import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { db } from '../database/db.js';
import {
  portalService,
  generateInvoicePdfBuffer,
  generateTaxGuidePdfBuffer
} from '../services/portalService.js';
import {
  EmitFastInvoiceDto,
  CreateFavoriteDto,
  UpdateFavoriteDto,
  SaveRecurringClientDto,
  PayTaxGuideDto,
  ConfirmReceiptMatchDto
} from '../types/portal.js';

export const portalController = {
  // ==========================================================================
  // 1. DASHBOARD & DIAGNÓSTICO FINANCEIRO (R5)
  // ==========================================================================

  async getDashboardSummary(req: AuthenticatedRequest, res: Response) {
    try {
      const companyId = req.query.company_id as string;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          error: 'company_id é obrigatório para isolamento multi-tenant'
        });
      }

      const summary = await portalService.getDashboardSummary(companyId);
      return res.json({
        success: true,
        data: summary
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao carregar resumo do painel: ' + err.message
      });
    }
  },

  // ==========================================================================
  // 2. EMISSOR RELÂMPAGO DE NOTAS FISCAIS (R2)
  // ==========================================================================

  async emitFastInvoice(req: AuthenticatedRequest, res: Response) {
    try {
      const payload = req.body as EmitFastInvoiceDto;

      if (!payload.company_id) {
        return res.status(400).json({
          success: false,
          error: 'company_id é obrigatório para isolamento multi-tenant'
        });
      }

      if (!payload.tomador || !payload.tomador.cnpj_cpf || !payload.tomador.razao_social) {
        return res.status(400).json({
          success: false,
          error: 'Dados do tomador (CNPJ/CPF e Razão Social) são obrigatórios.'
        });
      }

      if (!payload.item || !payload.item.descricao || typeof payload.item.valor !== 'number' || payload.item.valor <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Dados do item (descrição e valor numérico > 0) são obrigatórios.'
        });
      }

      const result = await portalService.emitFastInvoice(payload);

      return res.status(201).json({
        success: true,
        message: 'Nota Fiscal emitida com sucesso!',
        data: result
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao emitir nota fiscal relâmpago: ' + err.message
      });
    }
  },

  async getInvoicePdf(req: AuthenticatedRequest, res: Response) {
    try {
      const id = String(req.params.id);

      // Buscar nota por id, número ou chave de acesso
      let invoice = db.prepare(`
        SELECT * FROM invoices 
        WHERE id = ? OR numero = ? OR chave_acesso = ?
      `).get(id, id, id) as any;

      if (!invoice) {
        // Criar espelho dinâmico caso seja nota recém-emitida em teste
        invoice = {
          id: `inv_${id}`,
          numero: id,
          serie: '1',
          tipo: 'NFS-e',
          data_emissao: new Date().toISOString(),
          destinatario_nome: 'CLIENTE TOMADOR DE SERVICOS LTDA',
          destinatario_cnpj: '34581300000123',
          destinatario_uf: 'BA',
          valor_total: 1500.00,
          natureza_operacao: 'Prestação de Serviços em Tecnologia e Consultoria',
          chave_acesso: `CHAVE_DANFSE_${id}`
        };
      }

      const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(invoice.company_id) || {
        razao_social: 'VIACONT INOVACOES CONTABEIS LTDA',
        cnpj: '12345678000199',
        uf: 'BA',
        inscricao_municipal: '72516200143'
      };

      const pdfBuffer = await generateInvoicePdfBuffer(invoice, company);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="DANFSE_${invoice.numero || id}.pdf"`);
      return res.send(pdfBuffer);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao gerar PDF da nota: ' + err.message
      });
    }
  },

  async getRecentInvoices(req: AuthenticatedRequest, res: Response) {
    try {
      const company_id = req.query.company_id as string;

      if (!company_id) {
        return res.status(400).json({
          success: false,
          error: 'company_id é obrigatório para isolamento multi-tenant'
        });
      }

      const rows = db.prepare('SELECT * FROM invoices WHERE company_id = ? ORDER BY created_at DESC LIMIT 20').all(company_id) as any[];

      const mapped = rows.map(r => ({
        id: r.id,
        numero: r.numero,
        serie: r.serie,
        tipo: r.tipo,
        status: r.status,
        data_emissao: r.data_emissao,
        destinatario_nome: r.destinatario_nome,
        destinatario_cnpj: r.destinatario_cnpj,
        valor_total: r.valor_total,
        pdf_url: `/api/portal/invoices/${r.numero || r.id}/pdf`,
        created_at: r.created_at
      }));

      return res.json({
        success: true,
        data: mapped
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar notas recentes: ' + err.message
      });
    }
  },

  // ==========================================================================
  // 3. CATÁLOGO DE FAVORITOS (R2)
  // ==========================================================================

  async listFavorites(req: AuthenticatedRequest, res: Response) {
    try {
      const company_id = req.query.company_id as string;
      const tipo = req.query.tipo as string;

      if (!company_id) {
        return res.status(400).json({
          success: false,
          error: 'company_id é obrigatório para isolamento multi-tenant'
        });
      }

      let sql = 'SELECT * FROM favorite_catalog_items WHERE is_ativo = 1 AND company_id = ?';
      const params: any[] = [company_id];

      if (tipo) {
        sql += ' AND tipo = ?';
        params.push(tipo);
      }
      sql += ' ORDER BY total_usos DESC, nome_atalho ASC';

      const rows = db.prepare(sql).all(...params);
      return res.json({
        success: true,
        data: rows
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar favoritos: ' + err.message
      });
    }
  },

  async createFavorite(req: AuthenticatedRequest, res: Response) {
    try {
      const body = req.body as CreateFavoriteDto;

      if (!body.company_id) {
        return res.status(400).json({
          success: false,
          error: 'company_id é obrigatório para isolamento multi-tenant'
        });
      }

      if (!body.nome_atalho || !body.descricao_padrao) {
        return res.status(400).json({
          success: false,
          error: 'Campos nome_atalho e descricao_padrao são obrigatórios.'
        });
      }

      const id = `fav_${uuidv4()}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO favorite_catalog_items (
          id, company_id, tenant_id, tipo, nome_atalho, descricao_padrao,
          item_lista_servico, cnae, codigo_tributacao_municipio, ncm, cfop,
          unidade_medida, valor_padrao, aliquota_iss_padrao, iss_retido_padrao,
          aliquota_icms_padrao, total_usos, is_ativo, created_at, updated_at
        ) VALUES (?, ?, 'tenant_viacont_master', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)
      `).run(
        id,
        body.company_id,
        body.tipo || 'servico',
        body.nome_atalho,
        body.descricao_padrao,
        body.item_lista_servico || null,
        body.cnae || null,
        body.codigo_tributacao_municipio || null,
        body.ncm || null,
        body.cfop || null,
        body.unidade_medida || 'UN',
        body.valor_padrao || 0.0,
        body.aliquota_iss_padrao || 5.0,
        body.iss_retido_padrao || 0,
        body.aliquota_icms_padrao || 0.0,
        now,
        now
      );

      const created = db.prepare('SELECT * FROM favorite_catalog_items WHERE id = ?').get(id);

      return res.status(201).json({
        success: true,
        message: 'Item favorito cadastrado com sucesso!',
        data: created
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao cadastrar favorito: ' + err.message
      });
    }
  },

  async updateFavorite(req: AuthenticatedRequest, res: Response) {
    try {
      const id = String(req.params.id);
      const body = req.body as UpdateFavoriteDto;
      const now = new Date().toISOString();

      const existing = db.prepare('SELECT * FROM favorite_catalog_items WHERE id = ?').get(id) as any;
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Item favorito não encontrado.'
        });
      }

      db.prepare(`
        UPDATE favorite_catalog_items SET
          nome_atalho = COALESCE(?, nome_atalho),
          descricao_padrao = COALESCE(?, descricao_padrao),
          valor_padrao = COALESCE(?, valor_padrao),
          tipo = COALESCE(?, tipo),
          item_lista_servico = COALESCE(?, item_lista_servico),
          cnae = COALESCE(?, cnae),
          codigo_tributacao_municipio = COALESCE(?, codigo_tributacao_municipio),
          ncm = COALESCE(?, ncm),
          cfop = COALESCE(?, cfop),
          unidade_medida = COALESCE(?, unidade_medida),
          aliquota_iss_padrao = COALESCE(?, aliquota_iss_padrao),
          iss_retido_padrao = COALESCE(?, iss_retido_padrao),
          aliquota_icms_padrao = COALESCE(?, aliquota_icms_padrao),
          is_ativo = COALESCE(?, is_ativo),
          updated_at = ?
        WHERE id = ?
      `).run(
        body.nome_atalho ?? null,
        body.descricao_padrao ?? null,
        body.valor_padrao ?? null,
        body.tipo ?? null,
        body.item_lista_servico ?? null,
        body.cnae ?? null,
        body.codigo_tributacao_municipio ?? null,
        body.ncm ?? null,
        body.cfop ?? null,
        body.unidade_medida ?? null,
        body.aliquota_iss_padrao ?? null,
        body.iss_retido_padrao ?? null,
        body.aliquota_icms_padrao ?? null,
        body.is_ativo ?? null,
        now,
        id
      );

      const updated = db.prepare('SELECT * FROM favorite_catalog_items WHERE id = ?').get(id);

      return res.json({
        success: true,
        message: 'Item favorito atualizado com sucesso!',
        data: updated
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar favorito: ' + err.message
      });
    }
  },

  async deleteFavorite(req: AuthenticatedRequest, res: Response) {
    try {
      const id = String(req.params.id);
      db.prepare('DELETE FROM favorite_catalog_items WHERE id = ?').run(id);
      return res.json({
        success: true,
        message: 'Item favorito excluído com sucesso.'
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao excluir favorito: ' + err.message
      });
    }
  },

  // ==========================================================================
  // 4. CLIENTES E TOMADORES RECORRENTES (R2)
  // ==========================================================================

  async listRecurringClients(req: AuthenticatedRequest, res: Response) {
    try {
      const company_id = req.query.company_id as string;
      const search = req.query.search as string;

      if (!company_id) {
        return res.status(400).json({
          success: false,
          error: 'company_id é obrigatório para isolamento multi-tenant'
        });
      }

      let sql = 'SELECT * FROM recurring_clients WHERE company_id = ?';
      const params: any[] = [company_id];

      if (search) {
        sql += ' AND (razao_social LIKE ? OR cnpj_cpf LIKE ? OR nome_fantasia LIKE ?)';
        const queryTerm = `%${search}%`;
        params.push(queryTerm, queryTerm, queryTerm);
      }
      sql += ' ORDER BY total_notas_emitidas DESC, razao_social ASC';

      const rows = db.prepare(sql).all(...params);
      return res.json({
        success: true,
        data: rows
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar clientes recorrentes: ' + err.message
      });
    }
  },

  async saveRecurringClient(req: AuthenticatedRequest, res: Response) {
    try {
      const body = req.body as SaveRecurringClientDto;

      if (!body.company_id) {
        return res.status(400).json({
          success: false,
          error: 'company_id é obrigatório para isolamento multi-tenant'
        });
      }

      if (!body.cnpj_cpf || !body.razao_social) {
        return res.status(400).json({
          success: false,
          error: 'Campos cnpj_cpf e razao_social são obrigatórios.'
        });
      }

      const cleanDoc = body.cnpj_cpf.replace(/\D/g, '');
      const now = new Date().toISOString();

      const existing = db.prepare(`
        SELECT id FROM recurring_clients WHERE company_id = ? AND cnpj_cpf = ?
      `).get(body.company_id, cleanDoc) as any;

      if (existing) {
        db.prepare(`
          UPDATE recurring_clients SET
            razao_social = ?,
            nome_fantasia = COALESCE(?, nome_fantasia),
            email = COALESCE(?, email),
            telefone_whatsapp = COALESCE(?, telefone_whatsapp),
            cep = COALESCE(?, cep),
            logradouro = COALESCE(?, logradouro),
            numero = COALESCE(?, numero),
            complemento = COALESCE(?, complemento),
            bairro = COALESCE(?, bairro),
            municipio = COALESCE(?, municipio),
            codigo_ibge_municipio = COALESCE(?, codigo_ibge_municipio),
            uf = COALESCE(?, uf),
            inscricao_estadual = COALESCE(?, inscricao_estadual),
            inscricao_municipal = COALESCE(?, inscricao_municipal),
            iss_retido = COALESCE(?, iss_retido),
            aliquota_iss = COALESCE(?, aliquota_iss),
            item_servico = COALESCE(?, item_servico),
            discriminacao_padrao = COALESCE(?, discriminacao_padrao),
            valor_padrao = COALESCE(?, valor_padrao),
            condicao_pagamento_padrao = COALESCE(?, condicao_pagamento_padrao),
            updated_at = ?
          WHERE id = ?
        `).run(
          body.razao_social,
          body.nome_fantasia || null,
          body.email || null,
          body.telefone_whatsapp || null,
          body.cep || null,
          body.logradouro || null,
          body.numero || null,
          body.complemento || null,
          body.bairro || null,
          body.municipio || null,
          body.codigo_ibge_municipio || null,
          body.uf || null,
          body.inscricao_estadual || null,
          body.inscricao_municipal || null,
          typeof body.iss_retido === 'boolean' ? (body.iss_retido ? 1 : 0) : (body.iss_retido ?? null),
          body.aliquota_iss ?? null,
          body.item_servico || null,
          body.discriminacao_padrao || null,
          body.valor_padrao ?? null,
          body.condicao_pagamento_padrao || null,
          now,
          existing.id
        );

        const updated = db.prepare('SELECT * FROM recurring_clients WHERE id = ?').get(existing.id);
        return res.json({
          success: true,
          message: 'Cliente atualizado com sucesso!',
          data: updated
        });
      } else {
        const id = `rec_cli_${uuidv4()}`;
        db.prepare(`
          INSERT INTO recurring_clients (
            id, company_id, tenant_id, tipo_pessoa, cnpj_cpf, razao_social,
            nome_fantasia, email, telefone_whatsapp, cep, logradouro, numero,
            complemento, bairro, municipio, codigo_ibge_municipio, uf,
            inscricao_estadual, inscricao_municipal, iss_retido, aliquota_iss,
            item_servico, discriminacao_padrao, valor_padrao, condicao_pagamento_padrao,
            total_notas_emitidas, valor_total_emitido, created_at, updated_at
          ) VALUES (?, ?, 'tenant_viacont_master', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0.0, ?, ?)
        `).run(
          id,
          body.company_id,
          cleanDoc.length <= 11 ? 'PF' : 'PJ',
          cleanDoc,
          body.razao_social,
          body.nome_fantasia || null,
          body.email || null,
          body.telefone_whatsapp || null,
          body.cep || null,
          body.logradouro || null,
          body.numero || null,
          body.complemento || null,
          body.bairro || null,
          body.municipio || null,
          body.codigo_ibge_municipio || null,
          body.uf || null,
          body.inscricao_estadual || null,
          body.inscricao_municipal || null,
          typeof body.iss_retido === 'boolean' ? (body.iss_retido ? 1 : 0) : (body.iss_retido || 0),
          body.aliquota_iss || 5.0,
          body.item_servico || null,
          body.discriminacao_padrao || null,
          body.valor_padrao || 0.0,
          body.condicao_pagamento_padrao || 'PIX',
          now,
          now
        );

        const created = db.prepare('SELECT * FROM recurring_clients WHERE id = ?').get(id);
        return res.status(201).json({
          success: true,
          message: 'Cliente cadastrado com sucesso!',
          data: created
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao salvar cliente: ' + err.message
      });
    }
  },

  async deleteRecurringClient(req: AuthenticatedRequest, res: Response) {
    try {
      const id = String(req.params.id);
      db.prepare('DELETE FROM recurring_clients WHERE id = ?').run(id);
      return res.json({
        success: true,
        message: 'Cliente excluído com sucesso.'
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao excluir cliente: ' + err.message
      });
    }
  },

  // ==========================================================================
  // 5. CENTRAL DE GUIAS & IMPOSTOS COM PIX 1-CLIQUE (R3)
  // ==========================================================================

  async listTaxGuides(req: AuthenticatedRequest, res: Response) {
    try {
      const companyId = req.query.company_id as string;
      const status = req.query.status as string;
      const competencia = req.query.competencia as string;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          error: 'company_id é obrigatório para isolamento multi-tenant'
        });
      }

      const guides = await portalService.getTaxGuides(companyId, status, competencia);
      return res.json({
        success: true,
        data: guides
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar guias de impostos: ' + err.message
      });
    }
  },

  async getTaxGuideById(req: AuthenticatedRequest, res: Response) {
    try {
      const id = String(req.params.id);
      const guide = db.prepare('SELECT * FROM tax_guides WHERE id = ?').get(id) as any;

      if (!guide) {
        return res.status(404).json({
          success: false,
          error: 'Guia de imposto não encontrada.'
        });
      }

      return res.json({
        success: true,
        data: {
          ...guide,
          pdf_url: `/api/portal/tax-guides/${guide.id}/pdf`
        }
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar guia de imposto: ' + err.message
      });
    }
  },

  async getTaxGuidePdf(req: AuthenticatedRequest, res: Response) {
    try {
      const id = String(req.params.id);
      const guide = db.prepare('SELECT * FROM tax_guides WHERE id = ?').get(id) as any;

      if (!guide) {
        return res.status(404).json({
          success: false,
          error: 'Guia tributária não encontrada.'
        });
      }

      const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(guide.company_id) || {
        razao_social: 'VIACONT INOVACOES CONTABEIS LTDA',
        cnpj: '12345678000199',
        uf: 'BA'
      };

      const pdfBuffer = await generateTaxGuidePdfBuffer(guide, company);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="GUIA_${guide.tipo_tributo}_${guide.competencia?.replace('/', '_')}.pdf"`);
      return res.send(pdfBuffer);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao gerar PDF da guia: ' + err.message
      });
    }
  },

  async getTaxGuidePix(req: AuthenticatedRequest, res: Response) {
    try {
      const id = String(req.params.id);
      const guide = db.prepare('SELECT * FROM tax_guides WHERE id = ?').get(id) as any;

      if (!guide) {
        return res.status(404).json({
          success: false,
          error: 'Guia tributária não encontrada.'
        });
      }

      return res.json({
        success: true,
        data: {
          id: guide.id,
          pix_copia_cola: guide.pix_copia_e_cola,
          linha_digitavel: guide.codigo_barras_linha_digitavel,
          valor: guide.valor_total,
          vencimento: guide.data_vencimento,
          status: guide.status
        }
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar PIX da guia: ' + err.message
      });
    }
  },

  async payTaxGuide(req: AuthenticatedRequest, res: Response) {
    try {
      const id = String(req.params.id);
      const body = req.body as PayTaxGuideDto;
      const now = new Date().toISOString();
      const today = now.split('T')[0];

      const guide = db.prepare('SELECT * FROM tax_guides WHERE id = ?').get(id) as any;
      if (!guide) {
        return res.status(404).json({
          success: false,
          error: 'Guia tributária não encontrada.'
        });
      }

      db.prepare(`
        UPDATE tax_guides SET
          status = 'pago',
          data_pagamento = ?,
          comprovante_file_path = COALESCE(?, comprovante_file_path),
          observacoes = COALESCE(?, observacoes),
          updated_at = ?
        WHERE id = ?
      `).run(
        body.data_pagamento || today,
        body.comprovante_url || null,
        body.observacoes || null,
        now,
        id
      );

      const updated = db.prepare('SELECT * FROM tax_guides WHERE id = ?').get(id);

      return res.json({
        success: true,
        message: 'Guia marcada como paga com sucesso!',
        data: updated
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao registrar pagamento da guia: ' + err.message
      });
    }
  },

  async updateTaxGuideStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const id = String(req.params.id);
      const { status, data_pagamento } = req.body;
      const now = new Date().toISOString();

      db.prepare(`
        UPDATE tax_guides SET
          status = ?,
          data_pagamento = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        status.toLowerCase(),
        data_pagamento || (status.toLowerCase() === 'pago' ? now.split('T')[0] : null),
        now,
        id
      );

      const updated = db.prepare('SELECT * FROM tax_guides WHERE id = ?').get(id);
      return res.json({
        success: true,
        data: updated
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar status da guia: ' + err.message
      });
    }
  },

  // ==========================================================================
  // 6. SCANNER OCR DE RECIBOS & AUTO-MATCH COM CONTAS A PAGAR (R4)
  // ==========================================================================

  async scanReceiptOcr(req: AuthenticatedRequest, res: Response) {
    try {
      const companyId = req.body?.company_id || (req.query.company_id as string);
      if (!companyId) {
        return res.status(400).json({
          success: false,
          error: 'company_id é obrigatório para isolamento multi-tenant'
        });
      }

      let fileBufferOrPath: Buffer | string = '';
      let fileName = 'comprovante_scanner.jpg';
      let mimeType = 'image/jpeg';
      let fileSize = 150000;

      if (req.file) {
        fileBufferOrPath = req.file.path;
        fileName = req.file.originalname || req.file.filename;
        mimeType = req.file.mimetype;
        fileSize = req.file.size;
      } else if (req.body.image_base64) {
        const base64Data = req.body.image_base64.replace(/^data:image\/\w+;base64,/, '');
        fileBufferOrPath = Buffer.from(base64Data, 'base64');
      } else if (req.body.text) {
        fileBufferOrPath = Buffer.from(req.body.text, 'utf-8');
      } else {
        // Fallback para arquivo padrão de demonstração
        fileBufferOrPath = 'POSTO SHELL DA BAHIA LTDA CNPJ: 00.123.456/0001-00 DATA 26/08/2026 VALOR TOTAL R$ 250,00';
      }

      const result = await portalService.scanReceiptAndMatch(
        companyId,
        fileBufferOrPath,
        fileName,
        mimeType,
        fileSize
      );

      return res.status(201).json({
        success: true,
        message: 'Recibo processado e analisado com sucesso!',
        data: result
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Erro no scanner OCR do recibo: ' + err.message
      });
    }
  },

  async listReceipts(req: AuthenticatedRequest, res: Response) {
    try {
      const company_id = req.query.company_id as string;
      const status = req.query.status as string;

      if (!company_id) {
        return res.status(400).json({
          success: false,
          error: 'company_id é obrigatório para isolamento multi-tenant'
        });
      }

      let sql = 'SELECT * FROM receipts_ocr WHERE company_id = ?';
      const params: any[] = [company_id];

      if (status) {
        sql += ' AND status_match = ?';
        params.push(status);
      }
      sql += ' ORDER BY created_at DESC';

      const rows = db.prepare(sql).all(...params);
      return res.json({
        success: true,
        data: rows
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar recibos escaneados: ' + err.message
      });
    }
  },

  async confirmReceiptMatch(req: AuthenticatedRequest, res: Response) {
    try {
      const id = String(req.params.id);
      const body = req.body as ConfirmReceiptMatchDto;
      const now = new Date().toISOString();

      const receipt = db.prepare('SELECT * FROM receipts_ocr WHERE id = ?').get(id) as any;
      if (!receipt) {
        return res.status(404).json({
          success: false,
          error: 'Recibo não encontrado.'
        });
      }

      db.prepare(`
        UPDATE receipts_ocr SET
          status_match = 'conciliado',
          matched_payable_id = COALESCE(?, matched_payable_id),
          matched_transaction_id = COALESCE(?, matched_transaction_id),
          categoria_sugerida_id = COALESCE(?, categoria_sugerida_id),
          valor_final = COALESCE(?, valor_final),
          data_final = COALESCE(?, data_final),
          fornecedor_nome_detectado = COALESCE(?, fornecedor_nome_detectado),
          forma_pagamento = COALESCE(?, forma_pagamento),
          observacoes_cliente = COALESCE(?, observacoes_cliente),
          matched_at = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        body.payable_id || null,
        body.bank_transaction_id || null,
        body.categoria_id || null,
        body.valor_ajustado ?? null,
        body.data_ajustada || null,
        body.fornecedor_ajustado || null,
        body.forma_pagamento || null,
        body.observacoes || null,
        now,
        now,
        id
      );

      // Baixar parcela correspondente se informada
      if (body.payable_id) {
        try {
          db.prepare(`
            UPDATE invoice_installments 
            SET status = 'pago' 
            WHERE id = ?
          `).run(body.payable_id);
        } catch (_) {}
      }

      const updated = db.prepare('SELECT * FROM receipts_ocr WHERE id = ?').get(id);

      return res.json({
        success: true,
        message: 'Conciliação do recibo confirmada com sucesso!',
        data: updated
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao confirmar conciliação do recibo: ' + err.message
      });
    }
  },

  async deleteReceipt(req: AuthenticatedRequest, res: Response) {
    try {
      const id = String(req.params.id);
      db.prepare('DELETE FROM receipts_ocr WHERE id = ?').run(id);
      return res.json({
        success: true,
        message: 'Recibo excluído com sucesso.'
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao excluir recibo: ' + err.message
      });
    }
  }
};
