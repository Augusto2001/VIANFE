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
  protocolo_zapcont?: string;
  ambiente?: 'producao' | 'homologacao';
  tenant_id?: string;
}

export interface NfseOrderResult {
  sucesso: boolean;
  duplicado?: boolean;
  protocolo: string;
  status: 'AGUARDANDO_APROVACAO' | 'COM_IMPEDIMENTO' | 'PENDENTE_CONFERENCIA';
  mensagem: string;
  previa_pdf_path?: string;
  viaos_tarefa_id?: string;
  previa_anexada_viaos?: boolean;
  viaos_erro?: string;
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
    const ambiente = params.ambiente === 'homologacao' ? 'homologacao' : 'producao';
    const protocoloZapcont = params.protocolo_zapcont ? String(params.protocolo_zapcont).trim() : undefined;

    const ano = new Date().getFullYear();
    const seq = Math.floor(100000 + Math.random() * 900000);
    const protocolo = `NFSE-${ano}-${seq}`;
    const nowIso = new Date().toISOString();

    // 1. Localizar Empresa no ViaNFe (com escopo de tenant quando autenticado)
    const company = params.tenant_id
      ? (db.prepare('SELECT * FROM companies WHERE cnpj = ? AND tenant_id = ?').get(prestadorCnpj, params.tenant_id) as any)
      : (db.prepare('SELECT * FROM companies WHERE cnpj = ?').get(prestadorCnpj) as any);
    if (!company) {
      return {
        sucesso: false,
        protocolo,
        status: 'COM_IMPEDIMENTO',
        mensagem: `Empresa prestadora (CNPJ ${prestadorCnpj}) não cadastrada no ViaNFe.`,
        impedimento_motivo: 'PRESTADOR_NAO_CADASTRADO'
      };
    }

    // 1.5 Bloqueio determinístico de empresas não habilitadas para NFS-e (ex.: comércio puro emite_nfse = 0)
    if (Number(company.emite_nfse) !== 1) {
      const motivo = `Empresa ${company.razao_social} (CNPJ ${prestadorCnpj}) não está habilitada para emissão de NFS-e (emite_nfse = 0).`;
      return {
        sucesso: false,
        protocolo,
        status: 'COM_IMPEDIMENTO',
        mensagem: `Emissão de NFS-e bloqueada para ${company.razao_social}: empresa não habilitada para notas de serviço.`,
        impedimento_motivo: 'EMPRESA_NAO_HABILITADA_NFSE'
      };
    }

