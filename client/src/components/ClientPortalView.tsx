import React, { useState, useEffect } from 'react';
import { Company, Invoice, PortalTab } from '../types';
import { api } from '../services/api';
import { PortalDashboardTab } from './portal/PortalDashboardTab';
import { PortalInvoiceIssuerTab } from './portal/PortalInvoiceIssuerTab';
import { PortalTaxGuidesTab } from './portal/PortalTaxGuidesTab';
import { PortalReceiptScannerTab } from './portal/PortalReceiptScannerTab';
import { PwaInstallPrompt } from './portal/PwaInstallPrompt';
import { 
  TrendingUp, 
  Zap, 
  FileText, 
  Camera, 
  ShieldCheck, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Sparkles,
  Smartphone,
  Laptop,
  ChevronDown,
  Layers,
  Check
} from 'lucide-react';

interface ClientPortalViewProps {
  company: Company;
  companies?: Company[];
  onSelectCompany?: (company: Company) => void;
}

export const ClientPortalView: React.FC<ClientPortalViewProps> = ({
  company,
  companies = [],
  onSelectCompany,
}) => {
  // Tab State with LocalStorage Persistence
  const [activeTab, setActiveTab] = useState<PortalTab>(() => {
    const saved = localStorage.getItem('viacont_portal_active_tab');
    if (saved && ['inicio_financas', 'emitir_notas', 'guias_impostos', 'recibos_scanner', 'manifestar_nfe'].includes(saved)) {
      return saved as PortalTab;
    }
    return 'inicio_financas';
  });

  const handleTabChange = (tab: PortalTab) => {
    setActiveTab(tab);
    localStorage.setItem('viacont_portal_active_tab', tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Supplier Invoices for Manifestation Tab
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [manifestingId, setManifestingId] = useState<string | null>(null);

  const loadManifestInvoices = async () => {
    try {
      setLoadingInvoices(true);
      const res = await api.getInvoices({ company_id: company.id, limit: 30, period: 'all' });
      setInvoices(res.invoices || []);
    } catch (err: any) {
      console.error('Erro ao carregar notas para manifestação:', err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  useEffect(() => {
    setInvoices([]);
    if (activeTab === 'manifestar_nfe') {
      loadManifestInvoices();
    }
  }, [company.id, activeTab]);

  const handleManifest = async (invoiceId: string, eventType: string) => {
    try {
      setManifestingId(invoiceId);
      await api.submitManifestation(invoiceId, eventType);
      alert('Manifestação registrada oficialmente com sucesso na SEFAZ!');
      loadManifestInvoices();
    } catch (err: any) {
      alert(`Erro ao manifestar: ${err.message}`);
    } finally {
      setManifestingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-8 animate-fade-in select-none">
      
      {/* PWA Install Banner */}
      <PwaInstallPrompt />

      {/* ========================================================================= */}
      {/* 1. TOP HEADER & PORTAL BRANDING */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          
          {/* Company Title & Switcher */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider flex items-center gap-1">
                <Smartphone className="w-3 h-3" /> Super App Viacont
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Área do Cliente</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-1">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {company.nome_fantasia || company.razao_social}
              </h1>

              {/* Company Switcher Dropdown if multiple companies exist */}
              {companies.length > 1 && onSelectCompany && (
                <div className="relative inline-block">
                  <select
                    value={company.id}
                    onChange={(e) => {
                      const selected = companies.find(c => c.id === e.target.value);
                      if (selected) onSelectCompany(selected);
                    }}
                    aria-label="Trocar empresa selecionada"
                    className="appearance-none bg-slate-950 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 text-xs font-bold py-1.5 pl-3 pr-8 rounded-xl cursor-pointer transition-colors focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    {companies.map((comp) => (
                      <option key={comp.id} value={comp.id} className="bg-slate-900 text-white">
                        {comp.nome_fantasia || comp.razao_social}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-emerald-400 absolute right-2.5 top-2.5 pointer-events-none" />
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 font-mono">
              CNPJ: {company.cnpj} • UF: {company.uf} {company.inscricao_municipal ? `• IM: ${company.inscricao_municipal}` : ''}
            </p>
          </div>

          {/* Desktop Nav Pills (Hidden on Mobile) */}
          <div className="hidden md:flex items-center gap-1 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 self-start md:self-auto shadow-inner">
            
            <button
              onClick={() => handleTabChange('inicio_financas')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'inicio_financas'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Início & Finanças</span>
            </button>

            <button
              onClick={() => handleTabChange('emitir_notas')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'emitir_notas'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>Emitir Notas</span>
            </button>

            <button
              onClick={() => handleTabChange('guias_impostos')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'guias_impostos'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Guias & PIX</span>
            </button>

            <button
              onClick={() => handleTabChange('recibos_scanner')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'recibos_scanner'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Recibos OCR</span>
            </button>

            <button
              onClick={() => handleTabChange('manifestar_nfe')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'manifestar_nfe'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Manifestar</span>
            </button>

          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. DYNAMIC ACTIVE SUB-TAB VIEW */}
      {/* ========================================================================= */}
      <div>
        {activeTab === 'inicio_financas' && (
          <PortalDashboardTab
            company={company}
            onNavigateTab={handleTabChange}
          />
        )}

        {activeTab === 'emitir_notas' && (
          <PortalInvoiceIssuerTab
            company={company}
          />
        )}

        {activeTab === 'guias_impostos' && (
          <PortalTaxGuidesTab
            company={company}
          />
        )}

        {activeTab === 'recibos_scanner' && (
          <PortalReceiptScannerTab
            company={company}
          />
        )}

        {/* Manifestação de Notas de Fornecedores */}
        {activeTab === 'manifestar_nfe' && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>Manifestação do Destinatário SEFAZ</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Confirme o recebimento das mercadorias ou recuse notas indevidas emitidas contra seu CNPJ.
                </p>
              </div>

              <button
                onClick={loadManifestInvoices}
                disabled={loadingInvoices}
                className="p-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors self-start sm:self-auto"
                title="Atualizar lista"
              >
                <RefreshCw className={`w-4 h-4 ${loadingInvoices ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-3">
              {invoices.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 text-xs">
                  Nenhuma nota fiscal pendente de manifestação no momento.
                </div>
              ) : (
                invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                          NF-e #{inv.numero}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Emissão: {inv.data_emissao ? inv.data_emissao.split('T')[0].split('-').reverse().join('/') : '-'}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-white truncate">
                        {inv.emitente_nome || 'Fornecedor'}
                      </h4>
                      <p className="text-xs text-slate-400 font-mono">
                        CNPJ Emitente: {inv.emitente_cnpj} • Chave: {inv.chave_acesso?.substring(0, 20)}...
                      </p>
                    </div>

                    <div className="flex flex-col md:flex-row items-start md:items-center gap-3 shrink-0">
                      <div className="text-left md:text-right">
                        <span className="text-xs text-slate-400 block">Valor:</span>
                        <span className="text-base font-black text-emerald-400 font-mono">
                          R$ {(inv.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={api.getPdfDownloadUrl(inv.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[44px] px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                        >
                          <FileText className="w-4 h-4 text-emerald-400" />
                          <span>DANFE</span>
                        </a>

                        <button
                          onClick={() => handleManifest(inv.id, 'confirmacao')}
                          disabled={manifestingId === inv.id}
                          className="min-h-[44px] px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Confirmar</span>
                        </button>

                        <button
                          onClick={() => handleManifest(inv.id, 'desconhecimento')}
                          disabled={manifestingId === inv.id}
                          className="min-h-[44px] px-3 py-2 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/60 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Recusar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. MOBILE PWA BOTTOM DOCK BAR (< 768px) */}
      {/* ========================================================================= */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-pb">
        
        {/* Dock Item 1: Início */}
        <button
          onClick={() => handleTabChange('inicio_financas')}
          className={`flex flex-col items-center justify-center min-w-[64px] min-h-[52px] rounded-2xl transition-all cursor-pointer ${
            activeTab === 'inicio_financas'
              ? 'text-emerald-400 font-bold bg-emerald-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Início</span>
        </button>

        {/* Dock Item 2: Emitir (Hero Action) */}
        <button
          onClick={() => handleTabChange('emitir_notas')}
          className={`flex flex-col items-center justify-center min-w-[68px] min-h-[52px] rounded-2xl transition-all cursor-pointer relative ${
            activeTab === 'emitir_notas'
              ? 'text-white font-bold bg-emerald-600 shadow-lg shadow-emerald-500/30'
              : 'text-emerald-400 font-semibold bg-slate-900 border border-emerald-500/30'
          }`}
        >
          <Zap className="w-5 h-5 mb-0.5 animate-pulse" />
          <span className="text-[10px] tracking-tight font-bold">Emitir</span>
        </button>

        {/* Dock Item 3: Guias */}
        <button
          onClick={() => handleTabChange('guias_impostos')}
          className={`flex flex-col items-center justify-center min-w-[64px] min-h-[52px] rounded-2xl transition-all cursor-pointer ${
            activeTab === 'guias_impostos'
              ? 'text-emerald-400 font-bold bg-emerald-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Guias</span>
        </button>

        {/* Dock Item 4: Recibos */}
        <button
          onClick={() => handleTabChange('recibos_scanner')}
          className={`flex flex-col items-center justify-center min-w-[64px] min-h-[52px] rounded-2xl transition-all cursor-pointer ${
            activeTab === 'recibos_scanner'
              ? 'text-emerald-400 font-bold bg-emerald-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Camera className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Recibos</span>
        </button>

      </div>

    </div>
  );
};
