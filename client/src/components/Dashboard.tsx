import React, { useState, useEffect, useCallback } from 'react';
import { Company, Invoice, InvoiceSummary } from '../types';
import { api } from '../services/api';
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
  FileArchive, 
  AlertCircle,
  TrendingUp,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  UploadCloud
} from 'lucide-react';
import confetti from 'canvas-confetti';

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
  const [period, setPeriod] = useState<'7d' | '15d' | '30d' | 'custom'>('30d');
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

  // Fetch Invoices exclusively for selected company
  const loadInvoices = useCallback(async () => {
    if (!selectedCompany) {
      setInvoices([]);
      setSummary({ totalCount: 0, totalValor: 0, valorEntradas: 0, valorSaidas: 0, totalGdriveSynced: 0, totalGdrivePending: 0 });
      return;
    }

    try {
      setLoading(true);
      const res = await api.getInvoices({
        company_id: selectedCompany.id,
        period,
        startDate: period === 'custom' ? startDate : undefined,
        endDate: period === 'custom' ? endDate : undefined,
        tipo,
        status,
        search,
        page,
        limit: 25,
      });

      setInvoices(res.invoices);
      setSummary(res.summary);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Error fetching company invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCompany, period, startDate, endDate, tipo, status, search, page]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [selectedCompany?.id, period, startDate, endDate, tipo, status, search]);

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
      const blob = await api.downloadZip(selectedCompany.id, type, selectedIds.length > 0 ? selectedIds : undefined);
      
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

  // Sync individual invoice to Drive
  const handleSyncDrive = async (invoiceId: string) => {
    try {
      setSyncingInvoiceId(invoiceId);
      await api.syncInvoiceToDrive(invoiceId);
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
      await loadInvoices();
    } catch (err: any) {
      alert(`Erro ao sincronizar com Google Drive: ${err.message}`);
    } finally {
      setSyncingInvoiceId(null);
    }
  };

  const formatCurrency = (val?: number) => {
    return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatCnpj = (cnpj: string) => {
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length === 14) {
      return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    return cnpj;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
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
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center mx-auto mb-4 border border-brand-500/20 shadow-xl">
          <Building2 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Nenhuma Empresa Cliente Selecionada</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto mt-2">
          Cadastre as empresas clientes do escritório para iniciar a gestão, downloads de XML/PDF e sincronização com o Google Drive.
        </p>
        <button
          onClick={onOpenNewCompanyModal}
          className="mt-6 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-brand-500/20 inline-flex items-center gap-2"
        >
          <Building2 className="w-4 h-4" />
          Cadastrar Primeira Empresa
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner: Selected Client Info & Sefaz Status */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-700 to-sky-500 flex items-center justify-center text-white font-bold shadow-md shadow-brand-500/20 text-lg shrink-0">
            {selectedCompany.razao_social.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">
                {selectedCompany.razao_social}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Isolamento Seguro
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
              <span>CNPJ: <strong className="text-slate-200">{formatCnpj(selectedCompany.cnpj)}</strong></span>
              <span>•</span>
              <span>UF: <strong className="text-slate-200">{selectedCompany.uf}</strong></span>
              <span>•</span>
              <span>Pasta Drive: <strong className="text-brand-400">{selectedCompany.gdrive_folder_name || 'Padrão'}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={onOpenImporter}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
          >
            <UploadCloud className="w-4 h-4 text-brand-400" />
            <span>Importar XMLs / Lote</span>
          </button>

          <button
            onClick={loadInvoices}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
            title="Atualizar lista de notas"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards: Strictly for Selected Company */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Notas */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Total de Notas no Período</span>
            <span className="p-1 rounded bg-brand-500/10 text-brand-400">
              <FileText className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {summary.totalCount}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
            <span>Volume:</span>
            <strong className="text-emerald-400">{formatCurrency(summary.totalValor)}</strong>
          </div>
        </div>

        {/* Entradas */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Notas Recebidas (Entradas)</span>
            <span className="p-1 rounded bg-emerald-500/10 text-emerald-400">
              <ArrowDownLeft className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {formatCurrency(summary.valorEntradas)}
          </div>
          <p className="text-[11px] text-slate-400">Compras e insumos de fornecedores</p>
        </div>

        {/* Saídas */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Notas Emitidas (Saídas)</span>
            <span className="p-1 rounded bg-sky-500/10 text-sky-400">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-black text-sky-400 font-mono">
            {formatCurrency(summary.valorSaidas)}
          </div>
          <p className="text-[11px] text-slate-400">Faturamento e vendas do cliente</p>
        </div>

        {/* Google Drive Status */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Sincronização Google Drive</span>
            <span className="p-1 rounded bg-brand-500/10 text-brand-400">
              <HardDrive className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-black text-white font-mono flex items-baseline gap-1.5">
            <span className="text-emerald-400">{summary.totalGdriveSynced}</span>
            <span className="text-xs text-slate-400 font-normal">/ {summary.totalCount} sincronizadas</span>
          </div>
          <div className="text-[11px] text-amber-400 font-mono font-medium">
            {summary.totalGdrivePending} pendente(s) de backup
          </div>
        </div>

      </div>

      {/* Filter Control Bar: Period (7, 15, 30 days & Custom), Search, Type */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
        
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Period Selector Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
            <button
              onClick={() => setPeriod('7d')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === '7d' 
                  ? 'bg-brand-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Últimos 7 dias
            </button>
            <button
              onClick={() => setPeriod('15d')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === '15d' 
                  ? 'bg-brand-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Últimos 15 dias
            </button>
            <button
              onClick={() => setPeriod('30d')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === '30d' 
                  ? 'bg-brand-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Últimos 30 dias
            </button>
            <button
              onClick={() => setPeriod('custom')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === 'custom' 
                  ? 'bg-brand-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Personalizado</span>
            </button>
          </div>

          {/* Type Filter Tabs (Entrada / Saida / Todas) */}
          <div className="flex items-center gap-1 p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setTipo('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                tipo === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setTipo('entrada')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                tipo === 'entrada' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Entradas
            </button>
            <button
              onClick={() => setTipo('saida')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                tipo === 'saida' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Saídas
            </button>
          </div>

        </div>

        {/* Secondary Row: Custom Date Inputs & Search */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/80">
          
          {/* Custom Date Pickers */}
          {period === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">De:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-brand-500"
              />
              <span className="text-slate-400 font-medium">Até:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-brand-500"
              />
            </div>
          )}

          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por Chave de Acesso (44 dígitos), Fornecedor, Cliente ou Nº da Nota..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Status Dropdown */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-brand-500 font-medium"
          >
            <option value="all">Todos os Status</option>
            <option value="autorizada">Autorizadas</option>
            <option value="cancelada">Canceladas</option>
          </select>

        </div>

      </div>

      {/* Batch Action Bar (Visible when notes are selected or available) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-2">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors font-medium"
          >
            {selectedIds.length > 0 && selectedIds.length === invoices.length ? (
              <CheckSquare className="w-4 h-4 text-brand-400" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            <span>
              {selectedIds.length === 0 ? 'Selecionar Todas' : `${selectedIds.length} nota(s) selecionada(s)`}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownloadZip('xml')}
            disabled={batchLoading || invoices.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-40 shadow-sm"
            title="Baixar arquivo compactado ZIP contendo todos os XMLs filtrados"
          >
            <FileCode className="w-4 h-4 text-brand-400" />
            <span>Baixar Lote XML (.ZIP)</span>
          </button>

          <button
            onClick={() => handleDownloadZip('pdf')}
            disabled={batchLoading || invoices.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-40 shadow-sm"
            title="Baixar arquivo compactado ZIP contendo todos os DANFEs PDF"
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Baixar Lote PDF (.ZIP)</span>
          </button>
        </div>
      </div>

      {/* Invoices Table: Strict Isolation and Real Data Only */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-300 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-3.5 w-10 text-center">
                  <span className="sr-only">Seleção</span>
                </th>
                <th className="py-3 px-3">Data Emissão</th>
                <th className="py-3 px-3">Nº / Série</th>
                <th className="py-3 px-3">Tipo</th>
                <th className="py-3 px-3">Emitente / Fornecedor</th>
                <th className="py-3 px-3">Destinatário</th>
                <th className="py-3 px-3 text-right">Valor Total</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Google Drive</th>
                <th className="py-3 px-3.5 text-center w-48">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-400 mb-2" />
                    <span>Carregando notas fiscais da empresa...</span>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <h4 className="font-semibold text-white text-sm">
                        Nenhuma nota fiscal encontrada no período
                      </h4>
                      <p className="text-xs text-slate-400">
                        Não existem notas fiscais registradas para <strong>{selectedCompany.razao_social}</strong> no período selecionado.
                      </p>
                      <div className="pt-2">
                        <button
                          onClick={onOpenImporter}
                          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-md inline-flex items-center gap-1.5"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          Importar XMLs Desta Empresa
                        </button>
                      </div>
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
                      className={`hover:bg-slate-800/50 transition-colors ${
                        isSelected ? 'bg-brand-500/10' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3.5 text-center">
                        <button
                          onClick={() => toggleSelect(inv.id)}
                          className="text-slate-400 hover:text-white"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-brand-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Data Emissao */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-300 font-mono text-[11px]">
                        {formatDate(inv.data_emissao)}
                      </td>

                      {/* Numero & Serie */}
                      <td className="py-3 px-3 whitespace-nowrap font-mono">
                        <span className="font-bold text-white">{inv.numero}</span>
                        <span className="text-slate-400 text-[11px] ml-1.5">S:{inv.serie}</span>
                      </td>

                      {/* Tipo: Entrada / Saida */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          inv.tipo === 'entrada'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
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

                      {/* Emitente */}
                      <td className="py-3 px-3 max-w-[200px]">
                        <div className="font-medium text-white truncate" title={inv.emitente_nome}>
                          {inv.emitente_nome}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {formatCnpj(inv.emitente_cnpj)}
                        </div>
                      </td>

                      {/* Destinatario */}
                      <td className="py-3 px-3 max-w-[200px]">
                        <div className="font-medium text-slate-300 truncate" title={inv.destinatario_nome}>
                          {inv.destinatario_nome}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {formatCnpj(inv.destinatario_cnpj)}
                        </div>
                      </td>

                      {/* Valor Total */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                        {formatCurrency(inv.valor_total)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          inv.status === 'autorizada'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {inv.status}
                        </span>
                      </td>

                      {/* Google Drive Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {inv.gdrive_synced ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold" title="Arquivo enviado para pasta do cliente no Google Drive">
                            <HardDrive className="w-3.5 h-3.5" />
                            Sincronizado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-semibold" title="Ainda não sincronizado no Drive">
                            <HardDrive className="w-3.5 h-3.5 text-amber-400/60" />
                            Pendente
                          </span>
                        )}
                      </td>

                      {/* Action Buttons per Row (XML, PDF, Drive, Detalhes) */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          
                          {/* XML Download */}
                          <a
                            href={api.getXmlDownloadUrl(inv.id)}
                            download={`${inv.chave_acesso}.xml`}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-brand-600 text-slate-300 hover:text-white transition-colors border border-slate-700/80"
                            title="Baixar arquivo XML original"
                          >
                            <FileCode className="w-3.5 h-3.5" />
                          </a>

                          {/* PDF (DANFE) Download */}
                          <a
                            href={api.getPdfDownloadUrl(inv.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition-colors border border-slate-700/80"
                            title="Baixar ou Visualizar DANFE oficial em PDF"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </a>

                          {/* Drive Sync */}
                          <button
                            onClick={() => handleSyncDrive(inv.id)}
                            disabled={isSyncingThis}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white transition-colors border border-slate-700/80 disabled:opacity-50"
                            title="Enviar para a pasta no Google Drive agora"
                          >
                            <HardDrive className={`w-3.5 h-3.5 ${isSyncingThis ? 'animate-spin text-sky-400' : ''}`} />
                          </button>

                          {/* Detalhes Modal */}
                          <button
                            onClick={() => onSelectInvoice(inv)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/80"
                            title="Ver detalhes completos da nota e tributos"
                          >
                            <Eye className="w-3.5 h-3.5" />
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

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Página <strong className="text-white">{page}</strong> de <strong className="text-white">{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
