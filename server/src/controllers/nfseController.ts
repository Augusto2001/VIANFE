import fs from 'fs';
import { emissionKey, officialNfse } from '../services/nfse/emissionSafety.js';
import { originalNfsePdf } from '../services/nfse/originalDocuments.js';
import path from 'path';
import { Request, Response } from 'express';
import { db } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import { salvadorNfseService } from '../services/salvadorNfseService.js';
import { salvadorRobotService } from '../services/salvadorRobotService.js';
import { NfseAdapterFactory } from '../services/nfse/NfseAdapterFactory.js';
import { decryptText } from '../utils/crypto.js';
import { nfsePdfGenerator } from '../services/nfsePdfGenerator.js';

// List of supported prefeituras
export const SUPPORTED_PREFEITURAS = [
  'Salvador',
  'Feira de Santana',
  'Lauro de Freitas',
  'São Gonçalo dos Campos',
  'Curitiba',
  'Portal Nacional ADN (nfse.gov.br)'
];

export interface ProcessNfseEmissionParams {
  company: any;
  optante_simples_nacional?: '1' | '2';
  operacao_padrao_confirmada?: boolean;
  prefeitura: string;
  tomador_cnpj: string;
  tomador_nome: string;
  valor_servicos: number;
  aliquota_iss?: number;
  discriminacao_servico: string;
  whatsapp_phone?: string;
  iss_retido?: boolean | number;
  item_servico?: string;
  numero_rps?: number | string;
  serie_rps?: string;
  provedor?: string;
  focus_nfe_token?: string;
  ambiente?: string;
  senha_prefeitura?: string;
  cnae?: string;
}

export interface ProcessNfseEmissionResult {
  id: string;
  numeroNfse: string;
  numeroRps: string;
  serieRps: string;
  codigoVerificacao: string;
  prefeitura: string;
  valorTotal: number;
  valorIss: number;
  issRetido: boolean;
  statusNfse: string;
  successMessage: string;
  pdfUrl: string;
  xmlUrl: string;
  pdfPath: string;
  xmlPath: string;
}

