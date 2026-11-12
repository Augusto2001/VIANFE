import { db } from '../database/db.js';

export interface CardModalityMonthAudit {
  mes: string;
  extratoBancoStatus: 'ENTROU' | 'PENDENTE';
  extratoMaquininhaStatus: 'ENTROU' | 'PENDENTE';
  faturamentoTotal: number;
  qtdNotas: number;
  modalidadesNota: {
    dinheiro: number;
    credito: number;
    debito: number;
    pix: number;
    boleto: number;
    outros: number;
    qtdCredito: number;
    qtdDebito: number;
    qtdPix: number;
  };
  realBanco: {
    pix: number;
    redeAt: number;
    redeDb: number;
    cielo: number;
    totalMaquininhas: number;
    outrosCreditos: number;
    totalCreditos: number;
    qtdPix: number;
    qtdRedeAt: number;
    qtdRedeDb: number;
    qtdCielo: number;
  };
  confrontoCartao: {
    notaCartao: number;
    maquininhaReal: number;
    divergencia: number;
    taxaAderencia: number;
    status: 'CONCILIADO' | 'ATENCAO' | 'CRITICO';
  };
  confrontoPix: {
    notaPix: number;
    bancoPix: number;
    divergencia: number;
    status: 'CONCILIADO' | 'RISCO_OMISSAO';
  };
}

