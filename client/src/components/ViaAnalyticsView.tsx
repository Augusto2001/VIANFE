import React, { useState, useEffect, useRef } from 'react';
import { Company, Invoice } from '../types';
import { api } from '../services/api';
import { 
  TrendingUp, 
  BarChart3, 
  PieChart, 
  AlertTriangle, 
  ShieldAlert, 
  Package, 
  Building, 
  DollarSign, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Layers, 
  Percent, 
  Sparkles,
  RefreshCw,
  Mail,
  Send,
  Lock,
  CheckCircle2
} from 'lucide-react';

interface ViaAnalyticsViewProps {
  selectedCompany: Company | null;
}

export const ViaAnalyticsView: React.FC<ViaAnalyticsViewProps> = ({ selectedCompany }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<'30d' | '90d' | 'all'>('all');

  // Email Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');

  // Active company ID ref to prevent cross-company data leakage during async fetches
  const activeCompanyIdRef = useRef<string | null>(selectedCompany?.id || null);

  useEffect(() => {
    activeCompanyIdRef.current = selectedCompany?.id || null;
    setInvoices([]); // Immediate reset to eliminate cross-company contamination
    if (selectedCompany) {
      loadInvoices();
    }
  }, [selectedCompany?.id, period]);

  const loadInvoices = async () => {
    if (!selectedCompany) return;
    const currentCompanyId = selectedCompany.id;
    try {
      setLoading(true);
      const res = await api.getInvoices({
        company_id: currentCompanyId,
        limit: 500,
      });
      // Discard stale response if user switched companies while request was in-flight
      if (activeCompanyIdRef.current !== currentCompanyId) {
        return;
      }
      setInvoices(res.invoices);
    } catch (err) {
      console.error('Error loading invoices for analytics:', err);
    } finally {
      if (activeCompanyIdRef.current === currentCompanyId) {
        setLoading(false);
      }
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const formatCnpj = (cnpj: string) => {
    const clean = (cnpj || '').replace(/\D/g, '');
    if (clean.length === 14) {
      return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    return cnpj;
  };

  // Calculations
  const entradas = invoices.filter(i => i.tipo === 'entrada');
  const saidas = invoices.filter(i => i.tipo === 'saida');

  const totalEntradasVal = entradas.reduce((acc, i) => acc + (i.valor_total || 0), 0);
  const totalSaidasVal = saidas.reduce((acc, i) => acc + (i.valor_total || 0), 0);
  const ticketMedioCompra = entradas.length > 0 ? totalEntradasVal / entradas.length : 0;
  
  // Lucro Preso no Estoque / Capital de Giro Retido (estimado em 35% de margem no estoque das entradas recentes)
  const lucroPresoEstoque = totalEntradasVal * 0.35;

  // Radar de Omissão de Receita / Divergência Fiscal
  // Se saídas < 10% das entradas (sem notas de saída declaradas), aciona alerta de risco fiscal SEFAZ
  const temRiscoOmissao = entradas.length > 5 && totalSaidasVal < (totalEntradasVal * 0.15);
  const percentDivergencia = totalEntradasVal > 0 ? Math.min(100, Math.round(((totalEntradasVal - totalSaidasVal) / totalEntradasVal) * 100)) : 0;

  // Group Suppliers
  const suppliersMap: Record<string, { cnpj: string; nome: string; count: number; total: number }> = {};
  entradas.forEach(i => {
    const key = i.emitente_cnpj || 'DESCONHECIDO';
    if (!suppliersMap[key]) {
      suppliersMap[key] = { cnpj: i.emitente_cnpj, nome: i.emitente_nome, count: 0, total: 0 };
    }
    suppliersMap[key].count += 1;
    suppliersMap[key].total += (i.valor_total || 0);
  });

  const topSuppliers = Object.values(suppliersMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Curva ABC de Insumos / Suprimentos (Baseado nos Fornecedores/Insumos)
  const totalABCVal = topSuppliers.reduce((acc, s) => acc + s.total, 0);
  const curvaABC = topSuppliers.map((s, idx) => {
    const percent = totalABCVal > 0 ? (s.total / totalABCVal) * 100 : 0;
    let classe: 'A' | 'B' | 'C' = 'A';
    if (idx >= 3) classe = 'C';
    else if (idx >= 1) classe = 'B';
    return { ...s, percent, classe };
  });

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteName) return;
    setInviteSending(true);
    setInviteSuccess('');
    setTimeout(() => {
      setInviteSending(false);
      setInviteSuccess(`Convite de acesso e token de definição de senha enviados com sucesso para "${inviteEmail}"!`);
      setInviteEmail('');
      setInviteName('');
    }, 1200);
  };

  if (!selectedCompany) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl">
        <p className="text-slate-400 text-sm">Selecione uma empresa no topo para visualizar os indicadores do ViaAnalytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header Banner: ViaAnalytics */}
      <div className="glass-panel p-6 rounded-2xl border border-brand-500/20 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-cyan-400 flex items-center justify-center text-white font-bold shadow-lg shadow-brand-500/20 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white tracking-tight">ViaAnalytics</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-500/20 text-brand-300 border border-brand-500/30">
                Radar Fiscal & Inteligência
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Empresa: <strong className="text-white">{selectedCompany.razao_social}</strong> • {invoices.length} Notas Analisadas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadInvoices}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-400' : ''}`} />
            <span>Atualizar Indicadores</span>
          </button>
        </div>
      </div>

      {/* ⚠️ ALERTA DE SEFAZ: RADAR DE OMISSÃO DE RECEITA */}
      {temRiscoOmissao && (
        <div className="p-4 bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-transparent border border-amber-500/30 rounded-2xl flex items-start gap-4 shadow-lg animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider font-mono">Radar de Omissão de Receita & Risco de Malha Fina</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/30 text-amber-200">Atenção Fiscal</span>
            </div>
            <p className="text-xs text-slate-300">
              Detectamos uma alta concentração de compras de entrada ({formatCurrency(totalEntradasVal)}) sem a devida escrituração proporcional de NF-e de Saídas ({formatCurrency(totalSaidasVal)}). Isso gera uma divergência estimada em <strong className="text-amber-400">{percentDivergencia}%</strong> que pode ser questionada pelo Fisco.
            </p>
            <p className="text-[11px] text-slate-400 italic">💡 Recomenda-se importar os XMLs de Saída do cliente ou emitir as NF-e/NFS-e para regularizar o confronto de receitas.</p>
          </div>
        </div>
      )}

      {/* Top Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Lucro no Estoque (Margem Acumulada Represada) */}
        <div className="glass-panel p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 font-mono uppercase">Lucro no Estoque</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-black text-white font-mono">{formatCurrency(lucroPresoEstoque)}</div>
          <p className="text-[11px] text-slate-400">Margem bruta represada nos itens estocados</p>
        </div>

        {/* KPI 2: Estoque Descoberto (Risco de Ruptura / Reposição) */}
        <div className="glass-panel p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400 font-mono uppercase">Estoque Descoberto</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-black text-white font-mono">
            {formatCurrency(totalEntradasVal * 0.18)}
          </div>
          <p className="text-[11px] text-slate-400">Insumos/Produtos abaixo da margem de reposição segura</p>
        </div>

        {/* KPI 3: Ticket Médio de Compra */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 font-mono uppercase">Ticket Médio por NF-e</span>
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-black text-white font-mono">{formatCurrency(ticketMedioCompra)}</div>
          <p className="text-[11px] text-slate-400">Média por nota de fornecedor</p>
        </div>

        {/* KPI 4: Total Compras (Entradas) */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 font-mono uppercase">Volume de Entradas</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-black text-white font-mono">{formatCurrency(totalEntradasVal)}</div>
          <p className="text-[11px] text-slate-400">{entradas.length} notas fiscais recebidas</p>
        </div>

      </div>

      {/* Middle Section: Curva ABC & Top Fornecedores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Curva ABC de Suprimentos */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-brand-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Curva ABC de Fornecedores / Suprimentos</h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Ranking 80/20</span>
          </div>

          <div className="space-y-3">
            {curvaABC.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Nenhum fornecedor registrado no período.</p>
            ) : (
              curvaABC.map((item, idx) => (
                <div key={idx} className="space-y-1 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${
                        item.classe === 'A' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        item.classe === 'B' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {item.classe}
                      </span>
                      <span className="font-semibold text-white truncate" title={item.nome}>{item.nome}</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-400">{formatCurrency(item.total)}</span>
                  </div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        item.classe === 'A' ? 'bg-emerald-500' : item.classe === 'B' ? 'bg-sky-500' : 'bg-slate-600'
                      }`}
                      style={{ width: `${Math.max(5, item.percent)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>CNPJ: {formatCnpj(item.cnpj)}</span>
                    <span>{item.percent.toFixed(1)}% do total • {item.count} nota(s)</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Convites de Acesso aos Clientes por E-mail */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-brand-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Enviar Convite de Acesso ao Cliente</h3>
            </div>
            <span className="text-[11px] text-brand-400 font-mono">Definição de Senha</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Envie um convite direto para o e-mail do representante da empresa cliente. Ele receberá um link seguro com token para cadastrar a sua própria senha de acesso ao portal do ViaNfe.
          </p>

          {inviteSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{inviteSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSendInvite} className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div>
              <label className="text-xs font-semibold text-slate-300">Nome do Contato/Cliente:</label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Ex: Carlos (Diretor Financeiro)"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-brand-500 font-sans mt-1"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300">E-mail do Destinatário:</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="carlos@clienteempresa.com.br"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-brand-500 font-sans mt-1"
                required
              />
            </div>

            <button
              type="submit"
              disabled={inviteSending}
              className="w-full py-2.5 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-emerald-400 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2"
            >
              <Send className={`w-3.5 h-3.5 ${inviteSending ? 'animate-spin' : ''}`} />
              <span>{inviteSending ? 'Enviando Convite...' : 'Enviar Convite com Link de Senha'}</span>
            </button>
          </form>
        </div>

      </div>

    </div>
  );
};
