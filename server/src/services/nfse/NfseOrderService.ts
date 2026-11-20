import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { db } from '../../database/db.js';
import { nfsePdfGenerator } from '../nfsePdfGenerator.js';
import { cleanNumeric } from '../../utils/crypto.js';

export interface ClientNfseProfile {
  id: string;
  company_id: string;
  tenant_id: string;
  cnpj_prestador: string;
  item_servico_lc116: string;
  codigo_tributacao_nacional: string;
  aliquota_iss: number;
  iss_retido: number;
  codigo_municipio_padrao: string;
  descricao_servico_padrao: string;
  limite_valor_nota: number;
  optante_simples_nacional: string;
  exige_aprovacao_viaos: number;
  ativo: number;
  created_at: string;
  updated_at: string;
}

export interface NfseOrderParams {
  cnpj_prestador: string;
  tomador_doc: string;
  tomador_nome: string;
  valor_servicos: number;
  descricao?: string;
  solicitante_telefone?: string;
  solicitante_origem?: 'viviane_whatsapp' | 'portal' | 'manual';
  ambiente?: 'producao' | 'homologacao';
}

export interface NfseOrderResult {
  sucesso: boolean;
  protocolo: string;
  status: 'AGUARDANDO_APROVACAO' | 'COM_IMPEDIMENTO' | 'PENDENTE_CONFERENCIA';
  mensagem: string;
  previa_pdf_path?: string;
  viaos_tarefa_id?: string;
  impedimento_motivo?: string;
}

export class NfseOrderService {
  private static readonly STORAGE_PDFS = path.resolve(process.cwd(), 'server/storage/pdfs');

  private static ensureStorageDir() {
    if (!fs.existsSync(this.STORAGE_PDFS)) {
      fs.mkdirSync(this.STORAGE_PDFS, { recursive: true });
    }
  }

  /**
   * Consulta perfil fiscal do cliente pelo CNPJ
   */
  public static getProfileByCnpj(cnpj: string): ClientNfseProfile | null {
    const cleanCnpj = cleanNumeric(cnpj);
    const row = db.prepare('SELECT * FROM client_nfse_profiles WHERE cnpj_prestador = ? AND ativo = 1').get(cleanCnpj) as any;
    return row || null;
  }

  /**
   * Salva ou atualiza perfil fiscal do cliente
   */
  public static saveProfile(data: Partial<ClientNfseProfile> & { cnpj_prestador: string; company_id: string }): ClientNfseProfile {
    const cleanCnpj = cleanNumeric(data.cnpj_prestador);
    const existing = this.getProfileByCnpj(cleanCnpj);
    const now = new Date().toISOString();

    if (existing) {
      db.prepare(`
        UPDATE client_nfse_profiles
        SET item_servico_lc116 = COALESCE(?, item_servico_lc116),
            codigo_tributacao_nacional = COALESCE(?, codigo_tributacao_nacional),
            aliquota_iss = COALESCE(?, aliquota_iss),
            iss_retido = COALESCE(?, iss_retido),
            codigo_municipio_padrao = COALESCE(?, codigo_municipio_padrao),
            descricao_servico_padrao = COALESCE(?, descricao_servico_padrao),
            limite_valor_nota = COALESCE(?, limite_valor_nota),
            optante_simples_nacional = COALESCE(?, optante_simples_nacional),
            exige_aprovacao_viaos = COALESCE(?, exige_aprovacao_viaos),
            ativo = COALESCE(?, ativo),
            updated_at = ?
        WHERE id = ?
      `).run(
        data.item_servico_lc116 || null,
        data.codigo_tributacao_nacional || null,
        data.aliquota_iss !== undefined ? Number(data.aliquota_iss) : null,
        data.iss_retido !== undefined ? Number(data.iss_retido) : null,
        data.codigo_municipio_padrao || null,
        data.descricao_servico_padrao || null,
        data.limite_valor_nota !== undefined ? Number(data.limite_valor_nota) : null,
        data.optante_simples_nacional || null,
        data.exige_aprovacao_viaos !== undefined ? Number(data.exige_aprovacao_viaos) : null,
        data.ativo !== undefined ? Number(data.ativo) : null,
        now,
        existing.id
      );
      return this.getProfileByCnpj(cleanCnpj)!;
    } else {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO client_nfse_profiles (
          id, company_id, tenant_id, cnpj_prestador, item_servico_lc116,
          codigo_tributacao_nacional, aliquota_iss, iss_retido, codigo_municipio_padrao,
          descricao_servico_padrao, limite_valor_nota, optante_simples_nacional,
          exige_aprovacao_viaos, ativo, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        id,
        data.company_id,
        data.tenant_id || 'tenant_viacont_master',
        cleanCnpj,
        data.item_servico_lc116 || '17.01',
        data.codigo_tributacao_nacional || '170101',
        data.aliquota_iss !== undefined ? Number(data.aliquota_iss) : 5.0,
        data.iss_retido !== undefined ? Number(data.iss_retido) : 0,
        data.codigo_municipio_padrao || '2927408',
        data.descricao_servico_padrao || 'Prestação de serviços contábeis e administrativos',
        data.limite_valor_nota !== undefined ? Number(data.limite_valor_nota) : 50000.0,
        data.optante_simples_nacional || '1',
        data.exige_aprovacao_viaos !== undefined ? Number(data.exige_aprovacao_viaos) : 1,
        now,
        now
      );
      return this.getProfileByCnpj(cleanCnpj)!;
    }
  }

