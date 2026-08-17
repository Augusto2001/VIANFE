import React, { useState, useEffect } from 'react';
import { Company, Invoice } from './types';
import { api } from './services/api';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { CompaniesView } from './components/CompaniesView';
import { DriveSchedulerView } from './components/DriveSchedulerView';
import { XmlImporterView } from './components/XmlImporterView';
import { InvoiceDetailModal } from './components/InvoiceDetailModal';
import confetti from 'canvas-confetti';

export const App: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'companies' | 'drive' | 'import'>('dashboard');
  
  // Modals
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load companies on mount
  const loadCompanies = async () => {
    try {
      const data = await api.getCompanies();
      setCompanies(data);

      const savedCompanyId = localStorage.getItem('df_hub_selected_company');
      if (savedCompanyId) {
        const found = data.find(c => c.id === savedCompanyId);
        if (found) {
          setSelectedCompany(found);
          return;
        }
      }

      if (data.length > 0 && !selectedCompany) {
        setSelectedCompany(data[0]);
      }
    } catch (err) {
      console.error('Error loading companies:', err);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const handleSelectCompany = (comp: Company) => {
    setSelectedCompany(comp);
    localStorage.setItem('df_hub_selected_company', comp.id);
  };

  const handleQuickSync = async () => {
    if (!selectedCompany) return;
    try {
      setIsSyncing(true);
      const res = await api.syncCompanyToDrive(selectedCompany.id);
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
      alert(res.message || 'Sincronização com Google Drive concluída!');
      loadCompanies();
    } catch (err: any) {
      alert(`Erro na sincronização: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncInvoiceFromModal = async (invoiceId: string) => {
    try {
      await api.syncInvoiceToDrive(invoiceId);
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
      alert('Nota Fiscal enviada para o Google Drive!');
      if (selectedInvoice && selectedInvoice.id === invoiceId) {
        setSelectedInvoice({ ...selectedInvoice, gdrive_synced: 1 });
      }
    } catch (err: any) {
      alert(`Erro ao sincronizar nota: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#090f20] text-slate-100 flex flex-col selection:bg-brand-500 selection:text-white">
      
      {/* Top Header & Navigation */}
      <Header
        companies={companies}
        selectedCompany={selectedCompany}
        onSelectCompany={handleSelectCompany}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onQuickSync={handleQuickSync}
        isSyncing={isSyncing}
        onOpenNewCompanyModal={() => setIsCompanyModalOpen(true)}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {activeTab === 'dashboard' && (
          <Dashboard
            selectedCompany={selectedCompany}
            onOpenNewCompanyModal={() => setIsCompanyModalOpen(true)}
            onOpenImporter={() => setActiveTab('import')}
            onSelectInvoice={setSelectedInvoice}
          />
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

      {/* Invoice Details Inspection Modal */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onSyncDrive={handleSyncInvoiceFromModal}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>DF-e Hub Contabilidade • Sistema de Captura Fiscal e Backup em Nuvem</span>
          <span className="font-mono text-[11px]">Segregação Rígida de Clientes • SEFAZ / DFe & Google Drive</span>
        </div>
      </footer>

    </div>
  );
};
