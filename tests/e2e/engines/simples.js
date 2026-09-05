/**
 * Simples Nacional Diagnostic & Gauge Engine (LC 123/2006)
 * Calculates RBT12, Effective Tax Rates (Anexos I-V), Subteto Estadual, Teto Federal, and Warning Alerts
 */

export const SIMPLES_LIMITS = {
  SUBTETO_ESTADUAL: 3600000.00, // R$ 3.6M (ICMS/ISS recolhidos fora do DAS)
  TETO_FEDERAL: 4800000.00      // R$ 4.8M (Limite máximo ME/EPP)
};

// Anexo III - Prestadores de Serviços em Geral (Locação de bens móveis, contabilidade, TI, etc.)
export const ANEXO_III_TABELA = [
  { faixa: 1, limite_superior: 180000.00,  aliquota_nominal: 0.0600, deducao: 0.00 },
  { faixa: 2, limite_superior: 360000.00,  aliquota_nominal: 0.1120, deducao: 9360.00 },
  { faixa: 3, limite_superior: 720000.00,  aliquota_nominal: 0.1350, deducao: 17640.00 },
  { faixa: 4, limite_superior: 1800000.00, aliquota_nominal: 0.1600, deducao: 35640.00 },
  { faixa: 5, limite_superior: 3600000.00, aliquota_nominal: 0.2100, deducao: 125640.00 },
  { faixa: 6, limite_superior: 4800000.00, aliquota_nominal: 0.3300, deducao: 648000.00 }
];

/**
 * Calculates Simples Nacional Diagnostic Metrics based on RBT12
 * @param {number} rbt12 - Receita Bruta Total acumulada nos últimos 12 meses
 * @param {Array} [table=ANEXO_III_TABELA] - Tabela do Anexo do Simples
 * @returns {Object} Comprehensive diagnostic assessment
 */
export function calculateSimplesDiagnostic(rbt12, table = ANEXO_III_TABELA) {
  const cleanRbt12 = Math.max(0, Number(rbt12) || 0);

  // Calculate percentage reached against State and Federal limits
  const percentualEstadual = Number(((cleanRbt12 / SIMPLES_LIMITS.SUBTETO_ESTADUAL) * 100).toFixed(2));
  const percentualFederal = Number(((cleanRbt12 / SIMPLES_LIMITS.TETO_FEDERAL) * 100).toFixed(2));

  // Determine current bracket
  let faixaAtual = table[0];
  for (const f of table) {
    if (cleanRbt12 <= f.limite_superior) {
      faixaAtual = f;
      break;
    }
    faixaAtual = f; // If above top bracket, cap at last
  }

  // Calculate Alíquota Efetiva: ((RBT12 * AlíquotaNominal) - ParcelaADeduzir) / RBT12
  let aliquotaEfetiva = faixaAtual.aliquota_nominal;
  if (cleanRbt12 > 0) {
    const calculatedRate = ((cleanRbt12 * faixaAtual.aliquota_nominal) - faixaAtual.deducao) / cleanRbt12;
    aliquotaEfetiva = Math.max(0.04, calculatedRate); // minimum floor
  }

  const aliquotaEfetivaPercent = Number((aliquotaEfetiva * 100).toFixed(2));

  // Alert State Classification
  let alerta = 'normal';
  let mensagemAlerta = 'Empresa operando normalmente dentro dos limites do Simples Nacional.';

  if (cleanRbt12 > SIMPLES_LIMITS.TETO_FEDERAL) {
    alerta = 'desenquadramento_obrigatorio';
    mensagemAlerta = 'ATENÇÃO: Faturamento ultrapassou o teto federal de R$ 4,8 milhões! Desenquadramento obrigatório do Simples Nacional para o Lucro Presumido/Real.';
  } else if (cleanRbt12 >= SIMPLES_LIMITS.SUBTETO_ESTADUAL) {
    alerta = 'sublimite_atingido';
    mensagemAlerta = 'ALERTA: Faturamento ultrapassou o sublimite estadual de R$ 3,6 milhões. ICMS e ISS passam a ser recolhidos fora do DAS via guia estadual/municipal avulsa.';
  } else if (cleanRbt12 >= SIMPLES_LIMITS.SUBTETO_ESTADUAL * 0.85) {
    alerta = 'atencao_sublimite';
    mensagemAlerta = 'AVISO: Faturamento atingiu mais de 85% do sublimite estadual (R$ 3,6M). Monitore as próximas emissões para planejamento tributário.';
  }

  return {
    rbt12: cleanRbt12,
    teto_estadual: SIMPLES_LIMITS.SUBTETO_ESTADUAL,
    teto_federal: SIMPLES_LIMITS.TETO_FEDERAL,
    percentual_atingido_estadual: percentualEstadual,
    percentual_atingido_federal: percentualFederal,
    faixa_numero: faixaAtual.faixa,
    faixa_atual: `Faixa ${faixaAtual.faixa} - Alíquota Efetiva ~${aliquotaEfetivaPercent}%`,
    aliquota_efetiva: aliquotaEfetivaPercent,
    alerta,
    mensagem_alerta: mensagemAlerta
  };
}
