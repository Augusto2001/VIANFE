import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Company } from '../types';
import { 
  ShieldAlert, ShieldCheck, Sparkles, DollarSign, ArrowUpRight, 
  AlertTriangle, CheckCircle2, FileText, RefreshCw, Download, 
  Layers, Package, TrendingUp, Search, Info
} from 'lucide-react';

interface TaxAuditViewProps {
  company: Company;
}

export const TaxAuditView: React.FC<TaxAuditViewProps> = ({ company }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'monofasicos' | 'ncms' | 'cfops' | 'todos'>('monofasicos');

  // Active company ID ref to prevent cross-company race condition responses
  const activeCompanyIdRef = React.useRef(company.id);

  const loadAudit = async () => {
    const currentCompId = company.id;
    try {
      setLoading(true);
      const res = await api.getTaxAuditSummary(company.id);
      if (activeCompanyIdRef.current !== currentCompId) {
        return; // Discard response if user changed companies
      }
      setData(res);
    } catch (err: any) {
      console.error('Audit load error:', err);
    } finally {
      if (activeCompanyIdRef.current === currentCompId) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    activeCompanyIdRef.current = company.id;
    setData(null); // Immediate reset to prevent displaying previous company's audit
    loadAudit();
  }, [company.id]);

  const formatCurrency = (val?: number) => {
    return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleExportCsv = () => {
    if (!data || !data.ultimosItensAuditados) return;
    
    const headers = ['Numero Nota', 'Tipo', 'Data Emissao', 'Codigo', 'Descricao', 'NCM', 'CFOP', 'Valor Total (R$)', 'Monofasico', 'Categoria', 'Credito Estimado (R$)', 'Alerta'];
    const rows = data.ultimosItensAuditados.map((item: any) => [
      item.numeroNota || '',
      item.tipo === 'saida' ? 'Venda (Saída)' : 'Compra (Entrada)',
      item.dataEmissao ? new Date(item.dataEmissao).toLocaleDateString('pt-BR') : '',
      `="${item.codigoProduto}"`,
      `"${(item.descricao || '').replace(/"/g, '""')}"`,
      `="${item.ncm}"`,
      `="${item.cfop}"`,
      (item.valorTotal || 0).toFixed(2).replace('.', ','),
      item.isMonofasico ? 'SIM' : 'NAO',
      item.categoriaMonofasica || '',
      (item.creditoEstimado || 0).toFixed(2).replace('.', ','),
      `"${(item.alertaRisco || 'REGULAR').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r: any) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Auditoria_Tributaria_Viacont_${company.cnpj.replace(/\D/g, '')}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading || !data) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-16 text-center space-y-4 shadow-2xl">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
        <h3 className="text-sm font-bold text-white">Executando Auditoria Tributária de Itens do XML...</h3>
        <p className="text-xs text-slate-400">Cruzando NCMs com tabelas de PIS/COFINS Monofásico e regras de CFOP.</p>
      </div>
    );
  }

  const { resumo, topNcms, topCfops, itensMonofasicosRecuperaveis, ultimosItensAuditados } = data;

  const filteredItems = (activeTab === 'monofasicos' ? itensMonofasicosRecuperaveis : ultimosItensAuditados).filter((item: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (item.descricao || '').toLowerCase().includes(term) ||
      (item.ncm || '').includes(term) ||
      (item.cfop || '').includes(term) ||
      (item.codigoProduto || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner: Oportunidades & Recuperação */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold uppercase tracking-wider">
                Auditoria de XMLs & NCMs
              </span>
              <span className="text-xs text-slate-400 font-mono">Lei 10.147 / Lei 10.485</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Inteligência Tributária & Recuperação Fiscal
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              Análise profunda de cada item faturado para segregação no Simples Nacional / Lucro Presumido e identificação de créditos tributários.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              title="Exportar planilha analítica completa com auditoria de todos os itens"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Laudo Excel / CSV</span>
            </button>

            <button
              onClick={loadAudit}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl border border-slate-700 transition-colors cursor-pointer"
              title="Recalcular auditoria"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

      {/* KPI Cards: Resumo Tributário */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Estimativa de Crédito PIS/COFINS */}
        <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-5 shadow-lg space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-xs font-semibold">Crédito PIS/COFINS Estimado</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">
            {formatCurrency(resumo.estimativaCreditoPisCofins)}
          </div>
          <p className="text-[11px] text-emerald-300">
            Oportunidade de segregação de impostos
          </p>
        </div>

        {/* Faturamento Monofásico */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Itens Monofásicos Vendidos</span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center">
              <Package className="w-4 h-4 text-teal-400" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">
            {formatCurrency(resumo.totalValorMonofasico)}
          </div>
          <p className="text-[11px] text-slate-400">
            {resumo.totalItensMonofasicos} itens ({resumo.percentualMonofasico.toFixed(1)}% do faturamento)
          </p>
        </div>

        {/* Total Itens Auditados */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Volume Auditado</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">
            {resumo.totalItensAuditados} itens
          </div>
          <p className="text-[11px] text-slate-400">
            Em {resumo.totalInvoicesAuditadas} notas fiscais processadas
          </p>
        </div>

        {/* Alertas de CFOP */}
        <div className={`bg-slate-900 border rounded-2xl p-5 shadow-lg space-y-2 ${
          resumo.totalAlertasCfop > 0 ? 'border-amber-500/40' : 'border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Alertas de CFOP</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              resumo.totalAlertasCfop > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">
            {resumo.totalAlertasCfop}
          </div>
          <p className="text-[11px] text-slate-400">
            {resumo.totalAlertasCfop === 0 ? 'Todos os CFOPs em conformidade' : 'Revisão de escrituração recomendada'}
          </p>
        </div>

      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('monofasicos')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'monofasicos'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Itens Monofásicos ({itensMonofasicosRecuperaveis.length})
          </button>

          <button
            onClick={() => setActiveTab('todos')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'todos'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Todos os Itens ({ultimosItensAuditados.length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar por produto, NCM ou CFOP..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>

      </div>

      {/* Items Audit Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-300 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Nota</th>
                <th className="py-3 px-3">Tipo</th>
                <th className="py-3 px-3">Código / Produto</th>
                <th className="py-3 px-3">NCM</th>
                <th className="py-3 px-3">CFOP</th>
                <th className="py-3 px-3 text-right">Valor Item</th>
                <th className="py-3 px-3 text-center">Regime Tributário</th>
                <th className="py-3 px-4 text-right">Crédito Estimado</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/80">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Info className="w-6 h-6 mx-auto mb-2 text-slate-500" />
                    <span>Nenhum item encontrado com os filtros selecionados.</span>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      NF #{item.numeroNota}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.tipo === 'saida' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}>
                        {item.tipo === 'saida' ? 'Venda' : 'Compra'}
                      </span>
                    </td>
                    <td className="py-3 px-3 max-w-xs">
                      <div className="font-semibold text-white truncate">{item.descricao}</div>
                      <div className="text-[10px] text-slate-500 font-mono">Cód: {item.codigoProduto}</div>
                    </td>
                    <td className="py-3 px-3 font-mono text-emerald-300 font-semibold">
                      {item.ncm}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400">
                      {item.cfop}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-white">
                      {formatCurrency(item.valorTotal)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {item.isMonofasico ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                          {item.categoriaMonofasica || 'Monofásico'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px]">
                          Tributação Padrão
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-400">
                      {item.creditoEstimado > 0 ? formatCurrency(item.creditoEstimado) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
