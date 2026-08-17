import React, { useState } from 'react';
import { Company } from '../types';
import { api } from '../services/api';
import { 
  UploadCloud, 
  FileCode, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Layers, 
  ArrowRight,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface XmlImporterViewProps {
  companies: Company[];
  selectedCompany: Company | null;
  onSelectCompany: (company: Company) => void;
  onImportSuccess: () => void;
}

export const XmlImporterView: React.FC<XmlImporterViewProps> = ({
  companies,
  selectedCompany,
  onSelectCompany,
  onImportSuccess,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ processed: number; errors?: string[] } | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.xml'));
      setSelectedFiles(filesArray);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files).filter(f => f.name.endsWith('.xml'));
      setSelectedFiles(filesArray);
    }
  };

  const handleUpload = async () => {
    if (!selectedCompany) {
      alert('Por favor, selecione uma empresa cliente de destino.');
      return;
    }

    if (selectedFiles.length === 0) {
      alert('Selecione ao menos um arquivo .xml para importar.');
      return;
    }

    try {
      setUploading(true);
      setResult(null);

      const res = await api.uploadBatchXml(selectedCompany.id, selectedFiles);
      setResult(res);
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      setSelectedFiles([]);
      onImportSuccess();
    } catch (err: any) {
      alert(`Falha na importação: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      
      {/* Top Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center border border-brand-500/20">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Importador e Processador de XMLs Fiscais
            </h2>
            <p className="text-xs text-slate-400">
              Faça upload de notas fiscais (NFe, CTe, NFCe) em lote para armazenar, gerar DANFEs e sincronizar com o Google Drive.
            </p>
          </div>
        </div>
      </div>

      {/* Target Company Selector */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
          1. Selecione a Empresa Cliente de Destino:
        </label>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {companies.map((comp) => {
            const isSelected = selectedCompany?.id === comp.id;
            return (
              <button
                key={comp.id}
                onClick={() => onSelectCompany(comp)}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                  isSelected
                    ? 'border-brand-500 bg-brand-500/10 text-white ring-1 ring-brand-500/40'
                    : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                }`}
              >
                <Building2 className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? 'text-brand-400' : 'text-slate-500'}`} />
                <div className="min-w-0">
                  <div className="font-semibold text-xs truncate">{comp.razao_social}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{comp.cnpj}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Upload Drop Zone */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
          2. Selecione ou Arraste os Arquivos XML:
        </label>

        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
            dragActive
              ? 'border-brand-400 bg-brand-500/10 scale-[0.99]'
              : 'border-slate-700 hover:border-brand-500/60 bg-slate-950/40'
          }`}
          onClick={() => document.getElementById('xml-file-input')?.click()}
        >
          <input
            id="xml-file-input"
            type="file"
            multiple
            accept=".xml"
            onChange={handleFileChange}
            className="hidden"
          />
          
          <div className="w-14 h-14 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center mx-auto mb-3 border border-brand-500/20">
            <FileCode className="w-7 h-7" />
          </div>

          <h3 className="text-sm font-semibold text-white">
            Clique para selecionar ou arraste seus arquivos .xml aqui
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Suporta múltiplos arquivos XML de NFe (Mod 55), NFCe (Mod 65) e CTe (Mod 57).
          </p>

          {selectedFiles.length > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/20 text-brand-300 text-xs font-semibold border border-brand-500/30">
              <span>{selectedFiles.length} arquivo(s) XML selecionado(s)</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        {selectedFiles.length > 0 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              Destino: <strong className="text-brand-400">{selectedCompany?.razao_social}</strong>
            </span>

            <button
              onClick={handleUpload}
              disabled={uploading || !selectedCompany}
              className="px-6 py-2.5 bg-gradient-to-r from-brand-600 to-sky-500 hover:from-brand-500 hover:to-sky-400 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processando e Gerando DANFEs...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Processar {selectedFiles.length} Nota(s) Agora</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Results Feedback */}
        {result && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-2 animate-fade-in">
            <div className="flex items-center gap-2 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Importação Concluída com Sucesso!</span>
            </div>
            <p>
              {result.processed} nota(s) fiscal(is) processada(s), salvas e com DANFE gerado no perfil de <strong>{selectedCompany?.razao_social}</strong>.
            </p>
            {result.errors && result.errors.length > 0 && (
              <div className="mt-2 text-rose-300 space-y-1">
                <span className="font-semibold block">Avisos em alguns arquivos:</span>
                {result.errors.map((err, i) => (
                  <div key={i} className="text-[11px] font-mono">• {err}</div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
};
