import { Request, Response } from 'express';
import fs from 'fs';
import { NfseOrderService } from '../services/nfse/NfseOrderService.js';
import { db } from '../database/db.js';
import { cleanNumeric } from '../utils/crypto.js';

export const nfseOrderController = {
  /**
   * POST /api/nfse/pedidos
   * Endpoint receptor do pedido (chamado pela Viviane/WhatsApp ou pelo Portal)
   */
  async criarPedido(req: Request, res: Response) {
    try {
      const {
        cnpj_prestador,
        tomador_doc,
        tomador_nome,
        valor_servicos,
        descricao,
        solicitante_telefone,
        solicitante_origem,
        ambiente
      } = req.body;

      if (!cnpj_prestador || !tomador_doc || !tomador_nome || valor_servicos === undefined) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Campos obrigatórios ausentes: cnpj_prestador, tomador_doc, tomador_nome, valor_servicos.'
        });
      }

      const numValor = Number(valor_servicos);
      if (isNaN(numValor) || numValor <= 0) {
        return res.status(400).json({
          sucesso: false,
          erro: 'Valor dos serviços inválido. Deve ser numérico e maior que zero.'
        });
      }

      const resultado = await NfseOrderService.processOrder({
        cnpj_prestador,
        tomador_doc,
        tomador_nome,
        valor_servicos: numValor,
        descricao,
        solicitante_telefone,
        solicitante_origem: solicitante_origem || 'viviane_whatsapp',
        ambiente: ambiente || 'producao'
      });

      res.status(resultado.sucesso ? 201 : 422).json(resultado);
    } catch (err: any) {
      console.error('[nfseOrderController] Erro ao criar pedido de NFS-e:', err);
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  },

  /**
   * GET /api/nfse/pedidos/:protocolo
   * Consulta o andamento determinístico de um pedido por protocolo
   */
  async consultarPedido(req: Request, res: Response) {
    try {
      const protocolo = String(req.params.protocolo || '');
      const order = db.prepare('SELECT * FROM nfse_order_requests WHERE protocolo = ?').get(protocolo) as any;

      if (!order) {
        return res.status(404).json({ sucesso: false, erro: `Pedido não encontrado para o protocolo ${protocolo}.` });
      }

      res.json({
        sucesso: true,
        pedido: {
          protocolo: order.protocolo,
          prestador_cnpj: order.cnpj_prestador,
          tomador_doc: order.tomador_doc,
          tomador_nome: order.tomador_nome,
          valor_servicos: order.valor_servicos,
          status: order.status,
          motivo_pendencia: order.motivo_pendencia,
          viaos_tarefa_id: order.viaos_tarefa_id,
          tem_previa_pdf: Boolean(order.previa_pdf_path && fs.existsSync(order.previa_pdf_path)),
          previa_url: `/api/nfse/pedidos/${order.protocolo}/previa`,
          criado_em: order.created_at
        }
      });
    } catch (err: any) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  },

  /**
   * GET /api/nfse/pedidos/:protocolo/previa
   * Download / Visualização direta do PDF da prévia com tarja oficial
   */
  async baixarPreviaPdf(req: Request, res: Response) {
    try {
      const protocolo = String(req.params.protocolo || '');
      const order = db.prepare('SELECT * FROM nfse_order_requests WHERE protocolo = ?').get(protocolo) as any;

      if (!order || !order.previa_pdf_path || !fs.existsSync(order.previa_pdf_path)) {
        return res.status(404).json({ sucesso: false, erro: 'Arquivo PDF da prévia não encontrado para este pedido.' });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="PREVIA_NFSE_${protocolo}.pdf"`);
      const stream = fs.createReadStream(order.previa_pdf_path);
      stream.pipe(res);
    } catch (err: any) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  },

  /**
   * GET /api/nfse/perfis/:cnpj
   * Consulta o perfil fiscal cadastrado para a empresa
   */
  async consultarPerfil(req: Request, res: Response) {
    try {
      const cnpj = String(req.params.cnpj || '');
      const cleanCnpj = cleanNumeric(cnpj);
      const perfil = NfseOrderService.getProfileByCnpj(cleanCnpj);

      if (!perfil) {
        return res.status(404).json({ sucesso: false, erro: `Perfil fiscal de NFS-e não encontrado para o CNPJ ${cleanCnpj}.` });
      }

      res.json({ sucesso: true, perfil });
    } catch (err: any) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  },

  /**
   * POST /api/nfse/perfis
   * Salva ou atualiza a parametrização do perfil fiscal do cliente
   */
  async salvarPerfil(req: Request, res: Response) {
    try {
      const {
        cnpj_prestador,
        item_servico_lc116,
        codigo_tributacao_nacional,
        aliquota_iss,
        iss_retido,
        codigo_municipio_padrao,
        descricao_servico_padrao,
        limite_valor_nota,
        optante_simples_nacional,
        exige_aprovacao_viaos,
        ativo
      } = req.body;

      if (!cnpj_prestador) {
        return res.status(400).json({ sucesso: false, erro: 'CNPJ do prestador é obrigatório.' });
      }

      const cleanCnpj = cleanNumeric(cnpj_prestador);
      const company = db.prepare('SELECT id FROM companies WHERE cnpj = ?').get(cleanCnpj) as any;
      if (!company) {
        return res.status(404).json({ sucesso: false, erro: `Empresa com CNPJ ${cleanCnpj} não cadastrada no ViaNFe.` });
      }

      const perfil = NfseOrderService.saveProfile({
        company_id: company.id,
        cnpj_prestador: cleanCnpj,
        item_servico_lc116,
        codigo_tributacao_nacional,
        aliquota_iss,
        iss_retido,
        codigo_municipio_padrao,
        descricao_servico_padrao,
        limite_valor_nota,
        optante_simples_nacional,
        exige_aprovacao_viaos,
        ativo
      });

      res.json({
        sucesso: true,
        mensagem: `Perfil fiscal de NFS-e para CNPJ ${cleanCnpj} configurado com sucesso.`,
        perfil
      });
    } catch (err: any) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  }
};
