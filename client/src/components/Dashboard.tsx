import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Company, Invoice, InvoiceSummary } from '../types';
import { api } from '../services/api';
import { LiveEngineStream } from './LiveEngineStream';
import { ManifestationModal } from './ManifestationModal';
import { 
  Search, 
  Calendar, 
  Download, 
  FileCode, 
  FileText, 
  HardDrive, 
  Eye, 
  Filter, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  Building2, 
  CheckSquare, 
  Square, 
  AlertCircle,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';

interface DashboardProps {
  selectedCompany: Company | null;
  onOpenNewCompanyModal: () => void;
  onOpenImporter: () => void;
  onSelectInvoice: (invoice: Invoice) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  selectedCompany,
  onOpenNewCompanyModal,
  onOpenImporter,
  onSelectInvoice,
}) => {
  // Filters State
  const [period, setPeriod] = useState<'7d' | '15d' | '30d' | 'all' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tipo, setTipo] = useState<'all' | 'entrada' | 'saida'>('all');
  const [status, setStatus] = useState<'all' | 'autorizada' | 'cancelada'>('all');
  const [search, setSearch] = useState('');
  
  // Data State
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary>({
    totalCount: 0,
    totalValor: 0,
    valorEntradas: 0,
    valorSaidas: 0,
    totalGdriveSynced: 0,
    totalGdrivePending: 0,
  });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Selection for Batch Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [syncingInvoiceId, setSyncingInvoiceId] = useState<string | null>(null);
  const [manifestingInvoice, setManifestingInvoice] = useState<Invoice | null>(null);

  // Active company ID ref to prevent race condition responses from overwriting current company
  const activeCompanyIdRef = useRef<string | null>(selectedCompany?.id || null);

  // Immediate reset on company change so stale notes from previous company are never displayed
  useEffect(() => {
    activeCompanyIdRef.current = selectedCompany?.id || null;
    setInvoices([]);
    setSummary({
      totalCount: 0,
      totalValor: 0,
      valorEntradas: 0,
      valorSaidas: 0,
      totalGdriveSynced: 0,
      totalGdrivePending: 0,
    });
    setPage(1);
    setSelectedIds([]);
  }, [selectedCompany?.id]);

  // Fetch Invoices exclusively for selected company
  const loadInvoices = useCallback(async () => {
    if (!selectedCompany) {
      setInvoices([]);
      setSummary({ totalCount: 0, totalValor: 0, valorEntradas: 0, valorSaidas: 0, totalGdriveSynced: 0, totalGdrivePending: 0 });
      return;
    }

    const currentCompanyId = selectedCompany.id;

    try {
      setLoading(true);
      const res = await api.getInvoices({
        company_id: currentCompanyId,
        period: period,
        startDate: period === 'custom' ? startDate : undefined,
        endDate: period === 'custom' ? endDate : undefined,
        tipo: tipo === 'all' ? undefined : tipo,
        status: status === 'all' ? undefined : status,
        search: search || undefined,
        page,
        limit: 50,
      });

      // Discard response if user has already switched to another company
      if (activeCompanyIdRef.current !== currentCompanyId) {
        return;
      }

      setInvoices(res.invoices);
      if (res.summary) setSummary(res.summary);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Error fetching company invoices:', err);
    } finally {
      if (activeCompanyIdRef.current === currentCompanyId) {
        setLoading(false);
      }
    }
  }, [selectedCompany, period, startDate, endDate, tipo, status, search, page]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [period, startDate, endDate, tipo, status, search]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // Handle batch selection
  const toggleSelectAll = () => {
    if (selectedIds.length === invoices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(invoices.map(i => i.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Batch Download ZIP
  const handleDownloadZip = async (type: 'xml' | 'pdf') => {
    if (!selectedCompany) return;
    try {
      setBatchLoading(true);
      const blob = await api.downloadZip(
        selectedCompany.id, 
        type, 
        selectedIds.length > 0 ? selectedIds : undefined,
        {
          period,
          startDate: period === 'custom' ? startDate : undefined,
          endDate: period === 'custom' ? endDate : undefined,
          tipo: tipo === 'all' ? undefined : tipo,
          status: status === 'all' ? undefined : status,
          search: search || undefined,
        }
      );
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Notas_${type.toUpperCase()}_${selectedCompany.razao_social.substring(0, 20)}_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Erro ao gerar ZIP: ${err.message}`);
    } finally {
      setBatchLoading(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (!invoices.length || !selectedCompany) return;
    
    const headers = ['Chave de Acesso', 'Número', 'Série', 'Tipo', 'Data Emissão', 'CNPJ Emitente', 'Razão Social Emitente', 'Valor Total (R$)', 'Status', 'Sincronizado Drive'];
    const rows = invoices.map(i => [
      `"${i.chave_acesso}"`,
      `"${i.numero}"`,
      `"${i.serie}"`,
      `"${i.tipo.toUpperCase()}"`,
      `"${i.data_emissao}"`,
      `"${i.emitente_cnpj}"`,
      `"${i.emitente_nome.replace(/"/g, '""')}"`,
      i.valor_total.toFixed(2),
      `"${i.status.toUpperCase()}"`,
      i.gdrive_synced ? 'SIM' : 'NÃO'
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Relatorio_Fiscal_${selectedCompany.razao_social.substring(0, 20)}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSyncSingleInvoice = async (invoiceId: string) => {
    try {
      setSyncingInvoiceId(invoiceId);
      await api.syncInvoiceToDrive(invoiceId);
      loadInvoices();
    } catch (err: any) {
      alert(`Erro ao sincronizar com Google Drive: ${err.message}`);
    } finally {
      setSyncingInvoiceId(null);
    }
  };

  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatCnpj = (cnpj?: string) => {
    if (!cnpj) return '';
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length === 14) {
      return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    if (clean.length === 11) {
      return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    }
    return cnpj;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  // Guard: No company selected
  if (!selectedCompany) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
          <Building2 className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-white">Nenhuma Empresa Cliente Selecionada</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto mt-2">
          Selecione uma empresa no cabeçalho ou cadastre uma nova empresa cliente para iniciar o monitoramento fiscal.
        </p>
        <button
          onClick={onOpenNewCompanyModal}
          className="mt-5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all inline-flex items-center gap-2"
        >
          <Building2 className="w-4 h-4" />
          Cadastrar Empresa
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      
      {/* 1. Sleek 1-Line Status Strip (No visual clutter) */}
      <LiveEngineStream selectedCompany={selectedCompany} />

      {/* 2. Top KPI Summary Cards (Clean Inter typography & balanced contrast) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Total Volume */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Total de Notas</span>
            <span className="p-1 rounded bg-slate-800 text-slate-300">
              <FileText className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-bold text-white">
            {summary.totalCount}
          </div>
          <div className="text-[11px] text-slate-400">
            Volume total: <span className="font-semibold text-slate-200">{formatCurrency(summary.totalValor)}</span>
          </div>
        </div>

        {/* Entradas */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Notas Recebidas (Entradas)</span>
            <span className="p-1 rounded bg-blue-500/10 text-blue-300">
              <ArrowDownLeft className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {formatCurrency(summary.valorEntradas)}
          </div>
          <p className="text-[11px] text-slate-400">Compras e insumos de fornecedores</p>
        </div>

        {/* Saídas */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Notas Emitidas (Saídas)</span>
            <span className="p-1 rounded bg-amber-500/10 text-amber-300">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {formatCurrency(summary.valorSaidas)}
          </div>
          <p className="text-[11px] text-slate-400">Faturamento e vendas da empresa</p>
        </div>

        {/* Google Drive Status */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Backup Google Drive</span>
            <span className="p-1 rounded bg-slate-800 text-slate-300">
              <HardDrive className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-bold text-white flex items-baseline gap-1.5">
            <span className="text-emerald-400">{summary.totalGdriveSynced}</span>
            <span className="text-xs text-slate-400 font-normal">/ {summary.totalCount} sincronizadas</span>
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            {summary.totalGdrivePending > 0 ? (
              <span className="text-amber-400">{summary.totalGdrivePending} pendente(s)</span>
            ) : (
              <span className="text-emerald-400">Tudo em dia</span>
            )}
          </div>
        </div>

      </div>

      {/* 3. Filter Bar (Period, Type, Search, Status) */}
      <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          
          {/* Period Selector Buttons */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
            {(['all', '7d', '15d', '30d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  period === p ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p === 'all' ? 'Todos' : p === '7d' ? '7 dias' : p === '15d' ? '15 dias' : '30 dias'}
              </button>
            ))}
            <button
              onClick={() => setPeriod('custom')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                period === 'custom' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Personalizado</span>
            </button>
          </div>

          {/* Type Filter (Entrada / Saída / Todas) */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setTipo('all')}
              className={`px-3 py-1 rounded-md transition-colors ${
                tipo === 'all' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setTipo('entrada')}
              className={`px-3 py-1 rounded-md transition-colors ${
                tipo === 'entrada' ? 'bg-blue-500/20 text-blue-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Entradas
            </button>
            <button
              onClick={() => setTipo('saida')}
              className={`px-3 py-1 rounded-md transition-colors ${
                tipo === 'saida' ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Saídas
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por número, emitente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-600"
            />
          </div>

        </div>

        {/* Custom Date Range Drawer */}
        {period === 'custom' && (
          <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 animate-fade-in bg-slate-950/60 p-3 rounded-lg">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-300">Data Inicial:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-300">Data Final:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400 mr-1">Atalhos:</span>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                  setStartDate(firstDay.toISOString().split('T')[0]);
                  setEndDate(now.toISOString().split('T')[0]);
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[11px] font-medium transition-colors"
              >
                Mês Atual
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
                  setStartDate(firstDay.toISOString().split('T')[0]);
                  setEndDate(lastDay.toISOString().split('T')[0]);
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[11px] font-medium transition-colors"
              >
                Mês Anterior
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const d = new Date();
                  d.setDate(d.getDate() - 90);
                  setStartDate(d.toISOString().split('T')[0]);
                  setEndDate(now.toISOString().split('T')[0]);
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[11px] font-medium transition-colors"
              >
                Últimos 90 dias
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartDate('2026-01-01');
                  setEndDate('2026-12-31');
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[11px] font-medium transition-colors"
              >
                Ano 2026
              </button>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="px-2 py-1 text-rose-400 hover:text-rose-300 text-[11px] font-medium transition-colors ml-1"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. Batch Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <button
          onClick={toggleSelectAll}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors font-medium min-h-[44px]"
        >
          {selectedIds.length > 0 && selectedIds.length === invoices.length ? (
            <CheckSquare className="w-4 h-4 text-emerald-400" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          <span>
            {selectedIds.length === 0 ? 'Selecionar Todas' : `${selectedIds.length} selecionada(s)`}
          </span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownloadZip('xml')}
            disabled={batchLoading || invoices.length === 0}
            className="min-h-[44px] flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-medium border border-slate-800 transition-colors disabled:opacity-40"
          >
            <FileCode className="w-4 h-4 text-slate-400" />
            <span>Baixar XMLs (.ZIP)</span>
          </button>

          <button
            onClick={() => handleDownloadZip('pdf')}
            disabled={batchLoading || invoices.length === 0}
            className="min-h-[44px] flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-medium border border-slate-800 transition-colors disabled:opacity-40"
          >
            <FileText className="w-4 h-4 text-slate-400" />
            <span>Baixar PDFs (.ZIP)</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={invoices.length === 0}
            className="min-h-[44px] flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-medium border border-slate-800 transition-colors disabled:opacity-40"
          >
            <Download className="w-4 h-4 text-slate-400" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* 5. Invoices Table: Clean, no redundant Destinatário column, proper spacing */}
      <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60 shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <span className="sr-only">Seleção</span>
                </th>
                <th className="py-3 px-3 whitespace-nowrap">Data</th>
                <th className="py-3 px-3 whitespace-nowrap">Nº / Série</th>
                <th className="py-3 px-3 whitespace-nowrap">Tipo</th>
                <th className="py-3 px-4 min-w-[240px]">Emitente / Cliente</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Valor Total</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Status</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Drive</th>
                <th className="py-3 px-3.5 text-center w-48">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400 mb-2" />
                    <span>Carregando notas fiscais...</span>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-900 text-slate-400 flex items-center justify-center mx-auto border border-slate-800">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <h4 className="font-semibold text-white text-sm">
                        Nenhuma nota fiscal encontrada
                      </h4>
                      <p className="text-xs text-slate-400">
                        Não existem notas registradas para o filtro selecionado.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const isSelected = selectedIds.includes(inv.id);
                  const isSyncingThis = syncingInvoiceId === inv.id;

                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-slate-900/50 transition-colors ${
                        isSelected ? 'bg-slate-900/90' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => toggleSelect(inv.id)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-300"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Data Emissão */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-300 text-xs">
                        {formatDate(inv.data_emissao)}
                      </td>

                      {/* Numero & Serie */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-semibold text-white">{inv.numero}</span>
                        <span className="text-slate-400 text-[11px] ml-1.5">S:{inv.serie}</span>
                      </td>

                      {/* Tipo: Soft Blue for Entrada, Soft Amber for Saída */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          inv.tipo === 'entrada'
                            ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        }`}>
                          {inv.tipo === 'entrada' ? (
                            <>
                              <ArrowDownLeft className="w-3 h-3" />
                              Entrada
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-3 h-3" />
                              Saída
                            </>
                          )}
                        </span>
                      </td>

                      {/* Emitente / Cliente (Shows supplier for Entradas and customer for Saídas) */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-100 line-clamp-1" title={inv.tipo === 'saida' ? (inv.destinatario_nome || (inv.modelo === '65' ? 'Consumidor Final - Venda Balcão' : 'Não informado')) : inv.emitente_nome}>
                          {inv.tipo === 'saida' ? (inv.destinatario_nome || (inv.modelo === '65' ? 'Consumidor Final - Venda Balcão' : 'Não informado')) : inv.emitente_nome}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                          <span>
                            {inv.tipo === 'saida'
                              ? (() => {
                                  const cEmit = (inv.emitente_cnpj || '').replace(/\D/g, '');
                                  const cDest = (inv.destinatario_cnpj || '').replace(/\D/g, '');
                                  const isSame = Boolean(cEmit && cDest && cEmit === cDest);
                                  if (!inv.destinatario_cnpj || isSame) {
                                    return inv.modelo === '65' ? 'CPF não informado no cupom' : 'Não informado';
                                  }
                                  return formatCnpj(inv.destinatario_cnpj);
                                })()
                              : formatCnpj(inv.emitente_cnpj)}
                          </span>
                          {inv.tipo === 'saida' && (
                            <span className="text-[10px] text-slate-500">• Emitente: {inv.emitente_nome?.substring(0, 18)}</span>
                          )}
                        </div>
                      </td>

                      {/* Valor Total (Right-aligned, clean font) */}
                      <td className="py-3 px-4 text-right font-semibold text-slate-100 whitespace-nowrap text-xs">
                        {formatCurrency(inv.valor_total)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          inv.status === 'autorizada'
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                        }`}>
                          {inv.status}
                        </span>
                      </td>

                      {/* Google Drive */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {inv.gdrive_synced ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400" title="Sincronizada no Google Drive">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>OK</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSyncSingleInvoice(inv.id)}
                            disabled={isSyncingThis}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-[10px] font-medium border border-slate-800 transition-colors"
                            title="Sincronizar agora com Google Drive"
                          >
                            <RefreshCw className={`w-3 h-3 ${isSyncingThis ? 'animate-spin text-emerald-400' : ''}`} />
                            <span>Sincronizar</span>
                          </button>
                        )}
                      </td>

                      {/* Actions: View, PDF, XML, Manifest */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          
                          {/* View Detail Modal */}
                          <button
                            onClick={() => onSelectInvoice(inv)}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
                            title="Ver detalhes completos da nota"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* PDF / DANFE */}
                          <a
                            href={api.getPdfDownloadUrl(inv.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
                            title="Abrir DANFE em PDF"
                          >
                            <FileText className="w-4 h-4" />
                          </a>

                          {/* XML */}
                          <a
                            href={api.getXmlDownloadUrl(inv.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
                            title="Baixar arquivo XML original"
                          >
                            <FileCode className="w-4 h-4" />
                          </a>

                          {/* Manifestação do Destinatário */}
                          <button
                            onClick={() => setManifestingInvoice(inv)}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 border border-slate-800 transition-colors"
                            title="Manifestação do Destinatário SEFAZ"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>

                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Página {page} de {totalPages}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                disabled={page === 1}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 border border-slate-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                disabled={page === totalPages}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 border border-slate-800"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Manifestation Modal */}
      {manifestingInvoice && (
        <ManifestationModal
          invoice={manifestingInvoice}
          company={selectedCompany}
          onClose={() => setManifestingInvoice(null)}
          onSuccess={() => {
            setManifestingInvoice(null);
            loadInvoices();
          }}
        />
      )}

    </div>
  );
};
