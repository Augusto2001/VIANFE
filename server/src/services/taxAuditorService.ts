import { db } from '../database/db.js';
import { parseFiscalXml } from './xmlParser.js';

// Table of known Monofasic NCM prefixes in Brazilian Tax Law (Lei 10.147/2000, Lei 10.485/2002)
const MONOFASIC_NCM_PREFIXES = [
  // Bebidas Frias (Cervejas, Refrigerantes, Águas, Isotônicos)
  '2201', '2202', '2203', '2204', '2205', '2206', '2207', '2208',
  // Medicamentos & Farmácia
  '3001', '3002', '3003', '3004', '3005', '3006',
  // Perfumaria, Cosméticos e Higiene Pessoal
  '3303', '3304', '3305', '3306', '3307', '3401', '3402',
  // Autopeças e Pneumáticos
  '4011', '4012', '4013', '8708', '8407', '8408', '8409', '8483', '8511', '8512'
];

export interface TaxItemAudit {
  invoiceId: string;
  numeroNota: string;
  dataEmissao: string;
  tipo: 'entrada' | 'saida';
  codigoProduto: string;
  descricao: string;
  ncm: string;
  cfop: string;
  valorTotal: number;
  isMonofasico: boolean;
  aliquotaPis: number;
  aliquotaCofins: number;
  creditoEstimado: number;
  categoriaMonofasica?: string;
  alertaRisco?: string;
}

