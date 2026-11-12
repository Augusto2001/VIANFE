import { db } from '../database/db.js';

interface MonthlyBucket {
  mes: string;
  faturamentoTotal: number;
  credito: number;
  debito: number;
  pixNota: number;
  boleto: number;
  dinheiro: number;
  outrosNota: number;
  redeAt: number;
  redeDb: number;
  cielo: number;
  pixBanco: number;
  outrosBanco: number;
  bankTxCount: number;
  cardTxCount: number;
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export const cardAuditService = {
  getCompanyCardAndModalityAudit(companyId: string) {
    const invoices = db.prepare(`
      SELECT id, tipo, modelo, data_emissao, valor_total, pagamentos_json, xml_raw
      FROM invoices
      WHERE company_id = ? AND (tipo = 'saida' OR tipo = 'emissao_propria')
      ORDER BY data_emissao ASC
    `).all(companyId) as any[];

    const transactions = db.prepare(`
      SELECT id, data, tipo, valor, descricao_original
      FROM bank_transactions
      WHERE company_id = ?
      ORDER BY data ASC
    `).all(companyId) as any[];

    const months = new Map<string, MonthlyBucket>();
    const ensureMonth = (mes: string): MonthlyBucket => {
      let bucket = months.get(mes);
      if (!bucket) {
        bucket = {
          mes,
          faturamentoTotal: 0,
          credito: 0,
          debito: 0,
          pixNota: 0,
          boleto: 0,
          dinheiro: 0,
          outrosNota: 0,
          redeAt: 0,
          redeDb: 0,
          cielo: 0,
          pixBanco: 0,
          outrosBanco: 0,
          bankTxCount: 0,
          cardTxCount: 0
        };
        months.set(mes, bucket);
      }
      return bucket;
    };

    for (const inv of invoices) {
      const rawDate = String(inv.data_emissao || '').slice(0, 7);
      const mes = /^\d{4}-\d{2}$/.test(rawDate) ? rawDate : 'Sem Data';
      const bucket = ensureMonth(mes);
      const valorTotal = Number(inv.valor_total) || 0;
      bucket.faturamentoTotal += valorTotal;

      let pags: Array<{ forma?: string; tPag?: string; valor?: number; vPag?: number }> = [];
      try {
        if (inv.pagamentos_json) {
          const parsed = JSON.parse(inv.pagamentos_json);
          if (Array.isArray(parsed)) pags = parsed;
        }
      } catch {
        pags = [];
      }

      if (pags.length === 0 && inv.xml_raw) {
        const xml = String(inv.xml_raw);
        const detPags = xml.match(/<detPag>[\s\S]*?<\/detPag>/g) || [];
        for (const dp of detPags) {
          const t = (dp.match(/<tPag>(\d+)<\/tPag>/) || [])[1] || '99';
          const v = parseFloat((dp.match(/<vPag>([\d.]+)<\/vPag>/) || [])[1] || '0');
          pags.push({ forma: t, valor: v });
        }
      }

      if (pags.length === 0) {
        bucket.outrosNota += valorTotal;
      } else {
        for (const p of pags) {
          const code = String(p.forma || p.tPag || '99').padStart(2, '0');
          const val = Number(p.valor ?? p.vPag) || 0;
          if (code === '03') bucket.credito += val;
          else if (code === '04') bucket.debito += val;
          else if (code === '17' || code === '20') bucket.pixNota += val;
          else if (code === '15') bucket.boleto += val;
          else if (code === '01') bucket.dinheiro += val;
          else bucket.outrosNota += val;
        }
      }
    }

    for (const bt of transactions) {
      const rawDate = String(bt.data || '').slice(0, 7);
      const mes = /^\d{4}-\d{2}$/.test(rawDate) ? rawDate : 'Sem Data';
      const bucket = ensureMonth(mes);
      bucket.bankTxCount += 1;

      if (bt.tipo !== 'CREDITO') continue;
      const val = Number(bt.valor) || 0;
      const memo = String(bt.descricao_original || '').toUpperCase();

      if (memo.includes('CIELO')) {
        bucket.cielo += val;
        bucket.cardTxCount += 1;
      } else if (memo.includes('REDE') && (memo.includes(' AT') || memo.includes('ANTECIP'))) {
        bucket.redeAt += val;
        bucket.cardTxCount += 1;
      } else if (
        memo.includes('REDE') ||
        memo.includes(' DB0') ||
        memo.includes('STONE') ||
        memo.includes('GETNET') ||
        memo.includes('CARTAO')
      ) {
        bucket.redeDb += val;
        bucket.cardTxCount += 1;
      } else if (memo.includes('PIX')) {
        bucket.pixBanco += val;
      } else {
        bucket.outrosBanco += val;
      }
    }

    const sortedMonths = Array.from(months.values()).sort((a, b) => a.mes.localeCompare(b.mes));

    let totalFaturadoGeral = 0;
    let totalCredito = 0;
    let totalDebito = 0;
    let totalPixNota = 0;
    let totalBoleto = 0;
    let totalDinheiro = 0;
    let totalOutrosNota = 0;

    let totalPixBanco = 0;
    let totalRedeAt = 0;
    let totalRedeDb = 0;
    let totalCielo = 0;
    let totalOutrosBanco = 0;

    const monthlyAudit = sortedMonths.map(b => {
      const notaCartao = round2(b.credito + b.debito);
      const maquininhaReal = round2(b.redeAt + b.redeDb + b.cielo);
      const divergenciaCartao = round2(maquininhaReal - notaCartao);
      const taxaAderencia = notaCartao > 0
        ? Math.min(100, Math.round((maquininhaReal / notaCartao) * 1000) / 10)
        : (maquininhaReal === 0 ? 100 : 0);
      const status = taxaAderencia >= 90 ? 'CONCILIADO' : taxaAderencia >= 70 ? 'ATENCAO' : 'DIVERGENTE';

      const notaPix = round2(b.pixNota);
      const bancoPix = round2(b.pixBanco);
      const divergenciaPix = round2(bancoPix - notaPix);

      totalFaturadoGeral += b.faturamentoTotal;
      totalCredito += b.credito;
      totalDebito += b.debito;
      totalPixNota += b.pixNota;
      totalBoleto += b.boleto;
      totalDinheiro += b.dinheiro;
      totalOutrosNota += b.outrosNota;

      totalPixBanco += b.pixBanco;
      totalRedeAt += b.redeAt;
      totalRedeDb += b.redeDb;
      totalCielo += b.cielo;
      totalOutrosBanco += b.outrosBanco;

      return {
        mes: b.mes,
        extratoBancoStatus: b.bankTxCount > 0 ? 'ENTROU' : 'PENDENTE',
        extratoMaquininhaStatus: b.cardTxCount > 0 ? 'ENTROU' : 'PENDENTE',
        faturamentoTotal: round2(b.faturamentoTotal),
        confrontoCartao: {
          notaCartao,
          maquininhaReal,
          divergencia: divergenciaCartao,
          taxaAderencia,
          status
        },
        realBanco: {
          redeAt: round2(b.redeAt),
          redeDb: round2(b.redeDb),
          cielo: round2(b.cielo),
          pix: bancoPix,
          outros: round2(b.outrosBanco)
        },
        confrontoPix: {
          notaPix,
          bancoPix,
          divergencia: divergenciaPix
        }
      };
    });

    const totalCartoesNota = round2(totalCredito + totalDebito);
    const totalCartoesRealMaquininha = round2(totalRedeAt + totalRedeDb + totalCielo);
    const taxaAderenciaCartoes = totalCartoesNota > 0
      ? Math.min(100, Math.round((totalCartoesRealMaquininha / totalCartoesNota) * 1000) / 10)
      : (totalCartoesRealMaquininha === 0 ? 100 : 0);

    const totalBancoGeral = round2(totalPixBanco + totalRedeAt + totalRedeDb + totalCielo + totalOutrosBanco);

    return {
      success: true,
      kpis: {
        totalCartoesNota,
        totalCartoesRealMaquininha,
        taxaAderenciaCartoes,
        totalAntecipacoesPagas: round2(totalRedeAt),
        desagioEstimadoAntecipacao: round2(totalRedeAt * 0.032),
        totalFaturadoGeral: round2(totalFaturadoGeral),
        totalPixNota: round2(totalPixNota),
        totalPixBanco: round2(totalPixBanco),
        divergenciaPix: round2(totalPixBanco - totalPixNota)
      },
      modalidadesTotais: {
        credito: round2(totalCredito),
        debito: round2(totalDebito),
        pix: round2(totalPixNota),
        boleto: round2(totalBoleto),
        dinheiro: round2(totalDinheiro),
        outros: round2(totalOutrosNota)
      },
      bancoTotais: {
        pix: round2(totalPixBanco),
        redeAt: round2(totalRedeAt),
        redeDb: round2(totalRedeDb),
        cielo: round2(totalCielo),
        outros: round2(totalOutrosBanco),
        total: totalBancoGeral
      },
      monthlyAudit
    };
  }
};
