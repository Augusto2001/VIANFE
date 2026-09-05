import React, { useState, useRef } from 'react';
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
  Sparkles,
  BookOpen,
  Download,
  Edit3
} from 'lucide-react';

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
  const [importerType, setImporterType] = useState<'xml' | 'plano_contas'>('xml');

  // XML Import State
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ processed: number; errors?: string[] } | null>(null);

  // Plano de Contas State
  const [chartContent, setChartContent] = useState('');
  const [chartFileName, setChartFileName] = useState('');
  const [chartLinesCount, setChartLinesCount] = useState(0);
  const [replaceExistingChart, setReplaceExistingChart] = useState(true);
  const [chartUploading, setChartUploading] = useState(false);
  const [chartSuccessMsg, setChartSuccessMsg] = useState('');
  const chartFileInputRef = useRef<HTMLInputElement>(null);

  const handleChartFileChange = (file: File) => {
    setChartFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        setChartContent(text);
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        setChartLinesCount(lines.length);
        setChartSuccessMsg(`✓ Arquivo "${file.name}" lido com sucesso (${lines.length} linhas detectadas).`);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleDownloadTemplate = () => {
    const template = `Código;Classificação;Nome da Conta;Natureza
10;1.1.01.01.001;Caixa Geral;D
20;1.1.01.02.001;Banco Itaú S/A;D
100;1.1.02.01.001;Clientes a Receber;D
150;2.1.01.01.001;Fornecedores Nacionais;C
200;2.1.02.01.001;Salários e Ordenados a Pagar;C
300;3.1.01.01.001;Receita de Prestação de Serviços;C
420;4.1.02.01.001;Despesas com Salários;D`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MODELO_PLANO_DE_CONTAS_DOMINIO.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadChart = async () => {
    if (!selectedCompany) {
      alert('Por favor, selecione uma empresa de destino.');
      return;
    }
    if (!chartContent.trim()) {
      alert('Selecione um arquivo de Plano de Contas exportado da Domínio (.txt ou .csv).');
      return;
    }

    try {
      setChartUploading(true);
      setChartSuccessMsg('');
      const res = await api.importChartOfAccounts(selectedCompany.id, chartContent, replaceExistingChart);
      setChartSuccessMsg(res.message || 'Plano de Contas importado com sucesso!');
      setChartContent('');
      setChartFileName('');
      setChartLinesCount(0);
      onImportSuccess();
    } catch (err: any) {
      alert(`Erro ao importar Plano de Contas: ${err.message}`);
    } finally {
      setChartUploading(false);
    }
  };

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

      {/* Importer Mode Toggle */}
      <div className="flex items-center gap-3 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl">
        <button
          type="button"
          onClick={() => setImporterType('xml')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            importerType === 'xml'
              ? 'bg-gradient-to-r from-brand-600 to-sky-600 text-white shadow-lg shadow-brand-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Importar XMLs Fiscais (NF-e / CT-e / NFC-e)</span>
        </button>

        <button
          type="button"
          onClick={() => setImporterType('plano_contas')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            importerType === 'plano_contas'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Importar Plano de Contas Domínio (.txt / .csv)</span>
        </button>
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

      {/* MODE 1: XML FISCAL IMPORTER */}
      {importerType === 'xml' && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 animate-fade-in">
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
                className="px-6 py-2.5 bg-gradient-to-r from-brand-600 to-sky-500 hover:from-brand-500 hover:to-sky-400 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-500/20 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
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
      )}

      {/* MODE 2: PLANO DE CONTAS DOMÍNIO IMPORTER */}
      {importerType === 'plano_contas' && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              2. Selecione o Arquivo do Plano de Contas (.txt ou .csv):
            </label>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Baixar Modelo Exemplo (.csv)</span>
            </button>
          </div>

          <input
            ref={chartFileInputRef}
            type="file"
            accept=".txt,.csv,.tsv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleChartFileChange(file);
            }}
            className="hidden"
          />

          <div
            onClick={() => chartFileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) handleChartFileChange(file);
            }}
            className="border-2 border-dashed border-cyan-500/30 hover:border-cyan-500/60 bg-cyan-950/10 hover:bg-cyan-950/20 rounded-2xl p-8 text-center transition-all cursor-pointer space-y-3"
          >
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/20">
              <BookOpen className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-white">
                {chartFileName ? chartFileName : 'Clique para selecionar ou arraste o arquivo do Plano de Contas aqui'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {chartFileName
                  ? `✓ ${chartLinesCount} linhas lidas do arquivo. Pronto para processamento.`
                  : 'Suporta arquivos exportados da Domínio Sistemas em TXT (colunado) ou CSV (separado por ponto-e-vírgula).'}
              </p>
            </div>

            <span className="inline-block text-[10px] px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-full font-mono font-bold">
              Formato: Código;Classificação;Nome da Conta;Natureza(D/C)
            </span>
          </div>

          {/* Replace checkbox */}
          <div className="flex items-center gap-2 px-1">
            <input
              type="checkbox"
              id="replaceChartXml"
              checked={replaceExistingChart}
              onChange={(e) => setReplaceExistingChart(e.target.checked)}
              className="rounded border-slate-700 text-cyan-600 focus:ring-cyan-500"
            />
            <label htmlFor="replaceChartXml" className="text-xs text-slate-300 cursor-pointer">
              Substituir contas cadastradas anteriormente para esta empresa
            </label>
          </div>

          {chartSuccessMsg && (
            <div className="p-4 rounded-xl bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 text-xs font-semibold">
              {chartSuccessMsg}
            </div>
          )}

          {/* Action Button */}
          {chartContent.trim() && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                Destino: <strong className="text-cyan-400">{selectedCompany?.razao_social}</strong>
              </span>

              <button
                type="button"
                onClick={handleUploadChart}
                disabled={chartUploading || !selectedCompany}
                className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {chartUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Importando e Mapeando Contas...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Importar Plano de Contas Agora</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
