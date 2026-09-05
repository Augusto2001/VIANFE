import React, { useState, useEffect } from 'react';
import { Activity, Zap, Server, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';

interface EngineLog {
  id: string;
  timestamp: string;
  chave: string;
  action: string;
  status: 'mTLS' | 'Ingested' | 'DANFE' | 'Synced';
  company: string;
}

export const LiveEngineStream: React.FC = () => {
  const [logs, setLogs] = useState<EngineLog[]>([]);
  const [processedRate, setProcessedRate] = useState(1427);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const initialLogs: EngineLog[] = [
      { id: '1', timestamp: new Date().toLocaleTimeString('pt-BR'), chave: '3526060294827800011055001000306324...', action: 'mTLS Handshake + Decodificação SEFAZ', status: 'mTLS', company: 'SALES COMÉRCIO' },
      { id: '2', timestamp: new Date().toLocaleTimeString('pt-BR'), chave: '2926051511219600018355002000259325...', action: 'DANFE PDF Gerado & Armazenado', status: 'DANFE', company: 'LOPES COMÉRCIO' },
    ];
    setLogs(initialLogs);

    const interval = setInterval(() => {
      setProcessedRate(prev => Math.floor(1400 + Math.random() * 80));
      const sampleChaves = [
        '2926054174611800014055001000009223...',
        '3126052147359000022055001000119038...',
        '4126057946019200017955002000528313...'
      ];
      const sampleCompanies = ['SALES COMÉRCIO', 'LOPES COMÉRCIO', 'AMSFER COMERCIAL'];
      const sampleActions = [
        'Decodificação mTLS SEFAZ com Certificado A1',
        'Ingestão em Banco de Dados Seguro',
        'Geração de DANFE PDF & Backup Drive'
      ];
      const statuses: ('mTLS' | 'Ingested' | 'DANFE' | 'Synced')[] = ['mTLS', 'Ingested', 'DANFE'];

      const randomIdx = Math.floor(Math.random() * sampleCompanies.length);
      const newLog: EngineLog = {
        id: String(Date.now()),
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        chave: sampleChaves[randomIdx],
        action: sampleActions[randomIdx],
        status: statuses[randomIdx],
        company: sampleCompanies[randomIdx],
      };

      setLogs(prev => [newLog, ...prev.slice(0, 4)]);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const latestLog = logs[0];

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 transition-all text-xs">
      {/* 1-Line Clean Status Strip */}
      <div className="px-3.5 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-2 w-2 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-semibold text-slate-200 shrink-0">Motor Fiscal:</span>
          <span className="text-slate-400 truncate">
            {latestLog ? `${latestLog.action} (${latestLog.company})` : 'Captura contínua SEFAZ ativa'}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-400">
          <div className="hidden sm:flex items-center gap-1.5 font-sans">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span>SEFAZ BA: <strong className="text-emerald-400 font-medium">Online (38ms)</strong></span>
          </div>
          <span className="hidden md:inline">•</span>
          <div className="hidden md:flex items-center gap-1 font-sans">
            <span>{processedRate} docs/min</span>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer text-[10px]"
            title="Ver histórico de processamento"
          >
            <span>{isExpanded ? 'Ocultar' : 'Logs'}</span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Collapsible Detailed Logs */}
      {isExpanded && (
        <div className="border-t border-slate-800/80 p-3 space-y-1.5 bg-slate-950/60 rounded-b-xl text-[11px]">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between text-slate-400 hover:text-slate-200 py-1 px-2 rounded bg-slate-900/40">
              <div className="flex items-center gap-2 truncate">
                <span className="text-slate-400 font-mono text-[10px]">{log.timestamp}</span>
                <span className="font-medium text-slate-300">{log.company}</span>
                <span className="text-slate-400">—</span>
                <span className="truncate">{log.action}</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">{log.chave}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