    // 2. Localizar Perfil Fiscal Parametrizado
    const profile = this.getProfileByCnpj(prestadorCnpj);
    if (!profile) {
      const motivo = `Cadastro fiscal de NFS-e ausente para ${company.razao_social} (CNPJ ${prestadorCnpj}). Necessário cadastrar código de tributação nacional e alíquota de ISS.`;

      const viaosRes = await this.notificarViaOS({
        empresaCnpj: prestadorCnpj,
        empresaNome: company.razao_social,
        titulo: `Parametrizar Perfil Fiscal NFS-e: ${company.razao_social}`,
        descricao:
          `Pedido de NFS-e recebido sem perfil fiscal configurado no ViaNFe.\n` +
          `Protocolo do Pedido: ${protocolo}\n` +
          (protocoloZapcont ? `Protocolo ZapCont: ${protocoloZapcont}\n` : '') +
          `Ambiente: ${ambiente.toUpperCase()}\n` +
          `Tomador: ${tomadorNome} (${tomadorDoc})\n` +
          `Valor: R$ ${valor.toFixed(2)}\n` +
          `Motivo: ${motivo}`,
        status: 'COM_IMPEDIMENTO',
        protocolo,
        protocoloZapcont
      });

      db.prepare(`
        INSERT INTO nfse_order_requests (
          id, protocolo, company_id, cnpj_prestador, tomador_doc, tomador_nome,
          valor_servicos, discriminacao, status, motivo_pendencia, viaos_tarefa_id,
          solicitante_telefone, solicitante_origem, ambiente, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COM_IMPEDIMENTO', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(), protocolo, company.id, prestadorCnpj, tomadorDoc, tomadorNome,
        valor, params.descricao || 'Serviços prestados', motivo, viaosRes.tarefaId || null,
        params.solicitante_telefone || null, params.solicitante_origem || 'viviane_whatsapp',
        ambiente, nowIso, nowIso
      );

      return {
        sucesso: true,
        protocolo,
        status: 'COM_IMPEDIMENTO',
        mensagem: `Pedido recebido (Protocolo ${protocolo}). Pendente de parametrização cadastral da equipe fiscal.`,
        viaos_tarefa_id: viaosRes.tarefaId,
        viaos_erro: viaosRes.erro,
        impedimento_motivo: motivo
      };
    }

    // 3. Validação de Limite de Valor por Nota (Regra de Segurança)
    if (valor > profile.limite_valor_nota) {
      const motivo = `Valor da NFS-e (R$ ${valor.toFixed(2)}) ultrapassa o limite máximo parametrizado para o cliente (R$ ${profile.limite_valor_nota.toFixed(2)}).`;

      const viaosRes = await this.notificarViaOS({
        empresaCnpj: prestadorCnpj,
        empresaNome: company.razao_social,
        titulo: `Alçada / Limite Excedido NFS-e: ${company.razao_social} – R$ ${valor.toFixed(2)}`,
        descricao:
          `Pedido de emissão com valor acima da trava de segurança.\n` +
          `Protocolo do Pedido: ${protocolo}\n` +
          (protocoloZapcont ? `Protocolo ZapCont: ${protocoloZapcont}\n` : '') +
          `Ambiente: ${ambiente.toUpperCase()}\n` +
          `Tomador: ${tomadorNome} (${tomadorDoc})\n` +
          `Valor Solicitado: R$ ${valor.toFixed(2)}\n` +
          `Limite Cadastrado: R$ ${profile.limite_valor_nota.toFixed(2)}`,
        status: 'COM_IMPEDIMENTO',
        protocolo,
        protocoloZapcont
      });

      db.prepare(`
        INSERT INTO nfse_order_requests (
          id, protocolo, company_id, cnpj_prestador, tomador_doc, tomador_nome,
          valor_servicos, discriminacao, status, motivo_pendencia, viaos_tarefa_id,
          solicitante_telefone, solicitante_origem, ambiente, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COM_IMPEDIMENTO', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(), protocolo, company.id, prestadorCnpj, tomadorDoc, tomadorNome,
        valor, params.descricao || profile.descricao_servico_padrao || 'Serviços prestados', motivo, viaosRes.tarefaId || null,
        params.solicitante_telefone || null, params.solicitante_origem || 'viviane_whatsapp',
        ambiente, nowIso, nowIso
      );

      return {
        sucesso: true,
        protocolo,
        status: 'COM_IMPEDIMENTO',
        mensagem: `Pedido recebido (Protocolo ${protocolo}). Valor excede o limite cadastrado e foi encaminhado para deliberação da Diretoria.`,
        viaos_tarefa_id: viaosRes.tarefaId,
        viaos_erro: viaosRes.erro,
        impedimento_motivo: motivo
      };
    }

    // 4. Verificação de Nota Repetida no Mesmo Dia (Bloqueio anti-duplicidade — nunca retransmite)
    const hojeStr = nowIso.split('T')[0];
    const duplicada = db.prepare(`
      SELECT protocolo, status, viaos_tarefa_id FROM nfse_order_requests
      WHERE cnpj_prestador = ? AND tomador_doc = ? AND valor_servicos = ?
        AND substr(created_at, 1, 10) = ? AND status NOT IN ('REJEITADO', 'CANCELADO')
      ORDER BY created_at DESC LIMIT 1
    `).get(prestadorCnpj, tomadorDoc, valor, hojeStr) as any;

    if (duplicada) {
      console.warn(`[NfseOrder] Bloqueio anti-duplicidade: pedido já existe hoje (${duplicada.protocolo}) para ${prestadorCnpj} - ${tomadorDoc} - R$ ${valor}`);
      return {
        sucesso: false,
        duplicado: true,
        protocolo: duplicada.protocolo,
        status: duplicada.status || 'AGUARDANDO_APROVACAO',
        viaos_tarefa_id: duplicada.viaos_tarefa_id || undefined,
        impedimento_motivo: 'PEDIDO_DUPLICADO_MESMO_DIA',
        mensagem: `Alerta de duplicidade: já existe pedido idêntico registrado hoje (Protocolo ${duplicada.protocolo}). Nenhuma nova prévia ou transmissão foi disparada.`
      };
    }

    // 5. Construir Dados e Gerar a Prévia da DPS (sem transmitir à prefeitura / Portal Nacional)
    const discriminacaoFinal = params.descricao && params.descricao.trim()
      ? params.descricao.trim()
      : (profile.descricao_servico_padrao || 'Prestação de serviços');

    const aliquota = Number(profile.aliquota_iss || 5.0);
    const valorIss = Number((valor * (aliquota / 100)).toFixed(2));
    const previaFileName = `PREVIA_NFSE_${protocolo}.pdf`;
    const previaPath = path.join(this.STORAGE_PDFS, previaFileName);

    const itemServicoLabel = profile.codigo_tributacao_nacional
      ? `${profile.item_servico_lc116} / Cód. Trib.: ${profile.codigo_tributacao_nacional}`
      : profile.item_servico_lc116;

    await nfsePdfGenerator.generateDanfsePdf({
      numero: protocolo,
      dataEmissao: nowIso,
      prestadorNome: company.razao_social,
      prestadorCnpj: prestadorCnpj,
      prestadorCga: company.inscricao_municipal || undefined,
      prestadorMunicipio: company.nfse_prefeitura_padrao || 'Salvador',
      prestadorUf: company.uf || 'BA',
      tomadorNome: tomadorNome,
      tomadorDoc: tomadorDoc,
      valorServicos: valor,
      aliquota: aliquota,
      valorIss: valorIss,
      issRetido: Boolean(profile.iss_retido),
      discriminacao: discriminacaoFinal,
      itemServico: itemServicoLabel,
      competencia: `${nowIso.slice(5, 7)}/${nowIso.slice(0, 4)}`,
      isPrevia: true
    }, previaPath);

    // 6. Criar Tarefa no ViaOS para Conferência e Aprovação da Diretoria (Augusto ou Val)
    const valorFmt = valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const tituloTarefa = `Emitir NFS-e – ${company.razao_social} – ${tomadorNome} – R$ ${valorFmt}`;
    const descTarefa =
      `PEDIDO DE EMISSÃO DE NFS-E (${ambiente === 'homologacao' ? 'HOMOLOGAÇÃO — NÃO EMITIR' : 'AGUARDANDO CONFERÊNCIA'})\n` +
      `Protocolo do Pedido: ${protocolo}\n` +
      (protocoloZapcont ? `Protocolo ZapCont: ${protocoloZapcont}\n` : '') +
      `Prestador: ${company.razao_social} (CNPJ ${prestadorCnpj})\n` +
      `Tomador: ${tomadorNome} (Doc: ${tomadorDoc})\n` +
      `Valor: R$ ${valorFmt}\n` +
      `Serviço: ${itemServicoLabel} — ${discriminacaoFinal}\n` +
      `Alíquota ISS: ${aliquota}% (${profile.iss_retido ? 'ISS Retido' : 'ISS Não Retido'})\n` +
      `Ambiente: ${ambiente.toUpperCase()}\n\n` +
      `PRÉVIA GERADA E ANEXADA (SEM VALOR FISCAL / NÃO TRANSMITIDA). Conferência e aprovação exclusivas da Diretoria (Augusto ou Val).`;

    const viaosRes = await this.notificarViaOS({
      empresaCnpj: prestadorCnpj,
      empresaNome: company.razao_social,
      titulo: tituloTarefa,
      descricao: descTarefa,
      status: 'AGUARDANDO_APROVACAO',
      protocolo,
      protocoloZapcont,
      anexoPreviaPath: previaPath,
      anexoPreviaNome: previaFileName
    });

    // 7. Salvar Pedido no Banco de Dados (nunca grava ID sintético falso do ViaOS)
    const orderId = uuidv4();
    db.prepare(`
      INSERT INTO nfse_order_requests (
        id, protocolo, company_id, cnpj_prestador, tomador_doc, tomador_nome,
        valor_servicos, discriminacao, status, previa_pdf_path, viaos_tarefa_id,
        solicitante_telefone, solicitante_origem, ambiente, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AGUARDANDO_APROVACAO', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId, protocolo, company.id, prestadorCnpj, tomadorDoc, tomadorNome,
      valor, discriminacaoFinal, previaPath, viaosRes.tarefaId || null,
      params.solicitante_telefone || null, params.solicitante_origem || 'viviane_whatsapp',
      ambiente, nowIso, nowIso
    );

    return {
      sucesso: true,
      protocolo,
      status: 'AGUARDANDO_APROVACAO',
      mensagem: viaosRes.tarefaId
        ? `Pedido de NFS-e recebido (Protocolo ${protocolo}). Prévia gerada (sem transmissão) e tarefa criada para conferência.`
        : `Pedido de NFS-e recebido (Protocolo ${protocolo}). Prévia gerada (sem transmissão); aviso pendente de sincronização externa.`,
      previa_pdf_path: previaPath,
      viaos_tarefa_id: viaosRes.tarefaId,
      previa_anexada_viaos: viaosRes.anexado,
      viaos_erro: viaosRes.erro
    };
  }

  /**
   * Integração autenticada com a API do ViaOS para criação real da tarefa AGUARDANDO_APROVACAO + upload da prévia PDF
   */
  private static async notificarViaOS(dados: {
    empresaCnpj: string;
    empresaNome: string;
    titulo: string;
    descricao: string;
    status: string;
    protocolo: string;
    protocoloZapcont?: string;
    anexoPreviaPath?: string;
    anexoPreviaNome?: string;
  }): Promise<{ tarefaId?: string; anexado: boolean; erro?: string }> {
    const viaosUrl = (process.env.VIAOS_API_URL || 'http://viaos:3333').replace(/\/+$/, '');
    const viaosJwtSecret = (process.env.VIAOS_JWT_SECRET || '').trim();

    if (!viaosJwtSecret) {
      const msg = 'VIAOS_JWT_SECRET não configurado no ambiente do ViaNFe.';
      console.warn('[ViaNFe -> ViaOS]', msg);
      return { tarefaId: undefined, anexado: false, erro: msg };
    }

    const token = jwt.sign(
      {
        id: 999,
        nome: 'ViaNFe (Prévia Automática)',
        email: 'atendimento@viacont.com.br',
        cargo: 'SISTEMA',
        perfil: 'operacional',
        master: false
      },
      viaosJwtSecret,
      { expiresIn: '10m' }
    );

    const authHeaders = {
      Authorization: `Bearer ${token}`
    };

    try {
      // 1. Resolver empresa_id canônico no ViaOS pelo CNPJ
      const empRes = await fetch(`${viaosUrl}/api/tarefas/meta/empresas`, {
        method: 'GET',
        headers: authHeaders
      });
      if (!empRes.ok) {
        const msg = `Falha ao consultar empresas no ViaOS (HTTP ${empRes.status}).`;
        console.warn('[ViaNFe -> ViaOS]', msg);
        return { tarefaId: undefined, anexado: false, erro: msg };
      }
      const empJson = await empRes.json() as any;
      const listaEmpresas = Array.isArray(empJson?.dados) ? empJson.dados : [];
      const cnpjAlvo = cleanNumeric(dados.empresaCnpj);
      const empresaViaOS = listaEmpresas.find((e: any) => cleanNumeric(e.cnpj) === cnpjAlvo);

      if (!empresaViaOS || !empresaViaOS.id) {
        const msg = `Empresa CNPJ ${cnpjAlvo} não localizada no catálogo do ViaOS.`;
        console.warn('[ViaNFe -> ViaOS]', msg);
        return { tarefaId: undefined, anexado: false, erro: msg };
      }

      const nowIso = new Date().toISOString();
      const competencia = nowIso.slice(0, 7); // AAAA-MM

      const payload = {
        tipo: 'AVULSA',
        departamento: 'FISCAL',
        empresa_id: empresaViaOS.id,
        titulo: dados.titulo,
        descricao: dados.descricao,
        competencia,
        status: dados.status || 'AGUARDANDO_APROVACAO',
        origem_criacao: 'VIANFE',
        criado_por: 'ViaNFe (Motor de Pedidos)',
        protocolo_atendimento: dados.protocoloZapcont || dados.protocolo,
        itens_checklist: [
          { passo: 1, item: '1. Conferir Tomador, Valor, Discriminação e Tributos na Prévia da NFS-e', tipo_etapa: 'OPERACIONAL', obrigatorio: true },
          { passo: 2, item: '2. Aprovar Emissão Oficial (Alçada Diretoria: Augusto ou Val)', tipo_etapa: 'APROVACAO', obrigatorio: true }
        ]
      };

      // 2. Criar tarefa real no ViaOS (sem concluir nem liberar)
      const createRes = await fetch(`${viaosUrl}/api/tarefas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify(payload)
      });

