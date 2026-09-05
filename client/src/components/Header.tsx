import React, { useState, useRef, useEffect } from 'react';
import { Company } from '../types';
import { 
  Building2, 
  ChevronDown, 
  Search, 
  RefreshCw, 
  Plus, 
  CheckCircle2, 
  Moon, 
  Sun, 
  LogOut, 
  UserCheck, 
  Users,
  Menu,
  Sparkles
} from 'lucide-react';
import { NavTab } from './Sidebar';

interface HeaderProps {
  companies: Company[];
  selectedCompany: Company | null;
  onSelectCompany: (company: Company) => void;
  activeTab: NavTab;
  onQuickSync: () => void;
  isSyncing: boolean;
  onOpenNewCompanyModal: () => void;
  onOpenUsersModal?: () => void;
  onOpenTenantsModal?: () => void;
  onLogout?: () => void;
  currentUser?: any;
  onToggleMobileSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  companies,
  selectedCompany,
  onSelectCompany,
  activeTab,
  onQuickSync,
  isSyncing,
  onOpenNewCompanyModal,
  onOpenUsersModal,
  onOpenTenantsModal,
  onLogout,
  currentUser,
  onToggleMobileSidebar,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('vianfe_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.body.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.body.classList.remove('light');
    }
    localStorage.setItem('vianfe_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

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

  // Real-time client-side search filtering
  const filteredCompanies = companies.filter(c => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const cleanDoc = q.replace(/\D/g, '');
    return (
      c.razao_social.toLowerCase().includes(q) ||
      (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(q)) ||
      (cleanDoc && c.cnpj.includes(cleanDoc)) ||
      c.cnpj.toLowerCase().includes(q) ||
      (c.uf && c.uf.toLowerCase().includes(q))
    );
  });

  const formatCnpj = (cnpj: string) => {
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length === 14) {
      return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    return cnpj;
  };

  const getSectionTitle = (tab: NavTab) => {
    switch (tab) {
      case 'dashboard':
        return { category: 'Fiscal', name: 'Notas Fiscais & Captura SEFAZ' };
      case 'nfse':
        return { category: 'Fiscal', name: 'Emissão NFS-e & Serviços Multi-Cidades' };
      case 'import':
        return { category: 'Fiscal', name: 'Importador de XMLs em Lote' };
      case 'tax_audit':
        return { category: 'Fiscal', name: 'Auditoria Tributária & Monofásicos' };
      case 'bpo':
        return { category: 'Financeiro', name: 'BPO Financeiro & Conciliação Bancária' };
      case 'companies':
        return { category: 'Gestão', name: 'Empresas Clientes & Certificados' };
      case 'business_success':
        return { category: 'Gestão', name: 'Painel do Sucesso & Metas Contábeis' };
      case 'client_portal':
        return { category: 'Gestão', name: 'Área do Cliente (PWA Mobile)' };
      case 'drive':
        return { category: 'Gestão', name: 'Google Drive & Logs de Sincronização' };
      default:
        return { category: 'Fiscal', name: 'Painel Geral' };
    }
  };

  const sectionInfo = getSectionTitle(activeTab);

  return (
    <header className="bg-slate-950 border-b border-slate-800/90 sticky top-0 z-30 shadow-md">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* Left: Mobile Hamburger Toggle + Active Section Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onToggleMobileSidebar}
              className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-900 text-slate-300 hover:text-white border border-slate-800 transition-colors shrink-0"
              title="Abrir menu de navegação"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                <span className="text-emerald-400 uppercase tracking-wider">{sectionInfo.category}</span>
                <span>/</span>
                <span className="text-slate-300 truncate">{sectionInfo.name}</span>
              </div>
              <p className="text-xs font-bold text-white truncate hidden sm:block">
                {selectedCompany ? selectedCompany.nome_fantasia || selectedCompany.razao_social : 'Selecione uma Empresa'}
              </p>
            </div>
          </div>

          {/* Center: Company Selector with Working Real-Time Filter */}
          <div className="relative flex-1 max-w-sm hidden md:block" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition-all group shadow-sm min-h-[44px]"
              title="Clique para trocar a empresa cliente ativa"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 transition-colors shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {selectedCompany ? selectedCompany.razao_social : 'Selecionar Empresa...'}
                  </div>
                  {selectedCompany && (
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      {formatCnpj(selectedCompany.cnpj)} • {selectedCompany.uf}
                    </div>
                  )}
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${dropdownOpen ? 'rotate-180 text-emerald-400' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-scale-up">
                <div className="p-2 border-b border-slate-800 bg-slate-900/80">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Filtrar por nome ou CNPJ..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans"
                    />
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto py-1 bg-slate-950">
                  {filteredCompanies.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-slate-400">
                      Nenhuma empresa encontrada para "{searchQuery}".
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
                          className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-900 transition-colors border-l-2 ${
                            isSelected 
                              ? 'border-emerald-500 bg-slate-900 text-white' 
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
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="p-2 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenNewCompanyModal();
                    }}
                    className="w-full min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:text-white bg-slate-900 hover:bg-emerald-600 rounded-xl transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Cadastrar Nova Empresa Cliente
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Global Actions & Auth Info (Fluid & Never Cut-off) */}
          <div className="flex items-center gap-2 shrink-0">
            
            {/* Quick SEFAZ Sync Action */}
            {selectedCompany && (
              <button
                onClick={onQuickSync}
                disabled={isSyncing}
                className={`min-h-[44px] flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ${
                  isSyncing 
                    ? 'bg-emerald-600/50 text-white cursor-wait' 
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                }`}
                title="Buscar notas fiscais na SEFAZ e sincronizar com Google Drive"
              >
                <RefreshCw className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isSyncing ? 'Sincronizando...' : 'Sincronizar SEFAZ'}</span>
              </button>
            )}

            {/* Manage Users Button */}
            {onOpenUsersModal && (
              <button
                onClick={onOpenUsersModal}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-800 transition-colors"
                title="Gerenciar usuários e acessos de clientes"
              >
                <Users className="w-4 h-4 text-emerald-400" />
                <span className="hidden xl:inline">Usuários</span>
              </button>
            )}

            {/* Manage Multi-Office Tenants Button */}
            {onOpenTenantsModal && (
              <button
                onClick={onOpenTenantsModal}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-800 transition-colors"
                title="Gestão de Escritórios Contábeis Parceiros (SaaS Multi-Tenant)"
              >
                <Building2 className="w-4 h-4 text-teal-400" />
                <span className="hidden xl:inline">Tenants</span>
              </button>
            )}

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 transition-colors"
              title={theme === 'dark' ? 'Alternar para Tema Claro' : 'Alternar para Modo Noturno'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            {/* Current User Badge */}
            {currentUser && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs min-h-[44px]">
                <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="min-w-0 max-w-[130px]">
                  <p className="font-bold text-white truncate text-[11px]">{currentUser.name || currentUser.email}</p>
                  <p className="text-[10px] text-emerald-400 font-mono uppercase">{currentUser.role === 'admin' ? 'Viacont Admin' : 'Cliente'}</p>
                </div>
              </div>
            )}

            {/* Logout Button */}
            {onLogout && (
              <button
                onClick={onLogout}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-300 hover:text-red-200 rounded-xl text-xs font-semibold border border-red-500/30 transition-colors"
                title="Sair do sistema (Logout)"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
