import React, { useState } from 'react';
import { api } from '../services/api';
import { 
  ShieldCheck, Lock, Mail, ArrowRight, Sparkles, FileText, 
  Building2, CheckCircle2, TrendingUp, Cpu, Eye, EyeOff, BarChart3, Database, Layers
} from 'lucide-react';

interface LoginModalProps {
  onLoginSuccess: (user: any, token: string) => void;
  onClose?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess, onClose }) => {
  const [email, setEmail] = useState('augustocesarcontdados@gmail.com');
  const [password, setPassword] = useState('Mud@r123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Por favor, informe e-mail e senha.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.login(email, password);
      localStorage.setItem('vianfe_jwt_token', res.token);
      localStorage.setItem('vianfe_user', JSON.stringify(res.user));
      onLoginSuccess(res.user, res.token);
      if (onClose) onClose();
    } catch (err: any) {
      setError(err.message || 'Falha na autenticação. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#040d0a] flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-y-auto selection:bg-emerald-500 selection:text-white">
      
      {/* Background Animated Atmosphere & Mesh Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-600/5 rounded-full blur-[160px]" />
        
        {/* Subtle Grid overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]" 
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #10b981 1px, transparent 0)', backgroundSize: '32px 32px' }} 
        />
      </div>

      {/* Main Container Card (2-Column Showcase) */}
      <div className="relative w-full max-w-6xl bg-slate-900/90 border border-emerald-950/80 backdrop-blur-2xl rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        
        {/* ========================================================================= */}
        {/* LEFT COLUMN: THE DATA FUNNEL PIPELINE & FISCAL INTELLIGENCE (7 COLUMNS) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 bg-gradient-to-br from-slate-950/90 via-[#061410] to-[#040f0c] p-6 sm:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-emerald-900/30 relative overflow-hidden">
          
          {/* Top Brand Tag */}
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-400 to-teal-200 p-0.5 shadow-lg shadow-emerald-500/30">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-2xl text-white tracking-tight">Via<span className="text-emerald-400">Nfe</span></span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 uppercase tracking-wider">
                    Viacont 2.0
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">Ecossistema de Inteligência Fiscal & BPO Contábil</p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>SEFAZ & DFe 24h</span>
            </div>
          </div>

          {/* Center: THE DATA FUNNEL VISUAL SHOWCASE */}
          <div className="my-8 space-y-6 z-10">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                Tudo entra em dados brutos. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300">
                  Sai fechamento em tempo real no dia 31.
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-lg">
                O motor que transforma XMLs da SEFAZ, extratos OFX/PDF e folha de pagamento em conciliação lado a lado e relatórios gerenciais executivos.
              </p>
            </div>

            {/* THE VISUAL FUNNEL PIPELINE */}
            <div className="space-y-3 bg-slate-950/60 p-4 sm:p-5 rounded-2xl border border-emerald-900/40 relative">
              
              {/* Top Layer: Inputs */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-left hover:border-emerald-500/40 transition-colors">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                    <FileText className="w-3.5 h-3.5" />
                    <span>XMLs SEFAZ</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">NF-e • NFC-e • NFS-e</p>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-left hover:border-emerald-500/40 transition-colors">
                  <div className="flex items-center gap-1.5 text-teal-400 font-bold text-[11px]">
                    <Database className="w-3.5 h-3.5" />
                    <span>Extratos</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">OFX • PDF • Cartões</p>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-left hover:border-emerald-500/40 transition-colors">
                  <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-[11px]">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Folha & DAS</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">DARF • Salários</p>
                </div>
              </div>

              {/* The Central Funnel / AI Processing Node */}
              <div className="relative py-2 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-950 via-emerald-900/80 to-slate-950 border border-emerald-500/40 shadow-lg shadow-emerald-500/20 text-xs font-bold text-emerald-300">
                  <Cpu className="w-4 h-4 text-emerald-400 animate-spin" style={{ animationDuration: '8s' }} />
                  <span>Funil de Conciliação Inteligente & Auditoria Fiscal</span>
                </div>
              </div>

              {/* Bottom Layer: Output Dashboard & Domínio Export */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>Painel do Sucesso & DRE Real</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-semibold">Fechamento Dia 31</span>
                    </div>
                    <p className="text-[11px] text-slate-400">+30 KPIs • Cruzamento Cartões • Exportação Domínio</p>
                  </div>
                </div>

                <div className="text-right hidden sm:block">
                  <span className="text-xs font-black text-emerald-400">100% AUDITADO</span>
                  <p className="text-[10px] text-slate-500">Zero Risco Fiscal</p>
                </div>
              </div>

            </div>
          </div>

          {/* Bottom Badges */}
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-emerald-900/30 text-[11px] text-slate-400 z-10">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Multi-Empresa</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Certificado A1 TLS 1.3</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Conciliação Bancária</span>
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: LOGIN AUTHENTICATION FORM (5 COLUMNS) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 bg-slate-900/95 p-6 sm:p-10 flex flex-col justify-between relative">
          
          <div className="space-y-6 my-auto">
            
            {/* Header */}
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Acesso Restrito</span>
              <h2 className="text-2xl font-black text-white tracking-tight mt-1">
                Entrar na Plataforma
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Informe suas credenciais corporativas para acessar o painel.
              </p>
            </div>

            {error && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-300 font-medium animate-fade-in flex items-start gap-2">
                <span className="text-red-400 font-bold">✕</span>
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* E-mail Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>E-mail Corporativo:</span>
                  <span className="text-[10px] text-slate-500">Admin ou Cliente</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu-email@viacont.com.br"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans transition-all"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Senha de Acesso:</span>
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showPassword ? 'Ocultar' : 'Mostrar'}</span>
                  </button>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans transition-all"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>{loading ? 'Autenticando Cofre Seguro...' : 'Acessar ViaNfe Viacont'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

            </form>

            {/* Corporate Security Seal */}
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-[11px] text-slate-400 leading-snug">
                <span className="font-semibold text-slate-200 block">Acesso Restrito & Monitorado</span>
                Autenticação corporativa com criptografia ponta a ponta.
              </div>
            </div>

          </div>

          {/* Footer Branding */}
          <div className="pt-6 border-t border-slate-800/80 text-center space-y-1">
            <p className="text-[11px] text-slate-400 font-medium">
              Viacont Inovações Contábeis & Inteligência Fiscal
            </p>
            <p className="text-[10px] text-slate-600 font-mono">
              Ambiente Seguro com Proteção JWT e Criptografia A1
            </p>
          </div>

        </div>

      </div>

    </div>
  );
};
