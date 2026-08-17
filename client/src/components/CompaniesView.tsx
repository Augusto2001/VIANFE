import React, { useState } from 'react';
import { Company } from '../types';
import { api } from '../services/api';
import { 
  Building2, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Shield, 
  Key, 
  HardDrive, 
  CheckCircle, 
  AlertCircle, 
  Upload, 
  Globe, 
  Clock,
  Sparkles,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface CompaniesViewProps {
  companies: Company[];
  selectedCompany: Company | null;
  onSelectCompany: (company: Company) => void;
  onRefresh: () => void;
  isModalOpen: boolean;
  onCloseModal: () => void;
  onOpenModal: () => void;
}

export const CompaniesView: React.FC<CompaniesViewProps> = ({
  companies,
  selectedCompany,
  onSelectCompany,
  onRefresh,
  isModalOpen,
  onCloseModal,
  onOpenModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  // Form State for Create/Edit
  const [formData, setFormData] = useState({
    cnpj: '',
    razao_social: '',
    nome_fantasia: '',
    ie: '',
    uf: 'SP',
    email: '',
    telefone: '',
    sefaz_ambiente: 'producao' as 'producao' | 'homologacao',
    gdrive_folder_name: '',
    sync_frequency: 'daily' as 'manual' | 'hourly' | 'every_6h' | 'daily',
    gdrive_active: true,
  });

  const [cnpjSearching, setCnpjSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Certificate Modal State
  const [certModalCompany, setCertModalCompany] = useState<Company | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState('');
  const [certUploading, setCertUploading] = useState(false);

  const formatCnpj = (cnpj: string) => {
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length === 14) {
      return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    return cnpj;
  };

  const handleLookupCnpj = async () => {
    const clean = formData.cnpj.replace(/\D/g, '');
    if (clean.length !== 14) {
      setErrorMsg('Digite um CNPJ válido com 14 dígitos para consultar.');
      return;
    }

    try {
      setCnpjSearching(true);
      setErrorMsg('');
      const data = await api.lookupCnpj(clean);
      setFormData(prev => ({
        ...prev,
        razao_social: data.razao_social || prev.razao_social,
        nome_fantasia: data.nome_fantasia || prev.nome_fantasia,
        uf: data.uf || prev.uf,
        email: data.email || prev.email,
        telefone: data.telefone || prev.telefone,
        gdrive_folder_name: prev.gdrive_folder_name || `Contabilidade/${data.razao_social?.replace(/[\/\\:*?"<>|]/g, '_')}`
      }));
    } catch (err: any) {
      setErrorMsg(`Erro na consulta de CNPJ: ${err.message}`);
    } finally {
      setCnpjSearching(false);
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.cnpj || !formData.razao_social || !formData.uf) {
      setErrorMsg('CNPJ, Razão Social e UF são campos obrigatórios.');
      return;
    }

    try {
      setSaving(true);
      if (editingCompany) {
        await api.updateCompany(editingCompany.id, formData);
      } else {
        await api.createCompany(formData);
        confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
      }
      onRefresh();
      handleCloseModal();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (comp: Company) => {
    setEditingCompany(comp);
    setFormData({
      cnpj: comp.cnpj,
      razao_social: comp.razao_social,
      nome_fantasia: comp.nome_fantasia || '',
      ie: comp.ie || '',
      uf: comp.uf,
      email: comp.email || '',
      telefone: comp.telefone || '',
      sefaz_ambiente: comp.sefaz_ambiente || 'producao',
      gdrive_folder_name: comp.gdrive_folder_name || '',
      sync_frequency: comp.gdrive_sync_frequency || 'daily',
      gdrive_active: comp.gdrive_active !== 0,
    });
    onOpenModal();
  };

  const handleCloseModal = () => {
    setEditingCompany(null);
    setFormData({
      cnpj: '',
      razao_social: '',
      nome_fantasia: '',
      ie: '',
      uf: 'SP',
      email: '',
      telefone: '',
      sefaz_ambiente: 'producao',
      gdrive_folder_name: '',
      sync_frequency: 'daily',
      gdrive_active: true,
    });
    setErrorMsg('');
    onCloseModal();
  };

  const handleDeleteCompany = async (comp: Company) => {
    if (!window.confirm(`Tem certeza que deseja excluir a empresa ${comp.razao_social}? Todas as notas fiscais e configurações associadas serão apagadas.`)) {
      return;
    }
    try {
      await api.deleteCompany(comp.id);
      onRefresh();
    } catch (err: any) {
      alert(`Erro ao excluir: ${err.message}`);
    }
  };

  const handleUploadCert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certModalCompany || !certFile) return;

    try {
      setCertUploading(true);
      await api.uploadCertificate(certModalCompany.id, certFile, certPassword);
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
      alert('Certificado Digital A1 importado e protegido com sucesso!');
      setCertModalCompany(null);
      setCertFile(null);
      setCertPassword('');
      onRefresh();
    } catch (err: any) {
      alert(`Erro ao enviar certificado: ${err.message}`);
    } finally {
      setCertUploading(false);
    }
  };

  const filtered = companies.filter(c => 
    c.razao_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.cnpj.includes(searchTerm.replace(/\D/g, '')) ||
    (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Empresas Clientes do Escritório
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Cadastre os clientes, vincule as pastas do Google Drive e gerencie certificados digitais A1.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingCompany(null);
            onOpenModal();
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-600 to-sky-500 hover:from-brand-500 hover:to-sky-400 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-500/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Nova Empresa</span>
        </button>
      </div>

      {/* Search Filter Bar */}
      <div className="glass-panel p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar empresa por Razão Social, Nome Fantasia ou CNPJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-brand-500"
          />
        </div>
        <div className="text-xs text-slate-400 font-mono">
          Total: <strong className="text-white">{filtered.length}</strong> empresa(s)
        </div>
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full py-16 text-center glass-panel rounded-2xl border border-slate-800">
            <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-white">Nenhuma empresa cliente cadastrada</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Clique no botão "Cadastrar Nova Empresa" para começar a receber as notas fiscais no sistema.
            </p>
          </div>
        ) : (
          filtered.map((comp) => {
            const isSelected = selectedCompany?.id === comp.id;

            return (
              <div
                key={comp.id}
                className={`glass-panel p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-brand-500 ring-1 ring-brand-500/40 bg-brand-500/5'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  
                  {/* Top line: Status and Badge */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-brand-500/10 text-brand-400 border border-brand-500/20">
                      UF: {comp.uf}
                    </span>
                    
                    <div className="flex items-center gap-1.5">
                      {comp.cert_filename ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium" title="Certificado A1 configurado">
                          <Shield className="w-3.5 h-3.5" />
                          A1 Ativo
                        </span>
                      ) : (
                        <button
                          onClick={() => setCertModalCompany(comp)}
                          className="inline-flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 font-medium bg-amber-500/10 px-2 py-0.5 rounded"
                          title="Fazer upload do Certificado A1"
                        >
                          <Key className="w-3 h-3" />
                          + Certificado A1
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Company Name & CNPJ */}
                  <h3 className="font-bold text-white text-sm line-clamp-1" title={comp.razao_social}>
                    {comp.razao_social}
                  </h3>
                  {comp.nome_fantasia && comp.nome_fantasia !== comp.razao_social && (
                    <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{comp.nome_fantasia}</p>
                  )}
                  <p className="text-xs font-mono text-brand-400 font-medium mt-1">
                    CNPJ: {formatCnpj(comp.cnpj)}
                  </p>

                  {/* Stats Mini Grid */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-xs">
                    <div className="p-2 rounded-xl bg-slate-900/60">
                      <span className="text-[10px] text-slate-400 block">Total Notas</span>
                      <span className="font-mono font-bold text-white">{comp.total_invoices || 0}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900/60">
                      <span className="text-[10px] text-slate-400 block">Drive Synced</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {comp.total_synced_invoices || 0} / {comp.total_invoices || 0}
                      </span>
                    </div>
                  </div>

                  {/* Google Drive target path info */}
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                    <HardDrive className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="truncate">{comp.gdrive_folder_name || 'Pasta Padrão Google Drive'}</span>
                  </div>

                </div>

                {/* Bottom Actions */}
                <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onSelectCompany(comp)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                  >
                    {isSelected ? '✓ Empresa Ativa' : 'Selecionar'}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCertModalCompany(comp)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                      title="Gerenciar Certificado Digital A1"
                    >
                      <Key className="w-4 h-4 text-amber-400" />
                    </button>

                    <button
                      onClick={() => handleOpenEdit(comp)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                      title="Editar Empresa"
                    >
                      <Edit className="w-4 h-4 text-brand-400" />
                    </button>

                    <button
                      onClick={() => handleDeleteCompany(comp)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Excluir Empresa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* Modal: Create / Edit Company */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-base">
                  {editingCompany ? 'Editar Empresa Cliente' : 'Cadastrar Nova Empresa Cliente'}
                </h3>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="p-6 overflow-y-auto space-y-4 text-xs">
              
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* CNPJ with Auto-lookup */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  CNPJ (14 dígitos) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="00.000.000/0000-00"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500 font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleLookupCnpj}
                    disabled={cnpjSearching}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-brand-400 rounded-xl font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${cnpjSearching ? 'animate-spin' : ''}`} />
                    <span>{cnpjSearching ? 'Buscando...' : 'Consultar CNPJ'}</span>
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Clique em "Consultar CNPJ" para preencher Razão Social, UF e dados automaticamente da Receita.
                </span>
              </div>

              {/* Razão Social & Nome Fantasia */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Razão Social *</label>
                  <input
                    type="text"
                    value={formData.razao_social}
                    onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Nome Fantasia</label>
                  <input
                    type="text"
                    value={formData.nome_fantasia}
                    onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* IE & UF */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Inscrição Estadual (IE)</label>
                  <input
                    type="text"
                    placeholder="Isento ou Nº da IE"
                    value={formData.ie}
                    onChange={(e) => setFormData({ ...formData, ie: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">UF (Estado) *</label>
                  <select
                    value={formData.uf}
                    onChange={(e) => setFormData({ ...formData, uf: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500 font-semibold"
                  >
                    {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Google Drive Configuration Section */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-sky-400 font-semibold">
                  <HardDrive className="w-4 h-4" />
                  <span>Configuração de Backup no Google Drive</span>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Nome / Estrutura da Pasta no Google Drive
                  </label>
                  <input
                    type="text"
                    value={formData.gdrive_folder_name}
                    onChange={(e) => setFormData({ ...formData, gdrive_folder_name: e.target.value })}
                    placeholder="Ex: Contabilidade/Nome_Cliente"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    O sistema organizará automaticamente em subpastas: <code>[Pasta]/2026/08/XMLs</code> e <code>PDFs</code>.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Frequência de Sincronização</label>
                    <select
                      value={formData.sync_frequency}
                      onChange={(e) => setFormData({ ...formData, sync_frequency: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500 font-medium"
                    >
                      <option value="daily">Diária (Recomendado)</option>
                      <option value="every_6h">A cada 6 horas</option>
                      <option value="hourly">A cada 1 hora</option>
                      <option value="manual">Apenas Manual</option>
                    </select>
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300 font-medium">
                      <input
                        type="checkbox"
                        checked={formData.gdrive_active}
                        onChange={(e) => setFormData({ ...formData, gdrive_active: e.target.checked })}
                        className="rounded bg-slate-900 border-slate-700 text-brand-500 focus:ring-0 w-4 h-4"
                      />
                      <span>Backup Automático Ativo</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Footer Modal Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-semibold transition-colors shadow-lg shadow-brand-500/20 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : (editingCompany ? 'Atualizar Empresa' : 'Cadastrar Empresa')}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Modal: Upload Digital Certificate A1 */}
      {certModalCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Certificado Digital A1</h3>
                  <p className="text-xs text-slate-400 truncate max-w-[220px]">{certModalCompany.razao_social}</p>
                </div>
              </div>
              <button onClick={() => setCertModalCompany(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleUploadCert} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Arquivo do Certificado (.pfx ou .p12) *
                </label>
                <input
                  type="file"
                  accept=".pfx,.p12"
                  onChange={(e) => setCertFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-300 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:bg-brand-600 file:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Senha do Certificado *
                </label>
                <input
                  type="password"
                  placeholder="Digite a senha do arquivo .pfx"
                  value={certPassword}
                  onChange={(e) => setCertPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  🔒 A senha e o certificado são criptografados com chave AES-256 no servidor.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCertModalCompany(null)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={certUploading || !certFile}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-semibold disabled:opacity-50"
                >
                  {certUploading ? 'Enviando e Criptografando...' : 'Salvar Certificado A1'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
