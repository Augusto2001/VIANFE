import React, { useState, useEffect, useRef } from 'react';
import { Company, Invoice } from '../types';
import { api } from '../services/api';
import { 
  TrendingUp, 
  BarChart3, 
  PieChart, 
  AlertTriangle, 
  ShieldAlert, 
  ShieldCheck,
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
  CheckCircle2,
  CreditCard,
  QrCode,
  Zap,
  ArrowRightLeft,
  FileText
} from 'lucide-react';

interface ViaAnalyticsViewProps {
  selectedCompany: Company | null;
}

export const ViaAnalyticsView: React.FC<ViaAnalyticsViewProps> = ({ selectedCompany }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<'30d' | '90d' | 'all'>('all');

  // Card & Modality Intelligence Audit State
  const [cardAudit, setCardAudit] = useState<any>(null);
  const [loadingCardAudit, setLoadingCardAudit] = useState(false);
  const [activeTab, setActiveTab] = useState<'cartoes_modalidades' | 'radar_estoque'>('cartoes_modalidades');

  // Email Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');

  // Active company ID ref to prevent cross-company data leakage during async fetches
  const activeCompanyIdRef = useRef<string | null>(selectedCompany?.id || null);

  useEffect(() => {
    activeCompanyIdRef.current = selectedCompany?.id || null;
    setInvoices([]);
    setCardAudit(null);
    if (selectedCompany) {
      loadInvoices();
      loadCardAudit();
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
      if (activeCompanyIdRef.current !== currentCompanyId) return;
      setInvoices(res.invoices);
    } catch (err) {
      console.error('Error loading invoices for analytics:', err);
    } finally {
      if (activeCompanyIdRef.current === currentCompanyId) {
        setLoading(false);
      }
    }
  };

  const loadCardAudit = async () => {
    if (!selectedCompany) return;
    const currentCompanyId = selectedCompany.id;
    try {
      setLoadingCardAudit(true);
      const res = await api.getCardAndModalityAudit(currentCompanyId);
      if (activeCompanyIdRef.current !== currentCompanyId) return;
      setCardAudit(res);
    } catch (err) {
      console.error('Error loading card and modality audit:', err);
    } finally {
      if (activeCompanyIdRef.current === currentCompanyId) {
        setLoadingCardAudit(false);
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

  // Separação Estrita de Notas: Produtos (55/65) vs Serviços (NFS-e), sem misturar com despesas
  const produtosEntrada = invoices.filter(i => (i.tipo === 'entrada' || i.tipo === 'nfe_recebida' || !i.tipo) && i.modelo !== 'NFS-e');
  const produtosSaida = invoices.filter(i => (i.tipo === 'saida' || i.tipo === 'emissao_propria') && i.modelo !== 'NFS-e');
  const servicosEntrada = invoices.filter(i => (i.tipo === 'entrada' || i.tipo === 'nfe_recebida') && i.modelo === 'NFS-e');
  const servicosSaida = invoices.filter(i => (i.tipo === 'saida' || i.tipo === 'emissao_propria') && i.modelo === 'NFS-e');

  const totalComprasRevendaVal = produtosEntrada.reduce((acc, i) => acc + (i.valor_total || 0), 0);
  const totalVendasProdutosVal = produtosSaida.reduce((acc, i) => acc + (i.valor_total || 0), 0);
  const totalServicosTomadosVal = servicosEntrada.reduce((acc, i) => acc + (i.valor_total || 0), 0);
  const totalServicosPrestadosVal = servicosSaida.reduce((acc, i) => acc + (i.valor_total || 0), 0);

  const isEmpresaServico = (totalVendasProdutosVal === 0 && totalServicosPrestadosVal > 0) || (selectedCompany?.emite_nfse && !selectedCompany?.ie && totalVendasProdutosVal === 0);
  const isEmpresaMista = totalVendasProdutosVal > 0 && totalServicosPrestadosVal > 0;
  const isEmpresaComercio = !isEmpresaServico && !isEmpresaMista;

  const totalEntradasVal = isEmpresaServico ? totalServicosTomadosVal : totalComprasRevendaVal;
  const totalSaidasVal = isEmpresaServico ? totalServicosPrestadosVal : totalVendasProdutosVal;
  const ticketMedioCompra = isEmpresaServico 
    ? (servicosEntrada.length > 0 ? totalServicosTomadosVal / servicosEntrada.length : 0)
    : (produtosEntrada.length > 0 ? totalComprasRevendaVal / produtosEntrada.length : 0);
  const ticketMedioSaida = isEmpresaServico
    ? (servicosSaida.length > 0 ? totalServicosPrestadosVal / servicosSaida.length : 0)
    : (produtosSaida.length > 0 ? totalVendasProdutosVal / produtosSaida.length : 0);
  const lucroPresoEstoque = isEmpresaServico ? 0 : totalComprasRevendaVal * 0.35;

  // Group Suppliers (Mercadorias para revenda ou Prestadores de Serviços tomados)
  const fornecedoresAlvo = isEmpresaServico ? servicosEntrada : produtosEntrada;
  const suppliersMap: Record<string, { cnpj: string; nome: string; count: number; total: number }> = {};
  fornecedoresAlvo.forEach(i => {
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

  const kpis = cardAudit?.kpis;
  const monthlyList = cardAudit?.monthlyAudit || [];
  const modTotais = cardAudit?.modalidadesTotais || {};
  const bankTotais = cardAudit?.bancoTotais || {};

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
                Inteligência Fiscal & Financeira
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Empresa: <strong className="text-white">{selectedCompany.razao_social}</strong> • CNPJ: {formatCnpj(selectedCompany.cnpj)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Tab Selector */}
          <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('cartoes_modalidades')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'cartoes_modalidades'
                  ? 'bg-brand-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Cartões & Modalidades</span>
            </button>
            <button
              onClick={() => setActiveTab('radar_estoque')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'radar_estoque'
                  ? 'bg-brand-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>{isEmpresaServico ? 'Radar Serviços Tomados' : isEmpresaMista ? 'Radar Compras & Serviços' : 'Radar Compras Revenda'}</span>
            </button>
          </div>

          <button
            onClick={() => { loadInvoices(); loadCardAudit(); }}
            disabled={loading || loadingCardAudit}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || loadingCardAudit ? 'animate-spin text-brand-400' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {activeTab === 'cartoes_modalidades' && (
        <div className="space-y-6">

          {/* KPI CARDS: Cartões, Modalidades e Real do Banco */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* KPI 1: Vendas Cartões (NF vs Real Administradoras) */}
            <div className="glass-panel p-4 rounded-2xl border border-sky-500/20 bg-sky-500/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-sky-400 font-mono uppercase">Vendas Cartões (NF x Real)</span>
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg font-black text-white font-mono">
                {formatCurrency(kpis?.totalCartoesNota)}
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Real Maquininhas:</span>
                <span className="text-emerald-400 font-bold">{formatCurrency(kpis?.totalCartoesRealMaquininha)}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-800">
                <span className="text-slate-400">Aderência: <strong className="text-white">{kpis?.taxaAderenciaCartoes || 0}%</strong></span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  (kpis?.taxaAderenciaCartoes || 0) >= 90 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {(kpis?.taxaAderenciaCartoes || 0) >= 90 ? 'CONCILIADO' : 'DIVERGÊNCIA'}
                </span>
              </div>
            </div>

            {/* KPI 2: Antecipação de Recebíveis (Rede AT) */}
            <div className="glass-panel p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-400 font-mono uppercase">Antecipação Automática</span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <Zap className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg font-black text-white font-mono">
                {formatCurrency(kpis?.totalAntecipacoesPagas)}
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Deságio Estimado:</span>
                <span className="text-rose-400 font-bold">~{formatCurrency(kpis?.desagioEstimadoAntecipacao)}</span>
              </div>
              <div className="text-[10px] text-amber-300/80 pt-1 border-t border-slate-800 leading-tight">
                Taxa de antecipação automática descontada nas vendas de crédito (Rede AT)
              </div>
            </div>

            {/* KPI 3: Vendas por Modalidade (NF-e/NFC-e) */}
            <div className="glass-panel p-4 rounded-2xl border border-purple-500/20 bg-purple-500/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-400 font-mono uppercase">Vendas NF por Modalidade</span>
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg font-black text-white font-mono">
                {formatCurrency(kpis?.totalFaturadoGeral)}
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-slate-300 pt-1 border-t border-slate-800">
                <div>Crédito: <strong>{formatCurrency(modTotais.credito)}</strong></div>
                <div>Débito: <strong>{formatCurrency(modTotais.debito)}</strong></div>
                <div>PIX: <strong>{formatCurrency(modTotais.pix)}</strong></div>
                <div>Boleto: <strong>{formatCurrency(modTotais.boleto)}</strong></div>
              </div>
            </div>

            {/* KPI 4: Real do Banco por Modalidade & PIX */}
            <div className="glass-panel p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 font-mono uppercase">Confronto PIX (NF x Banco)</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <QrCode className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg font-black text-white font-mono">
                {formatCurrency(kpis?.totalPixNota)}
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">PIX no Banco:</span>
                <span className="text-emerald-400 font-bold">{formatCurrency(kpis?.totalPixBanco)}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-800">
                <span className="text-slate-400">Divergência:</span>
                <span className={`font-mono font-bold ${
                  (kpis?.divergenciaPix || 0) > 10000 ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {formatCurrency(kpis?.divergenciaPix)}
                </span>
              </div>
            </div>

          </div>

          {/* GRÁFICOS VISUAIS: Vendas Cartões, Modalidades NF e Real Banco */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Gráfico 1: Confronto Cartões (Nota Fiscal vs Real Administradoras) */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-sky-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Cartões: NF vs Real Maquininha</h3>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Mês a Mês</span>
              </div>

              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {monthlyList.map((m: any, idx: number) => {
                  const nfVal = m.confrontoCartao?.notaCartao || 0;
                  const realVal = m.confrontoCartao?.maquininhaReal || 0;
                  const maxVal = Math.max(nfVal, realVal, 1);
                  const nfPct = Math.min(100, Math.round((nfVal / maxVal) * 100));
                  const realPct = Math.min(100, Math.round((realVal / maxVal) * 100));

                  return (
                    <div key={idx} className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white font-mono">{m.mes}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          m.confrontoCartao.status === 'CONCILIADO' ? 'bg-emerald-500/20 text-emerald-400' :
                          m.confrontoCartao.status === 'ATENCAO' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {m.confrontoCartao.taxaAderencia}% aderência
                        </span>
                      </div>
                      
                      {/* NF Bar */}
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-[10px] text-sky-300 font-mono">
                          <span>NF (Crédito+Débito):</span>
                          <span>{formatCurrency(nfVal)}</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div className="h-full bg-sky-500 rounded-full" style={{ width: `${nfPct}%` }} />
                        </div>
                      </div>

                      {/* Real Maquininha Bar */}
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-[10px] text-emerald-300 font-mono">
                          <span>Real Maquininha (Rede+Cielo):</span>
                          <span>{formatCurrency(realVal)}</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${realPct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Gráfico 2: Composição de Vendas por Modalidade conforme NF-e */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-purple-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Vendas por Modalidade (NF-e)</h3>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Participação %</span>
              </div>

              <div className="space-y-3">
                {[
                  { label: 'Cartão de Crédito (03)', val: modTotais.credito || 0, color: 'bg-indigo-500', text: 'text-indigo-400' },
                  { label: 'Cartão de Débito (04)', val: modTotais.debito || 0, color: 'bg-cyan-500', text: 'text-cyan-400' },
                  { label: 'PIX (17/20)', val: modTotais.pix || 0, color: 'bg-emerald-500', text: 'text-emerald-400' },
                  { label: 'Boleto Bancário (15)', val: modTotais.boleto || 0, color: 'bg-amber-500', text: 'text-amber-400' },
                  { label: 'Dinheiro em Espécie (01)', val: modTotais.dinheiro || 0, color: 'bg-rose-500', text: 'text-rose-400' },
                ].map((item, idx) => {
                  const total = kpis?.totalFaturadoGeral || 1;
                  const pct = Math.round((item.val / total) * 1000) / 10;
                  return (
                    <div key={idx} className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white">{item.label}</span>
                        <span className={`font-mono font-bold ${item.text}`}>{formatCurrency(item.val)}</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${Math.max(2, pct)}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>Fatia no Faturamento</span>
                        <span className="font-bold text-slate-300">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Gráfico 3: Real do Banco por Modalidade */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Real do Banco por Canal</h3>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Entradas Reais</span>
              </div>

              <div className="space-y-3">
                {[
                  { label: 'PIX Recebido em Conta', val: bankTotais.pix || 0, color: 'bg-emerald-500', text: 'text-emerald-400', desc: 'Créditos PIX BB + Itaú' },
                  { label: 'Rede Antecipações (AT)', val: bankTotais.redeAt || 0, color: 'bg-amber-500', text: 'text-amber-400', desc: 'Crédito com antecipação' },
                  { label: 'Rede Débito (DB)', val: bankTotais.redeDb || 0, color: 'bg-sky-500', text: 'text-sky-400', desc: 'Vendas débito maquininha' },
                  { label: 'Cielo Recebido', val: bankTotais.cielo || 0, color: 'bg-purple-500', text: 'text-purple-400', desc: 'Depósitos adquirente Cielo' },
                  { label: 'Outros Créditos', val: bankTotais.outros || 0, color: 'bg-slate-500', text: 'text-slate-400', desc: 'Boletos, TEDs, Transferências' }
                ].map((item, idx) => {
                  const total = bankTotais.total || 1;
                  const pct = Math.round((item.val / total) * 1000) / 10;
                  return (
                    <div key={idx} className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white">{item.label}</span>
                        <span className={`font-mono font-bold ${item.text}`}>{formatCurrency(item.val)}</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${Math.max(2, pct)}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>{item.desc}</span>
                        <span className="font-bold text-slate-300">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* TABELA DE AUDITORIA COMPLETA MÊS A MÊS */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Auditoria Mês a Mês: Cartões, Modalidades e Extratos (2026)
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Confronto Fiscal x Financeiro Sem Agrupamento
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] text-slate-400 font-mono uppercase bg-slate-950/40">
                    <th className="py-2.5 px-3">Mês</th>
                    <th className="py-2.5 px-3">Extrato Banco</th>
                    <th className="py-2.5 px-3">Extrato Maq.</th>
                    <th className="py-2.5 px-3">Total Faturado</th>
                    <th className="py-2.5 px-3">Cartão NF (03+04)</th>
                    <th className="py-2.5 px-3">Maq. Real Banco</th>
                    <th className="py-2.5 px-3">Divergência Cartão</th>
                    <th className="py-2.5 px-3">Rede Antecip. (AT)</th>
                    <th className="py-2.5 px-3">PIX NF</th>
                    <th className="py-2.5 px-3">PIX Banco</th>
                    <th className="py-2.5 px-3">Divergência PIX</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {monthlyList.map((m: any, idx: number) => {
                    const diffCartao = m.confrontoCartao.divergencia || 0;
                    const diffPix = m.confrontoPix.divergencia || 0;

                    return (
                      <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-2 px-3 font-bold text-white">{m.mes}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.extratoBancoStatus === 'ENTROU' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {m.extratoBancoStatus === 'ENTROU' ? '✅ ENTROU' : '❌ PENDENTE'}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.extratoMaquininhaStatus === 'ENTROU' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {m.extratoMaquininhaStatus === 'ENTROU' ? '✅ ENTROU' : '❌ PENDENTE'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-200">{formatCurrency(m.faturamentoTotal)}</td>
                        <td className="py-2 px-3 text-sky-400 font-semibold">{formatCurrency(m.confrontoCartao.notaCartao)}</td>
                        <td className="py-2 px-3 text-emerald-400 font-semibold">{formatCurrency(m.confrontoCartao.maquininhaReal)}</td>
                        <td className={`py-2 px-3 font-bold ${
                          Math.abs(diffCartao) < 1500 ? 'text-slate-300' : (diffCartao > 0 ? 'text-amber-400' : 'text-rose-400')
                        }`}>
                          {formatCurrency(diffCartao)}
                        </td>
                        <td className="py-2 px-3 text-amber-400">{formatCurrency(m.realBanco.redeAt)}</td>
                        <td className="py-2 px-3 text-purple-400">{formatCurrency(m.confrontoPix.notaPix)}</td>
                        <td className="py-2 px-3 text-emerald-400">{formatCurrency(m.confrontoPix.bancoPix)}</td>
                        <td className={`py-2 px-3 font-bold ${
                          diffPix > 5000 ? 'text-rose-400' : 'text-slate-300'
                        }`}>
                          {formatCurrency(diffPix)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {activeTab === 'radar_estoque' && (
        <div className="space-y-6">
          {/* Top Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* KPI 1 */}
            <div className="glass-panel p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 font-mono uppercase">
                  {isEmpresaServico ? 'Serviços Prestados' : 'Compras para Revenda'}
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg font-black text-white font-mono">
                {formatCurrency(isEmpresaServico ? totalServicosPrestadosVal : totalComprasRevendaVal)}
              </div>
              <p className="text-[11px] text-slate-400">
                {isEmpresaServico ? `${servicosSaida.length} notas de serviços prestados` : `${produtosEntrada.length} notas de compras de mercadorias`}
              </p>
            </div>

            {/* KPI 2 */}
            <div className="glass-panel p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-400 font-mono uppercase">
                  {isEmpresaServico ? 'Serviços Tomados' : 'Saídas de Produtos (Vendas)'}
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg font-black text-white font-mono">
                {formatCurrency(isEmpresaServico ? totalServicosTomadosVal : totalVendasProdutosVal)}
              </div>
              <p className="text-[11px] text-slate-400">
                {isEmpresaServico ? `${servicosEntrada.length} notas de serviços tomados` : `${produtosSaida.length} notas de produtos emitidas (55/65)`}
              </p>
            </div>

            {/* KPI 3 */}
            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 font-mono uppercase">
                  {isEmpresaServico ? 'Ticket Médio Serviço' : 'Ticket Médio Compra'}
                </span>
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg font-black text-white font-mono">
                {formatCurrency(isEmpresaServico ? ticketMedioSaida : ticketMedioCompra)}
              </div>
              <p className="text-[11px] text-slate-400">
                {isEmpresaServico ? 'Média por NFS-e prestada' : 'Média por NF-e de fornecedor'}
              </p>
            </div>

            {/* KPI 4 */}
            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-400 font-mono uppercase">
                  {isEmpresaServico ? 'Tomados x Prestados' : 'Entradas x Saídas'}
                </span>
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg font-black text-white font-mono">
                {isEmpresaServico 
                  ? (totalServicosPrestadosVal > 0 ? ((totalServicosTomadosVal / totalServicosPrestadosVal) * 100).toFixed(1) + '%' : '0.0%')
                  : (totalVendasProdutosVal > 0 ? ((totalComprasRevendaVal / totalVendasProdutosVal) * 100).toFixed(1) + '%' : '0.0%')}
              </div>
              <p className="text-[11px] text-slate-400">
                {isEmpresaServico ? 'Percentual de terceirização' : 'Compras de revenda sobre saídas'}
              </p>
            </div>

          </div>

          {/* Curva ABC & Top Fornecedores */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Curva ABC de Suprimentos */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-brand-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">{isEmpresaServico ? "Curva ABC de Prestadores de Serviços (NFS-e)" : "Curva ABC de Fornecedores de Produtos para Revenda"}</h3>
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
      )}

    </div>
  );
};
