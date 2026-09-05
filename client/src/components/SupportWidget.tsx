import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Company } from '../types';
import { 
  MessageSquare, 
  HelpCircle, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Check, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Headphones, 
  Building2,
  Sparkles,
  LifeBuoy,
  Copy
} from 'lucide-react';

interface SupportWidgetProps {
  companies: Company[];
  selectedCompany: Company | null;
}

export const SupportWidget: React.FC<SupportWidgetProps> = ({ companies, selectedCompany }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'new_ticket' | 'history'>('new_ticket');
  
  // Form State
  const [solicitanteNome, setSolicitanteNome] = useState('');
  const [solicitantePhone, setSolicitantePhone] = useState('');
  const [selectedCompId, setSelectedCompId] = useState<string>(selectedCompany?.id || '');
  const [tipoDemanda, setTipoDemanda] = useState<'erro_sistema' | 'duvida_fiscal' | 'solicitacao_recurso' | 'outro'>('erro_sistema');
  const [mensagemErro, setMensagemErro] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Tickets List State
  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Admin Resolution State
  const [resolvingTicketId, setResolvingTicketId] = useState<string | null>(null);
  const [solucaoTexto, setSolucaoTexto] = useState('');

  useEffect(() => {
    if (selectedCompany && !selectedCompId) {
      setSelectedCompId(selectedCompany.id);
    }
  }, [selectedCompany]);

  const loadTickets = async () => {
    try {
      setLoadingTickets(true);
      const data = await api.getSupportTickets();
      setTickets(data || []);
    } catch (err) {
      console.error('Erro ao carregar tickets:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'history') {
      loadTickets();
    }
  }, [isOpen, activeTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!solicitanteNome.trim() || !solicitantePhone.trim() || !mensagemErro.trim()) {
      setErrorMsg('Por favor, preencha seu nome, WhatsApp e a mensagem.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      const comp = companies.find(c => c.id === selectedCompId);
      
      const res = await api.createSupportTicket({
        solicitante_nome: solicitanteNome,
        solicitante_phone: solicitantePhone,
        company_id: selectedCompId || undefined,
        company_name: comp?.razao_social || comp?.nome_fantasia || 'Geral',
        tipo_demanda: tipoDemanda,
        mensagem_erro: mensagemErro
      });

      setSuccessMsg(res.message || 'Chamado aberto com sucesso!');
      setMensagemErro('');
      setTimeout(() => {
        setSuccessMsg('');
        setActiveTab('history');
      }, 2500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao enviar chamado.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveTicket = async (ticketId: string) => {
    if (!solucaoTexto.trim()) {
      alert('Descreva a solução aplicada para encerrar o ticket.');
      return;
    }

    try {
      await api.resolveSupportTicket(ticketId, solucaoTexto);
      alert('Ticket resolvido e notificação enviada!');
      setResolvingTicketId(null);
      setSolucaoTexto('');
      loadTickets();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  const handleCopyTicket = (t: any) => {
    const text = `📋 REGISTRO DE OCORRÊNCIA & SUPORTE VIANFE\n\n` +
      `👤 Solicitante: ${t.solicitante_nome} (${t.solicitante_phone})\n` +
      `🏢 Empresa: ${t.company_name || 'Geral'}\n` +
      `📅 Data: ${new Date(t.created_at).toLocaleString('pt-BR')}\n\n` +
      `🔍 CAUSA / DESCRIÇÃO DO PROBLEMA:\n${t.mensagem_erro}\n\n` +
      (t.solucao ? `💡 SOLUÇÃO APLICADA:\n${t.solucao}\n\nStatus: ✅ Resolvido em ${t.resolved_at ? new Date(t.resolved_at).toLocaleString('pt-BR') : 'Hoje'}` : `Status: ⏳ Em Análise / Aberto`);

    navigator.clipboard.writeText(text);
    alert('📋 Informações de Causa e Solução copiadas para a Área de Transferência!');
  };

  return (
    <>
      {/* Floating WhatsApp Support Button */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        <button
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) setActiveTab('new_ticket');
          }}
          className="relative group p-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-full shadow-2xl shadow-emerald-500/40 hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center cursor-pointer border-2 border-white/20"
          title="Abrir Suporte Técnico & Demandas WhatsApp"
        >
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border border-white"></span>
          </span>
          <Headphones className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Support & Tickets Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-end sm:justify-center p-2 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>Central de Suporte & Ocorrências</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-mono">ZapCont</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Notificação imediata no WhatsApp para resolução rápida</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation SubTabs */}
            <div className="flex border-b border-slate-800 bg-slate-950/60 p-1">
              <button
                onClick={() => setActiveTab('new_ticket')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
                  activeTab === 'new_ticket'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Novo Chamado / Erro
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-slate-800 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Histórico de Ocorrências ({tickets.length})
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              
              {activeTab === 'new_ticket' && (
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  
                  {errorMsg && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {successMsg && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">Seu Nome / Solicitante *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Carlos (Fiscal)"
                        value={solicitanteNome}
                        onChange={(e) => setSolicitanteNome(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">Seu WhatsApp para Retorno *</label>
                      <input
                        type="text"
                        required
                        placeholder="5575999999999"
                        value={solicitantePhone}
                        onChange={(e) => setSolicitantePhone(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono placeholder-slate-600 focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">Empresa Relacionada</label>
                      <select
                        value={selectedCompId}
                        onChange={(e) => setSelectedCompId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                      >
                        <option value="">Geral / Sistema Todo</option>
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">Tipo de Demanda</label>
                      <select
                        value={tipoDemanda}
                        onChange={(e) => setTipoDemanda(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-medium"
                      >
                        <option value="erro_sistema">⚠️ Erro ou Travamento</option>
                        <option value="duvida_fiscal">❓ Dúvida Fiscal / SEFAZ</option>
                        <option value="solicitacao_recurso">💡 Nova Demanda / Melhoria</option>
                        <option value="outro">💬 Outro Assunto</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Descrição do Erro ou Solicitação *</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Descreva o que aconteceu, qual mensagem apareceu ou o que precisa que seja resolvido..."
                      value={mensagemErro}
                      onChange={(e) => setMensagemErro(e.target.value)}
                      className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-emerald-500"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      <span>{submitting ? 'Enviando ao Suporte...' : 'Enviar Chamado para o WhatsApp'}</span>
                    </button>
                  </div>

                </form>
              )}

              {activeTab === 'history' && (
                <div className="space-y-3">
                  {loadingTickets ? (
                    <p className="text-center text-xs text-slate-400 py-6">Carregando chamados...</p>
                  ) : tickets.length === 0 ? (
                    <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                      <p className="text-xs font-bold text-white">Nenhum chamado aberto no momento!</p>
                      <p className="text-[11px] text-slate-400">Todos os sistemas operando normalmente.</p>
                    </div>
                  ) : (
                    tickets.map((t) => {
                      const isResolved = t.status === 'resolvido';
                      const isResolvingThis = resolvingTicketId === t.id;

                      return (
                        <div 
                          key={t.id}
                          className={`p-3.5 rounded-xl border transition-all space-y-2 ${
                            isResolved 
                              ? 'bg-slate-950/40 border-slate-800/80' 
                              : 'bg-slate-950 border-slate-800 shadow-md'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                  isResolved ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                }`}>
                                  {isResolved ? '✅ Resolvido' : '⏳ Aberto'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {new Date(t.created_at).toLocaleString('pt-BR')}
                                </span>
                              </div>
                              <h4 className="text-xs font-bold text-white mt-1">
                                {t.solicitante_nome} • <span className="text-slate-400 font-normal">{t.company_name}</span>
                              </h4>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-500 font-mono">
                                {t.solicitante_phone}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyTicket(t)}
                                className="p-1 text-slate-400 hover:text-emerald-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                title="Copiar Causa & Solução deste Chamado"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <p className="text-xs text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                            {t.mensagem_erro}
                          </p>

                          {/* Solution Notes if Resolved */}
                          {isResolved && t.solucao && (
                            <div className="p-2 bg-emerald-950/40 border border-emerald-800/40 rounded-lg text-xs text-emerald-300">
                              <strong>💡 Solução Aplicada:</strong> {t.solucao}
                            </div>
                          )}

                          {/* Quick Resolve Button for Admin */}
                          {!isResolved && (
                            <div className="pt-1">
                              {!isResolvingThis ? (
                                <button
                                  onClick={() => setResolvingTicketId(t.id)}
                                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Dar Solução / Fechar Chamado</span>
                                </button>
                              ) : (
                                <div className="space-y-2 pt-1">
                                  <textarea
                                    rows={2}
                                    placeholder="Digite a solução aplicada (o solicitante receberá no WhatsApp)..."
                                    value={solucaoTexto}
                                    onChange={(e) => setSolucaoTexto(e.target.value)}
                                    className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setResolvingTicketId(null)}
                                      className="px-2.5 py-1 bg-slate-800 text-slate-300 text-xs rounded-lg"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleResolveTicket(t.id)}
                                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer"
                                    >
                                      Concluir Ticket
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

            </div>

          </div>
        </div>
      )}
    </>
  );
};