export const taxAuditorService = {
  /**
   * Run a deep tax audit on all captured invoices for a specific company
   */
  async auditCompanyInvoices(companyId: string): Promise<any> {
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
    if (!company) {
      throw new Error(`Empresa com ID ${companyId} não encontrada.`);
    }

    const invoices = db.prepare(`
      SELECT id, numero, serie, tipo, data_emissao, emitente_nome, destinatario_nome, valor_total, itens_json, xml_raw
      FROM invoices
      WHERE company_id = ?
      ORDER BY data_emissao DESC
    `).all(companyId) as any[];

    const auditedItems: TaxItemAudit[] = [];
    let totalFaturamentoAuditado = 0;
    let totalComprasAuditadas = 0;
    let totalItensMonofasicos = 0;
    let totalValorMonofasico = 0;
    let estimativaCreditoPisCofins = 0;
    let totalAlertasCfop = 0;

    const ncmGroupMap = new Map<string, { ncm: string; count: number; totalValor: number; descricao: string; isMonofasico: boolean }>();
    const cfopGroupMap = new Map<string, { cfop: string; count: number; totalValor: number; tipo: string }>();

    for (const inv of invoices) {
      if (inv.tipo === 'saida') {
        totalFaturamentoAuditado += (inv.valor_total || 0);
      } else {
        totalComprasAuditadas += (inv.valor_total || 0);
      }

      let parsedItens: any[] = [];
      try {
        if (inv.itens_json) {
          parsedItens = JSON.parse(inv.itens_json);
        } else if (inv.xml_raw) {
          const parsedXml = parseFiscalXml(inv.xml_raw);
          parsedItens = parsedXml.itens || [];
        }
      } catch (e) {
        parsedItens = [];
      }

      for (const item of parsedItens) {
        const ncmClean = (item.ncm || '').replace(/\D/g, '');
        const cfopClean = (item.cfop || '').replace(/\D/g, '');
        const itemValor = parseFloat(item.valorTotal || item.valor_total || 0);

        // Check if NCM belongs to Monofasic Regime
        let isMonofasico = false;
        let categoriaMonofasica = '';

        for (const prefix of MONOFASIC_NCM_PREFIXES) {
          if (ncmClean.startsWith(prefix)) {
            isMonofasico = true;
            if (prefix.startsWith('22')) categoriaMonofasica = 'Bebidas Frias / Cervejas';
            else if (prefix.startsWith('30')) categoriaMonofasica = 'Medicamentos / Farmácia';
            else if (prefix.startsWith('33') || prefix.startsWith('34')) categoriaMonofasica = 'Cosméticos & Higiene';
            else if (prefix.startsWith('40') || prefix.startsWith('87') || prefix.startsWith('84') || prefix.startsWith('85')) categoriaMonofasica = 'Autopeças & Pneus';
            break;
          }
        }

        // Potential recovery in Simples Nacional: ~3.65% to 9.25% (PIS 0.65% + COFINS 3.00% to 1.65% + 7.60%)
        let creditoEstimado = 0;
        if (isMonofasico && inv.tipo === 'saida') {
          // If selling monofasic items, Simples Nacional can segregate PIS/COFINS (~3.8% of product value)
          creditoEstimado = itemValor * 0.038;
          totalValorMonofasico += itemValor;
          totalItensMonofasicos++;
          estimativaCreditoPisCofins += creditoEstimado;
        }

        // CFOP Risk Detection
        let alertaRisco: string | undefined = undefined;
        if (inv.tipo === 'entrada' && (cfopClean.startsWith('5') || cfopClean.startsWith('6'))) {
          // CFOP of emission used in purchase invoice (supplier CFOP vs entry CFOP)
          alertaRisco = 'CFOP do Emitente: Necessário escriturar com CFOP de Entrada correspondente (ex: 1.102/2.102)';
          totalAlertasCfop++;
        }

        auditedItems.push({
          invoiceId: inv.id,
          numeroNota: inv.numero,
          dataEmissao: inv.data_emissao,
          tipo: inv.tipo,
          codigoProduto: item.codigo || item.cProd || 'N/A',
          descricao: item.descricao || item.xProd || 'Produto sem descrição',
          ncm: item.ncm || '00000000',
          cfop: item.cfop || '0000',
          valorTotal: itemValor,
          isMonofasico,
          aliquotaPis: 0.65,
          aliquotaCofins: 3.00,
          creditoEstimado,
          categoriaMonofasica,
          alertaRisco
        });

        // Accumulate NCM Grouping
        const ncmKey = item.ncm || 'Outros';
        const existingNcm = ncmGroupMap.get(ncmKey) || { ncm: ncmKey, count: 0, totalValor: 0, descricao: item.descricao || item.xProd || '', isMonofasico };
        existingNcm.count++;
        existingNcm.totalValor += itemValor;
        ncmGroupMap.set(ncmKey, existingNcm);

        // Accumulate CFOP Grouping
        const cfopKey = item.cfop || 'Outros';
        const existingCfop = cfopGroupMap.get(cfopKey) || { cfop: cfopKey, count: 0, totalValor: 0, tipo: inv.tipo };
        existingCfop.count++;
        existingCfop.totalValor += itemValor;
        cfopGroupMap.set(cfopKey, existingCfop);
      }
    }

    // Sort Top NCMs
    const topNcms = Array.from(ncmGroupMap.values())
      .sort((a, b) => b.totalValor - a.totalValor)
      .slice(0, 10);

    // Sort Top CFOPs
    const topCfops = Array.from(cfopGroupMap.values())
      .sort((a, b) => b.totalValor - a.totalValor);

    return {
      success: true,
      resumo: {
        totalInvoicesAuditadas: invoices.length,
        totalItensAuditados: auditedItems.length,
        totalFaturamentoAuditado,
        totalComprasAuditadas,
        totalItensMonofasicos,
        totalValorMonofasico,
        estimativaCreditoPisCofins,
        totalAlertasCfop,
        percentualMonofasico: totalFaturamentoAuditado > 0 ? (totalValorMonofasico / totalFaturamentoAuditado) * 100 : 0
      },
      topNcms,
      topCfops,
      itensMonofasicosRecuperaveis: auditedItems.filter(i => i.isMonofasico).slice(0, 50),
      ultimosItensAuditados: auditedItems.slice(0, 100)
    };
  }
};
