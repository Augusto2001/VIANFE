import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { Company, ReceiptOcrItem, ConfirmReceiptMatchDto } from '../../types';
import { 
  Camera, 
  UploadCloud, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  DollarSign, 
  Tag, 
  Calendar, 
  Building2, 
  Layers, 
  Check, 
  Trash2, 
  RefreshCw, 
  FileText, 
  Image as ImageIcon,
  ArrowRight,
  ShieldCheck,
  Zap,
  Filter
} from 'lucide-react';

interface PortalReceiptScannerTabProps {
  company: Company;
}

export const PortalReceiptScannerTab: React.FC<PortalReceiptScannerTabProps> = ({ company }) => {
  const [receipts, setReceipts] = useState<ReceiptOcrItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendente' | 'conciliado'>('all');

  // Scanner upload state
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ReceiptOcrItem | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Manual adjustment form before confirmation
  const [adjDescricao, setAdjDescricao] = useState('');
  const [adjValor, setAdjValor] = useState('');
  const [adjData, setAdjData] = useState('');
  const [adjCategoria, setAdjCategoria] = useState('');
  const [adjFormaPagamento, setAdjFormaPagamento] = useState('PIX');
  const [adjObservacoes, setAdjObservacoes] = useState('');
  const [confirming, setConfirming] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const loadReceipts = async () => {
    try {
      setLoading(true);
      const data = await api.getPortalReceipts(company.id);
      setReceipts(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar recibos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceipts();
  }, [company.id]);

  const handleProcessFile = async (file: File) => {
    try {
      setScanning(true);
      setScanError(null);
      setScanResult(null);

      // Create local preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      const result = await api.scanPortalReceipt(company.id, file);
      setScanResult(result);

      // Populate adjustment fields
      setAdjDescricao(result.fornecedor_nome_detectado || result.descricao_final || 'Despesa Operacional');
      setAdjValor(String(result.valor_total_detectado || result.valor_final || ''));
      setAdjData(result.data_despesa_detectada || result.data_final || new Date().toISOString().split('T')[0]);
      setAdjCategoria(result.categoria_sugerida_nome || 'Despesas Gerais');
      setAdjFormaPagamento(result.forma_pagamento || 'PIX');
      setAdjObservacoes(result.observacoes_cliente || '');

      loadReceipts();
    } catch (err: any) {
      console.error('Erro no OCR do recibo:', err);
      setScanError(err.message || 'Falha ao analisar recibo com OCR.');
    } finally {
      setScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleConfirmMatch = async (receiptId: string) => {
    try {
      setConfirming(true);
      const valNum = parseFloat(adjValor.replace(',', '.')) || undefined;

      const payload: ConfirmReceiptMatchDto = {
        payable_id: scanResult?.matched_payable_id || undefined,
        valor_ajustado: valNum,
        data_ajustada: adjData || undefined,
        fornecedor_ajustado: adjDescricao || undefined,
        forma_pagamento: adjFormaPagamento || undefined,
        observacoes: adjObservacoes || undefined,
      };

      await api.confirmPortalReceiptMatch(receiptId, payload);
      alert('Recibo conciliado e integrado com sucesso no Contas a Pagar!');
      setScanResult(null);
      setPreviewImage(null);
      loadReceipts();
    } catch (err: any) {
      alert(`Erro ao confirmar conciliação: ${err.message}`);
    } finally {
      setConfirming(false);
    }
  };

  const handleDeleteReceipt = async (id: string) => {
    if (!window.confirm('Deseja excluir este comprovante do portal?')) return;
    try {
      await api.deletePortalReceipt(id);
      loadReceipts();
    } catch (err: any) {
      alert(`Erro ao excluir: ${err.message}`);
    }
  };

  const filteredReceipts = receipts.filter((r) => {
    if (statusFilter === 'pendente') return r.status_match === 'pendente' || r.status_match === 'sugerido';
    if (statusFilter === 'conciliado') return r.status_match === 'conciliado' || r.status_match === 'CONFIRMADO';
    return true;
  });

  const formatCurrency = (val: number | undefined | null) => {
    return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider">
                  OCR Inteligente & BPO
                </span>
                <span className="text-xs text-slate-400 font-mono">Auto-Match</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
                Scanner & Captura de Recibos
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Fotografe comprovantes de balcão ou notas de compras para conciliação automática com o Contas a Pagar.
              </p>
            </div>
          </div>

          {/* Hidden File Inputs */}
          <input
            type="file"
            ref={cameraInputRef}
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Action Trigger Buttons for Mobile & Desktop */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={scanning}
              className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Tirar Foto (Câmera)</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={scanning}
              className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-cyan-400" />
              <span>Anexar Arquivo</span>
            </button>
          </div>
        </div>

        {/* Drag & Drop Hero Box */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="mt-5 p-8 border-2 border-dashed border-slate-800 hover:border-cyan-500/50 rounded-2xl bg-slate-950/60 hover:bg-slate-950 text-center cursor-pointer transition-all space-y-2 group"
        >
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
            <UploadCloud className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white">
            {scanning ? 'Processando Imagem com Inteligência OCR...' : 'Toque ou arraste seu cupom / recibo aqui'}
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Suporta fotos de celular (JPEG, PNG) e arquivos PDF de faturas ou recibos.
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* OCR PROCESSING RESULT & AUTO-MATCH CARD */}
      {/* ========================================================================= */}
      {scanning && (
        <div className="bg-slate-900 border border-cyan-500/30 rounded-3xl p-8 text-center space-y-4 shadow-xl animate-pulse">
          <div className="w-12 h-12 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin mx-auto" />
          <h4 className="text-base font-bold text-white">Extraindo dados fiscais do recibo...</h4>
          <p className="text-xs text-slate-400">Identificando CNPJ, Fornecedor, Data, Valor e Itens via OCR.</p>
        </div>
      )}

      {scanError && (
        <div className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 text-center space-y-3 shadow-xl">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <h4 className="text-sm font-bold text-white">Falha ao processar recibo</h4>
          <p className="text-xs text-slate-400">{scanError}</p>
        </div>
      )}

      {scanResult && (
        <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 animate-fade-in">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white">Análise OCR & Conciliação Inteligente</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                    {Math.round((scanResult.ocr_confidence_score || 0.95) * 100)}% Confiança
                  </span>
                </div>
                <p className="text-xs text-slate-400">Revise os dados extraídos antes de confirmar a baixa no Contas a Pagar</p>
              </div>
            </div>

            <button
              onClick={() => { setScanResult(null); setPreviewImage(null); }}
              className="text-xs text-slate-400 hover:text-white"
            >
              Fechar Análise
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left: OCR Extracted Values Card */}
            <div className="lg:col-span-2 space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Fornecedor Detectado:</label>
                  <input
                    type="text"
                    value={adjDescricao}
                    onChange={(e) => setAdjDescricao(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-cyan-500 font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Valor Total (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjValor}
                    onChange={(e) => setAdjValor(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-emerald-400 font-mono font-black focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Data do Comprovante:</label>
                  <input
                    type="date"
                    value={adjData}
                    onChange={(e) => setAdjData(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-cyan-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Categoria Sugerida:</label>
                  <input
                    type="text"
                    value={adjCategoria}
                    onChange={(e) => setAdjCategoria(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Forma de Pagamento:</label>
                  <select
                    value={adjFormaPagamento}
                    onChange={(e) => setAdjFormaPagamento(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-cyan-500"
                  >
                    <option value="PIX">PIX</option>
                    <option value="CARTAO_DEBITO">Cartão de Débito</option>
                    <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                    <option value="DINHEIRO">Dinheiro / Espécie</option>
                    <option value="BOLETO">Boleto Bancário</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">Observações do Cliente:</label>
                <textarea
                  value={adjObservacoes}
                  onChange={(e) => setAdjObservacoes(e.target.value)}
                  rows={2}
                  placeholder="Ex: Almoço de negócios com cliente da filial..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-cyan-500"
                />
              </div>

              {/* Auto-Match Suggestion Box */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-cyan-500/30 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-white font-bold">Auto-Match com Contas a Pagar:</strong>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {scanResult.status_match === 'sugerido' || scanResult.status_match === 'conciliado' ? 'Match Encontrado' : 'Novo Lançamento'}
                    </span>
                  </div>
                  <p className="text-slate-400">
                    {scanResult.matched_payable_id 
                      ? `Título correspondente localizado no valor de ${formatCurrency(scanResult.valor_total_detectado)}.`
                      : 'Nenhum título idêntico localizado. Um novo lançamento de despesa será criado na contabilidade Viacont.'}
                  </p>
                </div>
              </div>

              {/* Confirm Action Button */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => handleConfirmMatch(scanResult.id)}
                  disabled={confirming}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-black rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{confirming ? 'Conciliando...' : 'Confirmar Conciliação & Enviar para Viacont'}</span>
                </button>
              </div>

            </div>

            {/* Right: Document Preview */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-2">
              <span className="text-[10px] font-bold uppercase text-slate-400">Foto / Imagem do Recibo</span>
              {previewImage ? (
                <img
                  src={previewImage}
                  alt="Recibo"
                  className="max-h-64 object-contain rounded-xl border border-slate-800 shadow-md"
                />
              ) : (
                <div className="w-full h-48 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 text-xs">
                  <ImageIcon className="w-8 h-8" />
                </div>
              )}
              <span className="text-[10px] text-slate-500 font-mono">{scanResult.arquivo_nome}</span>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* RECEIPTS HISTORY LIST */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-cyan-400" />
            <div>
              <h4 className="text-sm font-black text-white">Histórico de Comprovantes Enviados</h4>
              <p className="text-xs text-slate-400">Acompanhe o status de conciliação de cada cupom</p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos ({receipts.length})
            </button>
            <button
              onClick={() => setStatusFilter('pendente')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'pendente' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Pendentes
            </button>
            <button
              onClick={() => setStatusFilter('conciliado')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'conciliado' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Conciliados
            </button>
          </div>
        </div>

        {filteredReceipts.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-1">
            <Camera className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="font-bold text-white">Nenhum recibo no histórico com este filtro.</p>
            <p>Utilize o botão de Tirar Foto acima para enviar seu primeiro comprovante.</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {filteredReceipts.map((rec) => {
              const isConciliated = rec.status_match === 'conciliado' || rec.status_match === 'CONFIRMADO';

              return (
                <div
                  key={rec.id}
                  className="bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-cyan-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        isConciliated 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {isConciliated ? 'Conciliado' : 'Pendente de Match'}
                      </span>
                      <h5 className="text-xs font-bold text-white truncate">
                        {rec.fornecedor_nome_detectado || rec.descricao_final || 'Despesa'}
                      </h5>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono">
                      <span>Data: {rec.data_despesa_detectada || rec.created_at?.split('T')[0]}</span>
                      {rec.categoria_sugerida_nome && (
                        <span className="text-cyan-400 font-sans">Categoria: {rec.categoria_sugerida_nome}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 self-end sm:self-auto">
                    <span className="text-sm font-black text-emerald-400 font-mono">
                      {formatCurrency(rec.valor_total_detectado || rec.valor_final || 0)}
                    </span>

                    <button
                      onClick={() => handleDeleteReceipt(rec.id)}
                      className="p-2 bg-slate-900 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 rounded-xl border border-slate-800 hover:border-rose-800 transition-colors"
                      title="Excluir comprovante"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

    </div>
  );
};