  /**
   * Processa o pedido de emissão de NFS-e (recebido da Viviane/WhatsApp ou Portal)
   * Determinístico: aplica regras do cliente, valida limites, gera prévia e abre tarefa no ViaOS.
   */
  public static async processOrder(params: NfseOrderParams): Promise<NfseOrderResult> {
    this.ensureStorageDir();

    const prestadorCnpj = cleanNumeric(params.cnpj_prestador);
    const tomadorDoc = cleanNumeric(params.tomador_doc);
    const tomadorNome = String(params.tomador_nome || '').trim();
    const valor = Number(params.valor_servicos || 0);

    const ano = new Date().getFullYear();
    const seq = Math.floor(100000 + Math.random() * 900000);
    const protocolo = `NFSE-${ano}-${seq}`;
    const nowIso = new Date().toISOString();

    // 1. Localizar Empresa no ViaNFe
    const company = db.prepare('SELECT * FROM companies WHERE cnpj = ?').get(prestadorCnpj) as any;
    if (!company) {
      return {
        sucesso: false,
        protocolo,
        status: 'COM_IMPEDIMENTO',
        mensagem: `Empresa prestadora (CNPJ ${prestadorCnpj}) não cadastrada no ViaNFe.`,
        impedimento_motivo: 'PRESTADOR_NAO_CADASTRADO'
      };
    }

    // 2. Localizar Perfil Fiscal Parametrizado
    const profile = this.getProfileByCnpj(prestadorCnpj);
    if (!profile) {
      const motivo = `Cadastro fiscal de NFS-e ausente para ${company.razao_social} (CNPJ ${prestadorCnpj}). Necessário cadastrar código de tributação nacional e alíquota de ISS.`;
      
      db.prepare(`
        INSERT INTO nfse_order_requests (
          id, protocolo, company_id, cnpj_prestador, tomador_doc, tomador_nome,
          valor_servicos, discriminacao, status, motivo_pendencia,
          solicitante_telefone, solicitante_origem, ambiente, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COM_IMPEDIMENTO', ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(), protocolo, company.id, prestadorCnpj, tomadorDoc, tomadorNome,
        valor, params.descricao || 'Serviços prestados', motivo,
        params.solicitante_telefone || null, params.solicitante_origem || 'viviane_whatsapp',
        params.ambiente || 'producao', nowIso, nowIso
      );

      // Criar tarefa de impedimento no ViaOS para a equipe cadastrar
      const tarefaId = await this.notificarViaOS({
        empresaCnpj: prestadorCnpj,
        empresaNome: company.razao_social,
        titulo: `Parametrizar Perfil Fiscal NFS-e: ${company.razao_social}`,
        descricao: `O cliente solicitou emissão de NFS-e via Viviane (Protocolo ${protocolo}), mas ainda não possui perfil fiscal configurado no ViaNFe.\n\nTomador: ${tomadorNome} (${tomadorDoc})\nValor: R$ ${valor.toFixed(2)}\nMotivo: ${motivo}`,
        status: 'COM_IMPEDIMENTO',
        protocolo
      });

      return {
        sucesso: true,
        protocolo,
        status: 'COM_IMPEDIMENTO',
        mensagem: `Pedido recebido (Protocolo ${protocolo}). Pendente de parametrização cadastral da equipe fiscal no ViaOS.`,
        viaos_tarefa_id: tarefaId,
        impedimento_motivo: motivo
      };
    }

    // 3. Validação de Limite de Valor por Nota (Regra de Segurança)
    if (valor > profile.limite_valor_nota) {
      const motivo = `Valor da NFS-e (R$ ${valor.toFixed(2)}) ultrapassa o limite máximo parametrizado para o cliente (R$ ${profile.limite_valor_nota.toFixed(2)}).`;
      
      const tarefaId = await this.notificarViaOS({
        empresaCnpj: prestadorCnpj,
        empresaNome: company.razao_social,
        titulo: `Alçada / Limite Excedido NFS-e: ${company.razao_social} – R$ ${valor.toFixed(2)}`,
        descricao: `Pedido de emissão com valor acima da trava de segurança.\n\nTomador: ${tomadorNome} (${tomadorDoc})\nValor Solicitado: R$ ${valor.toFixed(2)}\nLimite Cadastrado: R$ ${profile.limite_valor_nota.toFixed(2)}\nProtocolo: ${protocolo}`,
        status: 'COM_IMPEDIMENTO',
        protocolo
      });

      return {
        sucesso: true,
        protocolo,
        status: 'COM_IMPEDIMENTO',
        mensagem: `Pedido recebido (Protocolo ${protocolo}). Valor excede o limite cadastrado e foi encaminhado para deliberação da Diretoria no ViaOS.`,
        viaos_tarefa_id: tarefaId,
        impedimento_motivo: motivo
      };
    }

    // 4. Verificação de Nota Repetida no Mesmo Dia
    const hojeStr = nowIso.split('T')[0];
    const duplicada = db.prepare(`
      SELECT protocolo FROM nfse_order_requests
      WHERE cnpj_prestador = ? AND tomador_doc = ? AND valor_servicos = ? AND created_at LIKE ? AND status != 'REJEITADO'
    `).get(prestadorCnpj, tomadorDoc, valor, `${hojeStr}%`) as any;

    if (duplicada) {
      console.warn(`[NfseOrder] Alerta: Pedido duplicado detectado para ${prestadorCnpj} - ${tomadorDoc} - R$ ${valor}`);
    }

    // 5. Construir Dados e Gerar a Prévia da DPS (sem transmitir)
    const discriminacaoFinal = params.descricao && params.descricao.trim()
      ? params.descricao.trim()
      : (profile.descricao_servico_padrao || 'Prestação de serviços');

    const aliquota = Number(profile.aliquota_iss || 5.0);
    const valorIss = Number((valor * (aliquota / 100)).toFixed(2));
    const previaFileName = `PREVIA_NFSE_${protocolo}.pdf`;
    const previaPath = path.join(this.STORAGE_PDFS, previaFileName);

    await nfsePdfGenerator.generateDanfsePdf({
      numero: `DPS-${seq}`,
      dataEmissao: nowIso,
      prestadorNome: company.razao_social,
      prestadorCnpj: prestadorCnpj,
      prestadorMunicipio: 'Salvador',
      prestadorUf: company.uf || 'BA',
      tomadorNome: tomadorNome,
      tomadorDoc: tomadorDoc,
      valorServicos: valor,
      aliquota: aliquota,
      valorIss: valorIss,
      issRetido: Boolean(profile.iss_retido),
      discriminacao: discriminacaoFinal,
      itemServico: profile.codigo_tributacao_nacional || profile.item_servico_lc116,
      competencia: `${nowIso.slice(5, 7)}/${nowIso.slice(0, 4)}`,
      isPrevia: true
    }, previaPath);

    // 6. Criar Tarefa no ViaOS para Conferência e Aprovação da Equipe
    const tituloTarefa = `Emitir NFS-e – ${company.razao_social} – ${tomadorNome} – R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const descTarefa = `PEDIDO DE EMISSÃO DE NFS-E RECEBIDO VIA WHATSAPP (VIVIANE)\n` +
      `Protocolo: ${protocolo}\n` +
      `Prestador: ${company.razao_social} (${prestadorCnpj})\n` +
      `Tomador: ${tomadorNome} (Doc: ${tomadorDoc})\n` +
      `Valor: R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `Serviço: ${profile.codigo_tributacao_nacional} - ${discriminacaoFinal}\n` +
      `Alíquota ISS: ${aliquota}% (${profile.iss_retido ? 'ISS Retido' : 'ISS Devido no Simples'})\n\n` +
      `PRÉVIA GERADA E ANEXADA. A equipe/diretoria deve conferir os dados nos slots e aprovar para disparar a emissão oficial no Portal Nacional ADN.`;

    const tarefaId = await this.notificarViaOS({
      empresaCnpj: prestadorCnpj,
      empresaNome: company.razao_social,
      titulo: tituloTarefa,
      descricao: descTarefa,
      status: 'AGUARDANDO_APROVACAO',
      protocolo,
      anexoPreviaPath: previaPath,
      anexoPreviaNome: previaFileName
    });

    // 7. Salvar Pedido no Banco de Dados
    const orderId = uuidv4();
    db.prepare(`
      INSERT INTO nfse_order_requests (
        id, protocolo, company_id, cnpj_prestador, tomador_doc, tomador_nome,
        valor_servicos, discriminacao, status, previa_pdf_path, viaos_tarefa_id,
        solicitante_telefone, solicitante_origem, ambiente, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AGUARDANDO_APROVACAO', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId, protocolo, company.id, prestadorCnpj, tomadorDoc, tomadorNome,
      valor, discriminacaoFinal, previaPath, tarefaId,
      params.solicitante_telefone || null, params.solicitante_origem || 'viviane_whatsapp',
      params.ambiente || 'producao', nowIso, nowIso
    );

    return {
      sucesso: true,
      protocolo,
      status: 'AGUARDANDO_APROVACAO',
      mensagem: `Pedido de NFS-e recebido com sucesso (Protocolo ${protocolo}). Prévia gerada com tarja oficial e encaminhada para conferência da equipe no ViaOS.`,
      previa_pdf_path: previaPath,
      viaos_tarefa_id: tarefaId
    };
  }

  /**
   * Integração com a API do ViaOS para criação da tarefa de conferência
   */
  private static async notificarViaOS(dados: {
    empresaCnpj: string;
    empresaNome: string;
    titulo: string;
    descricao: string;
    status: string;
    protocolo: string;
    anexoPreviaPath?: string;
    anexoPreviaNome?: string;
  }): Promise<string> {
    const viaosUrl = process.env.VIAOS_API_URL || 'http://127.0.0.1:3333';
    const jwtSecret = process.env.JWT_SECRET || 'U8gtlNFYYeeu2ekI0VTk2HGrioyGEUVpRNkumz5IcizqHGObhQSRB2NFgGJ39R1J';
    const token = jwt.sign(
      { id: 999, nome: 'ViaNFe Robô Emissor', cargo: 'SISTEMA', master: true, perfil: 'master' },
      jwtSecret,
      { expiresIn: '1h' }
    );

    let docAnexado = [];
    if (dados.anexoPreviaPath && fs.existsSync(dados.anexoPreviaPath)) {
      docAnexado.push({
        id: `DOC-PREVIA-${dados.protocolo}`,
        nome: dados.anexoPreviaNome || 'PREVIA_NFSE.pdf',
        caminho: dados.anexoPreviaPath,
        tipo: 'PREVIA_NFSE',
        tamanho: fs.statSync(dados.anexoPreviaPath).size,
        data: new Date().toLocaleString('pt-BR'),
        anexado_por: 'ViaNFe (Prévia Automática)'
      });
    }

    const payload = {
      titulo: dados.titulo,
      descricao: dados.descricao,
      empresa_cnpj: dados.empresaCnpj,
      empresa_nome: dados.empresaNome,
      departamento: 'FISCAL',
      status: dados.status || 'AGUARDANDO_APROVACAO',
      protocolo: dados.protocolo,
      origem_criacao: 'VIANFE',
      documentos_anexados: docAnexado,
      checklist: [
        { passo: 1, item: '1. Conferir Tomador, Valor e Retenções na Prévia da NFS-e', tipo_etapa: 'OPERACIONAL', obrigatorio: true },
        { passo: 2, item: '2. Homologar Emissão Oficial no Portal Nacional ADN (Diretoria/Alçada)', tipo_etapa: 'APROVACAO', obrigatorio: true }
      ]
    };

    try {
      const response = await fetch(`${viaosUrl}/api/tarefas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const resJson = await response.json() as any;
      if (resJson.sucesso && resJson.tarefa?.id) {
        return resJson.tarefa.id;
      }
      return resJson.tarefa?.id || `VO-${dados.protocolo}`;
    } catch (err: any) {
      console.warn('[ViaNFe -> ViaOS] Aviso ao criar tarefa remota no ViaOS:', err.message);
      return `VO-${dados.protocolo}`;
    }
  }
}
