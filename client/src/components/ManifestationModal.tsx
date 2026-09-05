import React, { useState } from 'react';
import { Invoice } from '../types';
import { api } from '../services/api';
import { ShieldCheck, AlertTriangle, FileText, CheckCircle2, XCircle, HelpCircle, Send } from 'lucide-react';

interface ManifestationModalProps {
  invoice: Invoice;
  onClose: () => void;
  onSuccess: () => void;
}

export const ManifestationModal: React.FC<ManifestationModalProps> = ({ invoice, onClose, onSuccess }) => {
  const [eventType, setEventType] = useState<'ciencia' | 'confirmacao' | 'desconhecimento' | 'nao_realizada'>('ciencia');
  const [justificativa, setJustificativa] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if ((eventType === 'desconhecimento' || eventType === 'nao_realizada') && justificativa.trim().length < 15) {
      setError('A justificativa é obrigatória e deve conter no mínimo 15 caracteres.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.submitManifestation(invoice.id, eventType, justificativa);
      alert(`✅ ${res.message}\nProtocolo SEFAZ: ${res.data.protocol}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Falha ao registrar manifestação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5 animate-scale-up">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Manifestação do Destinatário</h3>
              <p className="text-xs text-slate-400 font-mono">NF nº {invoice.numero} • {invoice.emitente_nome}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Option Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Selecione o Evento Fiscal:</label>
            
            <div className="grid grid-cols-1 gap-2.5">
              
              {/* 1. Ciência da Operação */}
              <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                eventType === 'ciencia' ? 'bg-sky-500/10 border-sky-500/40 text-white' : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}>
                <input type="radio" name="evt" checked={eventType === 'ciencia'} onChange={() => setEventType('ciencia')} className="mt-1" />
                <div>
                  <div className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Ciência da Operação (Código 210210)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Declara ciência da emissão. Permite obter o XML completo sem confirmar o recebimento físico.</p>
                </div>
              </label>

              {/* 2. Confirmação da Operação */}
              <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                eventType === 'confirmacao' ? 'bg-emerald-500/10 border-emerald-500/40 text-white' : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}>
                <input type="radio" name="evt" checked={eventType === 'confirmacao'} onChange={() => setEventType('confirmacao')} className="mt-1" />
                <div>
                  <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirmação da Operação (Código 210200)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Confirma que as mercadorias/serviços foram recebidos em perfeito estado.</p>
                </div>
              </label>

              {/* 3. Desconhecimento da Operação */}
              <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                eventType === 'desconhecimento' ? 'bg-amber-500/10 border-amber-500/40 text-white' : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}>
                <input type="radio" name="evt" checked={eventType === 'desconhecimento'} onChange={() => setEventType('desconhecimento')} className="mt-1" />
                <div>
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Desconhecimento da Operação (Código 210220)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Protege a empresa contra notas indevidas ou frias emitidas com seu CNPJ.</p>
                </div>
              </label>

              {/* 4. Operação Não Realizada */}
              <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                eventType === 'nao_realizada' ? 'bg-rose-500/10 border-rose-500/40 text-white' : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}>
                <input type="radio" name="evt" checked={eventType === 'nao_realizada'} onChange={() => setEventType('nao_realizada')} className="mt-1" />
                <div>
                  <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Operação não Realizada (Código 210240)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Reconhece a negociação, mas a entrega não ocorreu (ex: avaria no transporte, recusa).</p>
                </div>
              </label>

            </div>
          </div>

          {/* Justificativa (for Desconhecimento or Nao Realizada) */}
          {(eventType === 'desconhecimento' || eventType === 'nao_realizada') && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Justificativa do Recusa/Desconhecimento (mín. 15 chars):</label>
              <textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Exemplo: Mercadorias danificadas no transporte e devolvidas ao remetente conforme laudo de avaria."
                rows={3}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-sans"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-brand-500/20 flex items-center gap-2"
            >
              <Send className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Enviando à SEFAZ...' : 'Transmitir à SEFAZ'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
