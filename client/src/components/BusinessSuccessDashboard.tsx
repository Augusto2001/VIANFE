import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Company } from '../types';
import { 
  TrendingUp, ShieldAlert, ShieldCheck, PieChart, Users, Building2, 
  DollarSign, ArrowUpRight, ArrowDownRight, Award, AlertTriangle, 
  Calendar, CheckCircle, BarChart3, Wallet, FileText, Activity, Share2, Send, Download, Copy, Printer
} from 'lucide-react';

interface BusinessSuccessDashboardProps {
  company: Company;
}

export const BusinessSuccessDashboard: React.FC<BusinessSuccessDashboardProps> = ({ company }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [targetPhone, setTargetPhone] = useState('55');
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<string | null>(null);

  // Active company ID ref to prevent cross-company data leakage
  const activeCompanyIdRef = React.useRef(company.id);

  const loadKpis = async () => {
    const currentCompId = company.id;
    try {
      setLoading(true);
      const res = await api.getBusinessSuccess(company.id);
      if (activeCompanyIdRef.current !== currentCompId) {
        return; // Discard stale response from prior company
      }
      setData(res);
    } catch (err: any) {
      console.error('Erro ao carregar Painel do Sucesso:', err);
    } finally {
      if (activeCompanyIdRef.current === currentCompId) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    activeCompanyIdRef.current = company.id;
    setData(null); // Immediate state reset to prevent displaying previous company's KPIs
    loadKpis();
  }, [company.id]);

  if (loading || !data) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
        <Activity className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
        <h3 className="text-sm font-bold text-white">Calculando +30 KPIs e Auditoria Fiscal em Tempo Real...</h3>
        <p className="text-xs text-slate-400">Processando notas SEFAZ, extratos bancários e fechamento gerencial.</p>
      </div>
    );
  }

  const { dre, kpis, radarFiscal, modalidadesVendas, top5Fornecedores, top5Clientes } = data;
  const isSafe = radarFiscal.nivelRisco === 'BAIXO';

  return (
    <div className="space-y-6">
      
      {/* Top Header Card: Radar de Risco Fiscal & Sucesso */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                Inteligência Estratégica
              </span>
              <span className="text-xs text-slate-400 font-mono">Fechamento em Tempo Real (Dia 31)</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
              <span>Painel do Sucesso Empresarial</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {company.nome_fantasia || company.razao_social} • CNPJ: {company.cnpj}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Print / PDF Executive Report Button */}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-all cursor-pointer shadow-sm hover:border-slate-600"
              title="Imprimir ou Salvar Relatório Executivo em PDF (A4 Timbrado)"
            >
              <Printer className="w-3.5 h-3.5 text-teal-400" />
              <span>Imprimir / PDF</span>
            </button>

            {/* WhatsApp Direct Modal Trigger Button */}
            <button
              onClick={() => {
                setSendFeedback(null);
                setIsWhatsAppModalOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              title="Abrir tela de disparo seguro de WhatsApp via ZapCont"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Enviar via WhatsApp (ZapCont)</span>
            </button>

            {/* WhatsApp Summary Copy Button */}
            <button
              onClick={() => {
                const text = `📊 *FECHAMENTO EXECUTIVO VIACONT* 📊\nEmpresa: *${company.razao_social}*\nCNPJ: ${company.cnpj}\n\n💰 *Faturamento Bruto:* ${formatCurrency(dre.receitaBruta)}\n📈 *Lucro Líquido:* ${formatCurrency(dre.lucroLiquido)} (Margem: ${dre.margemLiquida.toFixed(1)}%)\n🛡️ *Radar Fiscal:* ${isSafe ? '✅ Zero Risco (100% Coberto)' : '⚠️ Atenção / Divergência'}\n\n🏆 *Top Fornecedor:* ${top5Fornecedores[0]?.fornecedor || 'N/A'}\n\n_Gerado automaticamente pelo Ecossistema ViaNfe por Viacont._`;
                navigator.clipboard.writeText(text);
                alert('Resumo Executivo copiado para a área de transferência!\nVocê pode colar diretamente no WhatsApp / ZapCont.');
              }}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
              title="Copiar resumo gerencial formatado para envio no WhatsApp / ZapCont"
            >
              <Copy className="w-3.5 h-3.5 text-emerald-400" />
              <span>Copiar Texto</span>
            </button>

            {/* Fiscal Risk Level Badge */}
            <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
              isSafe 
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' 
                : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
            }`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isSafe ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {isSafe ? <ShieldCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold tracking-wider">Radar de Risco</span>
                <p className="text-xs font-bold text-white leading-tight">
                  {isSafe ? '100% REGULAR' : 'ATENÇÃO'}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. DRE GERENCIAL & METRICAS DE RENTABILIDADE (FECHAMENTO DIA 31) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Receita Bruta */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Faturamento Bruto</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">
            R$ {(dre.receitaBruta || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Fechamento consolidado do mês</span>
          </div>
        </div>

        {/* Lucro Bruto & Margem Bruta */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Lucro Bruto (Margem)</span>
            <TrendingUp className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-black text-teal-400">
            R$ {(dre.lucroBruto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold">
              {kpis.margemBruta}%
            </span>
            <span>Margem Bruta sobre Vendas</span>
          </div>
        </div>

        {/* EBITDA */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">EBITDA Gerencial</span>
            <BarChart3 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-400">
            R$ {(dre.ebitda || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
              {kpis.margemEbitda}%
            </span>
            <span>Geração Operacional de Caixa</span>
          </div>
        </div>

        {/* Lucro Líquido Real */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Lucro Líquido Final</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            R$ {(dre.lucroLiquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
              {kpis.margemLiquida}%
            </span>
            <span>Margem Líquida Real</span>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 2. RADAR FISCAL: CRUZAMENTO FORMAS DE PAGAMENTO & COMPRAS X VENDAS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Vendas por Modalidade de Pagamento (<pag> / <tPag>) (7 Columns) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PieChart className="w-4 h-4 text-emerald-400" />
                <span>Vendas por Modalidade (Tag &lt;pag&gt; x Extrato)</span>
              </h3>
              <p className="text-xs text-slate-400">Rastreamento temporal da liquidação (D+0, D+1, D+30)</p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">
              Total: R$ {(dre.receitaBruta || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Modality Progress Bars */}
          <div className="space-y-4">
            {modalidadesVendas.map((mod: any, idx: number) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: mod.cor }} />
                    <span className="font-semibold text-slate-200">{mod.modalidade}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 font-mono">
                      R$ {mod.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="font-bold text-white w-10 text-right">{mod.percentual}%</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500" 
                    style={{ width: `${mod.percentual}%`, backgroundColor: mod.cor }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white">Confronto Automático de Liquidação:</span>
              <p className="text-slate-400 mt-0.5">
                O PIX e Débito foram conferidos no extrato bancário D+0/D+1. As vendas de Cartão de Crédito estão projetadas para D+30 descontando a taxa MDR da adquirente.
              </p>
            </div>
          </div>
        </div>

        {/* Right: +30 KPIs Executivos & Prazos Médios (5 Columns) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Indicadores de Eficiência & Caixa</span>
            </h3>
            <p className="text-xs text-slate-400">Prazos médios, liquidez e estrutura patrimonial</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-medium uppercase">PMR (Recebimento)</span>
              <div className="text-lg font-black text-white mt-0.5">{kpis.pmr} dias</div>
              <p className="text-[10px] text-slate-500">Média para receber vendas</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-medium uppercase">PMP (Pagamento)</span>
              <div className="text-lg font-black text-emerald-400 mt-0.5">{kpis.pmp} dias</div>
              <p className="text-[10px] text-slate-500">Prazo com fornecedores</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-medium uppercase">Liquidez Corrente</span>
              <div className="text-lg font-black text-cyan-400 mt-0.5">{kpis.liquidezCorrente}x</div>
              <p className="text-[10px] text-slate-500">Capacidade de honrar dívidas</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-medium uppercase">Giro de Estoque</span>
              <div className="text-lg font-black text-teal-400 mt-0.5">{kpis.giroEstoque}x/ano</div>
              <p className="text-[10px] text-slate-500">Renovação de mercadorias</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-medium uppercase">Ponto de Equilíbrio</span>
              <div className="text-sm font-black text-amber-400 mt-0.5">
                R$ {(kpis.pontoEquilibrio || 0).toLocaleString('pt-BR')}
              </div>
              <p className="text-[10px] text-slate-500">Faturamento mínimo (Break-Even)</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-[10px] text-slate-400 font-medium uppercase">Ciclo Financeiro</span>
              <div className="text-lg font-black text-indigo-400 mt-0.5">{kpis.cicloFinanceiro} dias</div>
              <p className="text-[10px] text-slate-500">Necessidade de Caixa</p>
            </div>

          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. RANKINGS ESTRATÉGICOS: TOP 5 FORNECEDORES & TOP 5 CLIENTES */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top 5 Fornecedores */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Top 5 Fornecedores (Concentração de Compras)</span>
            </h3>
            <span className="text-xs text-slate-400">Total NF-e</span>
          </div>

          <div className="space-y-2.5">
            {top5Fornecedores.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Nenhum fornecedor registrado no período.</p>
            ) : (
              top5Fornecedores.map((f: any, idx: number) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{f.nome}</p>
                      <p className="text-[10px] text-slate-400">{f.count} notas fiscais emitidas</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-black text-white">
                      R$ {f.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-emerald-400 font-semibold">{f.percentual}% do total</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top 5 Clientes */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-teal-400" />
              <span>Top 5 Clientes (Faturamento / Saídas)</span>
            </h3>
            <span className="text-xs text-slate-400">Vendas</span>
          </div>

          <div className="space-y-2.5">
            {top5Clientes.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Consumidores Finais / Vendas no Balcão.</p>
            ) : (
              top5Clientes.map((c: any, idx: number) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{c.nome}</p>
                      <p className="text-[10px] text-slate-400">{c.count} operações faturadas</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-black text-teal-400">
                      R$ {c.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-slate-400">Faturado</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL: SAFE WHATSAPP ZAPCONT SENDER */}
      {/* ========================================================================= */}
      {isWhatsAppModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 animate-fade-in">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Disparo Seguro via WhatsApp (ZapCont)</h3>
                  <p className="text-[10px] text-slate-400">Canal direto de comunicação com o cliente</p>
                </div>
              </div>
              <button 
                onClick={() => setIsWhatsAppModalOpen(false)}
                className="text-slate-400 hover:text-white text-base font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Safe Hours Notice */}
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-slate-300 leading-snug">
                <span className="font-bold text-emerald-400 block">Horário Seguro Ativo (08h às 18h):</span>
                Disparos automáticos são bloqueados de madrugada. Envios manuais de teste sob demanda são liberados instantaneamente.
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSendWhatsApp} className="space-y-4">
              
              {/* Phone Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Número de WhatsApp do Destinatário (com DDI e DDD):
                </label>
                <input
                  type="text"
                  value={targetPhone}
                  onChange={(e) => setTargetPhone(e.target.value)}
                  placeholder="5585999999999"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-500">Exemplo: 55 + DDD + 9 dígitos (ex: 5585988887777)</p>
              </div>

              {/* Message Preview */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Prévia do Resumo Executivo:
                </label>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {`📊 *FECHAMENTO EXECUTIVO VIACONT* 📊\nEmpresa: *${company.razao_social}*\nCNPJ: ${company.cnpj}\n\n💰 *Faturamento Bruto:* ${(data?.dre?.receitaBruta || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n📈 *Lucro Líquido:* ${(data?.dre?.lucroLiquido || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n🛡️ *Radar Fiscal:* ${data?.radarFiscal?.nivelRisco === 'BAIXO' ? '✅ Zero Risco (100% Coberto)' : '⚠️ Atenção / Divergência'}\n\n🏆 *Top Fornecedor:* ${data?.top5Fornecedores?.[0]?.fornecedor || 'N/A'}\n\n_Gerado com segurança pelo Ecossistema ViaNfe por Viacont._`}
                </div>
              </div>

              {sendFeedback && (
                <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white font-medium">
                  {sendFeedback}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWhatsAppModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={sendingWhatsApp}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingWhatsApp ? 'Enviando...' : 'Disparar Teste Seguro'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
