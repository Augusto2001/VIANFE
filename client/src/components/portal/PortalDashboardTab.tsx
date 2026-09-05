import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Company, DashboardSummaryData, PortalTab } from '../../types';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Zap, 
  FileText, 
  Camera, 
  RefreshCw, 
  ShieldCheck, 
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Bell,
  Send,
  Copy,
  Sparkles,
  PhoneCall,
  Check
} from 'lucide-react';

interface PortalDashboardTabProps {
  company: Company;
  onNavigateTab: (tab: PortalTab) => void;
}

export const PortalDashboardTab: React.FC<PortalDashboardTabProps> = ({ company, onNavigateTab }) => {
  const [data, setData] = useState<DashboardSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forecastRange, setForecastRange] = useState<'7' | '15' | '30'>('15');

  // Predictive WhatsApp Alerts State
  const [alertsSummary, setAlertsSummary] = useState<any>(null);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertTargetPhone, setAlertTargetPhone] = useState(company.telefone || company.whatsapp || '55');
  const [alertSending, setAlertSending] = useState(false);
  const [alertFeedback, setAlertFeedback] = useState<string | null>(null);
  const [copiedPixId, setCopiedPixId] = useState<string | null>(null);

  const loadSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const summary = await api.getPortalDashboardSummary(company.id);
      setData(summary);
    } catch (err: any) {
      console.error('Erro ao carregar resumo do portal:', err);
      setError(err.message || 'Falha ao carregar diagnóstico financeiro.');
    } finally {
      setLoading(false);
    }
  };

  const loadAlerts = async () => {
    try {
      setAlertsLoading(true);
      const res = await api.getUpcomingAlerts(company.id, 2);
      setAlertsSummary(res);
      if (res?.phone) {
        setAlertTargetPhone(res.phone);
      }
    } catch (e: any) {
      console.warn('Erro ao carregar alertas preditivos:', e.message);
    } finally {
      setAlertsLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
    loadAlerts();
  }, [company.id]);

  const handleDispatchWhatsAppAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertTargetPhone || alertTargetPhone.length < 10) {
      alert('Informe um número de WhatsApp válido com DDD.');
      return;
    }
    try {
      setAlertSending(true);
      setAlertFeedback(null);
      const res = await api.sendPredictiveAlertWhatsApp(company.id, alertTargetPhone);
      setAlertFeedback(res.message || 'Alerta preditivo enviado com sucesso no WhatsApp!');
      loadAlerts();
    } catch (err: any) {
      setAlertFeedback(`Erro: ${err.message}`);
    } finally {
      setAlertSending(false);
    }
  };

  const handleCopyPix = (pixCode: string, id: string) => {
    navigator.clipboard.writeText(pixCode);
    setCopiedPixId(id);
    setTimeout(() => setCopiedPixId(null), 3000);
  };

  const formatCurrency = (val: number | undefined | null) => {
    const num = typeof val === 'number' && !isNaN(val) ? val : 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-900/60 border border-slate-800 rounded-2xl p-4" />
          ))}
        </div>
        <div className="h-72 bg-slate-900/60 border border-slate-800 rounded-3xl" />
        <div className="h-64 bg-slate-900/60 border border-slate-800 rounded-3xl" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-slate-900 border border-rose-800/40 rounded-3xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white">Não foi possível carregar o diagnóstico financeiro</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">{error}</p>
        <button
          onClick={loadSummary}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Tentar Novamente</span>
        </button>
      </div>
    );
  }

  const bankBalance = data?.bank_balance ?? 0;
  const payablesToday = data?.payables_today ?? 0;
  const receivablesToday = data?.receivables_today ?? 0;
  const projectedEndDay = (data as any)?.projected_end_of_day !== undefined
    ? Number((data as any).projected_end_of_day)
    : (bankBalance + receivablesToday - payablesToday);

  const simples = data?.simples_nacional;
  const rbt12 = simples?.rbt12 ?? 0;
  const tetoEstadual = simples?.teto_estadual ?? (simples as any)?.limite_estadual ?? 3600000;
  const tetoFederal = simples?.teto_federal ?? (simples as any)?.limite_federal ?? 4800000;

  const percEstadual = tetoEstadual > 0 ? (rbt12 / tetoEstadual) * 100 : 0;
  const percFederal = tetoFederal > 0 ? (rbt12 / tetoFederal) * 100 : 0;
  const margemEstadualRestante = Math.max(0, tetoEstadual - rbt12);

  const forecast = data?.cash_flow_forecast || [];
  const limitDays = parseInt(forecastRange, 10) || 15;
  const visibleForecast = forecast.slice(0, limitDays);

  const getAlertLevelBadge = (alerta?: string) => {
    switch (alerta) {
      case 'critico':
        return {
          label: 'Alerta Crítico (Exclusão)',
          bg: 'bg-rose-950/40 border-rose-800 text-rose-300',
          badgeBg: 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
        };
      case 'alerta_subteto':
        return {
          label: 'Sublimite Atingido (ICMS/ISS por Fora)',
          bg: 'bg-amber-950/40 border-amber-800 text-amber-300',
          badgeBg: 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
        };
      case 'atencao':
        return {
          label: 'Atenção ao Limite',
          bg: 'bg-amber-950/30 border-amber-800/60 text-amber-200',
          badgeBg: 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
        };
      case 'normal':
      default:
        return {
          label: 'Enquadramento Saudável',
          bg: 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200',
          badgeBg: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
        };
    }
  };

  const alertStyle = getAlertLevelBadge(simples?.alerta);
  const defaultAlertMessage = 'Sua empresa está dentro dos limites de faturamento do Simples Nacional. O imposto único (DAS) cobre todos os tributos federais e municipais sem bitributação.';

  const dueItems = alertsSummary?.items || [];
  const totalAlertAmount = alertsSummary?.total_amount || 0;

  return (
    <div className="space-y-6">
      
      {/* 1. Header with Fast Quick Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Área do Cliente • Super App Viacont
              </span>
              <span className="text-xs text-slate-400 font-mono">Tempo Real</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1.5 flex items-center gap-2">
              <span>{company.nome_fantasia || company.razao_social}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              CNPJ: <span className="font-mono text-slate-300">{company.cnpj}</span> • Diagnóstico Contábil e Fluxo de Caixa Integrado
            </p>
          </div>

          {/* Quick Action Shortcuts */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <button
              onClick={() => onNavigateTab('emitir_notas')}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              <span>Emitir Nota Rápida</span>
            </button>

            <button
              onClick={() => onNavigateTab('guias_impostos')}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Pagar Impostos PIX</span>
            </button>

            <button
              onClick={() => onNavigateTab('recibos_scanner')}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4 text-teal-400" />
              <span>Enviar Recibo (OCR)</span>
            </button>

            <button
              onClick={() => setIsAlertModalOpen(true)}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2"
            >
              <Bell className="w-4 h-4 text-emerald-200 animate-bounce" />
              <span>Radar WhatsApp 48h</span>
            </button>
          </div>

        </div>
      </div>

      {/* 2. Four Real-Time Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Saldo Consolidado */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Saldo Bancário Atual</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white tracking-tight">
              {formatCurrency(bankBalance)}
            </div>
            <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3 h-3" /> Contas bancárias conciliadas
            </p>
          </div>
        </div>

        {/* Card 2: Contas a Pagar Hoje */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-rose-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">A Pagar Hoje</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-400 tracking-tight">
              {formatCurrency(payablesToday)}
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3 text-rose-400" /> Títulos vencendo no dia
            </p>
          </div>
        </div>

        {/* Card 3: Contas a Receber Hoje */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-teal-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">A Receber Hoje</span>
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-teal-300 tracking-tight">
              {formatCurrency(receivablesToday)}
            </div>
            <p className="text-[11px] text-teal-400 flex items-center gap-1 mt-1">
              <ArrowDownRight className="w-3 h-3" /> Faturamento previsto
            </p>
          </div>
        </div>

        {/* Card 4: Saldo Projetado Fim do Dia */}
        <div className={`border rounded-2xl p-5 shadow-lg relative overflow-hidden ${
          projectedEndDay >= 0 
            ? 'bg-slate-900 border-slate-800/90 hover:border-emerald-500/40' 
            : 'bg-rose-950/20 border-rose-800/40'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Saldo Projetado (Fim do Dia)</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              projectedEndDay >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            }`}>
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-black tracking-tight ${
              projectedEndDay >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {formatCurrency(projectedEndDay)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Saldo + Recebíveis - Pagamentos
            </p>
          </div>
        </div>

      </div>

      {/* 🌟 3. RADAR DE ALERTAS PREDITIVOS NO WHATSAPP (48H DE ANTECEDÊNCIA) */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 border border-emerald-500/30 rounded-3xl p-6 sm:p-7 shadow-xl space-y-5">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Bell className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white tracking-tight">Radar de Vencimentos em 48h (WhatsApp Proativo)</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Assistente Viviane 24/7
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Varredura contínua de duplicatas de notas fiscais, guias tributárias (DAS, FGTS) e despesas a vencer nos próximos 2 dias.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAlertModalOpen(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 shrink-0"
            >
              <Send className="w-4 h-4" />
              <span>Disparar Resumo no WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Status de Compromissos das Próximas 48h */}
        {alertsLoading ? (
          <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Consultando vencimentos nas próximas 48 horas...</span>
          </div>
        ) : dueItems.length === 0 ? (
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white">Nenhum compromisso a vencer nas próximas 48 horas!</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Todas as guias de impostos e duplicatas de fornecedores estão em dia para os próximos dias.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{dueItems.length} {dueItems.length === 1 ? 'compromisso identificado' : 'compromissos identificados'} a vencer:</span>
              <span className="font-bold text-white">
                Total Consolidado: <strong className="text-rose-400 font-mono text-sm">{formatCurrency(totalAlertAmount)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
              {dueItems.map((item: any, idx: number) => {
                const isUrgentToday = item.days_until_due === 0;
                const isTomorrow = item.days_until_due === 1;

                return (
                  <div
                    key={idx}
                    className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col justify-between gap-3 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isUrgentToday 
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                            : isTomorrow
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                        }`}>
                          {item.urgency_label}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Vence: <strong className="text-white">{item.formatted_due_date}</strong>
                        </span>
                      </div>

                      <h5 className="text-xs font-bold text-white mt-2 line-clamp-1">
                        {item.description}
                      </h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {item.category} • Beneficiário: {item.beneficiary || 'Fornecedor'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5">
                      <span className="text-sm font-black text-rose-400 font-mono">
                        {formatCurrency(item.amount)}
                      </span>

                      {item.pix_code && (
                        <button
                          onClick={() => handleCopyPix(item.pix_code, item.id)}
                          className="px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/30 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5"
                        >
                          {copiedPixId === item.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>PIX Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copiar PIX</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* 4. Simples Nacional RBT12 Thermometer & Fiscal Health */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white tracking-tight">Termômetro do Simples Nacional</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${alertStyle.badgeBg}`}>
                  {alertStyle.label}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitoramento contínuo de faturamento acumulado dos últimos 12 meses (RBT12) vs Sublimites.
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-[11px] text-slate-400 block font-medium">RBT12 Acumulado:</span>
            <span className="text-xl font-black text-white font-mono">
              {formatCurrency(rbt12)}
            </span>
          </div>
        </div>

        {/* Progress Gauges */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Gauge 1: Sublimite Estadual (ICMS/ISS) */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white">Sublimite Estadual (ICMS / ISS)</span>
                <p className="text-[11px] text-slate-400">Teto de R$ 3.600.000,00</p>
              </div>
              <span className="text-sm font-black text-emerald-400 font-mono">
                {percEstadual.toFixed(2)}%
              </span>
            </div>

            {/* Progress Bar with Color Thresholds */}
            <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  percEstadual > 90 
                    ? 'bg-rose-500' 
                    : percEstadual > 75 
                    ? 'bg-amber-500' 
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, percEstadual)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Consumido: <strong className="text-slate-200">{formatCurrency(rbt12)}</strong></span>
              <span>Margem Livre: <strong className="text-emerald-400">{formatCurrency(margemEstadualRestante)}</strong></span>
            </div>
          </div>

          {/* Gauge 2: Teto Nacional Simples */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white">Teto Federal Simples Nacional</span>
                <p className="text-[11px] text-slate-400">Teto Geral de R$ 4.800.000,00</p>
              </div>
              <span className="text-sm font-black text-teal-300 font-mono">
                {percFederal.toFixed(2)}%
              </span>
            </div>

            <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
              <div
                className="h-full rounded-full bg-teal-500 transition-all duration-700"
                style={{ width: `${Math.min(100, percFederal)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Consumido: <strong className="text-slate-200">{formatCurrency(rbt12)}</strong></span>
              <span>Teto Máximo: <strong className="text-slate-200">{formatCurrency(tetoFederal)}</strong></span>
            </div>
          </div>

        </div>

        {/* Tributary Summary Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400">Faixa Atual</span>
            <div className="text-xs font-bold text-white">
              {simples?.faixa_atual || 'Faixa 1 (Sem Faturamento)'}
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400">Enquadramento</span>
            <div className="text-xs font-bold text-emerald-400">
              {simples?.anexo || 'Anexo III'}
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400">Alíquota Efetiva</span>
            <div className="text-xs font-bold text-white font-mono">
              {(simples?.aliquota_efetiva ?? 0).toFixed(2)}%
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400">Parcela a Deduzir</span>
            <div className="text-xs font-bold text-slate-300 font-mono">
              {formatCurrency(simples?.parcela_deduzir ?? 0)}
            </div>
          </div>
        </div>

        {/* Alert Description Banner */}
        <div className={`p-4 rounded-2xl border flex items-start gap-3 ${alertStyle.bg}`}>
          <Info className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-xs">
            <p className="font-bold">Diagnóstico Tributário Viacont:</p>
            <p className="opacity-90">
              {simples?.alerta_mensagem || defaultAlertMessage}
            </p>
          </div>
        </div>

      </div>

      {/* 5. Cash Flow Forecast Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-5">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight">Previsão de Fluxo de Caixa Diário</h3>
              <p className="text-xs text-slate-400">Entradas e saídas programadas nos próximos dias</p>
            </div>
          </div>

          {/* Range Picker */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
            {(['7', '15', '30'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setForecastRange(r)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  forecastRange === r
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {r} Dias
              </button>
            ))}
          </div>
        </div>

        {/* Forecast Daily Grid */}
        {visibleForecast.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-950/60 rounded-2xl border border-slate-800/80 space-y-1">
            <p className="font-bold text-slate-300">Nenhuma movimentação futura registrada</p>
            <p className="text-slate-500">Não há previsões de contas a pagar ou a receber para os próximos {forecastRange} dias.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {visibleForecast.map((day, idx) => {
              const rawDate = day.date || (day as any).data || '';
              const formattedDate = rawDate.includes('-') 
                ? rawDate.split('-').reverse().join('/') 
                : (rawDate || '-');
              const isPositive = (day.net ?? 0) >= 0;

              return (
                <div
                  key={idx}
                  className="bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 text-slate-300 font-mono text-xs font-bold flex items-center justify-center">
                      {formattedDate.length >= 5 ? formattedDate.substring(0, 5) : formattedDate}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Data: {formattedDate}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-0.5">
                        <span className="text-emerald-400">Entradas: {formatCurrency(day.inflow ?? 0)}</span>
                        <span className="text-rose-400">Saídas: {formatCurrency(day.outflow ?? 0)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 block font-medium">Saldo Líquido do Dia:</span>
                    <span className={`text-sm font-black font-mono ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isPositive ? '+' : ''}{formatCurrency(day.net ?? 0)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* 🌟 6. MODAL DE DISPARO RADAR WHATSAPP (ASSISTENTE VIVIANE) */}
      {isAlertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-5 shadow-2xl relative">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-white">Radar Preditivo no WhatsApp</h4>
                  <p className="text-xs text-slate-400">Disparo com resumo de vencimentos em 48h</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsAlertModalOpen(false);
                  setAlertFeedback(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDispatchWhatsAppAlert} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Número de WhatsApp do Cliente (com DDD):
                </label>
                <input
                  type="text"
                  value={alertTargetPhone}
                  onChange={(e) => setAlertTargetPhone(e.target.value)}
                  placeholder="Ex: 5571999999999"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  A mensagem será enviada pela assistente <strong>Viviane</strong> com os valores detalhados e chaves PIX.
                </p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1.5 text-xs text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Empresa:</span>
                  <span className="font-bold text-white">{company.nome_fantasia || company.razao_social}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Vencimentos nas próximas 48h:</span>
                  <span className="font-bold text-emerald-400">{dueItems.length} {dueItems.length === 1 ? 'item' : 'itens'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total a Pagar:</span>
                  <span className="font-bold text-rose-400 font-mono">{formatCurrency(totalAlertAmount)}</span>
                </div>
              </div>

              {alertFeedback && (
                <div className={`p-3.5 rounded-xl border text-xs font-medium ${
                  alertFeedback.includes('Erro') 
                    ? 'bg-rose-950/40 border-rose-800 text-rose-300' 
                    : 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                }`}>
                  {alertFeedback}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAlertModalOpen(false);
                    setAlertFeedback(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                >
                  Fechar
                </button>

                <button
                  type="submit"
                  disabled={alertSending}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                >
                  {alertSending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Enviar Agora</span>
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