export async function processNfseEmissionCore(params: ProcessNfseEmissionParams): Promise<ProcessNfseEmissionResult> {
  const {company}=params;
  if (Number(company.emite_nfse)!==1) throw new Error('Empresa não habilitada para emissão de NFS-e.');
  const doc=String(params.tomador_cnpj || '').replace(/\D/g,'');
  const rate=params.aliquota_iss ?? company.nfse_aliquota_padrao;
  if (![11,14].includes(doc.length) || !params.tomador_nome?.trim() || !params.discriminacao_servico?.trim() || !Number.isFinite(Number(params.valor_servicos)) || Number(params.valor_servicos)<=0) throw new Error('Informe os dados reais do tomador, descrição e valor.');
  if (rate===null || rate===undefined || rate==='' || !Number.isFinite(Number(rate)) || Number(rate)<0 || Number(rate)>100) throw new Error('Informe a alíquota de ISS real.');
  const item=params.item_servico || company.item_servico_padrao;
  const cnae=params.cnae || company.cnae_padrao;
  if (!item || !cnae || !company.inscricao_municipal || !company.codigo_tributacao_municipio) throw new Error('Complete inscrição municipal, item de serviço, CNAE e código de tributação no cadastro.');
  // Other adapters still contain defaults without fiscal evidence. Fail before transmission.
  if (!/^salvador(?: \(webservice direto\))?$/i.test(params.prefeitura) || (params.provedor && params.provedor!=='webservice_direto')) throw new Error('Emissão disponível somente pelo webservice direto de Salvador; demais provedores aguardam validação.');
  if (!['1','2'].includes(String((params as any).optante_simples_nacional))) throw new Error('Informe se o prestador é optante pelo Simples Nacional.');
  if (params.operacao_padrao_confirmada!==true) throw new Error('Confirme tributação em Salvador, sem incentivo cultural, deduções, descontos ou outras retenções. Operações diferentes exigem parametrização específica.');
  if (params.iss_retido !== undefined && ![true,false,0,1].includes(params.iss_retido)) throw new Error('Retenção de ISS inválida.');
  if (!/^[A-Za-z0-9]{1,5}$/.test(String(params.serie_rps || company.serie_rps || '1'))) throw new Error('Série do RPS inválida.');
  if (!['producao','homologacao'].includes(params.ambiente || company.sefaz_ambiente)) throw new Error('Ambiente fiscal não configurado.');
  const key=emissionKey(company.id,params);
  db.exec(`CREATE TABLE IF NOT EXISTS nfse_emission_attempts (
    request_key TEXT PRIMARY KEY, company_id TEXT NOT NULL, rps TEXT NOT NULL,
    state TEXT NOT NULL, response_json TEXT, official_xml TEXT, created_at TEXT NOT NULL,
    UNIQUE(company_id,rps)
  )`);
  const previous=db.prepare('SELECT * FROM nfse_emission_attempts WHERE request_key=?').get(key) as any;
  if(previous){
    if(previous.state==='autorizada' && previous.response_json) return JSON.parse(previous.response_json);
    throw new Error('Pedido já transmitido ou em conferência. Consulte o RPS '+previous.rps+' antes de qualquer nova emissão.');
  }
  let rps=0;
  db.exec('BEGIN IMMEDIATE');
  try {
    const current=db.prepare('SELECT ultimo_rps_numero FROM companies WHERE id=?').get(company.id) as any;
    rps=params.numero_rps ? Number(params.numero_rps) : Number(current.ultimo_rps_numero || 0)+1;
    if(!Number.isSafeInteger(rps) || rps<=Number(current.ultimo_rps_numero || 0)) throw new Error('Número de RPS já utilizado ou inválido.');
    db.prepare('INSERT INTO nfse_emission_attempts(request_key,company_id,rps,state,created_at) VALUES(?,?,?,?,?)').run(key,company.id,String(rps),'em_conferencia',new Date().toISOString());
    db.prepare('UPDATE companies SET ultimo_rps_numero=? WHERE id=?').run(rps,company.id);
    db.exec('COMMIT');
  } catch(error) {db.exec('ROLLBACK');throw error;}
  const serie=String(params.serie_rps || company.serie_rps || '1');
  const result=await NfseAdapterFactory.getAdapter(params.prefeitura).emitir({
    company,numeroRps:String(rps),serieRps:serie,optanteSimplesNacional:(params as any).optante_simples_nacional,
    tomadorCnpjCpf:doc,tomadorNome:params.tomador_nome,valorServicos:Number(params.valor_servicos),
    aliquotaIss:Number(rate),issRetido:!!params.iss_retido,itemServico:item,cnae,
    codigoTributacaoMunicipio:company.codigo_tributacao_municipio,
    discriminacao:params.discriminacao_servico,ambiente:(params.ambiente || company.sefaz_ambiente) as any
  });
  db.prepare('UPDATE nfse_emission_attempts SET response_json=?, official_xml=? WHERE request_key=?').run(JSON.stringify(result),result.xmlRetorno || null,key);
  if(!result.success || result.status!=='autorizada') throw new Error('RPS '+rps+' sem autorização confirmada. '+result.mensagem);
  const official=officialNfse(result.xmlRetorno || '',{cnpj:company.cnpj,tomador:doc,valor:Number(params.valor_servicos)});
  const id=uuidv4();
  db.prepare(`INSERT INTO nfse_issued(id,company_id,prefeitura,numero_nfse,codigo_verificacao,prestador_cnpj,tomador_cnpj,tomador_nome,valor_servicos,aliquota_iss,valor_iss,discriminacao_servico,status,numero_rps,serie_rps,issued_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id,company.id,params.prefeitura,official.numero,official.codigo,company.cnpj,doc,official.tomador,official.valor,Number(rate),official.valorIss,official.descricao,'autorizada',String(rps),serie,official.data);
  const response:ProcessNfseEmissionResult={id,numeroNfse:official.numero,numeroRps:String(rps),serieRps:serie,codigoVerificacao:official.codigo,prefeitura:params.prefeitura,valorTotal:official.valor,valorIss:official.valorIss,issRetido:!!params.iss_retido,statusNfse:'autorizada',successMessage:'NFS-e autorizada; XML oficial conferido.',pdfUrl:`/api/portal/nfse/${id}/pdf`,xmlUrl:`/api/portal/nfse/${id}/xml`,pdfPath:'',xmlPath:''};
  db.prepare('UPDATE nfse_emission_attempts SET state=?,response_json=? WHERE request_key=?').run('autorizada',JSON.stringify(response),key);
  return response;
}

export const nfseController = {
  /**
   * Get all emitted NFS-e for a company
   */
  async getNfseList(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.query.company_id as string;
      if (!companyId) {
        res.status(400).json({ error: 'company_id é obrigatório' });
        return;
      }

      const rows = db.prepare('SELECT * FROM nfse_issued WHERE company_id = ? ORDER BY issued_at DESC').all(companyId);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Emit municipal NFS-e (Salvador, Feira, Lauro, S. Gonçalo, Curitiba, ADN)
   */
  async emitNfse(req: Request, res: Response): Promise<void> {
    try {
      const { 
        company_id, 
        prefeitura, 
        tomador_cnpj, 
        tomador_nome, 
        valor_servicos, 
        aliquota_iss, 
        discriminacao_servico,
        whatsapp_phone,
        iss_retido,
        item_servico,
        numero_rps,
        serie_rps,
        provedor,
        focus_nfe_token,
        ambiente,
        senha_prefeitura,
        cnae
      } = req.body;

      if (!company_id || !prefeitura || !tomador_cnpj || !tomador_nome || !valor_servicos || !discriminacao_servico) {
        res.status(400).json({ error: 'Todos os campos obrigatórios da NFS-e devem ser preenchidos.' });
        return;
      }

      const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(company_id) as any;
      if (!company) {
        res.status(404).json({ error: 'Empresa prestadora não encontrada.' });
        return;
      }

      const emissionResult = await processNfseEmissionCore({
        company,
        optante_simples_nacional: req.body.optante_simples_nacional,
        operacao_padrao_confirmada: req.body.operacao_padrao_confirmada,
        prefeitura,
        tomador_cnpj,
        tomador_nome,
        valor_servicos: Number(valor_servicos),
        aliquota_iss: aliquota_iss !== undefined && aliquota_iss !== '' ? Number(aliquota_iss) : undefined,
        discriminacao_servico,
        whatsapp_phone,
        iss_retido,
        item_servico,
        numero_rps,
        serie_rps,
        provedor,
        focus_nfe_token,
        ambiente,
        senha_prefeitura,
        cnae
      });

      res.status(201).json({
        message: emissionResult.successMessage,
        data: {
          id: emissionResult.id,
          numeroNfse: emissionResult.numeroNfse,
          numeroRps: emissionResult.numeroRps,
          serieRps: emissionResult.serieRps,
          codigoVerificacao: emissionResult.codigoVerificacao,
          prefeitura: emissionResult.prefeitura,
          valorTotal: emissionResult.valorTotal,
          valorIss: emissionResult.valorIss,
          issRetido: emissionResult.issRetido,
          whatsappSent: false,
        }
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  /**
   * Stream DANFSe PDF directly for download or WhatsApp media sending
   */
  /**
   * Stream DANFSe PDF directly for download or WhatsApp media sending
   */
  async getPdf(req: Request,res: Response): Promise<void> {
    try {
      const row=db.prepare('SELECT a.official_xml,c.cnpj FROM nfse_emission_attempts a JOIN companies c ON c.id=a.company_id WHERE a.state=? AND json_extract(a.response_json,\'$.id\')=?').get('autorizada',String(req.params.id)) as any;
      if(!row) {res.status(409).json({error:'XML oficial verificado indisponível. PDF não será reconstruído com dados presumidos.'});return;}
      officialNfse(row.official_xml,{cnpj:row.cnpj});
      res.type('application/pdf').send(await originalNfsePdf(row.official_xml));
    }catch(err:any){res.status(409).json({error:err.message});}
  },
  async getXml(req:Request,res:Response):Promise<void>{
    try {
      const row=db.prepare('SELECT a.official_xml,c.cnpj FROM nfse_emission_attempts a JOIN companies c ON c.id=a.company_id WHERE a.state=? AND json_extract(a.response_json,\'$.id\')=?').get('autorizada',String(req.params.id)) as any;
      if(!row){res.status(409).json({error:'XML oficial verificado indisponível. Solicite recuperação do original.'});return;}
      officialNfse(row.official_xml,{cnpj:row.cnpj});
      res.type('application/xml').send(row.official_xml);
    }catch(err:any){res.status(409).json({error:err.message});}
  },

  /**
   * List Recurring Clients (Tomadores Recorrentes)
   */
  async getRecurringClients(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.query.company_id as string;
      if (!companyId) {
        res.status(400).json({ error: 'company_id é obrigatório' });
        return;
      }

      const rows = db.prepare('SELECT * FROM nfse_recurring_clients WHERE company_id = ? ORDER BY razao_social ASC').all(companyId);
      res.json({ success: true, data: rows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Save / Create Recurring Client (Tomador)
   */
  async saveRecurringClient(req: Request, res: Response): Promise<void> {
    try {
      const { 
        company_id, cnpj_cpf, razao_social, email, telefone_whatsapp, 
        cep, logradouro, numero, complemento, bairro, municipio, uf,
        iss_retido, aliquota_iss, item_servico, discriminacao_padrao, valor_padrao 
      } = req.body;

      if (!company_id || !cnpj_cpf || !razao_social) {
        res.status(400).json({ error: 'company_id, cnpj_cpf e razao_social são obrigatórios.' });
        return;
      }

      const cleanDoc = cnpj_cpf.replace(/\D/g, '');
      const existing = db.prepare('SELECT id FROM nfse_recurring_clients WHERE company_id = ? AND cnpj_cpf = ?').get(company_id, cleanDoc) as any;

      if (existing) {
        db.prepare(`
          UPDATE nfse_recurring_clients SET
            razao_social = ?, email = ?, telefone_whatsapp = ?,
            cep = ?, logradouro = ?, numero = ?, complemento = ?, bairro = ?, municipio = ?, uf = ?,
            iss_retido = ?, aliquota_iss = ?, 
            item_servico = ?, discriminacao_padrao = ?, valor_padrao = ?
          WHERE id = ?
        `).run(
          razao_social.trim(),
          email || null,
          telefone_whatsapp || null,
          cep || null,
          logradouro || null,
          numero || null,
          complemento || null,
          bairro || null,
          municipio || null,
          uf || null,
          iss_retido ? 1 : 0,
          Number(aliquota_iss || 5.0),
          item_servico || null,
          discriminacao_padrao || null,
          Number(valor_padrao || 0),
          existing.id
        );
        res.json({ success: true, message: 'Tomador atualizado com sucesso!' });
      } else {
        const id = uuidv4();
        db.prepare(`
          INSERT INTO nfse_recurring_clients (
            id, company_id, cnpj_cpf, razao_social, email, telefone_whatsapp,
            cep, logradouro, numero, complemento, bairro, municipio, uf,
            iss_retido, aliquota_iss, item_servico, discriminacao_padrao, valor_padrao, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          id,
          company_id,
          cleanDoc,
          razao_social.trim(),
          email || null,
          telefone_whatsapp || null,
          cep || null,
          logradouro || null,
          numero || null,
          complemento || null,
          bairro || null,
          municipio || null,
          uf || null,
          iss_retido ? 1 : 0,
          Number(aliquota_iss || 5.0),
          item_servico || null,
          discriminacao_padrao || null,
          Number(valor_padrao || 0)
        );
        res.json({ success: true, message: 'Tomador cadastrado com sucesso!' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Delete Recurring Client
   */
  async deleteRecurringClient(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      db.prepare('DELETE FROM nfse_recurring_clients WHERE id = ?').run(id);
      res.json({ success: true, message: 'Tomador recorrente excluído com sucesso.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * n8n / ZapCont WhatsApp Webhook Endpoint (Auto-Match, Pure Commerce Check & Real Emission)
   */
  async handleWhatsappWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { 
        phone, 
        message, 
        tomador_cnpj, 
        tomador_nome, 
        valor, 
        servico, 
        company_cnpj, 
        prefeitura,
        numero_rps,
        serie_rps
      } = req.body;

      if (!phone) {
        res.status(400).json({ 
          status: 'error',
          error: 'Telefone do WhatsApp é obrigatório no webhook.' 
        });
        return;
      }

      // 1. Localiza a empresa prestadora
      let company: any = null;
      if (company_cnpj) {
        const cleanCnpj = company_cnpj.replace(/\D/g, '');
        company = db.prepare('SELECT * FROM companies WHERE cnpj = ?').get(cleanCnpj) as any;
      }
      if (!company) {
        res.status(404).json({ 
          status: 'error',
          error: 'Nenhuma empresa cadastrada no sistema.' 
        });
        return;
      }

      // 2. 🛡️ Bloqueio para Empresas de Comércio Puro (não emissoras de NFS-e)
      if (company.emite_nfse === 0 || company.emite_nfse === false || company.emite_nfse === '0') {
        res.status(400).json({
          status: 'error',
          error: `A empresa "${company.razao_social}" está cadastrada como Comércio Puro (não emissora de NFS-e). Emissão bloqueada.`,
          whatsappResponseText: `*Viviane:* Emissão não permitida.\n\nA empresa *${company.razao_social}* está cadastrada como *Comércio Puro* (não emissora de NFS-e). Para emitir notas de serviço, habilite a emissão no cadastro da empresa no ViaNFe.`
        });
        return;
      }

      // 3. Busca se o Tomador é um cliente recorrente cadastrado
      let recurringTomador: any = null;
      if (tomador_cnpj) {
        const cleanDoc = tomador_cnpj.replace(/\D/g, '');
        recurringTomador = db.prepare('SELECT * FROM nfse_recurring_clients WHERE company_id = ? AND cnpj_cpf = ?').get(company.id, cleanDoc) as any;
      }

      // Se encontrou cliente recorrente, aproveita os dados cadastrados
      const finalTomadorCnpj = recurringTomador?.cnpj_cpf || (tomador_cnpj ? tomador_cnpj.replace(/\D/g, '') : '');
      const finalTomadorNome = recurringTomador?.razao_social || tomador_nome || '';
      const finalValor = valor ? Number(valor) : (recurringTomador?.valor_padrao || 0);
      const finalServico = servico || recurringTomador?.discriminacao_padrao || '';
      const aliquotaIss = recurringTomador?.aliquota_iss ?? company.nfse_aliquota_padrao;
      const issRetido = recurringTomador?.iss_retido !== undefined ? recurringTomador.iss_retido : (company.nfse_iss_retido_padrao || 0);
      const pref = prefeitura || company.nfse_prefeitura_padrao || '';

      // 4. Validação Interativa: Se faltam dados cruciais, devolve pergunta para o ZapCont
      if (!finalTomadorCnpj || finalTomadorCnpj.length < 11) {
        res.json({
          status: 'missing_info',
          missingField: 'cnpj_cpf',
          whatsappResponseText: `*Viviane:*\n\nPara emitir sua NFS-e pela *${company.razao_social}*, por favor informe o *CNPJ ou CPF* do tomador do serviço.`
        });
        return;
      }

      if (!finalValor || finalValor <= 0) {
        res.json({
          status: 'missing_info',
          missingField: 'valor',
          tomadorIdentificado: finalTomadorNome || finalTomadorCnpj,
          whatsappResponseText: `*Viviane:*\n\nIdentificamos o cliente *${finalTomadorNome || finalTomadorCnpj}*.\nPor favor, informe o *valor total do serviço* (ex: 2500.00).`
        });
        return;
      }

      // 5. Executa emissão real e oficial através do pipeline completo (SalvadorNfseAdapter / Focus NFe)
      const emissionResult = await processNfseEmissionCore({
        company,
        optante_simples_nacional: req.body.optante_simples_nacional,
        operacao_padrao_confirmada: req.body.operacao_padrao_confirmada,
        prefeitura: pref,
        tomador_cnpj: finalTomadorCnpj,
        tomador_nome: finalTomadorNome || '',
        valor_servicos: finalValor,
        aliquota_iss: aliquotaIss,
        discriminacao_servico: finalServico,
        whatsapp_phone: phone,
        iss_retido: !!issRetido,
        item_servico: recurringTomador?.item_servico || company.item_servico_padrao,
        numero_rps,
        serie_rps
      });

      const host = req.get('host') || 'vianfe.contadordev.com.br';
      const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
      const baseUrl = `${protocol}://${host}`;
      const pdfDownloadUrl = `${baseUrl}/api/portal/nfse/${emissionResult.id}/pdf`;
      const xmlDownloadUrl = `${baseUrl}/api/portal/nfse/${emissionResult.id}/xml`;

      res.json({
        status: 'success',
        message: emissionResult.successMessage,
        whatsappResponseText: `*Viviane:* NFS-e autorizada com XML conferido.\n\n🏛️ *Prefeitura:* ${emissionResult.prefeitura}\n📄 *Número da Nota:* ${emissionResult.numeroNfse}\n🔢 *RPS:* Nº ${emissionResult.numeroRps} (Série ${emissionResult.serieRps})\n🔐 *Cód. Verificação:* ${emissionResult.codigoVerificacao}\n👤 *Tomador:* ${finalTomadorNome || finalTomadorCnpj}\n💰 *Valor Total:* R$ ${finalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n🛡️ *ISS:* ${issRetido ? 'RETIDO NA FONTE' : `R$ ${emissionResult.valorIss.toFixed(2)} (${aliquotaIss}%)`}\n📝 *Discriminação:* ${finalServico}\n\n📎 *A representação em PDF está disponível para download e visualização!*\n👉 *PDF:* ${pdfDownloadUrl}\n💾 *XML Oficial:* ${xmlDownloadUrl}\n\n_Emitido automaticamente via ZapCont & Viacont Fiscal._`,
        data: {
          id: emissionResult.id,
          numeroNfse: emissionResult.numeroNfse,
          numeroRps: emissionResult.numeroRps,
          serieRps: emissionResult.serieRps,
          codigoVerificacao: emissionResult.codigoVerificacao,
          prefeitura: emissionResult.prefeitura,
          pdfUrl: pdfDownloadUrl,
          xmlUrl: xmlDownloadUrl,
          mediaUrl: pdfDownloadUrl,
          mediaType: 'application/pdf',
          fileName: `DANFSE_${emissionResult.numeroNfse}.pdf`,
          xmlFileName: `NFSE_${emissionResult.numeroNfse}.xml`
        }
      });
    } catch (err: any) {
      console.error('❌ [WhatsApp Webhook NFS-e] Erro:', err.message);
      res.status(400).json({ 
        status: 'error',
        error: err.message,
        whatsappResponseText: `*Viviane:* Emissão não confirmada.\n\nNão foi possível emitir a nota fiscal.\n*Motivo:* ${err.message}\n\nConsulte o estado do RPS antes de tentar novamente.`
      });
    }
  },

  /**
   * Delete single NFS-e record (exclusão de testes)
   */
  async deleteNfse(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const nfse = db.prepare('SELECT id, numero_nfse FROM nfse_issued WHERE id = ?').get(id) as any;
      if (!nfse) {
        res.status(404).json({ error: 'NFS-e não encontrada.' });
        return;
      }

      db.prepare('DELETE FROM nfse_issued WHERE id = ?').run(id);
      res.json({ success: true, message: `NFS-e Nº ${nfse.numero_nfse} excluída com sucesso.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Get Focus NFe Configuration for company
   */
  async getFocusNfeConfig(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.query.company_id as string;
      if (!companyId) {
        res.status(400).json({ error: 'company_id é obrigatório' });
        return;
      }
      const company = db.prepare('SELECT focus_nfe_token, nfse_provedor FROM companies WHERE id = ?').get(companyId) as any;
      res.json({
        focus_nfe_token: company?.focus_nfe_token || process.env.FOCUS_NFE_TOKEN || '',
        nfse_provedor: company?.nfse_provedor || 'focus_nfe'
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Save Focus NFe Configuration for company
   */
  async saveFocusNfeConfig(req: Request, res: Response): Promise<void> {
    try {
      const { company_id, focus_nfe_token, nfse_provedor, ambiente } = req.body;
      if (!company_id) {
        res.status(400).json({ error: 'company_id é obrigatório' });
        return;
      }
      const tokenClean = focus_nfe_token ? String(focus_nfe_token).trim() : null;
      db.prepare(`
        UPDATE companies SET 
          focus_nfe_token = ?,
          nfse_provedor = ?,
          sefaz_ambiente = COALESCE(?, sefaz_ambiente),
          updated_at = datetime('now')
        WHERE id = ?
      `).run(tokenClean, nfse_provedor || 'focus_nfe', ambiente || null, company_id);

      res.json({ success: true, message: 'Configurações da Focus NFe salvas com sucesso!' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Sincronização Mensal Automática / Manual de NFS-e (Salvador ABRASF)
   */
  async syncMonthlyNfse(req: Request, res: Response): Promise<void> {
    try {
      const companyId = (req.body.company_id || req.body.companyId || req.query.company_id) as string;
      let ano = parseInt(String(req.body.ano || req.body.year || new Date().getFullYear()), 10);
      let mes = parseInt(String(req.body.mes || req.body.month || (new Date().getMonth() + 1)), 10);

      // Suporte para parâmetro "competencia" formato MM/AAAA ou MM.AAAA
      if (req.body.competencia) {
        const parts = String(req.body.competencia).replace('/', '.').split('.');
        if (parts.length === 2) {
          mes = parseInt(parts[0], 10);
          ano = parseInt(parts[1], 10);
        }
      }

      if (!companyId) {
        res.status(400).json({ error: 'company_id é obrigatório.' });
        return;
      }

      const { salvadorNfseMonthlyService } = await import('../services/salvadorNfseMonthlyService.js');
      const result = await salvadorNfseMonthlyService.syncMonthlyNfse(companyId, ano, mes);
      res.json(result);
    } catch (err: any) {
      console.error('❌ [NFS-e Controller] Erro na sincronização mensal:', err.message);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Stream do Relatório Oficial de Auditoria e Conferência Mensal em PDF
   */
  async getMonthlyReportPdf(req: Request, res: Response): Promise<void> {
    try {
      const companyId = String(req.params.companyId);
      const mesAno = String(req.params.mesAno);
      const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
      if (!company) {
        res.status(404).send('Empresa não encontrada.');
        return;
      }

      const cleanCnpj = (company.cnpj || '').replace(/\D/g, '');
      const [mesStr, anoStr] = mesAno.split('.');
      const reportPath = path.resolve(__dirname, `../../storage/exports/nfse/${cleanCnpj}/${anoStr}/${mesAno}/RELATORIO_CONFERENCIA_NFSE_${mesAno}.pdf`);

      if (fs.existsSync(reportPath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="RELATORIO_CONFERENCIA_NFSE_${cleanCnpj}_${mesAno}.pdf"`);
        const stream = fs.createReadStream(reportPath);
        stream.pipe(res);
        return;
      }

      // Se o relatório ainda não existir em disco, tenta sincronizar e gerar na hora
      const { salvadorNfseMonthlyService } = await import('../services/salvadorNfseMonthlyService.js');
      const syncRes = await salvadorNfseMonthlyService.syncMonthlyNfse(companyId, parseInt(anoStr, 10), parseInt(mesStr, 10));

      if (syncRes.arquivosGerados.relatorioConferenciaPdf && fs.existsSync(syncRes.arquivosGerados.relatorioConferenciaPdf)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="RELATORIO_CONFERENCIA_NFSE_${cleanCnpj}_${mesAno}.pdf"`);
        const stream = fs.createReadStream(syncRes.arquivosGerados.relatorioConferenciaPdf);
        stream.pipe(res);
      } else {
        res.status(404).send('Nenhum relatório de conferência disponível para esta competência.');
      }
    } catch (err: any) {
      res.status(500).send(`Erro ao gerar relatório de conferência: ${err.message}`);
    }
  },

  /**
   * Obter Resumo / Auditoria da Competência em JSON
   */
  async getMonthlySummary(req: Request, res: Response): Promise<void> {
    try {
      const companyId = String(req.params.companyId);
      const mesAno = String(req.params.mesAno);
      const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
      if (!company) {
        res.status(404).json({ error: 'Empresa não encontrada.' });
        return;
      }

      const [mesStr, anoStr] = mesAno.split('.');
      const startDate = `${anoStr}-${mesStr}-01`;
      const endDate = `${anoStr}-${mesStr}-31`;

      const invoices = db.prepare(`
        SELECT numero, data_emissao, emitente_nome, destinatario_nome, destinatario_cnpj, valor_total, status
        FROM invoices
        WHERE company_id = ? AND modelo = 'NFS-e' AND data_emissao >= ? AND data_emissao <= ?
        ORDER BY CAST(numero AS INTEGER) ASC
      `).all(companyId, startDate, endDate) as any[];

      const totalServicos = invoices.reduce((acc, inv) => acc + (inv.status !== 'cancelada' ? inv.valor_total : 0), 0);
      const canceladas = invoices.filter(inv => inv.status === 'cancelada').length;

      res.json({
        empresa: company.razao_social,
        cnpj: company.cnpj,
        cga: company.inscricao_municipal,
        competencia: mesAno,
        totalNotas: invoices.length,
        canceladas,
        totalServicos,
        primeiraNota: invoices.length > 0 ? invoices[0].numero : null,
        ultimaNota: invoices.length > 0 ? invoices[invoices.length - 1].numero : null,
        notas: invoices
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Varredura em Lote de todas as empresas ativas para uma competência
   */
  async batchSyncMonth(req: Request, res: Response): Promise<void> {
    try {
      let ano = parseInt(String(req.body.ano || new Date().getFullYear()), 10);
      let mes = parseInt(String(req.body.mes || new Date().getMonth() + 1), 10);

      const companies = db.prepare(`
        SELECT id, razao_social, cnpj, inscricao_municipal, cert_filename
        FROM companies
        WHERE status = 'ativo' AND emite_nfse = 1 AND cert_filename IS NOT NULL AND inscricao_municipal IS NOT NULL AND inscricao_municipal != ''
      `).all() as any[];

      const { salvadorNfseMonthlyService } = await import('../services/salvadorNfseMonthlyService.js');
      const results: any[] = [];

      for (const comp of companies) {
        try {
          const resSync = await salvadorNfseMonthlyService.syncMonthlyNfse(comp.id, ano, mes);
          results.push({ company: comp.razao_social, status: 'success', totalNotas: resSync.totalNotas });
        } catch (compErr: any) {
          results.push({ company: comp.razao_social, status: 'error', error: compErr.message });
        }
      }

      res.json({
        competencia: `${String(mes).padStart(2, '0')}.${ano}`,
        totalProcessadas: companies.length,
        resultados: results
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
};