      const createJson = await createRes.json().catch(() => ({})) as any;
      if (!createRes.ok || !createJson?.sucesso || !createJson?.tarefa?.id) {
        const msg = `ViaOS recusou criação da tarefa (HTTP ${createRes.status}): ${createJson?.erro || 'resposta inválida'}`;
        console.warn('[ViaNFe -> ViaOS]', msg);
        return { tarefaId: undefined, anexado: false, erro: msg };
      }

      const tarefaId = String(createJson.tarefa.id);
      let anexado = false;

      // 3. Upload real do arquivo PDF da prévia para a tarefa criada
      if (dados.anexoPreviaPath && fs.existsSync(dados.anexoPreviaPath)) {
        try {
          const pdfBuffer = fs.readFileSync(dados.anexoPreviaPath);
          const form = new FormData();
          const nomeArquivo = dados.anexoPreviaNome || `PREVIA_NFSE_${dados.protocolo}.pdf`;
          form.append('arquivo', new Blob([pdfBuffer], { type: 'application/pdf' }), nomeArquivo);
          form.append(
            'legenda',
            `Prévia automática da NFS-e (${dados.protocolo}) — documento não transmitido.` +
            (dados.protocoloZapcont ? ` Protocolo ZapCont: ${dados.protocoloZapcont}.` : '')
          );

          const upRes = await fetch(`${viaosUrl}/api/tarefas/${encodeURIComponent(tarefaId)}/historico/anexos`, {
            method: 'POST',
            headers: authHeaders,
            body: form
          });
          anexado = upRes.ok;
          if (!upRes.ok) {
            const upErr = await upRes.text().catch(() => '');
            console.warn(`[ViaNFe -> ViaOS] Tarefa ${tarefaId} criada, mas upload da prévia falhou (HTTP ${upRes.status}): ${upErr.slice(0, 200)}`);
          }
        } catch (upEx: any) {
          console.warn(`[ViaNFe -> ViaOS] Tarefa ${tarefaId} criada, erro ao anexar prévia:`, upEx.message);
        }
      }

      return { tarefaId, anexado };
    } catch (err: any) {
      const msg = err?.message || 'Erro de rede ao conectar no ViaOS';
      console.warn('[ViaNFe -> ViaOS] Aviso ao criar tarefa remota no ViaOS:', msg);
      return { tarefaId: undefined, anexado: false, erro: msg };
    }
  }
}
