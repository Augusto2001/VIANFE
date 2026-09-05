import React, { useState, useEffect } from 'react';
import { Company, Invoice } from './types';
import { api } from './services/api';
import { Header } from './components/Header';
import { Sidebar, NavTab } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { CompaniesView } from './components/CompaniesView';
import { DriveSchedulerView } from './components/DriveSchedulerView';
import { XmlImporterView } from './components/XmlImporterView';
import { InvoiceDetailModal } from './components/InvoiceDetailModal';
import { UsersModal } from './components/UsersModal';
import { TenantsManagementModal } from './components/TenantsManagementModal';
import { LoginModal } from './components/LoginModal';
import { ViaAnalyticsView } from './components/ViaAnalyticsView';
import { NfseView } from './components/NfseView';
import { BankReconciliationView } from './components/BankReconciliationView';
import { BusinessSuccessDashboard } from './components/BusinessSuccessDashboard';
import { ClientPortalView } from './components/ClientPortalView';
import { TaxAuditView } from './components/TaxAuditView';
import { SupportWidget } from './components/SupportWidget';

export const App: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Modals
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [isTenantsModalOpen, setIsTenantsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [authChecking, setAuthChecking] = useState<boolean>(() => {
    return !!localStorage.getItem('vianfe_jwt_token');
  });

  const [currentUser, setCurrentUser] = useState<any>(() => {
    const saved = localStorage.getItem('vianfe_user');
    const token = localStorage.getItem('vianfe_jwt_token');
    return saved && token ? JSON.parse(saved) : null;
  });

  // Load companies
  const loadCompanies = async () => {
    try {
      const data = await api.getCompanies();
      setCompanies(data || []);

      const savedCompanyId = localStorage.getItem('df_hub_selected_company');
      if (savedCompanyId && data) {
        const found = data.find(c => c.id === savedCompanyId);
        if (found) {
          setSelectedCompany(found);
          return;
        }
      }

      if (data && data.length > 0) {
        const best = data.find(c => (c.total_invoices || 0) > 0) || data[0];
        setSelectedCompany(best);
      }
    } catch (err: any) {
      console.error('Error loading companies:', err);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('vianfe_jwt_token');
    if (!token) {
      setAuthChecking(false);
      return;
    }

    api.getMe(token)
      .then((res) => {
        if (res.success && res.user) {
          setCurrentUser(res.user);
          localStorage.setItem('vianfe_user', JSON.stringify(res.user));
          loadCompanies();
        } else {
          handleLogout();
        }
      })
      .catch((err) => {
        console.error('Sessão expirada:', err);
        handleLogout();
      })
      .finally(() => {
        setAuthChecking(false);
      });
  }, []);

  const handleSelectCompany = (comp: Company) => {
    setSelectedCompany(comp);
    localStorage.setItem('df_hub_selected_company', comp.id);
  };

  const handleQuickSync = async () => {
    if (!selectedCompany) return;
    try {
      setIsSyncing(true);
      const res = await api.syncSefaz(selectedCompany.id);
      if (res.success) {
        alert(`Sincronização concluída com sucesso!\n${res.message || ''}`);
        loadCompanies();
      }
    } catch (err: any) {
      console.error('Erro na sincronização rápida:', err);
      alert(`Falha na sincronização: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncInvoiceFromModal = async (invoiceId: string) => {
    try {
      await api.syncInvoiceToDrive(invoiceId);
      alert('Nota sincronizada com sucesso no Google Drive!');
      loadCompanies();
    } catch (err: any) {
      alert(`Erro ao sincronizar: ${err.message}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('vianfe_jwt_token');
    localStorage.removeItem('vianfe_user');
    setCurrentUser(null);
    setCompanies([]);
    setSelectedCompany(null);
  };

  // 1. Loading state while checking token
  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#040d0a] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono">Iniciando ambiente seguro ViaNfe Viacont...</p>
        </div>
      </div>
    );
  }

  // 2. Strict Login Gate: If not authenticated, render ONLY the Showcase Login Screen
  if (!currentUser) {
    return (
      <LoginModal
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          loadCompanies();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#06110d] text-slate-100 flex selection:bg-brand-500 selection:text-white antialiased">
      
      {/* 1. Left Fixed Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        companiesCount={companies.length}
        selectedCompany={selectedCompany}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* 2. Main Right Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        
        {/* Top Header */}
        <Header
          companies={companies}
          selectedCompany={selectedCompany}
          onSelectCompany={handleSelectCompany}
          activeTab={activeTab}
          onQuickSync={handleQuickSync}
          isSyncing={isSyncing}
          onOpenNewCompanyModal={() => setIsCompanyModalOpen(true)}
          onOpenUsersModal={() => setIsUsersModalOpen(true)}
          onOpenTenantsModal={() => setIsTenantsModalOpen(true)}
          onLogout={handleLogout}
          currentUser={currentUser}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />

        {/* Dynamic View Panel */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          
          {activeTab === 'dashboard' && (
            <Dashboard
              selectedCompany={selectedCompany}
              onOpenNewCompanyModal={() => setIsCompanyModalOpen(true)}
              onOpenImporter={() => setActiveTab('import')}
              onSelectInvoice={setSelectedInvoice}
            />
          )}

          {activeTab === 'bpo' && selectedCompany && (
            <BankReconciliationView company={selectedCompany} />
          )}

          {activeTab === 'business_success' && selectedCompany && (
            <BusinessSuccessDashboard company={selectedCompany} />
          )}

          {activeTab === 'tax_audit' && selectedCompany && (
            <TaxAuditView company={selectedCompany} />
          )}

          {activeTab === 'client_portal' && selectedCompany && (
            <ClientPortalView 
              company={selectedCompany} 
              companies={companies}
              onSelectCompany={handleSelectCompany}
            />
          )}

          {activeTab === 'analytics' && (
            <ViaAnalyticsView selectedCompany={selectedCompany} />
          )}

          {activeTab === 'nfse' && (
            <NfseView selectedCompany={selectedCompany} />
          )}

          {activeTab === 'companies' && (
            <CompaniesView
              companies={companies}
              selectedCompany={selectedCompany}
              onSelectCompany={handleSelectCompany}
              onRefresh={loadCompanies}
              isModalOpen={isCompanyModalOpen}
              onCloseModal={() => setIsCompanyModalOpen(false)}
              onOpenModal={() => setIsCompanyModalOpen(true)}
            />
          )}

          {activeTab === 'drive' && (
            <DriveSchedulerView
              companies={companies}
              selectedCompany={selectedCompany}
              onRefresh={loadCompanies}
            />
          )}

          {activeTab === 'import' && (
            <XmlImporterView
              companies={companies}
              selectedCompany={selectedCompany}
              onSelectCompany={handleSelectCompany}
              onImportSuccess={() => {
                loadCompanies();
                setActiveTab('dashboard');
              }}
            />
          )}

        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-400 mt-auto bg-slate-950/40">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>ViaNfe Viacont • Inteligência Fiscal & BPO Financeiro</span>
            <span className="font-mono text-[11px] text-slate-400">Ambiente Seguro Oracle Cloud • SEFAZ / NFS-e & Google Drive</span>
          </div>
        </footer>

      </div>

      {/* Invoice Details Inspection Modal */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onSyncDrive={handleSyncInvoiceFromModal}
        />
      )}

      {/* Users Management Modal */}
      {isUsersModalOpen && (
        <UsersModal
          companies={companies}
          onClose={() => setIsUsersModalOpen(false)}
        />
      )}

      {/* Multi-Office SaaS Tenants Management Modal */}
      {isTenantsModalOpen && (
        <TenantsManagementModal
          onClose={() => setIsTenantsModalOpen(false)}
        />
      )}

      {/* Floating WhatsApp Support & Ticket Resolution Widget */}
      <SupportWidget
        companies={companies}
        selectedCompany={selectedCompany}
      />

    </div>
  );
};
