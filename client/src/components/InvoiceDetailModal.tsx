import React, { useState } from 'react';
import { Invoice } from '../types';
import { api } from '../services/api';
import { 
  X, 
  FileCode, 
  FileText, 
  HardDrive, 
  Copy, 
  Check, 
  Building, 
  UserCheck, 
  Receipt, 
  Truck, 
  Coins,
  ShieldCheck,
  Calendar,
  Layers,
  CreditCard
} from 'lucide-react';

interface InvoiceDetailModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  onSyncDrive: (invoiceId: string) => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoice,
  onClose,
  onSyncDrive,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'geral' | 'itens' | 'tributos' | 'cobranca'>('geral');

  if (!invoice) return null;

  const copyChave = () => {
    navigator.clipboard.writeText(invoice.chave_acesso);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const itens = invoice.itens || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center border border-brand-500/20">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">
                  Nota Fiscal Nº {invoice.numero} • Série {invoice.serie}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                  invoice.tipo === 'entrada' 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                }`}>
                  {invoice.tipo === 'entrada' ? 'Recebida (Entrada)' : 'Emitida (Saída)'}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase bg-emerald-500/20 text-emerald-300">
                  {invoice.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Modelo {invoice.modelo} • Emitida em {formatDate(invoice.data_emissao)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chave de Acesso Bar */}
        <div className="px-6 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-slate-400 font-medium">Chave de Acesso:</span>
            <span className="font-mono text-brand-400 font-medium truncate select-all">
              {invoice.chave_acesso}
            </span>
          </div>
          <button
            onClick={copyChave}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors shrink-0 ml-2"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiada!' : 'Copiar Chave'}</span>
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800 bg-slate-900/50">
          <button
            onClick={() => setActiveTab('geral')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'geral' 
                ? 'border-brand-500 text-brand-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Visão Geral & Envolvidos
          </button>
          <button
            onClick={() => setActiveTab('itens')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'itens' 
                ? 'border-brand-500 text-brand-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Itens da Nota</span>
            <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded-full text-[10px]">
              {itens.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('tributos')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'tributos' 
                ? 'border-brand-500 text-brand-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Totais & Impostos Fiscais
          </button>
          <button
            onClick={() => setActiveTab('cobranca')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'cobranca' 
                ? 'border-brand-500 text-brand-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-amber-400" />
            <span>Cobrança & Duplicatas</span>
            {(invoice.duplicatas?.length || 0) > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded-full text-[10px] font-bold">
                {invoice.duplicatas?.length}x
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {activeTab === 'geral' && (
            <div className="space-y-6 animate-fade-in">
              {/* Emitente & Destinatario Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Emitente */}
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-3">
                  <div className="flex items-center gap-2 text-brand-400 font-semibold text-xs uppercase tracking-wider">
                    <Building className="w-4 h-4" />
                    <span>Emitente / Fornecedor</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-sm">
                      {invoice.emitente_nome}
                    </h4>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">
                      CNPJ: {formatCnpj(invoice.emitente_cnpj)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      UF: <span className="text-slate-200 font-medium">{invoice.emitente_uf || 'N/A'}</span>
                    </p>
                  </div>
                </div>

                {/* Destinatario */}
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs uppercase tracking-wider">
                    <UserCheck className="w-4 h-4" />
                    <span>Destinatário / Cliente</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-sm">
                      {invoice.destinatario_nome}
                    </h4>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">
                      CNPJ/CPF: {formatCnpj(invoice.destinatario_cnpj)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      UF: <span className="text-slate-200 font-medium">{invoice.destinatario_uf || 'N/A'}</span>
                    </p>
                  </div>
                </div>

              </div>

              {/* Detalhes da Operacao */}
              <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 space-y-3">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Natureza & Informações da Operação
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block">Natureza da Operação:</span>
                    <span className="font-medium text-white">{invoice.natureza_operacao || 'Venda / Prestação'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Valor Total da Nota:</span>
                    <span className="font-bold text-emerald-400 text-sm">{formatCurrency(invoice.valor_total)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Google Drive:</span>
                    <span className={`inline-flex items-center gap-1 font-medium ${
                      invoice.gdrive_synced ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      <HardDrive className="w-3.5 h-3.5" />
                      {invoice.gdrive_synced ? 'Sincronizado na Nuvem' : 'Pendente de Sincronização'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'itens' && (
            <div className="space-y-4 animate-fade-in">
              <div className="overflow-x-auto border border-slate-700/80 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/90 text-slate-300 font-semibold border-b border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Código</th>
                      <th className="py-2.5 px-3">Descrição</th>
                      <th className="py-2.5 px-3">NCM</th>
                      <th className="py-2.5 px-3">CFOP</th>
                      <th className="py-2.5 px-3">UN</th>
                      <th className="py-2.5 px-3 text-right">Qtd</th>
                      <th className="py-2.5 px-3 text-right">V. Unitário</th>
                      <th className="py-2.5 px-3 text-right">V. Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {itens.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-slate-400">
                          Nenhum item individual discriminado no XML ou itens resumidos.
                        </td>
                      </tr>
                    ) : (
                      itens.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2 px-3 text-slate-400 font-mono">{item.itemNumero || idx + 1}</td>
                          <td className="py-2 px-3 text-slate-300 font-mono">{item.codigo}</td>
                          <td className="py-2 px-3 text-white font-medium max-w-xs truncate" title={item.descricao}>
                            {item.descricao}
                          </td>
                          <td className="py-2 px-3 text-slate-400 font-mono">{item.ncm}</td>
                          <td className="py-2 px-3 text-slate-400 font-mono">{item.cfop}</td>
                          <td className="py-2 px-3 text-slate-300">{item.unidade}</td>
                          <td className="py-2 px-3 text-slate-200 text-right font-mono">{item.quantidade}</td>
                          <td className="py-2 px-3 text-slate-200 text-right font-mono">{formatCurrency(item.valorUnitario)}</td>
                          <td className="py-2 px-3 text-brand-300 text-right font-mono font-semibold">{formatCurrency(item.valorTotal)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'tributos' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Valor dos Produtos</span>
                  <div className="text-base font-bold text-white mt-1 font-mono">
                    {formatCurrency(invoice.valor_produtos || invoice.valor_total)}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Valor ICMS</span>
                  <div className="text-base font-bold text-sky-400 mt-1 font-mono">
                    {formatCurrency(invoice.valor_icms)}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Valor PIS</span>
                  <div className="text-base font-bold text-indigo-400 mt-1 font-mono">
                    {formatCurrency(invoice.valor_pis)}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Valor COFINS</span>
                  <div className="text-base font-bold text-violet-400 mt-1 font-mono">
                    {formatCurrency(invoice.valor_cofins)}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Valor IPI</span>
                  <div className="text-base font-bold text-amber-400 mt-1 font-mono">
                    {formatCurrency(invoice.valor_ipi)}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-brand-500/10 border border-brand-500/30">
                  <span className="text-[11px] text-brand-300 uppercase font-semibold">Valor Total da NF-e</span>
                  <div className="text-base font-bold text-emerald-400 mt-1 font-mono">
                    {formatCurrency(invoice.valor_total)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cobranca' && (
            <div className="space-y-6 animate-fade-in">
              {/* Fatura Resumo */}
              {invoice.fatura && (
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
                    <Receipt className="w-4 h-4" />
                    <span>Dados da Fatura Nº {invoice.fatura.numero || invoice.numero}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">Valor Original</span>
                      <span className="text-sm font-bold text-white font-mono">{formatCurrency(invoice.fatura.valorOriginal || invoice.valor_total)}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">Valor Desconto</span>
                      <span className="text-sm font-bold text-rose-400 font-mono">{formatCurrency(invoice.fatura.valorDesconto || 0)}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">Valor Líquido a Pagar</span>
                      <span className="text-sm font-bold text-emerald-400 font-mono">{formatCurrency(invoice.fatura.valorLiquido || invoice.valor_total)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabela de Duplicatas / Parcelas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    <span>Duplicatas & Vencimentos Registrados ({invoice.duplicatas?.length || 1} parcelas)</span>
                  </h4>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {invoice.tipo === 'entrada' ? 'Contas a Pagar' : 'Contas a Receber'}
                  </span>
                </div>

                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800/70 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Parcela</th>
                        <th className="py-2.5 px-3">Favorecido / Fornecedor</th>
                        <th className="py-2.5 px-3">Data de Vencimento</th>
                        <th className="py-2.5 px-3 text-right">Valor da Parcela</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {(!invoice.duplicatas || invoice.duplicatas.length === 0) ? (
                        <tr className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-mono text-cyan-400 font-bold">001 (À Vista / Parcela Única)</td>
                          <td className="py-2.5 px-3 text-white">{invoice.emitente_nome}</td>
                          <td className="py-2.5 px-3 text-slate-300 font-mono">{formatDate(invoice.data_saida_entrada || invoice.data_emissao)}</td>
                          <td className="py-2.5 px-3 text-emerald-400 font-mono font-bold text-right">{formatCurrency(invoice.valor_total)}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              Lançada em Contas a Pagar
                            </span>
                          </td>
                        </tr>
                      ) : (
                        invoice.duplicatas.map((dup, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 font-mono text-cyan-400 font-bold">Parcela {dup.numero || String(idx + 1).padStart(3, '0')}</td>
                            <td className="py-2.5 px-3 text-white max-w-xs truncate">{invoice.emitente_nome}</td>
                            <td className="py-2.5 px-3 text-slate-300 font-mono font-medium">{dup.vencimento ? dup.vencimento.split('-').reverse().join('/') : formatDate(invoice.data_emissao)}</td>
                            <td className="py-2.5 px-3 text-emerald-400 font-mono font-bold text-right">{formatCurrency(dup.valor)}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                Lançada em Contas a Pagar
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer Actions (Direct Download XML, PDF, Drive Sync) */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/95 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <a
              href={api.getXmlDownloadUrl(invoice.id)}
              download={`${invoice.chave_acesso}.xml`}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors border border-slate-700"
            >
              <FileCode className="w-4 h-4 text-brand-400" />
              <span>Baixar XML</span>
            </a>

            <a
              href={api.getPdfDownloadUrl(invoice.id)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors border border-slate-700"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Baixar DANFE (PDF)</span>
            </a>

            <button
              onClick={() => onSyncDrive(invoice.id)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors border border-slate-700"
            >
              <HardDrive className="w-4 h-4 text-sky-400" />
              <span>{invoice.gdrive_synced ? 'Re-sincronizar no Drive' : 'Enviar ao Drive Agora'}</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
