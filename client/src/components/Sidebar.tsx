import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  FileSpreadsheet, 
  UploadCloud, 
  ShieldCheck, 
  DollarSign, 
  Building2, 
  Sparkles, 
  Smartphone, 
  Cloud,
  ChevronRight,
  ChevronDown,
  X,
  Activity,
  Receipt,
  PieChart
} from 'lucide-react';
import { Company } from '../types';

export type NavTab = 'dashboard' | 'bpo' | 'business_success' | 'tax_audit' | 'client_portal' | 'companies' | 'drive' | 'import' | 'analytics' | 'nfse';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  companiesCount: number;
  selectedCompany: Company | null;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ElementType;
  badge?: {
    text: string;
    variant: 'count' | 'feature' | 'urgency' | 'success';
  };
}

interface NavCategory {
  id: 'fiscal' | 'financeiro' | 'gestao';
  title: string;
  icon: React.ElementType;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  companiesCount,
  selectedCompany,
  isOpenMobile,
  onCloseMobile,
}) => {
  const categories: NavCategory[] = [
    {
      id: 'fiscal',
      title: 'FISCAL',
      icon: ShieldCheck,
      items: [
        {
          id: 'dashboard',
          label: 'Notas & SEFAZ',
          icon: Layers,
          badge: { text: 'Ao Vivo', variant: 'success' },
        },
        {
          id: 'nfse',
          label: 'NFS-e & Serviços',
          icon: FileSpreadsheet,
          badge: { text: 'Cidades', variant: 'feature' },
        },
        {
          id: 'import',
          label: 'Importador XMLs',
          icon: UploadCloud,
          badge: { text: 'Lote/Zip', variant: 'feature' },
        },
        {
          id: 'tax_audit',
          label: 'Auditoria Tributária',
          icon: PieChart,
          badge: { text: 'PIS/COFINS', variant: 'feature' },
        },
      ],
    },
    {
      id: 'financeiro',
      title: 'FINANCEIRO',
      icon: DollarSign,
      items: [
        {
          id: 'bpo',
          label: 'BPO & Conciliação',
          icon: DollarSign,
          badge: { text: 'OFX/PDF', variant: 'feature' },
        },
      ],
    },
    {
      id: 'gestao',
      title: 'GESTÃO',
      icon: Building2,
      items: [
        {
          id: 'companies',
          label: 'Empresas Clientes',
          icon: Building2,
          badge: { text: String(companiesCount), variant: 'count' },
        },
        {
          id: 'business_success',
          label: 'Painel do Sucesso',
          icon: Sparkles,
          badge: { text: 'Dia 31', variant: 'urgency' },
        },
        {
          id: 'client_portal',
          label: 'Área do Cliente',
          icon: Smartphone,
          badge: { text: 'Mobile PWA', variant: 'feature' },
        },
        {
          id: 'drive',
          label: 'Drive & Logs',
          icon: Cloud,
          badge: { text: 'Backup', variant: 'feature' },
        },
      ],
    },
  ];

  // Helper to determine which category contains activeTab
  const getCategoryForTab = (tab: NavTab): 'fiscal' | 'financeiro' | 'gestao' => {
    for (const cat of categories) {
      if (cat.items.some(i => i.id === tab)) return cat.id;
    }
    return 'fiscal';
  };

  // State to track expanded categories (All open by default for immediate visibility)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    fiscal: true,
    financeiro: true,
    gestao: true,
  });

  // Auto-expand group when activeTab changes
  useEffect(() => {
    const activeCat = getCategoryForTab(activeTab);
    setExpandedCategories(prev => ({
      ...prev,
      [activeCat]: true,
    }));
  }, [activeTab]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const renderBadge = (badge: NavItem['badge']) => {
    if (!badge) return null;

    switch (badge.variant) {
      case 'count':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-bold bg-slate-800 text-slate-300 border border-slate-700">
            {badge.text}
          </span>
        );
      case 'urgency':
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
            {badge.text}
          </span>
        );
      case 'success':
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {badge.text}
          </span>
        );
      case 'feature':
      default:
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20">
            {badge.text}
          </span>
        );
    }
  };

  const handleNavClick = (tabId: NavTab) => {
    onTabChange(tabId);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between bg-slate-950 border-r border-slate-800/90 w-72 select-none">
      {/* Brand Header */}
      <div>
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-700 via-brand-500 to-cyan-400 p-0.5 shadow-md shadow-brand-500/20 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base text-white tracking-tight">Via<span className="text-emerald-400">Nfe</span></span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-semibold border border-emerald-500/20 uppercase tracking-wider">
                  Viacont
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">Inteligência Fiscal & BPO</p>
            </div>
          </div>

          {/* Close button for Mobile Drawer */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            title="Fechar menu lateral"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Main Categories (Accordion Dropdown) */}
        <div className="p-3 space-y-2.5 overflow-y-auto max-h-[calc(100vh-170px)]">
          {categories.map((category) => {
            const isExpanded = !!expandedCategories[category.id];
            const CategoryIcon = category.icon;
            const hasActiveChild = category.items.some(i => i.id === activeTab);

            return (
              <div key={category.id} className="rounded-xl border border-slate-800/80 bg-slate-900/40 overflow-hidden">
                {/* 1. Large Clickable Category Header */}
                <button
                  onClick={() => toggleCategory(category.id)}
                  className={`w-full min-h-[44px] px-3.5 py-2.5 flex items-center justify-between text-left transition-colors cursor-pointer ${
                    hasActiveChild 
                      ? 'bg-slate-900 text-white font-bold' 
                      : 'text-slate-300 hover:text-white hover:bg-slate-900/80 font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                      hasActiveChild ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-400'
                    }`}>
                      <CategoryIcon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs tracking-wider uppercase">{category.title}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">
                      {category.items.length} {category.items.length === 1 ? 'item' : 'itens'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180 text-emerald-400' : ''
                    }`} />
                  </div>
                </button>

                {/* 2. Sub-items (Revealed Only when Category is Clicked/Expanded) */}
                {isExpanded && (
                  <div className="p-1.5 space-y-1 bg-slate-950/80 border-t border-slate-800/60 animate-fade-in">
                    {category.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleNavClick(item.id)}
                          className={`w-full min-h-[40px] pl-4 pr-2.5 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-all group ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-semibold'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                              isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-300'
                            }`} />
                            <span className="whitespace-nowrap">{item.label}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {renderBadge(item.badge)}
                            <ChevronRight className={`w-3 h-3 transition-transform ${
                              isActive ? 'text-emerald-400 translate-x-0.5' : 'text-slate-400 opacity-0 group-hover:opacity-100'
                            }`} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Status Widget */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/80">
        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-white">Motor Fiscal</span>
              <span className="text-[9px] text-emerald-400 font-semibold">ATIVO</span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              {selectedCompany ? selectedCompany.nome_fantasia || selectedCompany.razao_social : 'Pronto para captura'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:flex lg:flex-col shrink-0 h-screen sticky top-0 z-40">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Slide-out Panel */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-950 shadow-2xl z-10 animate-slide-in">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
