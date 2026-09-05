import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Building2, Plus, Users, ShieldCheck, CheckCircle2, Trash2, Edit2, 
  Layers, Lock, Mail, FileText, Sparkles, X, RefreshCw 
} from 'lucide-react';

interface TenantsManagementModalProps {
  onClose: () => void;
}

export const TenantsManagementModal: React.FC<TenantsManagementModalProps> = ({ onClose }) => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [plan, setPlan] = useState('pro');
  const [submitting, setSubmitting] = useState(false);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const data = await api.getTenants();
      setTenants(data);
    } catch (err: any) {
      console.error('Erro ao listar escritórios:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !adminEmail || !adminPassword) {
      alert('Preencha os campos obrigatórios: Nome do escritório, e-mail e senha.');
      return;
    }

    try {
      setSubmitting(true);
      await api.createTenant({
        name,
        cnpj,
        admin_name: adminName,
        admin_email: adminEmail,
        admin_password: adminPassword,
        plan
      });

      alert('Novo escritório parceiro cadastrado com sucesso!');
      
      // Reset form
      setName('');
      setCnpj('');
      setAdminName('');
      setAdminEmail('');
      setAdminPassword('');
      setIsCreating(false);
      loadTenants();
    } catch (err: any) {
      alert(`Erro ao criar escritório: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTenant = async (id: string, tenantName: string) => {
    if (id === 'tenant_viacont_master') {
      alert('O escritório matriz Viacont não pode ser excluído.');
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir o escritório "${tenantName}"? Todas as empresas e usuários vinculados a ele serão desativados.`)) {
      return;
    }

    try {
      await api.deleteTenant(id);
      alert('Escritório removido com sucesso.');
      loadTenants();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">
                Gestão de Escritórios Contábeis (White-Label SaaS)
              </h3>
              <p className="text-xs text-slate-400">
                Cadastre novos escritórios parceiros com ambiente e cofres de clientes 100% isolados.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{isCreating ? 'Ver Lista' : 'Novo Escritório'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW 1: FORM TO REGISTER NEW ACCOUNTING OFFICE */}
        {/* ========================================================================= */}
        {isCreating ? (
          <form onSubmit={handleCreateTenant} className="space-y-4 bg-slate-950 p-6 rounded-2xl border border-slate-800">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Cadastrar Novo Escritório Contábil Parceiro</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Nome / Razão Social do Escritório:</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Auditar Contabilidade Ltda"
                  required
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">CNPJ do Escritório:</label>
                <input
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Nome do Contador / Admin Master:</label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="Ex: Carlos Silva"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">E-mail de Login do Contador:</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="contador@auditar.com.br"
                  required
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Senha Provisória:</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Plano de Assinatura:</label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="basic">Plano Starter (Até 10 Empresas)</option>
                  <option value="pro">Plano Pro (Até 50 Empresas)</option>
                  <option value="enterprise">Plano Enterprise (Ilimitado)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl transition-all shadow-md"
              >
                {submitting ? 'Criando Escritório...' : 'Criar Escritório Parceiro'}
              </button>
            </div>
          </form>
        ) : (
          /* ========================================================================= */
          /* VIEW 2: LIST OF ALL REGISTERED ACCOUNTING OFFICES */
          /* ========================================================================= */
          <div className="space-y-3">
            {tenants.map((t) => {
              const isMaster = t.id === 'tenant_viacont_master';

              return (
                <div 
                  key={t.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    isMaster 
                      ? 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/40' 
                      : 'bg-slate-950/80 border-slate-800'
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-white">{t.name}</h4>
                      {isMaster && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 uppercase">
                          Matriz Master
                        </span>
                      )}
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono uppercase">
                        Plano {t.plan}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 font-mono">
                      ID: {t.id} {t.cnpj ? `• CNPJ: ${t.cnpj}` : ''}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
                      <div className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span><strong>{t.total_companies || 0}</strong> Empresas</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-teal-400" />
                        <span><strong>{t.total_users || 0}</strong> Usuários</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-cyan-400" />
                        <span><strong>{t.total_invoices || 0}</strong> Notas</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isMaster && (
                      <button
                        onClick={() => handleDeleteTenant(t.id, t.name)}
                        className="p-2 text-slate-500 hover:text-rose-400 rounded-xl hover:bg-slate-900 transition-colors"
                        title="Excluir escritório parceiro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
};
