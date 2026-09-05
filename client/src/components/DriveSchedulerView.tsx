import React, { useState, useEffect } from 'react';
import { Company, SyncLog, DriveStatus } from '../types';
import { api } from '../services/api';
import { 
  HardDrive, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Settings, 
  Key, 
  Play, 
  FolderTree, 
  FileText, 
  ShieldCheck,
  Calendar,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface DriveSchedulerViewProps {
  companies: Company[];
  selectedCompany: Company | null;
  onRefresh: () => void;
}

export const DriveSchedulerView: React.FC<DriveSchedulerViewProps> = ({
  companies,
  selectedCompany,
  onRefresh,
}) => {
  const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  // Credentials Modal
  const [isCredModalOpen, setIsCredModalOpen] = useState(false);
  const [credentialsJson, setCredentialsJson] = useState('');
  const [savingCred, setSavingCred] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statusRes, logsRes] = await Promise.all([
        api.getDriveStatus(),
        api.getLogs(selectedCompany?.id),
      ]);
      setDriveStatus(statusRes);
      setLogs(logsRes);
    } catch (err) {
      console.error('Error loading Drive status and logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCompany?.id]);

  const handleSyncCompany = async (companyId: string) => {
    try {
      setSyncingAll(true);
      await api.syncCompanyToDrive(companyId);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      await loadData();
      onRefresh();
    } catch (err: any) {
      alert(`Erro na sincronização: ${err.message}`);
    } finally {
      setSyncingAll(false);
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingCred(true);
      await api.saveDriveCredentials(credentialsJson);
      alert('Credenciais do Google Drive salvas com sucesso!');
      setIsCredModalOpen(false);
      setCredentialsJson('');
      await loadData();
    } catch (err: any) {
      alert(`Erro ao salvar credenciais: ${err.message}`);
    } finally {
      setSavingCred(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner: Drive Status & Global Controls */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-brand-400 flex items-center justify-center text-white shadow-lg shadow-sky-500/20 shrink-0">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">
                Sincronizador Automático Google Drive
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${
                driveStatus?.isConfigured
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {driveStatus?.isConfigured ? 'Google API Conectada' : 'Modo Operacional Ativo'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              {driveStatus?.message || 'Gerenciador de backup automático em nuvem organizado por Empresa / Ano / Mês.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
          <button
            onClick={() => setIsCredModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
          >
            <Key className="w-4 h-4 text-amber-400" />
            <span>Credenciais Google Cloud</span>
          </button>

          {selectedCompany && (
            <button
              onClick={() => handleSyncCompany(selectedCompany.id)}
              disabled={syncingAll}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-600 to-sky-500 hover:from-brand-500 hover:to-sky-400 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-500/20 transition-all disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
              <span>{syncingAll ? 'Sincronizando...' : `Executar Sync: ${selectedCompany.razao_social.substring(0, 15)}...`}</span>
            </button>
          )}

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700"
            title="Atualizar logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-400' : ''}`} />
          </button>
        </div>

      </div>

      {/* Structure Guide Card */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-brand-400 font-bold text-xs uppercase tracking-wider">
          <FolderTree className="w-4 h-4" />
          <span>Estrutura de Pastas Automatizada no Google Drive</span>
        </div>
        <p className="text-xs text-slate-300">
          O sistema organiza automaticamente os arquivos baixados da SEFAZ na seguinte hierarquia em sua conta do Google Drive:
        </p>

        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 font-mono text-xs text-slate-300 space-y-1">
          <div className="text-brand-400">📁 Google Drive Principal</div>
          <div className="pl-4 text-sky-400">└── 📁 Contabilidade / [Nome_da_Empresa_Cliente]</div>
          <div className="pl-8 text-amber-400">└── 📁 2026 (Ano de Emissão)</div>
          <div className="pl-12 text-emerald-400">└── 📁 08 (Mês de Competência)</div>
          <div className="pl-16 text-slate-200">├── 📁 XMLs (Arquivos .xml originais assinados)</div>
          <div className="pl-16 text-slate-200">└── 📁 PDFs (DANFEs oficiais em PDF)</div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl space-y-3 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-400" />
            <h3 className="font-bold text-white text-sm">Histórico de Execuções e Auditoria de Backup</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {selectedCompany ? `Filtro ativo: ${selectedCompany.razao_social}` : 'Todas as empresas'}
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-300 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Data / Hora</th>
                <th className="py-2.5 px-3">Empresa Cliente</th>
                <th className="py-2.5 px-3">Gatilho</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Enviados ao Drive</th>
                <th className="py-2.5 px-3">Mensagem / Detalhes</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Nenhum log de sincronização registrado ainda. Execute uma sincronização para visualizar os registros.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-300 font-mono text-[11px]">
                      {formatDate(log.executed_at)}
                    </td>
                    <td className="py-2.5 px-3 text-white font-medium">
                      {log.company_name || log.company_id}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap capitalize">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                        {log.trigger_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {log.status === 'sucesso' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300">
                          <CheckCircle className="w-3 h-3" />
                          Sucesso
                        </span>
                      )}
                      {log.status === 'processando' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/20 text-sky-300">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Processando
                        </span>
                      )}
                      {log.status === 'erro' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300">
                          <XCircle className="w-3 h-3" />
                          Erro
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-400">
                      {log.gdrive_uploaded}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 max-w-md truncate" title={log.message}>
                      {log.message || 'Operação concluída.'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Modal: Google Drive Credentials JSON */}
      {isCredModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Credenciais Google Drive (Service Account)</h3>
                  <p className="text-xs text-slate-400">Cole o JSON gerado no Google Cloud Console</p>
                </div>
              </div>
              <button onClick={() => setIsCredModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveCredentials} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Conteúdo do Arquivo JSON de Conta de Serviço:
                </label>
                <textarea
                  rows={8}
                  value={credentialsJson}
                  onChange={(e) => setCredentialsJson(e.target.value)}
                  placeholder='{"type": "service_account", "project_id": "...", "private_key": "...", "client_email": "..."}'
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-[11px] focus:outline-none focus:border-brand-500"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Crie uma Service Account no Google Cloud com a permissão "Google Drive API" e compartilhe as pastas desejadas com o e-mail da Service Account.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCredModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCred || !credentialsJson}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold disabled:opacity-50"
                >
                  {savingCred ? 'Validando...' : 'Salvar Credenciais'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
