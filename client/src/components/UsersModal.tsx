import React, { useState, useEffect } from 'react';
import { Company } from '../types';
import { api } from '../services/api';
import { Users, UserPlus, Shield, Check, Trash2, Key, Building2, Briefcase, Lock, CheckCircle2, AlertCircle } from 'lucide-react';

interface UsersModalProps {
  companies: Company[];
  onClose: () => void;
}

export const UsersModal: React.FC<UsersModalProps> = ({ companies, onClose }) => {
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'staff' | 'client'>('staff');
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Change Password Modal state
  const [editingPasswordUser, setEditingPasswordUser] = useState<any | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [passwordModalLoading, setPasswordModalLoading] = useState(false);
  const [passwordModalMessage, setPasswordModalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsersList(data);
    } catch (err: any) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCompany = (companyId: string) => {
    if (selectedCompanyIds.includes(companyId)) {
      setSelectedCompanyIds(selectedCompanyIds.filter(id => id !== companyId));
    } else {
      setSelectedCompanyIds([...selectedCompanyIds, companyId]);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!name || !email || !password) {
      setFormError('Nome, e-mail e senha são obrigatórios.');
      return;
    }

    if (password.trim().length < 4) {
      setFormError('A senha deve ter no mínimo 4 caracteres.');
      return;
    }

    if (role === 'client' && selectedCompanyIds.length === 0) {
      setFormError('Selecione ao menos 1 empresa para conceder acesso ao cliente.');
      return;
    }

    try {
      setLoading(true);
      await api.createUser({
        name,
        email,
        password,
        role,
        companyIds: selectedCompanyIds,
      });

      setFormSuccess(`Usuário "${name}" cadastrado com sucesso!`);
      setName('');
      setEmail('');
      setPassword('');
      setSelectedCompanyIds([]);
      setShowAddForm(false);
      await loadUsers();
    } catch (err: any) {
      setFormError(err.message || 'Falha ao criar usuário.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPasswordUser || !newPasswordInput || newPasswordInput.trim().length < 4) {
      setPasswordModalMessage({ type: 'error', text: 'Informe uma nova senha com no mínimo 4 caracteres.' });
      return;
    }

    try {
      setPasswordModalLoading(true);
      setPasswordModalMessage(null);
      await api.updateUserPassword(editingPasswordUser.id, newPasswordInput.trim());
      setPasswordModalMessage({ type: 'success', text: `Senha de "${editingPasswordUser.name}" alterada com sucesso!` });
      setTimeout(() => {
        setEditingPasswordUser(null);
        setNewPasswordInput('');
        setPasswordModalMessage(null);
      }, 1500);
    } catch (err: any) {
      setPasswordModalMessage({ type: 'error', text: err.message || 'Falha ao atualizar senha.' });
    } finally {
      setPasswordModalLoading(false);
    }
  };

  const handleDeleteUser = async (id: string, userName: string) => {
    if (!confirm(`Confirma a exclusão do usuário "${userName}"?`)) return;
    try {
      await api.deleteUser(id);
      await loadUsers();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-5 animate-scale-up max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center border border-brand-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Gestão de Usuários, Senhas & Permissões</h3>
              <p className="text-xs text-slate-400 font-mono">Master Viacont • Equipe do Escritório • Clientes Finais</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg font-bold p-1">✕</button>
        </div>

        {/* Action Toggle */}
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
            {showAddForm ? 'Novo Usuário do Sistema' : `Usuários Cadastrados (${usersList.length})`}
          </h4>
          <button
            onClick={() => { setShowAddForm(!showAddForm); setFormError(''); setFormSuccess(''); }}
            className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-md shadow-brand-500/20 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{showAddForm ? 'Ver Lista de Usuários' : '+ Novo Login'}</span>
          </button>
        </div>

        {formSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-medium">
            {formSuccess}
          </div>
        )}
        {formError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 font-medium">
            {formError}
          </div>
        )}

        {/* Create User Form */}
        {showAddForm ? (
          <form onSubmit={handleCreateUser} className="space-y-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Nome Completo do Usuário:</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Carlos Santos (Assistente Fiscal)"
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-brand-500 font-sans mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">E-mail de Acesso (Login):</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="carlos@viacont.com.br"
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-brand-500 font-sans mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Senha Inicial:</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-brand-500 font-sans mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Perfil / Nível de Permissão:</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-brand-500 font-sans mt-1 cursor-pointer"
                >
                  <option value="staff">💼 Funcionário do Escritório (Fiscal / Contábil / BPO)</option>
                  <option value="client">🏢 Cliente / Empresário (Acesso Restrito à sua Empresa)</option>
                  <option value="admin">👑 Administrador Master (Acesso Total ao Sistema)</option>
                </select>
              </div>
            </div>

            {/* Explanation badge of selected role */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
              {role === 'admin' && (
                <p className="text-amber-300">👑 <strong>Administrador Master:</strong> Acesso irrestrito a configurações, escritórios SaaS, certificados e gestão de todos os usuários.</p>
              )}
              {role === 'staff' && (
                <p className="text-emerald-300">💼 <strong>Funcionário do Escritório:</strong> Acessa todas as empresas do escritório para consultas SEFAZ, conciliação BPO, auditoria tributária e DRE (Sem permissão para deletar escritórios).</p>
              )}
              {role === 'client' && (
                <p className="text-cyan-300">🏢 <strong>Cliente / Empresário:</strong> Acessa apenas as notas e relatórios das empresas marcadas abaixo.</p>
              )}
            </div>

            {/* Select Companies for Client Role */}
            {role === 'client' && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-xs font-semibold text-slate-300">Selecione as empresas liberadas para este cliente:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                  {companies.map((comp) => {
                    const isChecked = selectedCompanyIds.includes(comp.id);
                    return (
                      <div
                        key={comp.id}
                        onClick={() => handleToggleCompany(comp.id)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                          isChecked ? 'bg-brand-500/10 border-brand-500/40 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span className="truncate pr-2 font-medium">{comp.razao_social}</span>
                        <div className={`w-4 h-4 rounded flex items-center justify-center ${isChecked ? 'bg-brand-500 text-white' : 'border border-slate-700'}`}>
                          {isChecked && <Check className="w-3 h-3" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-brand-500/20 cursor-pointer"
              >
                Salvar Novo Usuário
              </button>
            </div>

          </form>
        ) : (
          /* Users Table */
          <div className="space-y-2">
            {usersList.map((u) => (
              <div key={u.id} className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between gap-3 font-mono">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                    u.role === 'admin' 
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                      : u.role === 'staff'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                  }`}>
                    {u.role === 'admin' ? <Shield className="w-4 h-4" /> : u.role === 'staff' ? <Briefcase className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-xs text-white truncate">{u.name}</strong>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        u.role === 'admin' 
                          ? 'bg-amber-500/20 text-amber-300' 
                          : u.role === 'staff'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-cyan-500/20 text-cyan-300'
                      }`}>
                        {u.role === 'admin' ? '👑 Master' : u.role === 'staff' ? '💼 Funcionário' : '🏢 Cliente'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans mt-0.5 truncate">{u.email}</p>
                    <p className="text-[10px] text-slate-500 font-sans mt-0.5 truncate">
                      {u.companyNames?.join(', ') || 'Todas as Empresas'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Master Change Password Button */}
                  <button
                    onClick={() => {
                      setEditingPasswordUser(u);
                      setNewPasswordInput('');
                      setPasswordModalMessage(null);
                    }}
                    className="p-2 text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                    title={`Alterar senha de "${u.name}"`}
                  >
                    <Key className="w-4 h-4" />
                  </button>

                  {u.id !== 'usr_admin_viacont_master' && (
                    <button
                      onClick={() => handleDeleteUser(u.id, u.name)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Excluir usuário"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* SUBMODAL: MASTER DIRECT PASSWORD CHANGER */}
      {/* ========================================================================= */}
      {editingPasswordUser && (
        <div className="fixed inset-0 z-60 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 animate-scale-up">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Alterar Senha de Usuário</h4>
                  <p className="text-[10px] text-slate-400">Controle Master Viacont</p>
                </div>
              </div>
              <button
                onClick={() => setEditingPasswordUser(null)}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
              <p className="text-xs text-slate-200 font-bold">{editingPasswordUser.name}</p>
              <p className="text-[11px] text-slate-400 font-mono">{editingPasswordUser.email}</p>
            </div>

            <form onSubmit={handleUpdateUserPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Nova Senha para este Usuário:</label>
                <input
                  type="text"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Digite a nova senha (mínimo 4 caracteres)"
                  required
                  autoFocus
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono placeholder-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
                <p className="text-[10px] text-slate-500">A nova senha entra em vigor imediatamente após salvar.</p>
              </div>

              {passwordModalMessage && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  passwordModalMessage.type === 'success' 
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
                    : 'bg-red-500/10 border border-red-500/30 text-red-300'
                }`}>
                  {passwordModalMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{passwordModalMessage.text}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingPasswordUser(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={passwordModalLoading}
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  {passwordModalLoading ? 'Salvando...' : 'Salvar Nova Senha'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