export const cardAuditService = {
  getCompanyCardAndModalityAudit(companyId: string) {
    const comp = db.prepare('SELECT id, razao_social, cnpj FROM companies WHERE id = ?').get(companyId) as any;
    if (!comp) {
      throw new Error('Empresa não encontrada');
    }

    // 1. Fetch Invoices
    const invoices = db.prepare(
      "SELECT data_emissao, valor_total, pagamentos_json, xml_raw, modelo FROM invoices WHERE company_id = ? AND tipo = 'saida' ORDER BY data_emissao ASC"
    ).all(companyId) as any[];

    // 2. Fetch Bank Transactions
    const bankTxs = db.prepare(
      'SELECT data, descricao_original, tipo, valor FROM bank_transactions WHERE company_id = ? ORDER BY data ASC'
    ).all(companyId) as any[];

    const months = [
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05',
      '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'
    ];

    const monthlyMap: Record<string, CardModalityMonthAudit> = {};

    for (const m of months) {
      monthlyMap[m] = {
        mes: m,
        extratoBancoStatus: 'PENDENTE',
        extratoMaquininhaStatus: 'PENDENTE',
        faturamentoTotal: 0,
        qtdNotas: 0,
        modalidadesNota: {
          dinheiro: 0, credito: 0, debito: 0, pix: 0, boleto: 0, outros: 0,
          qtdCredito: 0, qtdDebito: 0, qtdPix: 0
        },
        realBanco: {
          pix: 0, redeAt: 0, redeDb: 0, cielo: 0, totalMaquininhas: 0,
          outrosCreditos: 0, totalCreditos: 0, qtdPix: 0, qtdRedeAt: 0, qtdRedeDb: 0, qtdCielo: 0
        },
        confrontoCartao: {
          notaCartao: 0, maquininhaReal: 0, divergencia: 0, taxaAderencia: 100, status: 'CONCILIADO'
        },
        confrontoPix: {
          notaPix: 0, bancoPix: 0, divergencia: 0, status: 'CONCILIADO'
        }
      };
    }

    // Process Invoices
    for (const inv of invoices) {
      const ym = (inv.data_emissao || '').substring(0, 7);
      if (!monthlyMap[ym]) continue;

      const item = monthlyMap[ym];
      const vnf = Number(inv.valor_total) || 0;
      item.faturamentoTotal += vnf;
      item.qtdNotas += 1;

      let pags: any[] = [];
      try {
        if (inv.pagamentos_json) {
          pags = JSON.parse(inv.pagamentos_json);
        }
      } catch (e) {
        pags = [];
      }

      if (!pags || pags.length === 0) {
        const xml = inv.xml_raw || '';
        const detPags = xml.match(/<detPag>[\s\S]*?<\/detPag>/g) || [];
        for (const dp of detPags) {
          const t = dp.match(/<tPag>(\d+)<\/tPag>/)?.[1] || '99';
          const v = parseFloat(dp.match(/<vPag>([\d\.]+)<\/vPag>/)?.[1] || vnf.toString());
          pags.push({ forma: t, valor: v });
        }
      }

      if (pags.length === 0) {
        pags.push({ forma: '99', valor: vnf });
      }

      for (const p of pags) {
        const t = p.forma || p.tPag || '99';
        const v = Number(p.valor || p.vPag) || 0;

        if (t === '01') {
          item.modalidadesNota.dinheiro += v;
        } else if (t === '03') {
          item.modalidadesNota.credito += v;
          item.modalidadesNota.qtdCredito += 1;
        } else if (t === '04') {
          item.modalidadesNota.debito += v;
          item.modalidadesNota.qtdDebito += 1;
        } else if (t === '15') {
          item.modalidadesNota.boleto += v;
        } else if (t === '17' || t === '20') {
          item.modalidadesNota.pix += v;
          item.modalidadesNota.qtdPix += 1;
        } else {
          item.modalidadesNota.outros += v;
        }
      }
    }

    // Process Bank Transactions
    for (const bt of bankTxs) {
      const ym = (bt.data || '').substring(0, 7);
      if (!monthlyMap[ym]) continue;

      const item = monthlyMap[ym];
      item.extratoBancoStatus = 'ENTROU';

      const memo = (bt.descricao_original || '').toUpperCase();
      const val = Number(bt.valor) || 0;

      if (bt.tipo === 'CREDITO') {
        item.realBanco.totalCreditos += val;

        const isCielo = memo.includes('CIELO');
        const isRedeAt = memo.includes(' AT0') || memo.includes('AT ') || (memo.includes('REDE') && memo.includes('AT')) || memo.includes('ANTECIP');
        const isRedeDb = memo.includes(' DB0') || memo.includes('DB ') || (memo.includes('REDE') && memo.includes('DB'));
        const isPix = memo.includes('PIX') && !isCielo && !memo.includes('REDE');

        if (isRedeAt) {
          item.realBanco.redeAt += val;
          item.realBanco.qtdRedeAt += 1;
          item.extratoMaquininhaStatus = 'ENTROU';
        } else if (isRedeDb) {
          item.realBanco.redeDb += val;
          item.realBanco.qtdRedeDb += 1;
          item.extratoMaquininhaStatus = 'ENTROU';
        } else if (isCielo) {
          item.realBanco.cielo += val;
          item.realBanco.qtdCielo += 1;
          item.extratoMaquininhaStatus = 'ENTROU';
        } else if (isPix) {
          item.realBanco.pix += val;
          item.realBanco.qtdPix += 1;
        } else {
          item.realBanco.outrosCreditos += val;
        }
      }
    }

    // Calculate reconciliations and indicators
    const monthlyList: CardModalityMonthAudit[] = [];
    let totCartaoNota = 0;
    let totCartaoMaq = 0;
    let totRedeAt = 0;
    let totPixNota = 0;
    let totPixBanco = 0;
    let totFaturado = 0;

    const modTotais = { dinheiro: 0, credito: 0, debito: 0, pix: 0, boleto: 0, outros: 0 };
    const bankTotais = { pix: 0, redeAt: 0, redeDb: 0, cielo: 0, outros: 0, total: 0 };

    for (const m of months) {
      const item = monthlyMap[m];
      item.realBanco.totalMaquininhas = item.realBanco.redeAt + item.realBanco.redeDb + item.realBanco.cielo;

      const notaCartao = item.modalidadesNota.credito + item.modalidadesNota.debito;
      const maqReal = item.realBanco.totalMaquininhas;
      const diffCartao = maqReal - notaCartao;
      const taxaAderencia = notaCartao > 0 ? Math.min(100, Math.round((Math.min(notaCartao, maqReal) / Math.max(notaCartao, maqReal)) * 100)) : (maqReal === 0 ? 100 : 0);

      item.confrontoCartao = {
        notaCartao,
        maquininhaReal: maqReal,
        divergencia: diffCartao,
        taxaAderencia,
        status: Math.abs(diffCartao) < 1500 ? 'CONCILIADO' : (diffCartao > 0 ? 'CRITICO' : 'ATENCAO')
      };

      const notaPix = item.modalidadesNota.pix;
      const bancoPix = item.realBanco.pix;
      const diffPix = bancoPix - notaPix;

      item.confrontoPix = {
        notaPix,
        bancoPix,
        divergencia: diffPix,
        status: diffPix > 5000 ? 'RISCO_OMISSAO' : 'CONCILIADO'
      };

      totCartaoNota += notaCartao;
      totCartaoMaq += maqReal;
      totRedeAt += item.realBanco.redeAt;
      totPixNota += notaPix;
      totPixBanco += bancoPix;
      totFaturado += item.faturamentoTotal;

      modTotais.dinheiro += item.modalidadesNota.dinheiro;
      modTotais.credito += item.modalidadesNota.credito;
      modTotais.debito += item.modalidadesNota.debito;
      modTotais.pix += item.modalidadesNota.pix;
      modTotais.boleto += item.modalidadesNota.boleto;
      modTotais.outros += item.modalidadesNota.outros;

      bankTotais.pix += item.realBanco.pix;
      bankTotais.redeAt += item.realBanco.redeAt;
      bankTotais.redeDb += item.realBanco.redeDb;
      bankTotais.cielo += item.realBanco.cielo;
      bankTotais.outros += item.realBanco.outrosCreditos;
      bankTotais.total += item.realBanco.totalCreditos;

      monthlyList.push(item);
    }

    return {
      company: comp,
      kpis: {
        totalCartoesNota: totCartaoNota,
        totalCartoesRealMaquininha: totCartaoMaq,
        divergenciaCartoes: totCartaoMaq - totCartaoNota,
        taxaAderenciaCartoes: totCartaoNota > 0 ? Math.round((totCartaoMaq / totCartaoNota) * 1000) / 10 : 0,
        totalAntecipacoesPagas: totRedeAt,
        desagioEstimadoAntecipacao: totRedeAt * 0.0385,
        totalPixNota: totPixNota,
        totalPixBanco: totPixBanco,
        divergenciaPix: totPixBanco - totPixNota,
        totalFaturadoGeral: totFaturado
      },
      modalidadesTotais: modTotais,
      bancoTotais: bankTotais,
      monthlyAudit: monthlyList
    };
  }
};
