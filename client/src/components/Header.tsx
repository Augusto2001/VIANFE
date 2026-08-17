import React, { useState, useRef, useEffect } from 'react';
import { Company } from '../types';
import { 
  Building2, 
  ChevronDown, 
  Search, 
  RefreshCw, 
  Plus, 
  CheckCircle2, 
  FileSpreadsheet, 
  HardDrive, 
  UploadCloud, 
  Layers,
  Sparkles,
  ShieldCheck,
  Cloud
} from 'lucide-react';

interface HeaderProps {
  companies: Company[];
  selectedCompany: Company | null;
  onSelectCompany: (company: Company) => void;
  activeTab: 'dashboard' | 'companies' | 'drive' | 'import';
  onTabChange: (tab: 'dashboard' | 'companies' | 'drive' | 'import') => void;
  onQuickSync: () => void;
  isSyncing: boolean;
  onOpenNewCompanyModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  companies,
  selectedCompany,
  onSelectCompany,
  activeTab,
  onTabChange,
  onQuickSync,
  isSyncing,
  onOpenNewCompanyModal,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCompanies = companies.filter(c => 
    c.razao_social.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.cnpj.includes(searchQuery.replace(/\D/g, '')) ||
    (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatCnpj = (cnpj: string) => {
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length === 14) {
      return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    return cnpj;
  };

  return (
    <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & System Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center shadow-lg shadow-brand-500/20 text-white">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg text-white tracking-tight">DF-e Hub</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 font-medium border border-brand-500/30">
                  Fiscal Pro
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-normal">Escritório Contábil & Automação Drive</p>
            </div>
          </div>

          {/* Center: Company Selector */}
          <div className="relative flex-1 max-w-md" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center justify-between gap-2 px-3.5 py-2 bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-brand-500/60 rounded-xl text-left transition-all group shadow-inner"
              title="Clique para trocar a empresa cliente ativa"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-slate-700/60 flex items-center justify-center text-brand-400 group-hover:bg-brand-500/20 transition-colors shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Cliente Ativo:</span>
                    {selectedCompany?.status === 'ativo' && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Online
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-white truncate max-w-[260px]">
                    {selectedCompany ? selectedCompany.razao_social : 'Nenhuma empresa cadastrada'}
                  </div>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${dropdownOpen ? 'rotate-180 text-brand-400' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute left-0 right-0 mt-2 bg-slate-900/98 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 backdrop-blur-xl animate-fade-in">
                <div className="p-2 border-b border-slate-800 bg-slate-900/60">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por Razão Social ou CNPJ..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-brand-500"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto py-1">
                  {filteredCompanies.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-slate-400">
                      Nenhuma empresa encontrada com este filtro.
                    </div>
                  ) : (
                    filteredCompanies.map((comp) => {
                      const isSelected = selectedCompany?.id === comp.id;
                      return (
                        <button
                          key={comp.id}
                          onClick={() => {
                            onSelectCompany(comp);
                            setDropdownOpen(false);
                            setSearchQuery('');
                          }}
                          className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-800/80 transition-colors border-l-2 ${
                            isSelected 
                              ? 'border-brand-500 bg-brand-500/10 text-white' 
                              : 'border-transparent text-slate-300'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="font-medium text-xs text-white truncate">
                              {comp.razao_social}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                              <span>CNPJ: {formatCnpj(comp.cnpj)}</span>
                              <span>•</span>
                              <span className="text-slate-300 font-sans">{comp.uf}</span>
                            </div>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-brand-400 shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="p-2 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenNewCompanyModal();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-400 hover:text-white bg-brand-500/10 hover:bg-brand-600 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Cadastrar Nova Empresa Cliente
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Drive Sync Action */}
          <div className="flex items-center gap-3">
            {selectedCompany && (
              <button
                onClick={onQuickSync}
                disabled={isSyncing}
                className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-brand-600 to-sky-600 hover:from-brand-500 hover:to-sky-500 text-white rounded-xl text-xs font-medium transition-all shadow-md shadow-brand-500/20 disabled:opacity-50 active:scale-95"
                title="Sincroniza notas pendentes da empresa com a pasta do Google Drive"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Google Drive'}</span>
              </button>
            )}
          </div>

        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 -mb-px pt-1 border-t border-slate-800/60 overflow-x-auto">
          <button
            onClick={() => onTabChange('dashboard')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Dashboard & Notas Fiscais</span>
          </button>

          <button
            onClick={() => onTabChange('companies')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'companies'
                ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Empresas Clientes</span>
            <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded text-[10px] font-mono">
              {companies.length}
            </span>
          </button>

          <button
            onClick={() => onTabChange('drive')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'drive'
                ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Google Drive & Agendador</span>
          </button>

          <button
            onClick={() => onTabChange('import')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'import'
                ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Importador de XMLs</span>
          </button>
        </div>

      </div>
    </header>
  );
};
