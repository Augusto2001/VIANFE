import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Company, TaxGuideItem, PayTaxGuideDto } from '../../types';
import { 
  FileText, 
  Copy, 
  Check, 
  Download, 
  ExternalLink, 
  Share2, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  DollarSign, 
  QrCode, 
  RefreshCw, 
  Filter, 
  ShieldCheck, 
  X,
  CreditCard,
  Building2,
  FileCheck
} from 'lucide-react';

interface PortalTaxGuidesTabProps {
  company: Company;
}

export const PortalTaxGuidesTab: React.FC<PortalTaxGuidesTabProps> = ({ company }) => {
  const [guides, setGuides] = useState<TaxGuideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendente' | 'vencido' | 'pago'>('all');
  const [copiedPixId, setCopiedPixId] = useState<string | null>(null);
  const [copiedBarId, setCopiedBarId] = useState<string | null>(null);

  // Payment Confirmation Modal State
  const [paymentModalGuide, setPaymentModalGuide] = useState<TaxGuideItem | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentObservacoes, setPaymentObservacoes] = useState('');
  const [paymentComprovante, setPaymentComprovante] = useState('');
  const [paying, setPaying] = useState(false);

  const loadGuides = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getPortalTaxGuides(company.id);
      setGuides(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar guias:', err);
      setError(err.message || 'Falha ao buscar guias fiscais.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGuides();
  }, [company.id]);

  const formatCurrency = (val: number | undefined | null) => {
    return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    const clean = dateStr.split('T')[0];
    return clean.split('-').reverse().join('/');
  };

  const getUrgencyStatus = (guide: TaxGuideItem) => {
    const s = guide.status.toLowerCase();
    if (s === 'pago') return 'pago';
    if (s === 'cancelado') return 'cancelado';

    const today = new Date().toISOString().split('T')[0];
    const due = guide.data_vencimento ? guide.data_vencimento.split('T')[0] : today;

    if (due < today) return 'vencido';
    if (due === today) return 'vence_hoje';
    return 'a_vencer';
  };

  const renderStatusBadge = (guide: TaxGuideItem) => {
    const urgency = getUrgencyStatus(guide);

    switch (urgency) {
      case 'pago':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Pago
          </span>
        );
      case 'vencido':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Vencido
          </span>
        );
      case 'vence_hoje':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-500/25 text-amber-300 border border-amber-500/50 flex items-center gap-1 animate-pulse">
            <Clock className="w-3 h-3" /> Vence Hoje!
          </span>
        );
      case 'a_vencer':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1">
            <Clock className="w-3 h-3" /> A Vencer
          </span>
        );
    }
  };

  const handleCopyPix = (guide: TaxGuideItem) => {
    const pixCode = guide.pix_copia_e_cola || '';
    if (!pixCode) return;
    navigator.clipboard.writeText(pixCode);
    
    if (typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(50); } catch (_) {}
    }

    setCopiedPixId(guide.id);
    setTimeout(() => setCopiedPixId(null), 3000);
  };

  const handleCopyBarcode = (guide: TaxGuideItem) => {
    if (!guide.codigo_barras_linha_digitavel) return;
    navigator.clipboard.writeText(guide.codigo_barras_linha_digitavel);
    setCopiedBarId(guide.id);
    setTimeout(() => setCopiedBarId(null), 3000);
  };

  const handleOpenPaymentModal = (guide: TaxGuideItem) => {
    setPaymentModalGuide(guide);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentObservacoes('');
    setPaymentComprovante('');
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalGuide) return;

    try {
      setPaying(true);
      const payload: PayTaxGuideDto = {
        status: 'pago',
        data_pagamento: paymentDate,
        observacoes: paymentObservacoes || undefined,
        comprovante_url: paymentComprovante || undefined,
      };

      await api.payPortalTaxGuide(paymentModalGuide.id, payload);
      setPaymentModalGuide(null);
      await loadGuides();
    } catch (err: any) {
      alert(`Erro ao registrar pagamento: ${err.message}`);
    } finally {
      setPaying(false);
    }
  };

  // Filter logic
  const filteredGuides = guides.filter((g) => {
    const urgency = getUrgencyStatus(g);
    if (statusFilter === 'pago') return urgency === 'pago';
    if (statusFilter === 'vencido') return urgency === 'vencido';
    if (statusFilter === 'pendente') return urgency === 'a_vencer' || urgency === 'vence_hoje';
    return true;
  });

  const totalPendentes = guides.filter(g => getUrgencyStatus(g) !== 'pago').reduce((acc, g) => acc + g.valor_total, 0);

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                  Central Fiscal & Tributária
                </span>
                <span className="text-xs text-slate-400 font-mono">1-Clique PIX</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
                Guias de Impostos & Tributos
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Pague o DAS do Simples Nacional, ICMS, Folha e Taxas com código PIX Copia-e-Cola direto no seu banco.
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Total Pendente a Vencer:</span>
            <span className="text-xl font-black text-amber-400 font-mono">
              {formatCurrency(totalPendentes)}
            </span>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Todas ({guides.length})
            </button>
            <button
              onClick={() => setStatusFilter('pendente')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'pendente' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              A Vencer ({guides.filter(g => ['a_vencer', 'vence_hoje'].includes(getUrgencyStatus(g))).length})
            </button>
            <button
              onClick={() => setStatusFilter('vencido')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'vencido' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Vencidas ({guides.filter(g => getUrgencyStatus(g) === 'vencido').length})
            </button>
            <button
              onClick={() => setStatusFilter('pago')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'pago' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Pagas ({guides.filter(g => getUrgencyStatus(g) === 'pago').length})
            </button>
          </div>

          <button
            onClick={loadGuides}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-950 text-slate-400 hover:text-white border border-slate-800 transition-colors"
            title="Atualizar guias"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Guides List */}
      <div className="space-y-4">
        {loading && guides.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 text-xs animate-pulse">
            Carregando guias tributárias da empresa...
          </div>
        ) : error && guides.length === 0 ? (
          <div className="bg-slate-900 border border-rose-800/40 rounded-3xl p-8 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
            <h4 className="text-sm font-bold text-white">Falha ao carregar guias</h4>
            <p className="text-xs text-slate-400">{error}</p>
            <button
              onClick={loadGuides}
              className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl"
            >
              Tentar Novamente
            </button>
          </div>
        ) : filteredGuides.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 text-xs space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="font-bold text-white">Nenhuma guia pendente encontrada.</p>
            <p className="text-slate-400">Todos os tributos apurados estão em dia.</p>
          </div>
        ) : (
          filteredGuides.map((guide) => {
            const urgency = getUrgencyStatus(guide);
            const isPaid = urgency === 'pago';

            return (
              <div
                key={guide.id}
                className={`border rounded-3xl p-5 sm:p-6 shadow-xl transition-all relative overflow-hidden ${
                  isPaid 
                    ? 'bg-slate-900/60 border-slate-800/80 opacity-85'
                    : urgency === 'vence_hoje'
                    ? 'bg-slate-900 border-amber-500/50 shadow-amber-950/20'
                    : urgency === 'vencido'
                    ? 'bg-slate-900 border-rose-500/40 shadow-rose-950/20'
                    : 'bg-slate-900 border-slate-800 hover:border-emerald-500/30'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  
                  {/* Guide Info */}
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {renderStatusBadge(guide)}
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                        Comp: {guide.competencia || '-'}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {guide.tipo_tributo?.replace('_', ' ')}
                      </span>
                    </div>

                    <h4 className="text-base font-black text-white tracking-tight">
                      {guide.titulo || `Guia de Recolhimento - ${guide.tipo_tributo}`}
                    </h4>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Vencimento: <strong className="text-white">{formatDate(guide.data_vencimento)}</strong>
                      </span>
                      {guide.data_pagamento && (
                        <span className="text-emerald-400 font-mono">
                          Pago em: {formatDate(guide.data_pagamento)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Values & Main 1-Click PIX Action */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0">
                    
                    <div className="text-left sm:text-right">
                      <span className="text-xs text-slate-400 block font-medium">Valor Total a Pagar:</span>
                      <span className="text-2xl font-black text-white font-mono">
                        {formatCurrency(guide.valor_total)}
                      </span>
                    </div>

                    {/* PIX 1-Click Button */}
                    {!isPaid && guide.pix_copia_e_cola ? (
                      <button
                        onClick={() => handleCopyPix(guide)}
                        className={`min-h-[48px] px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                          copiedPixId === guide.id
                            ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30'
                            : 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-950/50'
                        }`}
                      >
                        {copiedPixId === guide.id ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Código PIX Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Copiar Código PIX</span>
                          </>
                        )}
                      </button>
                    ) : !isPaid ? (
                      <div className="text-xs text-slate-500 italic py-2 px-3 bg-slate-950 rounded-xl border border-slate-800">
                        PIX em processamento
                      </div>
                    ) : null}

                  </div>

                </div>

                {/* Secondary Actions Row: PDF, Barcode, WhatsApp, Mark as Paid */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-4 mt-4 border-t border-slate-800/80 text-xs">
                  
                  <div className="flex flex-wrap items-center gap-2">
                    {/* View / Download PDF */}
                    <a
                      href={api.getPortalTaxGuidePdfUrl(guide.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 flex items-center gap-1.5 transition-colors"
                      title="Visualizar Guia em PDF"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Baixar PDF</span>
                    </a>

                    {/* Copy Barcode Line */}
                    {guide.codigo_barras_linha_digitavel && (
                      <button
                        onClick={() => handleCopyBarcode(guide)}
                        className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 flex items-center gap-1.5 transition-colors"
                        title="Copiar Linha Digitável / Código de Barras"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{copiedBarId === guide.id ? 'Linha Copiada!' : 'Copiar Código de Barras'}</span>
                      </button>
                    )}

                    {/* WhatsApp Share */}
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                        `Olá! Segue a Guia Fiscal ${guide.titulo} da empresa ${company.razao_social} no valor de ${formatCurrency(
                          guide.valor_total
                        )} com vencimento em ${formatDate(guide.data_vencimento)}.${
                          guide.pix_copia_e_cola ? `\n\nCódigo PIX para pagamento:\n${guide.pix_copia_e_cola}` : ''
                        }`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 rounded-xl flex items-center gap-1.5 transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Enviar no WhatsApp</span>
                    </a>
                  </div>

                  {/* Mark as Paid Action */}
                  {!isPaid ? (
                    <button
                      onClick={() => handleOpenPaymentModal(guide)}
                      className="px-3.5 py-1.5 bg-slate-950 hover:bg-emerald-950/40 text-emerald-400 hover:text-emerald-300 border border-slate-800 hover:border-emerald-500/40 rounded-xl font-bold flex items-center gap-1.5 transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Informar Pagamento</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4" /> Pagamento conciliado pela Viacont
                    </span>
                  )}

                </div>

              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* PAYMENT CONFIRMATION DIALOG MODAL */}
      {/* ========================================================================= */}
      {paymentModalGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-in">
            
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Confirmar Pagamento de Guia</h3>
                  <p className="text-[11px] text-slate-400">{paymentModalGuide.titulo}</p>
                </div>
              </div>

              <button
                onClick={() => setPaymentModalGuide(null)}
                className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="p-5 space-y-4">
              
              <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">Valor Pago:</span>
                <span className="text-base font-black text-emerald-400 font-mono">
                  {formatCurrency(paymentModalGuide.valor_total)}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Data do Pagamento Efetivo:</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Observações / Banco Utilizado:</label>
                <input
                  type="text"
                  value={paymentObservacoes}
                  onChange={(e) => setPaymentObservacoes(e.target.value)}
                  placeholder="Ex: Pago via PIX Banco Inter conta corrente..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Link ou Comprovante (Opcional):</label>
                <input
                  type="text"
                  value={paymentComprovante}
                  onChange={(e) => setPaymentComprovante(e.target.value)}
                  placeholder="Ex: comprovante_das_agosto.pdf"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalGuide(null)}
                  className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl border border-slate-800"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={paying}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-950/40 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{paying ? 'Salvando...' : 'Confirmar Pagamento'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
