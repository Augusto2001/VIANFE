import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Company } from '../types';
import { 
  Building2, UploadCloud, Zap, Globe, Wand2, ArrowRight, CheckCircle2, AlertCircle, ArrowUpRight, ArrowDownLeft, 
  Sparkles, FileText, Check, Edit3, Download, RefreshCw, Plus, Filter, Link, Search,
  BookOpen, FileSpreadsheet, Layers, Paperclip, FileCheck, ArrowRightLeft, DollarSign, Calendar, Upload, FileUp, Copy,
  RotateCcw, ExternalLink, Archive, ChevronDown
} from 'lucide-react';

const formatCurrency = (val: number) => {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

interface BankReconciliationViewProps {
  company: Company;
}

export const BankReconciliationView: React.FC<BankReconciliationViewProps> = ({ company }) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    totalCount: 0,
    reconciledCount: 0,
    pendingCount: 0,
    reconciledPercent: 0,
    totalEntradas: 0,
    totalSaidas: 0,
    saldoLiquido: 0
  });

  const [filterStatus, setFilterStatus] = useState<'pending' | 'reconciled' | 'all'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [companyInvoices, setCompanyInvoices] = useState<any[]>([]);

  // Upload Statement Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [statementTab, setStatementTab] = useState<'file' | 'text'>('file');
  const [ofxContent, setOfxContent] = useState('');
  const [selectedStatementFileName, setSelectedStatementFileName] = useState('');
  const [isPdfStatement, setIsPdfStatement] = useState(false);
  const [statementFileLinesCount, setStatementFileLinesCount] = useState(0);
  const [statementResult, setStatementResult] = useState<{
    totalFound: number;
    insertedCount: number;
    duplicatesCount: number;
    message: string;
    preview?: any[];
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const statementFileInputRef = React.useRef<HTMLInputElement>(null);

  // Chart of Accounts Domínio Modal State
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);
  const [chartTab, setChartTab] = useState<'file' | 'text'>('file');
  const [chartContent, setChartContent] = useState('');
  const [selectedChartFileName, setSelectedChartFileName] = useState('');
  const [chartFileLinesCount, setChartFileLinesCount] = useState(0);
  const [replaceExistingChart, setReplaceExistingChart] = useState(true);
  const [chartAccountSearch, setChartAccountSearch] = useState('');
  const [chartList, setChartList] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartMsg, setChartMsg] = useState('');
  const chartFileInputRef = React.useRef<HTMLInputElement>(null);

  // Provisions Modal State (Folha de Pagamento & Impostos)
  const [isProvisionsModalOpen, setIsProvisionsModalOpen] = useState(false);
  const [competencia, setCompetencia] = useState('08/2026');
  const [salariosBrutos, setSalariosBrutos] = useState('');
  const [inssEmpresa, setInssEmpresa] = useState('');
  const [fgts, setFgts] = useState('');
  const [proLabore, setProLabore] = useState('');
  const [valorDas, setValorDas] = useState('');
  const [valorIcms, setValorIcms] = useState('');
  const [provisionsList, setProvisionsList] = useState<any[]>([]);
  const [provisionsLoading, setProvisionsLoading] = useState(false);
  const [provisionsMsg, setProvisionsMsg] = useState('');


  // Open Finance & Webhooks State
  const [isOpenFinanceModalOpen, setIsOpenFinanceModalOpen] = useState(false);
  const [openFinanceInfo, setOpenFinanceInfo] = useState<any>(null);
  const [openFinanceLoading, setOpenFinanceLoading] = useState(false);
  const [openFinanceFeedback, setOpenFinanceFeedback] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Mapeador De/Para Domínio State
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [autoMapLoading, setAutoMapLoading] = useState(false);
  const [mappingFeedback, setMappingFeedback] = useState<string | null>(null);
  const [editingMappingCatId, setEditingMappingCatId] = useState<string | null>(null);
  const [mapDebito, setMapDebito] = useState('');
  const [mapCredito, setMapCredito] = useState('');

  const loadOpenFinanceInfo = async () => {
    try {
      setOpenFinanceLoading(true);
      const res = await api.getOpenFinanceInfo(company.id);
      setOpenFinanceInfo(res);
    } catch (e: any) {
      console.warn('Erro ao carregar Open Finance info:', e.message);
    } finally {
      setOpenFinanceLoading(false);
    }
  };

  const handleOpenFinanceModal = () => {
    setOpenFinanceFeedback(null);
    setIsOpenFinanceModalOpen(true);
    loadOpenFinanceInfo();
  };

  const handleCopyWebhookUrl = () => {
    if (openFinanceInfo?.webhookUrl) {
      navigator.clipboard.writeText(openFinanceInfo.webhookUrl);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 3000);
    }
  };


  const handleAutoMapChartOfAccounts = async () => {
    try {
      setAutoMapLoading(true);
      setMappingFeedback(null);
      const res = await api.autoMapChartOfAccounts(company.id);
      setMappingFeedback(res.message || 'Auto-mapeamento concluído com sucesso!');
      await loadData();
    } catch (err: any) {
      setMappingFeedback(`Erro: ${err.message}`);
    } finally {
      setAutoMapLoading(false);
    }
  };

  const handleSaveCategoryMapping = async (catId: string) => {
    try {
      setAutoMapLoading(true);
      await api.updateCategoryMapping(catId, {
        conta_debito_dominio: mapDebito,
        conta_credito_dominio: mapCredito
      });
      setEditingMappingCatId(null);
      await loadData();
    } catch (err: any) {
      alert('Erro ao salvar mapeamento: ' + err.message);
    } finally {
      setAutoMapLoading(false);
    }
  };

  // Dropzone State
  const [isDragging, setIsDragging] = useState(false);
  const [dropzoneMsg, setDropzoneMsg] = useState('');

  // Conta Azul Side-by-Side Row Form State
  const [rowState, setRowState] = useState<Record<string, {
    tab?: 'novo' | 'transferencia' | 'buscar';
    descricao?: string;
    categoria_id?: string;
    fornecedor_cliente_nome?: string;
    centro_custo?: string;
    repetir?: boolean;
    invoice_id?: string | null;
  }>>({});

  const updateRowField = (trnId: string, field: string, val: any) => {
    setRowState(prev => ({
      ...prev,
      [trnId]: {
        ...(prev[trnId] || {}),
        [field]: val
      }
    }));
  };

  const updateRowTab = (trnId: string, tab: 'novo' | 'transferencia' | 'buscar') => {
    updateRowField(trnId, 'tab', tab);
  };

  // Helper date formatter with weekday
  const formatDateWithWeekday = (dateStr: string) => {
    if (!dateStr) return '';
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    const weekdays = ['Domingo', 'Segunda-Feira', 'Terça-Feira', 'Quarta-Feira', 'Quinta-Feira', 'Sexta-Feira', 'Sábado'];
    const weekday = weekdays[d.getDay()] || '';
    return `${day}/${month}/${year} ${weekday}`;
  };

  const formatCurrencyNumber = (val: number) => {
    return Math.abs(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Active company ID ref to prevent cross-company data leakage
  const activeCompanyIdRef = React.useRef(company.id);

  const loadData = async () => {
    const currentCompanyId = company.id;
    try {
      setLoading(true);
      const [resTrn, resCat, resChart, resProv, resInv] = await Promise.all([
        api.getBpoTransactions(company.id, filterStatus === 'all' ? undefined : filterStatus),
        api.getBpoCategories(),
        api.getChartOfAccounts(company.id).catch(() => []),
        api.getProvisions(company.id).catch(() => []),
        api.getInvoices({ company_id: company.id, limit: 100 }).catch(() => ({ invoices: [] }))
      ]);

      if (activeCompanyIdRef.current !== currentCompanyId) {
        return; // Discard stale response from prior company
      }

      setTransactions(resTrn.data || []);
      setSummary(resTrn.summary || {});
      setCategories(resCat || []);
      setChartList(resChart || []);
      setProvisionsList(resProv || []);
      setCompanyInvoices(resInv.invoices || []);
    } catch (err: any) {
      console.error('Erro ao carregar conciliação:', err);
    } finally {
      if (activeCompanyIdRef.current === currentCompanyId) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    activeCompanyIdRef.current = company.id;
    // Immediate state reset on company change to eliminate cross-company contamination
    setTransactions([]);
    setSummary({
      totalCount: 0,
      reconciledCount: 0,
      pendingCount: 0,
      reconciledPercent: 0,
      totalEntradas: 0,
      totalSaidas: 0,
      saldoLiquido: 0
    });
    setChartList([]);
    setProvisionsList([]);
    setCompanyInvoices([]);
    loadData();
  }, [company.id, filterStatus]);

  const handleReconcileQuick = async (trn: any) => {
    try {
      setReconcilingId(trn.id);
      const row = rowState[trn.id] || {};
      const catToUse = row.categoria_id || trn.categoria_id;
      const descToUse = row.descricao || trn.descricao_custom || trn.descricao_original;
      const fornecedorToUse = row.fornecedor_cliente_nome !== undefined ? row.fornecedor_cliente_nome : trn.fornecedor_cliente_nome;
      const centroCustoToUse = row.centro_custo !== undefined ? row.centro_custo : trn.centro_custo;
      const repetirToUse = row.repetir !== undefined ? row.repetir : true;
      const invToUse = row.invoice_id !== undefined ? row.invoice_id : trn.invoice_id;

      await api.reconcileBpoTransaction(trn.id, {
        categoria_id: catToUse,
        invoice_id: invToUse,
        descricao_custom: descToUse,
        fornecedor_cliente_nome: fornecedorToUse,
        centro_custo: centroCustoToUse,
        forma_lancamento: row.tab || 'novo_lancamento',
        learn_rule: repetirToUse
      });

      await loadData();
    } catch (err: any) {
      alert(`Erro ao conciliar: ${err.message}`);
    } finally {
      setReconcilingId(null);
    }
  };

  const handleUnreconcile = async (trnId: string) => {
    try {
      setReconcilingId(trnId);
      await api.reconcileBpoTransaction(trnId, { desconciliar: true });
      await loadData();
    } catch (err: any) {
      alert(`Erro ao desconciliar: ${err.message}`);
    } finally {
      setReconcilingId(null);
    }
  };


  const handleStatementFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processStatementFile(file);
    }
  };

  const processStatementFile = (file: File) => {
    setOfxContent('');
    setSelectedStatementFileName(file.name);
    setStatementResult(null);
    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    setIsPdfStatement(isPdf);

    const reader = new FileReader();
    if (isPdf) {
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          setOfxContent(base64);
          setStatementFileLinesCount(1);
        }
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = (event) => {
        const bytes = event.target?.result as ArrayBuffer;
        if (!bytes) return;
        let text: string;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
        catch { text = new TextDecoder('windows-1252').decode(bytes); }
        setOfxContent(text);
        setStatementFileLinesCount(text.split(/\r?\n/).filter(l => l.trim().length > 0).length);
      };
      reader.onerror = () => alert('Não foi possível ler o arquivo. Selecione-o novamente.');
      reader.readAsArrayBuffer(file);
    }
  };

  const handleStatementDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processStatementFile(file);
    }
  };

  const handleUploadOfx = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!ofxContent.trim()) {
      alert('Selecione um arquivo de extrato (.OFX, .CSV, .TXT, .PDF) ou cole o conteúdo.');
      return;
    }

    try {
      setUploading(true);
      setStatementResult(null);
      const isPdf = isPdfStatement || 
        selectedStatementFileName.toLowerCase().endsWith('.pdf') || 
        ofxContent.startsWith('data:application/pdf') ||
        ofxContent.startsWith('data:application/octet-stream;base64,JVBERi');
      const res = await api.uploadBpoStatement(company.id, null, ofxContent, isPdf, selectedStatementFileName || undefined);
      setStatementResult(res);
      loadData();
    } catch (err: any) {
      alert(`Erro ao importar extrato: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const processChartFile = (file: File) => {
    setSelectedChartFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      let text = event.target?.result as string;
      if (text) {
        setChartContent(text);
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        setChartFileLinesCount(lines.length);
        setChartMsg(`✓ Arquivo "${file.name}" lido com sucesso (${lines.length} linhas detectadas). Clique em "Importar Plano de Contas" para salvar.`);
      }
    };
    reader.onerror = () => {
      // Fallback para leitura ISO-8859-1 (arquivos legados da Domínio em ANSI)
      const readerAnsi = new FileReader();
      readerAnsi.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          setChartContent(text);
          const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
          setChartFileLinesCount(lines.length);
          setChartMsg(`✓ Arquivo "${file.name}" lido com sucesso em ANSI (${lines.length} linhas).`);
        }
      };
      readerAnsi.readAsText(file, 'ISO-8859-1');
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleChartFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processChartFile(file);
  };

  const handleChartDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processChartFile(file);
  };

  const handleDownloadChartTemplate = () => {
    const template = `Código;Classificação;Nome da Conta;Natureza
10;1.1.01.01.001;Caixa Geral;D
20;1.1.01.02.001;Banco Itaú S/A;D
30;1.1.01.02.002;Banco Bradesco S/A;D
100;1.1.02.01.001;Clientes a Receber;D
150;2.1.01.01.001;Fornecedores Nacionais;C
200;2.1.02.01.001;Salários e Ordenados a Pagar;C
210;2.1.02.01.002;INSS a Recolher;C
220;2.1.02.01.003;FGTS a Recolher;C
300;3.1.01.01.001;Receita de Prestação de Serviços;C
400;4.1.01.01.001;Custos dos Serviços Prestados;D
420;4.1.02.01.001;Despesas com Salários;D
450;4.1.02.02.001;Despesas com Energia Elétrica;D
460;4.1.02.02.002;Despesas com Internet e Telefonia;D
490;4.1.03.01.001;Tarifas e Despesas Bancárias;D`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MODELO_PLANO_DE_CONTAS_DOMINIO.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearChart = async () => {
    if (!window.confirm(`Deseja realmente apagar todas as ${chartList.length} contas cadastradas para ${company.razao_social}?`)) return;
    try {
      setChartLoading(true);
      await api.clearChartOfAccounts(company.id);
      setChartMsg('Plano de contas excluído com sucesso.');
      setChartContent('');
      setSelectedChartFileName('');
      setChartFileLinesCount(0);
      await loadData();
    } catch (err: any) {
      setChartMsg(`Erro: ${err.message}`);
    } finally {
      setChartLoading(false);
    }
  };

  const handleImportChart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chartContent.trim()) {
      alert('Selecione um arquivo de Plano de Contas ou cole o conteúdo exportado da Domínio.');
      return;
    }

    try {
      setChartLoading(true);
      setChartMsg('');
      const res = await api.importChartOfAccounts(company.id, chartContent, replaceExistingChart);
      setChartMsg(res.message || 'Plano de Contas importado com sucesso!');
      setChartContent('');
      setSelectedChartFileName('');
      setChartFileLinesCount(0);
      loadData();
    } catch (err: any) {
      setChartMsg(`Erro: ${err.message}`);
    } finally {
      setChartLoading(false);
    }
  };

  const handleGenerateProvisions = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setProvisionsLoading(true);
      setProvisionsMsg('');
      
      // 1. Provisão de Folha
      if (salariosBrutos || fgts || inssEmpresa || proLabore) {
        await api.importPayrollProvisions({
          company_id: company.id,
          competencia,
          salarios_brutos: parseFloat(salariosBrutos || '0'),
          inss_empresa: parseFloat(inssEmpresa || '0'),
          fgts: parseFloat(fgts || '0'),
          pro_labore: parseFloat(proLabore || '0')
        });
      }

      // 2. Provisão de Impostos
      if (valorDas || valorIcms) {
        await api.importTaxProvisions({
          company_id: company.id,
          competencia,
          valor_das: parseFloat(valorDas || '0'),
          valor_icms: parseFloat(valorIcms || '0')
        });
      }

      setProvisionsMsg('Provisões contábeis geradas com sucesso!');
      loadData();
    } catch (err: any) {
      setProvisionsMsg(`Erro: ${err.message}`);
    } finally {
      setProvisionsLoading(false);
    }
  };

  const handleDropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        if (content) {
          try {
            setDropzoneMsg(`Processando arquivo "${file.name}"...`);
            await api.uploadBpoStatement(company.id, null, content, isPdf, file.name);
            setDropzoneMsg(`Arquivo "${file.name}" importado e integrado aos lançamentos!`);
            loadData();
            setTimeout(() => setDropzoneMsg(''), 4000);
          } catch (err: any) {
            setDropzoneMsg(`Erro ao importar "${file.name}": ${err.message}`);
          }
        }
      };
      if (isPdf) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file, 'utf-8');
      }
    }
  };

  const filteredTransactions = transactions.filter(t => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      t.descricao_original?.toLowerCase().includes(term) ||
      t.categoria_nome?.toLowerCase().includes(term) ||
      t.invoice_numero?.toLowerCase().includes(term) ||
      t.invoice_emitente?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                BPO Contábil & Financeiro
              </span>
              <span className="text-xs text-slate-400 font-mono">Padrão Domínio Sistemas</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
              <span>{company.nome_fantasia || company.razao_social}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              CNPJ: {company.cnpj} • Cruzamento de extratos com notas SEFAZ e geração de lotes contábeis
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">

            {/* Open Finance & Webhooks Button */}
            <button
              onClick={handleOpenFinanceModal}
              className="px-3.5 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-teal-500/20 flex items-center gap-1.5 cursor-pointer"
              title="Conectar e sincronizar contas digitais via Open Finance / Webhook"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>Open Finance (Plug & Play)</span>
            </button>

            {/* Mapeador De/Para Domínio Button */}
            <button
              onClick={() => { setMappingFeedback(null); setIsMappingModalOpen(true); }}
              className="px-3 py-2 bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 border border-indigo-500/30 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              title="Mapear categorias financeiras para as contas contábeis da Domínio"
            >
              <Wand2 className="w-4 h-4 text-indigo-400" />
              <span>Mapeador De/Para</span>
            </button>

            {/* Import Statement */}
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Importar Extrato (OFX/PDF)</span>
            </button>

            {/* Domínio Chart of Accounts - Prominent Vibrant Button */}
            <button
              onClick={() => { setChartMsg(''); setIsChartModalOpen(true); }}
              className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/25 flex items-center gap-1.5 cursor-pointer ring-1 ring-cyan-400/30 animate-pulse hover:animate-none"
              title="Importar e gerenciar o Plano de Contas da Domínio Sistemas"
            >
              <BookOpen className="w-4 h-4 text-white" />
              <span>Importar Plano de Contas ({chartList.length})</span>
            </button>

            {/* Payroll & Tax Provisions */}
            <button
              onClick={() => { setProvisionsMsg(''); setIsProvisionsModalOpen(true); }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              title="Gerar provisões contábeis de folha de pagamento e impostos"
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-400" />
              <span>Provisões ({provisionsList.length})</span>
            </button>

            {/* Export Domínio */}
            <button
              onClick={() => api.exportDominioBatches(company.id)}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
              title="Exportar lote contábil TXT no layout oficial da Domínio Sistemas"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Domínio (TXT)</span>
            </button>

            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-colors cursor-pointer"
              title="Atualizar transações"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

        </div>

        {/* Summary Metric Counters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Lançamentos</span>
            <p className="text-xl font-black text-white mt-0.5">{summary.totalCount || 0}</p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Conciliados (Domínio)</span>
            <p className="text-xl font-black text-emerald-400 mt-0.5">{summary.reconciledCount || 0} ({summary.reconciledPercent || 0}%)</p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Pendentes de Match</span>
            <p className="text-xl font-black text-amber-400 mt-0.5">{summary.pendingCount || 0}</p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-teal-400 tracking-wider">Provisões Geradas</span>
            <p className="text-xl font-black text-teal-400 mt-0.5">{provisionsList.length}</p>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* BANNER DE AVISO: PLANO DE CONTAS NÃO IMPORTADO */}
      {/* ========================================================================= */}
      {chartList.length === 0 && (
        <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-3 animate-fade-in shadow-lg shadow-cyan-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Plano de Contas da Domínio Sistemas não importado</h4>
              <p className="text-[11px] text-slate-400">
                Importe o arquivo do Plano de Contas (.txt ou .csv) para habilitar o mapeamento contábil e a exportação automática para a Domínio.
              </p>
            </div>
          </div>
          <button
            onClick={() => { setChartMsg(''); setIsChartModalOpen(true); }}
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-cyan-500/20 cursor-pointer flex items-center gap-1.5"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Importar Plano de Contas Agora</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SMART DROPZONE: DRAG & DROP COMPROVANTES, RELATÓRIOS & EXTRATOS */}
      {/* ========================================================================= */}
      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDropFiles}
        className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all cursor-pointer ${
          isDragging 
            ? 'border-emerald-400 bg-emerald-950/30' 
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <FileUp className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h4 className="text-xs font-bold text-white">Central de Arrastar Documentos (Dropzone Inteligente)</h4>
            <p className="text-[11px] text-slate-400">
              Arraste comprovantes de PIX, guias de impostos, relatórios de folha ou extratos em PDF/TXT/OFX para converter em lançamentos contábeis.
            </p>
          </div>
        </div>
        {dropzoneMsg && (
          <div className="mt-2 text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 p-2 rounded-xl">
            {dropzoneMsg}
          </div>
        )}
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              filterStatus === 'pending' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            Pendentes ({summary.pendingCount || 0})
          </button>
          <button
            onClick={() => setFilterStatus('reconciled')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              filterStatus === 'reconciled' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            Conciliados ({summary.reconciledCount || 0})
          </button>
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              filterStatus === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Todos ({summary.totalCount || 0})
          </button>
        </div>

        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por descrição, fornecedor, valor ou nota..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CONTA AZUL SIDE-BY-SIDE RECONCILIATION CARDS (2 TELAS: BANCO x SISTEMA)  */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        {/* Table/List Section Headers */}
        <div className="hidden lg:grid grid-cols-12 gap-4 px-4 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-900/60 rounded-xl border border-slate-800">
          <div className="col-span-5 flex items-center justify-between">
            <span>Lançamentos do Banco (Extrato)</span>
            <span className="text-slate-500 font-mono">Valor</span>
          </div>
          <div className="col-span-2 text-center">
            <span>Ação</span>
          </div>
          <div className="col-span-5 flex items-center justify-between">
            <span>Lançamentos do Sistema (BPO / ERP)</span>
            <span className="text-blue-400 font-mono text-[10px]">3 Campos Rápidos</span>
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-2xl space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h3 className="text-sm font-bold text-white">Nenhum lançamento pendente encontrado</h3>
            <p className="text-xs text-slate-400">
              Importe um extrato bancário real para iniciar a conciliação.
            </p>
          </div>
        ) : (
          filteredTransactions.map((trn) => {
            const isReconciled = trn.conciliado === 1;
            const isCredit = trn.tipo === 'CREDITO';
            const row = rowState[trn.id] || {};
            const activeTab = row.tab || 'novo';

            return (
              <div 
                key={trn.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isReconciled 
                    ? 'bg-slate-900/40 border-emerald-950/40 opacity-90' 
                    : 'bg-slate-900/95 border-slate-800 shadow-xl hover:border-slate-700'
                }`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                  
                  {/* ========================================================= */}
                  {/* CARD 1 (ESQUERDA): LANÇAMENTOS DO BANCO                   */}
                  {/* ========================================================= */}
                  <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
                    {/* Top Row: Date & Amount */}
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatDateWithWeekday(trn.data)}</span>
                      </div>
                      <div className={`text-sm font-black tracking-tight ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isCredit ? '+' : '-'} R$ {formatCurrencyNumber(trn.valor)}
                      </div>
                    </div>

                    {/* Bank Description */}
                    <div>
                      <div className="text-xs font-bold text-white line-clamp-2" title={trn.descricao_original}>
                        {trn.descricao_original}
                      </div>
                      {trn.documento && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Doc: <span className="text-slate-300">{trn.documento}</span>
                        </div>
                      )}
                    </div>

                    {/* Cliente / Fornecedor info */}
                    <div className="text-[11px] text-slate-400 space-y-0.5 bg-slate-900/50 p-2 rounded-lg border border-slate-800/50">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Favorecido / Pagador:</span>
                        <span className="text-slate-200 font-medium truncate max-w-[200px]">
                          {trn.fornecedor_cliente_nome || (trn.invoice_emitente ? trn.invoice_emitente : 'Identificado no extrato')}
                        </span>
                      </div>
                      {trn.invoice_numero && (
                        <div className="flex items-center justify-between text-[10px] text-emerald-400 font-mono pt-0.5">
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            NF-e Vinculada:
                          </span>
                          <span>#{trn.invoice_numero}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action buttons on Bank side (Manual / Archive / Unreconcile) */}
                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            updateRowField(trn.id, 'descricao', trn.descricao_original);
                            updateRowField(trn.id, 'tab', 'novo');
                          }}
                          className="text-slate-400 hover:text-blue-400 transition-colors flex items-center gap-1 cursor-pointer font-medium"
                          title="Copiar texto do banco para o formulário"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Integração manual</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => alert(`Transação "${trn.descricao_original}" arquivada com sucesso.`)}
                          className="text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Arquivar transação"
                        >
                          <Archive className="w-3 h-3" />
                          <span>Arquivar</span>
                        </button>
                      </div>
                      {isReconciled && (
                        <button
                          type="button"
                          onClick={() => handleUnreconcile(trn.id)}
                          disabled={reconcilingId === trn.id}
                          className="text-amber-400 hover:text-amber-300 transition-colors text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Desconciliar</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ========================================================= */}
                  {/* CENTRO: BOTÃO / STATUS DE CONCILIAÇÃO                     */}
                  {/* ========================================================= */}
                  <div className="lg:col-span-2 flex flex-col items-center justify-center py-2">
                    {isReconciled ? (
                      <div className="flex flex-col items-center gap-1.5 animate-fade-in text-center">
                        <div className="px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Conciliado</span>
                        </div>
                        {trn.categoria_nome && (
                          <span className="text-[10px] text-slate-400 font-mono truncate max-w-[130px]">
                            {trn.categoria_nome}
                          </span>
                        )}
                        {trn.conta_debito_dominio && (
                          <span className="text-[9px] text-cyan-400/80 font-mono">
                            D:{trn.conta_debito_dominio} / C:{trn.conta_credito_dominio}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 w-full">
                        <button
                          type="button"
                          onClick={() => handleReconcileQuick(trn)}
                          disabled={reconcilingId === trn.id}
                          className="w-full max-w-[140px] py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-1.5 transition-all transform active:scale-95 cursor-pointer border border-blue-400/30"
                        >
                          <Check className="w-4 h-4 text-white stroke-[3]" />
                          <span>{reconcilingId === trn.id ? 'Gravando...' : 'Conciliar'}</span>
                        </button>
                        <span className="text-[10px] text-slate-400 text-center font-medium">
                          Grava na Domínio
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ========================================================= */}
                  {/* CARD 2 (DIREITA): LANÇAMENTOS DO SISTEMA (3 CAMPOS)       */}
                  {/* ========================================================= */}
                  <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-3">
                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-1.5 border-b border-slate-800/60 pb-2">
                      <button
                        type="button"
                        onClick={() => updateRowTab(trn.id, 'novo')}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                          activeTab === 'novo'
                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                        <span>Novo lançamento</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateRowTab(trn.id, 'transferencia')}
                        className={`text-xs font-semibold px-2 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                          activeTab === 'transferencia'
                            ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>Transferência</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateRowTab(trn.id, 'buscar')}
                        className={`text-xs font-semibold px-2 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                          activeTab === 'buscar'
                            ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Search className="w-3 h-3" />
                        <span>Buscar lançamento</span>
                      </button>
                    </div>

                    {/* TAB 1: NOVO LANÇAMENTO (3 CAMPOS ESSENCIAIS CONTA AZUL) */}
                    {activeTab === 'novo' && (
                      <div className="space-y-2.5">
                        
                        {/* 1. Descrição */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                            Descrição <span className="text-rose-400">*</span>
                          </label>
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              disabled={isReconciled}
                              value={row.descricao !== undefined ? row.descricao : (trn.descricao_custom || trn.descricao_original || '')}
                              onChange={(e) => updateRowField(trn.id, 'descricao', e.target.value)}
                              placeholder="Ex: Fornecedor de Peças / Venda Balcão"
                              className="w-full pr-8 pl-2.5 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                            <button
                              type="button"
                              disabled={isReconciled}
                              onClick={() => updateRowField(trn.id, 'descricao', trn.descricao_original)}
                              className="absolute right-2 text-amber-400 hover:text-amber-300 cursor-pointer"
                              title="Copiar texto original do banco"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* 2. Categoria & 3. Fornecedor/Cliente (2 colunas) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          
                          {/* 2. Categoria */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                              Categoria <span className="text-rose-400">*</span>
                            </label>
                            <select
                              disabled={isReconciled}
                              value={row.categoria_id !== undefined ? row.categoria_id : (trn.categoria_id || '')}
                              onChange={(e) => updateRowField(trn.id, 'categoria_id', e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none truncate"
                            >
                              <option value="">Selecione a categoria...</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.nome} {c.conta_debito_dominio ? `(${c.conta_debito_dominio}/${c.conta_credito_dominio})` : ''}
                                </option>
                              ))}
                              {chartList.length > 0 && (
                                <optgroup label="Plano de Contas Domínio">
                                  {chartList.filter(c => c.classificacao && c.classificacao.length > 2).slice(0, 30).map(c => (
                                    <option key={c.id} value={c.id}>
                                      {c.codigo_reduzido ? `[${c.codigo_reduzido}] ` : ''}{c.nome_conta}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                          </div>

                          {/* 3. Fornecedor / Cliente */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                              Fornecedor / Cliente
                            </label>
                            <input
                              type="text"
                              disabled={isReconciled}
                              value={row.fornecedor_cliente_nome !== undefined ? row.fornecedor_cliente_nome : (trn.fornecedor_cliente_nome || trn.invoice_emitente || '')}
                              onChange={(e) => updateRowField(trn.id, 'fornecedor_cliente_nome', e.target.value)}
                              placeholder="Nome do cliente/fornecedor"
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                        </div>

                        {/* Optional Centro de Custo & Checkbox Repetir Regra */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                          <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              disabled={isReconciled}
                              checked={row.repetir !== undefined ? row.repetir : true}
                              onChange={(e) => updateRowField(trn.id, 'repetir', e.target.checked)}
                              className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                            />
                            <span>🔁 Repetir lançamento (Aprender regra)</span>
                          </label>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {trn.forma_lancamento || 'novo_lancamento'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* TAB 2: TRANSFERENCIA */}
                    {activeTab === 'transferencia' && (
                      <div className="space-y-2.5 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">Conta de Origem</label>
                            <select className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white">
                              <option>Conta Corrente Principal</option>
                              <option>Caixa Geral (Dinheiro)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">Conta de Destino</label>
                            <select className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white">
                              <option>Aplicação CDB / Poupança</option>
                              <option>Caixa Pequeno</option>
                            </select>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400 italic">
                          Realiza a conciliação entre contas patrimoniais ativas da empresa.
                        </p>
                      </div>
                    )}

                    {/* TAB 3: BUSCAR LANÇAMENTO / NF-E */}
                    {activeTab === 'buscar' && (
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Search className="w-3.5 h-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Buscar notas fiscais da empresa..."
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500"
                          />
                        </div>

                        {trn.invoice_numero ? (
                          <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-300 flex items-center justify-between">
                            <div>
                              <strong className="block text-white">NF-e #{trn.invoice_numero}</strong>
                              <span>{trn.invoice_emitente || 'SEFAZ'} • R$ {formatCurrencyNumber(trn.valor)}</span>
                            </div>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                              Vínculo Automático
                            </span>
                          </div>
                        ) : companyInvoices.length > 0 ? (
                          <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                            {companyInvoices.slice(0, 3).map((inv: any) => (
                              <div
                                key={inv.id}
                                onClick={() => {
                                  updateRowField(trn.id, 'invoice_id', inv.id);
                                  updateRowField(trn.id, 'descricao', `NF-e #${inv.numero} - ${inv.emitente_nome || inv.destinatario_nome}`);
                                  updateRowField(trn.id, 'fornecedor_cliente_nome', inv.emitente_nome || inv.destinatario_nome);
                                }}
                                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 cursor-pointer text-[11px] flex items-center justify-between transition-colors"
                              >
                                <span className="text-white truncate max-w-[200px]">
                                  NF-e #{inv.numero} • {inv.emitente_nome || inv.destinatario_nome}
                                </span>
                                <span className="text-slate-300 font-mono shrink-0">
                                  R$ {formatCurrencyNumber(inv.valor_total)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400">
                            Nenhuma nota pendente com este valor exato. Utilize os campos na aba "Novo lançamento".
                          </p>
                        )}
                      </div>
                    )}

                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: IMPORT BANK STATEMENT (OFX / CSV / PDF / TXT) COM AUDITORIA */}
      {/* ========================================================================= */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-4 animate-scale-up max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Importar Extrato Bancário</h3>
                  <p className="text-[11px] text-slate-400">Suporta OFX, Planilhas CSV e Relatórios TXT de qualquer banco ({company.razao_social})</p>
                </div>
              </div>
              <button 
                onClick={() => { setIsUploadModalOpen(false); setStatementResult(null); }} 
                className="text-slate-400 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* If Results are Ready: Display Audit Breakdown */}
            {statementResult ? (
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Extrato Processado e Auditado com Sucesso!</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {statementResult.message}
                  </p>
                </div>

                {/* Audit Metric Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Total no Arquivo</span>
                    <p className="text-xl font-black text-white mt-1 font-mono">{statementResult.totalFound}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-center">
                    <span className="text-[10px] text-emerald-400 uppercase font-bold">Novas Gravadas</span>
                    <p className="text-xl font-black text-emerald-400 mt-1 font-mono">{statementResult.insertedCount}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                    <span className="text-[10px] text-amber-400 uppercase font-bold">Já Existentes</span>
                    <p className="text-xl font-black text-amber-400 mt-1 font-mono">{statementResult.duplicatesCount}</p>
                  </div>
                </div>

                {/* Preview Table of Processed Transactions */}
                {statementResult.preview && statementResult.preview.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Conferência dos Lançamentos ({statementResult.preview.length} primeiras linhas):
                    </h4>
                    <div className="border border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 sticky top-0">
                          <tr>
                            <th className="py-2 px-3">Data</th>
                            <th className="py-2 px-3">Descrição Bancária</th>
                            <th className="py-2 px-3">Tipo</th>
                            <th className="py-2 px-3 text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono">
                          {statementResult.preview.map((t, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/40 text-[11px]">
                              <td className="py-2 px-3 text-slate-300">{t.data.split('-').reverse().join('/')}</td>
                              <td className="py-2 px-3 text-white font-sans truncate max-w-xs">{t.descricao}</td>
                              <td className="py-2 px-3">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  t.tipo === 'CREDITO' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                }`}>
                                  {t.tipo}
                                </span>
                              </td>
                              <td className={`py-2 px-3 text-right font-bold ${
                                t.tipo === 'CREDITO' ? 'text-emerald-400' : 'text-rose-400'
                              }`}>
                                {formatCurrency(t.valor)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUploadModalOpen(false);
                      setStatementResult(null);
                      setOfxContent('');
                      setSelectedStatementFileName('');
                    }}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    ✓ Ver Lançamentos na Tela de Conciliação
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleUploadOfx} className="space-y-4">
                
                {/* Tabs: File Upload vs Textarea */}
                <div className="flex items-center gap-2 p-1.5 bg-slate-950/60 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setStatementTab('file')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      statementTab === 'file'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Selecionar / Arrastar Arquivo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatementTab('text')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      statementTab === 'text'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Colar Texto do Extrato</span>
                  </button>
                </div>

                {statementTab === 'file' && (
                  <div className="space-y-3">
                    <input
                      type="file"
                      ref={statementFileInputRef}
                      onChange={handleStatementFileSelected}
                      accept=".ofx,.txt,.pdf,.csv,.tsv"
                      className="hidden"
                    />

                    <div
                      onClick={() => statementFileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={handleStatementDrop}
                      className="border-2 border-dashed border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-950/10 hover:bg-emerald-950/20 rounded-2xl p-8 text-center transition-all cursor-pointer space-y-2 group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">
                          {selectedStatementFileName ? selectedStatementFileName : 'Clique para selecionar ou arraste o arquivo do Extrato aqui'}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {selectedStatementFileName 
                            ? `✓ ${statementFileLinesCount} linhas carregadas. Pronto para processar.`
                            : 'Suporta arquivos .OFX, planilhas .CSV e extratos em .TXT / .PDF de qualquer banco.'}
                        </p>
                      </div>
                      <span className="inline-block text-[10px] px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full font-mono font-bold">
                        Bancos: Itaú, Bradesco, Santander, BB, Inter, Nubank, Sicredi, Sicoob, C6, etc.
                      </span>
                    </div>
                  </div>
                )}

                {statementTab === 'text' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Cole o conteúdo do extrato (OFX, CSV ou TXT):</label>
                    <textarea
                      value={ofxContent}
                      onChange={(e) => setOfxContent(e.target.value)}
                      placeholder="Cole aqui o conteúdo OFX ou texto do extrato..."
                      rows={7}
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder-slate-600 focus:border-emerald-500"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => { setIsUploadModalOpen(false); setOfxContent(''); setSelectedStatementFileName(''); }} 
                    className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={uploading || !ofxContent.trim()} 
                    className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {uploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Processando & Cruzando Duplicatas...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Processar Extrato Agora</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: IMPORT DOMÍNIO CHART OF ACCOUNTS */}
      {/* ========================================================================= */}
      {isChartModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-4 animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Plano de Contas Domínio Sistemas</h3>
                  <p className="text-[10px] text-slate-400">Importação de contas contábeis da empresa ({company.razao_social})</p>
                </div>
              </div>
              <button onClick={() => setIsChartModalOpen(false)} className="text-slate-400 hover:text-white font-bold cursor-pointer">✕</button>
            </div>

            {/* Action Buttons Header: Download Template & Clear */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setChartTab('file')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    chartTab === 'file'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Importar Arquivo (.txt / .csv)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChartTab('text')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    chartTab === 'text'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Colar Texto</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadChartTemplate}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                  title="Baixar modelo de exemplo em CSV com a estrutura aceita pela Domínio Sistemas"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Modelo Exemplo (.csv)</span>
                </button>

                {chartList.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearChart}
                    disabled={chartLoading}
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800 text-[11px] font-semibold rounded-lg transition-all cursor-pointer"
                    title="Apagar todas as contas desta empresa"
                  >
                    <span>Limpar ({chartList.length})</span>
                  </button>
                )}
              </div>
            </div>

            <form onSubmit={handleImportChart} className="space-y-4">
              {/* TAB 1: FILE UPLOAD DROPZONE */}
              {chartTab === 'file' && (
                <div className="space-y-3">
                  <input
                    type="file"
                    ref={chartFileInputRef}
                    onChange={handleChartFileSelected}
                    accept=".txt,.csv,.tsv"
                    className="hidden"
                  />

                  <div
                    onClick={() => chartFileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={handleChartDrop}
                    className="border-2 border-dashed border-cyan-500/30 hover:border-cyan-500/60 bg-cyan-950/10 hover:bg-cyan-950/20 rounded-2xl p-6 text-center transition-all cursor-pointer space-y-2 group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        {selectedChartFileName ? selectedChartFileName : 'Clique para Selecionar o Arquivo do Plano de Contas'}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {selectedChartFileName
                          ? `✓ ${chartFileLinesCount} linhas prontas para importação. Clique para trocar de arquivo.`
                          : 'Selecione o arquivo exportado da Domínio Sistemas (.txt, .csv ou .tsv)'}
                      </p>
                    </div>
                    <span className="inline-block text-[10px] px-2.5 py-1 bg-cyan-500/20 text-cyan-300 rounded-full font-mono font-bold">
                      Formato: Código;Classificação;Nome da Conta;Natureza(D/C)
                    </span>
                  </div>
                </div>
              )}

              {/* TAB 2: TEXTAREA PASTE */}
              {chartTab === 'text' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Cole o Plano de Contas exportado da Domínio (Formato: Código;Classificação;Nome;Natureza):
                  </label>
                  <textarea
                    value={chartContent}
                    onChange={(e) => setChartContent(e.target.value)}
                    placeholder="Exemplo:&#10;10;1.1.01.01.001;Caixa Geral;D&#10;20;1.1.01.02.001;Banco Itaú S/A;D&#10;150;2.1.01.01.001;Fornecedores Nacionais;C&#10;420;4.1.02.01.001;Despesas com Salários;D"
                    rows={6}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder-slate-600 focus:border-cyan-500"
                  />
                </div>
              )}

              {/* Replace checkbox */}
              <div className="flex items-center gap-2 px-1">
                <input
                  type="checkbox"
                  id="replaceChart"
                  checked={replaceExistingChart}
                  onChange={(e) => setReplaceExistingChart(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-600 focus:ring-cyan-500"
                />
                <label htmlFor="replaceChart" className="text-xs text-slate-300 cursor-pointer">
                  Substituir contas anteriores desta empresa (recomendado para manter o plano atualizado)
                </label>
              </div>

              {chartMsg && (
                <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-cyan-300">
                  {chartMsg}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIsChartModalOpen(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer">Fechar</button>
                <button
                  type="submit"
                  disabled={chartLoading || !chartContent.trim()}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer shadow-md shadow-cyan-500/20"
                >
                  {chartLoading ? 'Importando...' : 'Importar Plano de Contas'}
                </button>
              </div>
            </form>

            {/* List of currently loaded accounts */}
            <div className="space-y-2 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300">Contas Cadastradas para Esta Empresa ({chartList.length})</h4>
                {chartList.length > 5 && (
                  <input
                    type="text"
                    placeholder="Filtrar contas..."
                    value={chartAccountSearch}
                    onChange={(e) => setChartAccountSearch(e.target.value)}
                    className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 w-44"
                  />
                )}
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 pr-1 font-mono text-xs">
                {chartList.length === 0 ? (
                  <p className="text-[11px] text-slate-500 py-2">Nenhuma conta cadastrada ainda. Selecione um arquivo acima para importar.</p>
                ) : (
                  chartList
                    .filter(acc => !chartAccountSearch || acc.nome_conta.toLowerCase().includes(chartAccountSearch.toLowerCase()) || acc.codigo_conta.includes(chartAccountSearch) || acc.classificacao.includes(chartAccountSearch))
                    .map((acc, idx) => (
                      <div key={idx} className="p-2 bg-slate-950/70 rounded-lg border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-cyan-400 font-bold mr-2">[{acc.codigo_conta}]</span>
                          <span className="text-slate-400 mr-2">{acc.classificacao}</span>
                          <span className="text-white">{acc.nome_conta}</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded">
                          {acc.natureza === 'C' ? 'Credora (C)' : 'Devedora (D)'}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PAYROLL & TAX PROVISIONS (FOLHA DE PAGAMENTO & IMPOSTOS) */}
      {/* ========================================================================= */}
      {isProvisionsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-4 animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Provisões Contábeis (Folha & Impostos)</h3>
                  <p className="text-[10px] text-slate-400">Geração automática de lançamentos de provisão para exportação Domínio</p>
                </div>
              </div>
              <button onClick={() => setIsProvisionsModalOpen(false)} className="text-slate-400 hover:text-white font-bold">✕</button>
            </div>

            <form onSubmit={handleGenerateProvisions} className="space-y-4">
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Competência de Fechamento:</label>
                <input
                  type="text"
                  value={competencia}
                  onChange={(e) => setCompetencia(e.target.value)}
                  placeholder="08/2026"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>

              {/* Payroll Section */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>1. Folha de Pagamento & Encargos Sociais</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400">Salários Brutos (R$):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={salariosBrutos}
                      onChange={(e) => setSalariosBrutos(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">FGTS a Recolher (R$):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={fgts}
                      onChange={(e) => setFgts(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">INSS / CPP Patronal (R$):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={inssEmpresa}
                      onChange={(e) => setInssEmpresa(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">Pró-Labore Sócios (R$):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={proLabore}
                      onChange={(e) => setProLabore(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Tax Section */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>2. Impostos Faturados (Guias de Apuração)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400">Guia DAS (Simples Nacional) (R$):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={valorDas}
                      onChange={(e) => setValorDas(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">ICMS / ISS a Recolher (R$):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={valorIcms}
                      onChange={(e) => setValorIcms(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono mt-1"
                    />
                  </div>
                </div>
              </div>

              {provisionsMsg && (
                <div className="p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white">
                  {provisionsMsg}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIsProvisionsModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl">Fechar</button>
                <button type="submit" disabled={provisionsLoading} className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl cursor-pointer">
                  {provisionsLoading ? 'Gerando...' : 'Gerar Provisões Contábeis'}
                </button>
              </div>

            </form>

            {/* List of generated provisions */}
            <div className="space-y-2 pt-3 border-t border-slate-800">
              <h4 className="text-xs font-bold text-slate-300">Lotes de Provisão Registrados ({provisionsList.length})</h4>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
                {provisionsList.length === 0 ? (
                  <p className="text-[11px] text-slate-500 py-2">Nenhuma provisão gerada para esta empresa ainda.</p>
                ) : (
                  provisionsList.map((p, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-950/70 rounded-lg border border-slate-800 flex items-center justify-between">
                      <div>
                        <p className="text-white font-bold text-[11px]">{p.historico}</p>
                        <p className="text-[10px] text-slate-400">D: {p.conta_debito} / C: {p.conta_credito} • Ref: {p.competencia}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-amber-400 font-bold">R$ {p.valor.toFixed(2)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    
      {/* 🌟 MODAL OPEN FINANCE & BANCOS DIGITAIS (PLUG & PLAY) */}
      {isOpenFinanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-2xl w-full space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-teal-300" />
                </div>
                <div>
                  <h4 className="text-base font-black text-white">Open Finance & Sincronização Bancária</h4>
                  <p className="text-xs text-slate-400">Ingestão automática de extratos e transações em tempo real</p>
                </div>
              </div>

              <button
                onClick={() => setIsOpenFinanceModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Supported Banks Badges */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">Bancos & Gateways Compatíveis:</label>
              <div className="flex flex-wrap gap-2">
                {['Banco Inter', 'Cora PJ', 'Asaas', 'Itaú Empresas', 'Nubank PJ', 'Pluggy'].map((banco, idx) => (
                  <span key={idx} className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{banco}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Webhook URL Endpoint Box */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>URL do Webhook Exclusivo desta Empresa:</span>
                <span className="text-[10px] text-emerald-400 font-mono">POST JSON</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={openFinanceInfo?.webhookUrl || `${window.location.origin}/api/bpo/open-finance/webhook/${company.id}`}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-emerald-300 text-xs font-mono select-all focus:outline-none"
                />
                <button
                  onClick={handleCopyWebhookUrl}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-all flex items-center gap-1 shrink-0"
                >
                  {copiedWebhook ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedWebhook ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Cadastre este endpoint nas configurações de Webhook do seu banco para receber notificações automáticas a cada PIX, TED ou boleto liquidado.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Lançamentos Sincronizados</span>
                <p className="text-lg font-black text-white mt-0.5">{openFinanceInfo?.totalSynced || 0}</p>
              </div>
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Última Sincronização</span>
                <p className="text-xs font-bold text-emerald-400 mt-1">{openFinanceInfo?.lastSync ? new Date(openFinanceInfo.lastSync).toLocaleString('pt-BR') : 'Aguardando primeiro evento'}</p>
              </div>
            </div>

            {openFinanceFeedback && (
              <div className={`p-3.5 rounded-xl border text-xs font-medium ${
                openFinanceFeedback.includes('Erro') 
                  ? 'bg-rose-950/40 border-rose-800 text-rose-300' 
                  : 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              }`}>
                {openFinanceFeedback}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">

              <button
                type="button"
                onClick={() => setIsOpenFinanceModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 🌟 MODAL MAPEADOR VISUAL DE PLANO DE CONTAS DOMÍNIO SISTEMAS */}
      {isMappingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-4xl w-full space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                  <Wand2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-black text-white">Mapeador De/Para (Categorias ⟷ Domínio Sistemas)</h4>
                  <p className="text-xs text-slate-400">Vincule as contas de Débito e Crédito para exportação contábil oficial 100% precisa</p>
                </div>
              </div>

              <button
                onClick={() => setIsMappingModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div>
                <span className="text-xs font-bold text-white block">Auto-Mapeamento Inteligente:</span>
                <p className="text-[11px] text-slate-400">
                  Cruza nomes de categorias e contas da Domínio preenchendo as partidas dobradas automaticamente.
                </p>
              </div>

              <button
                onClick={handleAutoMapChartOfAccounts}
                disabled={autoMapLoading || chartList.length === 0}
                className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 shrink-0"
              >
                {autoMapLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                <span>Auto-Mapear Agora</span>
              </button>
            </div>

            {mappingFeedback && (
              <div className={`p-3.5 rounded-xl border text-xs font-medium ${
                mappingFeedback.includes('Erro') 
                  ? 'bg-rose-950/40 border-rose-800 text-rose-300' 
                  : 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              }`}>
                {mappingFeedback}
              </div>
            )}

            {/* Mapping Table */}
            <div className="border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Categoria Financeira</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Conta Débito (Domínio)</th>
                    <th className="p-3">Conta Crédito (Domínio)</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 font-mono">
                  {categories.map((cat: any) => {
                    const isEditing = editingMappingCatId === cat.id;

                    return (
                      <tr key={cat.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-sans font-bold text-white">
                          {cat.nome}
                        </td>
                        <td className="p-3 font-sans">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${
                            cat.tipo === 'receita' 
                              ? 'bg-emerald-500/20 text-emerald-300' 
                              : cat.tipo === 'imposto'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {cat.tipo}
                          </span>
                        </td>
                        <td className="p-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={mapDebito}
                              onChange={(e) => setMapDebito(e.target.value)}
                              placeholder="Cód ou Classif."
                              className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white w-28"
                            />
                          ) : (
                            <span className="text-emerald-400 font-bold">{cat.conta_debito_dominio || '-'}</span>
                          )}
                        </td>
                        <td className="p-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={mapCredito}
                              onChange={(e) => setMapCredito(e.target.value)}
                              placeholder="Cód ou Classif."
                              className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white w-28"
                            />
                          ) : (
                            <span className="text-teal-400 font-bold">{cat.conta_credito_dominio || '-'}</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-sans">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleSaveCategoryMapping(cat.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold"
                              >
                                Salvar
                              </button>
                              <button
                                onClick={() => setEditingMappingCatId(null)}
                                className="px-2 py-1 bg-slate-800 text-slate-400 hover:text-white rounded text-[11px]"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingMappingCatId(cat.id);
                                setMapDebito(cat.conta_debito_dominio || '');
                                setMapCredito(cat.conta_credito_dominio || '');
                              }}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-bold border border-slate-700"
                            >
                              Editar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsMappingModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
