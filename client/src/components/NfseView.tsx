import React, { useState, useEffect } from 'react';
import { Company } from '../types';
import { api } from '../services/api';
import { 
  Building, 
  FileText, 
  Send, 
  MessageSquare, 
  CheckCircle2, 
  Plus, 
  ShieldCheck, 
  Sparkles, 
  Smartphone, 
  Download, 
  RefreshCw,
  Search,
  ExternalLink,
  Users,
  UserPlus,
  Trash2,
  Edit2,
  DollarSign,
  FileSpreadsheet,
  MapPin,
  Loader2,
  Share2,
  Bot,
  Zap,
  Cloud
} from 'lucide-react';

interface NfseViewProps {
  selectedCompany: Company | null;
}

const PREFEITURAS = [
  'Salvador (Robô Automatizado)',
  'Salvador (Webservice Direto)',
  'Salvador (Focus NFe)',
  'Feira de Santana',
  'Lauro de Freitas',
  'São Gonçalo dos Campos',
  'Curitiba',
  'Portal Nacional ADN (nfse.gov.br)'
];

export const NfseView: React.FC<NfseViewProps> = ({ selectedCompany }) => {
  const [activeSubTab, setActiveSubTab] = useState<'emitted' | 'recurring'>('emitted');
  const [nfseList, setNfseList] = useState<any[]>([]);
  const [recurringClients, setRecurringClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);

  // Focus NFe & Mode State
  const [emissionMode, setEmissionMode] = useState<'robo_salvador' | 'webservice_direto' | 'focus_nfe'>('robo_salvador');
  const [focusToken, setFocusToken] = useState('');
  const [focusAmbiente, setFocusAmbiente] = useState<'producao' | 'homologacao'>('producao');
  const [nfseProvedor, setNfseProvedor] = useState('robo_salvador');
  const [savingFocusConfig, setSavingFocusConfig] = useState(false);
  const [showFocusConfig, setShowFocusConfig] = useState(false);

  // Form State for NFS-e Emission
  const [prefeitura, setPrefeitura] = useState('Salvador (Robô Automatizado)');
  const [numeroRps, setNumeroRps] = useState('1');
  const [serieRps, setSerieRps] = useState('1');
  const [tomadorCnpj, setTomadorCnpj] = useState('');
  const [tomadorNome, setTomadorNome] = useState('');
  const [tomadorEndereco, setTomadorEndereco] = useState('');
  const [valorServicos, setValorServicos] = useState('');
  const [aliquotaIss, setAliquotaIss] = useState('5.0');
  const [issRetido, setIssRetido] = useState(false);
  const [discriminacaoServico, setDiscriminacaoServico] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [cnpjSearchingEmission, setCnpjSearchingEmission] = useState(false);

  // Form State for Tomador Management
  const [clientDoc, setClientDoc] = useState('');
  const [clientNome, setClientNome] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientCep, setClientCep] = useState('');
  const [clientLogradouro, setClientLogradouro] = useState('');
  const [clientNumero, setClientNumero] = useState('');
  const [clientComplemento, setClientComplemento] = useState('');
  const [clientBairro, setClientBairro] = useState('');
  const [clientMunicipio, setClientMunicipio] = useState('');
  const [clientUf, setClientUf] = useState('BA');
  const [clientIssRetido, setClientIssRetido] = useState(false);
  const [clientAliquota, setClientAliquota] = useState('5.0');
  const [clientItemServico, setClientItemServico] = useState('17.01');
  const [clientDescricao, setClientDescricao] = useState('');
  const [clientValor, setClientValor] = useState('');
  const [clientSaving, setClientSaving] = useState(false);
  const [cnpjSearchingTomador, setCnpjSearchingTomador] = useState(false);

  // 2Captcha Configuration State
  const [captchaKey, setCaptchaKey] = useState('');
  const [savingCaptchaKey, setSavingCaptchaKey] = useState(false);
  const [showCaptchaConfig, setShowCaptchaConfig] = useState(false);

  useEffect(() => {
    if (selectedCompany) {
      loadData();
    }
  }, [selectedCompany]);

  const loadData = async () => {
    if (!selectedCompany) return;
    try {
      setLoading(true);
      const [list, clients, key, focusCfg] = await Promise.all([
        api.getNfseList(selectedCompany.id),
        api.getNfseClients(selectedCompany.id).catch(() => []),
        api.getCaptchaKey().catch(() => ''),
        api.getFocusNfeConfig(selectedCompany.id).catch(() => ({ focus_nfe_token: '', nfse_provedor: 'focus_nfe' }))
      ]);
      setNfseList(list || []);
      setRecurringClients(clients || []);
      setCaptchaKey(key || '');
      setFocusToken(focusCfg?.focus_nfe_token || '');
      setNfseProvedor(focusCfg?.nfse_provedor || 'focus_nfe');
      setNumeroRps(String((selectedCompany.ultimo_rps_numero || 358) + 1));
    } catch (err) {
      console.error('Error loading NFS-e data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFocusConfig = async () => {
    if (!selectedCompany) return;
    try {
      setSavingFocusConfig(true);
      await api.saveFocusNfeConfig(selectedCompany.id, focusToken, nfseProvedor, focusAmbiente);
      alert('Configurações da Focus NFe salvas com sucesso!');
      setShowFocusConfig(false);
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSavingFocusConfig(false);
    }
  };

  const handleSaveCaptchaKey = async () => {
    try {
      setSavingCaptchaKey(true);
      await api.saveCaptchaKey(captchaKey);
      alert('Chave API 2Captcha salva com sucesso! O robô utilizará para resolver o portal de Salvador.');
      setShowCaptchaConfig(false);
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSavingCaptchaKey(false);
    }
  };

  // Fast CNPJ Lookup for Tomador Modal
  const handleLookupTomadorCnpj = async () => {
    const clean = clientDoc.replace(/\D/g, '');
    if (clean.length !== 14) {
      alert('Digite um CNPJ válido com 14 dígitos para consultar na Receita Federal.');
      return;
    }

    try {
      setCnpjSearchingTomador(true);
      const data = await api.lookupCnpj(clean);
      if (data) {
        setClientNome(data.razao_social || data.nome_fantasia || clientNome);
        setClientEmail(data.email || clientEmail);
        setClientPhone(data.telefone || clientPhone);
        setClientLogradouro(data.logradouro || '');
        setClientNumero(data.numero || '');
        setClientComplemento(data.complemento || '');
        setClientBairro(data.bairro || '');
        setClientMunicipio(data.municipio || '');
        setClientUf(data.uf || 'BA');
        setClientCep(data.cep || '');
      }
    } catch (err: any) {
      alert(`Consulta de CNPJ: ${err.message}`);
    } finally {
      setCnpjSearchingTomador(false);
    }
  };

  // Fast CNPJ Lookup for Emission Modal
  const handleLookupEmissionCnpj = async () => {
    const clean = tomadorCnpj.replace(/\D/g, '');
    if (clean.length !== 14) {
      alert('Digite um CNPJ válido com 14 dígitos para consultar na Receita Federal.');
      return;
    }

    try {
      setCnpjSearchingEmission(true);
      const data = await api.lookupCnpj(clean);
      if (data) {
        setTomadorNome(data.razao_social || data.nome_fantasia || '');
        setTomadorEndereco(`${data.logradouro || ''}, ${data.numero || 'S/N'} - ${data.bairro || ''}, ${data.municipio || ''}/${data.uf || ''}`);
        if (data.telefone) setWhatsappPhone(data.telefone);
      }
    } catch (err: any) {
      alert(`Consulta de CNPJ: ${err.message}`);
    } finally {
      setCnpjSearchingEmission(false);
    }
  };

  const handleSelectRecurringClient = (client: any) => {
    setTomadorCnpj(client.cnpj_cpf);
    setTomadorNome(client.razao_social);
    const end = [client.logradouro, client.numero, client.bairro, client.municipio, client.uf].filter(Boolean).join(', ');
    setTomadorEndereco(end || '');
    setValorServicos(client.valor_padrao ? client.valor_padrao.toString() : '');
    setAliquotaIss(client.aliquota_iss ? client.aliquota_iss.toString() : '5.0');
    setIssRetido(client.iss_retido === 1);
    setDiscriminacaoServico(client.discriminacao_padrao || '');
    setWhatsappPhone(client.telefone_whatsapp || '');
  };

  const handleEmitNfse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;
    setError('');

    if (!tomadorCnpj || !tomadorNome || !valorServicos || !discriminacaoServico) {
      setError('Por favor, preencha todos os campos obrigatórios da NFS-e.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const res = await api.emitNfse({
        company_id: selectedCompany.id,
        prefeitura,
        tomador_cnpj: tomadorCnpj,
        tomador_nome: tomadorNome,
        valor_servicos: Number(valorServicos),
        aliquota_iss: Number(aliquotaIss),
        iss_retido: issRetido,
        discriminacao_servico: discriminacaoServico,
        whatsapp_phone: whatsappPhone || undefined,
        numero_rps: numeroRps,
        serie_rps: serieRps,
        provedor: emissionMode,
        focus_nfe_token: focusToken || undefined,
        ambiente: focusAmbiente
      });

      alert(`✅ ${res.message}\nNúmero: ${res.data.numeroNfse} | Verificação: ${res.data.codigoVerificacao}`);
      setShowModal(false);
      setTomadorCnpj('');
      setTomadorNome('');
      setTomadorEndereco('');
      setValorServicos('');
      setDiscriminacaoServico('');
      setWhatsappPhone('');
      await loadData();
    } catch (err: any) {
      const msg = err.message || 'Falha ao emitir NFS-e na prefeitura.';
      setError(msg);
      alert(`❌ Erro na Emissão:\n${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;
    if (!clientDoc || !clientNome) {
      alert('CNPJ/CPF e Razão Social são obrigatórios.');
      return;
    }

    try {
      setClientSaving(true);
      await api.saveNfseClient({
        company_id: selectedCompany.id,
        cnpj_cpf: clientDoc,
        razao_social: clientNome,
        email: clientEmail || undefined,
        telefone_whatsapp: clientPhone || undefined,
        cep: clientCep || undefined,
        logradouro: clientLogradouro || undefined,
        numero: clientNumero || undefined,
        complemento: clientComplemento || undefined,
        bairro: clientBairro || undefined,
        municipio: clientMunicipio || undefined,
        uf: clientUf || undefined,
        iss_retido: clientIssRetido ? 1 : 0,
        aliquota_iss: Number(clientAliquota || 5.0),
        item_servico: clientItemServico || undefined,
        discriminacao_padrao: clientDescricao || undefined,
        valor_padrao: Number(clientValor || 0)
      });

      alert('Tomador salvo com sucesso!');
      setShowClientModal(false);
      setClientDoc('');
      setClientNome('');
      setClientEmail('');
      setClientPhone('');
      setClientCep('');
      setClientLogradouro('');
      setClientNumero('');
      setClientComplemento('');
      setClientBairro('');
      setClientMunicipio('');
      setClientDescricao('');
      setClientValor('');
      await loadData();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setClientSaving(false);
    }
  };

  const handleDeleteClient = async (id: string, name: string) => {
    if (!window.confirm(`Deseja excluir o tomador "${name}"?`)) return;
    try {
      await api.deleteNfseClient(id);
      await loadData();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  const handleDeleteNfse = async (id: string, numeroNfse: string) => {
    if (!window.confirm(`Deseja realmente apagar o registro da NFS-e / RPS "${numeroNfse}"?`)) return;
    try {
      await api.deleteNfse(id);
      await loadData();
    } catch (err: any) {
      alert(`Erro ao excluir nota: ${err.message}`);
    }
  };

  if (!selectedCompany) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl">
        <Building className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-bold text-white">Nenhuma Empresa Selecionada</h3>
        <p className="text-xs text-slate-400 mt-1">Selecione uma empresa no topo para gerenciar e emitir Notas Fiscais de Serviço (NFS-e).</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/20 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                Emissor Municipal & Nacional ADN
              </span>
              <span className="text-xs text-slate-400 font-mono">ZapCont WhatsApp Agent</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
              <span>{selectedCompany.nome_fantasia || selectedCompany.razao_social}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Emissão de NFS-e para Salvador, Feira de Santana, Lauro de Freitas, São Gonçalo, Curitiba e Portal Nacional ADN.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowClientModal(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <UserPlus className="w-4 h-4 text-cyan-400" />
              <span>Cadastrar Tomador</span>
            </button>

            {/* Direct Fiscal Actions */}
            <button
              onClick={() => setShowModal(true)}
              className="min-h-[44px] px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Emitir Nova NFS-e</span>
            </button>

            {/* Focus NFe Integration Button */}
            <button
              onClick={() => setShowFocusConfig(!showFocusConfig)}
              className={`min-h-[44px] px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border ${
                focusToken
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 hover:bg-blue-600/30 shadow-md'
                  : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/20'
              }`}
              title="Configurar Integração Oficial Focus NFe (Salvador & Nacional)"
            >
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>{focusToken ? '🟢 Focus NFe Ativo' : 'Configurar Focus NFe'}</span>
            </button>

            {/* Optional Fallback Automation */}
            <button
              onClick={() => setShowCaptchaConfig(!showCaptchaConfig)}
              className={`min-h-[44px] px-3 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border ${
                captchaKey
                  ? 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-600'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800'
              }`}
              title="Configuração Opcional de Integração de Terceiros (2Captcha API)"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">2Captcha</span>
            </button>

            <button
              onClick={loadData}
              disabled={loading}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition-colors cursor-pointer"
              title="Atualizar lista de notas fiscais"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Collapsible Focus NFe Settings Banner */}
        {showFocusConfig && (
          <div className="mt-4 p-4 bg-slate-950/90 rounded-2xl border border-blue-500/40 space-y-3 animate-fade-in shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>Integração Oficial Focus NFe (Salvador / Homologado)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono">REST API v2</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Informe o seu <strong>Token de Acesso da Focus NFe</strong>. As notas fiscais de serviço para a Prefeitura de Salvador serão transmitidas diretamente pela infraestrutura da Focus NFe com emissão instantânea, autorização em tempo real e retorno imediato do PDF do DANFSe e XML:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="password"
                placeholder="Token Focus NFe (ex: wH2xYz910...)"
                value={focusToken}
                onChange={(e) => setFocusToken(e.target.value)}
                className="sm:col-span-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
              />
              <select
                value={focusAmbiente}
                onChange={(e) => setFocusAmbiente(e.target.value as any)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              >
                <option value="producao">Ambiente: Produção (Oficial)</option>
                <option value="homologacao">Ambiente: Homologação (Testes)</option>
              </select>
              <button
                onClick={handleSaveFocusConfig}
                disabled={savingFocusConfig}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {savingFocusConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Salvar Configurações</span>
              </button>
            </div>
          </div>
        )}

        {/* Collapsible 2Captcha Settings Banner */}
        {showCaptchaConfig && (
          <div className="mt-4 p-4 bg-slate-950/80 rounded-2xl border border-indigo-500/30 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Integração 2Captcha (Resolução Automática do Portal Nota Salvador)</span>
              </div>
              <span className="text-[10px] text-slate-400">Custo: ~R$ 0,005 por nota</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Cole sua Chave da API do <strong>2Captcha</strong> abaixo. Quando você clicar em Emitir, o robô quebrará o captcha ondulado da prefeitura de Salvador em 2 a 3 segundos com 99.8% de precisão:
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Cole sua chave API (ex: 2c19a84b0...)"
                value={captchaKey}
                onChange={(e) => setCaptchaKey(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
              />
              <button
                onClick={handleSaveCaptchaKey}
                disabled={savingCaptchaKey}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {savingCaptchaKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Salvar Chave</span>
              </button>
            </div>
          </div>
        )}

        {/* Subtabs: Emitted vs Tomadores */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800/80">
          <button
            onClick={() => setActiveSubTab('emitted')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'emitted'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Notas Emitidas ({nfseList.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('recurring')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'recurring'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-cyan-300" />
            <span>Tomadores Cadastrados ({recurringClients.length})</span>
          </button>
        </div>
      </div>

      {/* SubTab 1: Emitted List */}
      {activeSubTab === 'emitted' && (
        <div className="space-y-3">
          {nfseList.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-2xl space-y-3">
              <CheckCircle2 className="w-10 h-10 text-indigo-400 mx-auto" />
              <h3 className="text-sm font-bold text-white">Nenhuma NFS-e emitida para esta empresa ainda</h3>
              <p className="text-xs text-slate-400">
                Clique no botão <strong>"Emitir Nova NFS-e"</strong> ou envie uma mensagem no ZapCont para emitir via WhatsApp.
              </p>
            </div>
          ) : (
            nfseList.map((nfse) => (
              <div 
                key={nfse.id} 
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md hover:border-slate-700 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white">NFS-e Nº {nfse.numero_nfse}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded font-semibold border border-indigo-500/30">
                        {nfse.prefeitura}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Cód: {nfse.codigo_verificacao}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 truncate">
                      Tomador: <strong>{nfse.tomador_nome}</strong> (Doc: {nfse.tomador_cnpj})
                    </p>
                    <p className="text-[11px] text-slate-400 line-clamp-1">
                      Serviço: {nfse.discriminacao_servico}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 w-full md:w-auto justify-between md:justify-end">
                  <div className="text-right">
                    <div className="text-sm font-black text-indigo-400">
                      R$ {Number(nfse.valor_servicos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      ISS ({nfse.aliquota_iss}%): R$ {Number(nfse.valor_iss).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`https://vianfe.contadordev.com.br/api/portal/nfse/${nfse.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 border border-slate-700 shadow-sm"
                      title="Visualizar e Baixar DANFSe Oficial em PDF"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-400" />
                      <span>PDF</span>
                    </a>

                    <a
                      href={`https://vianfe.contadordev.com.br/api/portal/nfse/${nfse.id}/xml`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 border border-slate-700 shadow-sm"
                      title="Baixar Arquivo XML Oficial da NFS-e"
                    >
                      <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                      <span>XML</span>
                    </a>

                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Olá! Segue o link do seu Documento Fiscal (RPS/NFS-e Nº ${nfse.numero_nfse}) emitido por Viacont: https://vianfe.contadordev.com.br/api/portal/nfse/${nfse.id}/pdf`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 border border-emerald-500/30 shadow-sm"
                      title="Enviar PDF no WhatsApp do Cliente"
                    >
                      <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>WhatsApp</span>
                    </a>

                    <button
                      onClick={() => handleDeleteNfse(nfse.id, nfse.numero_nfse)}
                      className="p-1.5 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                      title="Excluir Registro de Teste"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* SubTab 2: Tomadores List */}
      {activeSubTab === 'recurring' && (
        <div className="space-y-3">
          {recurringClients.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-2xl space-y-3">
              <Users className="w-10 h-10 text-cyan-400 mx-auto" />
              <h3 className="text-sm font-bold text-white">Nenhum tomador cadastrado</h3>
              <p className="text-xs text-slate-400">
                Cadastre os tomadores com endereço completo e regras de ISS para emissão automática pelo WhatsApp ou tela!
              </p>
            </div>
          ) : (
            recurringClients.map((c) => {
              const fullAddress = [c.logradouro, c.numero, c.bairro, c.municipio, c.uf].filter(Boolean).join(', ');
              return (
                <div 
                  key={c.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md hover:border-slate-700 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">{c.razao_social}</span>
                        <span className="text-[10px] text-slate-400 font-mono">Doc: {c.cnpj_cpf}</span>
                        {c.iss_retido === 1 && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded font-bold border border-amber-500/30">
                            ISS RETIDO NA FONTE
                          </span>
                        )}
                      </div>
                      {fullAddress && (
                        <p className="text-[11px] text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{fullAddress}</span>
                        </p>
                      )}
                      <p className="text-xs text-slate-400 truncate">
                        Alíquota ISS: <strong>{c.aliquota_iss}%</strong> • Valor Padrão: <strong>R$ {Number(c.valor_padrao || 0).toFixed(2)}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        handleSelectRecurringClient(c);
                        setShowModal(true);
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Emitir Nota</span>
                    </button>

                    <button
                      onClick={() => handleDeleteClient(c.id, c.razao_social)}
                      className="p-1.5 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                      title="Excluir Tomador"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EMIT NEW NFS-E */}
      {/* ========================================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Emitir NFS-e Municipal</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white font-bold">✕</button>
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300">
                {error}
              </div>
            )}

            <form onSubmit={handleEmitNfse} className="space-y-4">
              
              {/* Autofill Select from Registered Tomadores */}
              {recurringClients.length > 0 && (
                <div className="space-y-1.5 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <label className="text-[11px] font-bold text-cyan-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Selecionar Tomador Cadastrado:</span>
                  </label>
                  <select
                    onChange={(e) => {
                      const found = recurringClients.find(c => c.id === e.target.value);
                      if (found) handleSelectRecurringClient(found);
                    }}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                  >
                    <option value="">-- Selecione para preenchimento rápido --</option>
                    {recurringClients.map(c => (
                      <option key={c.id} value={c.id}>{c.razao_social} ({c.cnpj_cpf})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Seletor de Modo de Emissão */}
              <div className="space-y-2 p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Escolha o Modo de Emissão:</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEmissionMode('robo_salvador');
                      setPrefeitura('Salvador (Robô Automatizado)');
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      emissionMode === 'robo_salvador'
                        ? 'bg-amber-500/15 border-amber-500 text-white shadow-md shadow-amber-500/10'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                        <Bot className="w-4 h-4" />
                        <span>Robô Salvador</span>
                      </span>
                      {emissionMode === 'robo_salvador' && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400">Emissão automática no portal com login e senha.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEmissionMode('webservice_direto');
                      setPrefeitura('Salvador (Webservice Direto)');
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      emissionMode === 'webservice_direto'
                        ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-md shadow-emerald-500/10'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Webservice A1</span>
                      </span>
                      {emissionMode === 'webservice_direto' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400">Envio direto para SEFAZ com Certificado A1.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEmissionMode('focus_nfe');
                      setPrefeitura('Salvador (Focus NFe)');
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      emissionMode === 'focus_nfe'
                        ? 'bg-blue-500/15 border-blue-500 text-white shadow-md shadow-blue-500/10'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-blue-400 flex items-center gap-1">
                        <Cloud className="w-4 h-4" />
                        <span>Focus NFe</span>
                      </span>
                      {emissionMode === 'focus_nfe' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400">Transmissão em nuvem via Focus NFe API.</p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5 md:col-span-1">
                  <label className="text-xs font-semibold text-slate-300">Prefeitura:</label>
                  <select
                    value={prefeitura}
                    onChange={(e) => setPrefeitura(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  >
                    {PREFEITURAS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-1">
                  <label className="text-xs font-semibold text-amber-400">Nº do RPS (Sequencial):</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={numeroRps}
                    onChange={(e) => setNumeroRps(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-amber-500/40 rounded-xl text-xs text-amber-300 font-mono font-bold"
                    placeholder="Ex: 1 ou 146"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-1">
                  <label className="text-xs font-semibold text-slate-300">Série do RPS:</label>
                  <input
                    type="text"
                    required
                    value={serieRps}
                    onChange={(e) => setSerieRps(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                    placeholder="1"
                  />
                </div>
              </div>

              {/* CNPJ Input with Instant Search Button */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">CNPJ ou CPF do Tomador:</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      required
                      placeholder="00.000.000/0000-00"
                      value={tomadorCnpj}
                      onChange={(e) => setTomadorCnpj(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleLookupEmissionCnpj}
                      disabled={cnpjSearchingEmission}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1 shrink-0 cursor-pointer"
                      title="Buscar CNPJ na Receita Federal"
                    >
                      {cnpjSearchingEmission ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Razão Social / Nome:</label>
                  <input
                    type="text"
                    required
                    placeholder="Razão Social do Cliente"
                    value={tomadorNome}
                    onChange={(e) => setTomadorNome(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              {/* Address info preview */}
              {tomadorEndereco && (
                <div className="text-[11px] text-slate-400 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">{tomadorEndereco}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Valor dos Serviços (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={valorServicos}
                    onChange={(e) => setValorServicos(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Alíquota ISS (%):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={aliquotaIss}
                    onChange={(e) => setAliquotaIss(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="iss_retido_modal"
                  checked={issRetido}
                  onChange={(e) => setIssRetido(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-indigo-500 focus:ring-0 w-4 h-4"
                />
                <label htmlFor="iss_retido_modal" className="text-xs text-slate-300 font-medium cursor-pointer">
                  ISS Retido na Fonte pelo Tomador
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Discriminação dos Serviços:</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Descreva detalhadamente os serviços prestados..."
                  value={discriminacaoServico}
                  onChange={(e) => setDiscriminacaoServico(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">WhatsApp do Cliente (Opcional - Envio Automático ZapCont):</label>
                <input
                  type="text"
                  placeholder="5575999999999"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>

              {submitting && (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-xs text-indigo-300 flex items-center gap-2 animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0 text-indigo-400" />
                  <span>🤖 <strong>Robô em Ação:</strong> Acessando portal da prefeitura, resolvendo captcha visual e emitindo sua NFS-e oficial... (Aguarde alguns segundos)</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" disabled={submitting} onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 cursor-pointer flex items-center gap-2">
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Emitindo NFS-e na Prefeitura...</span>
                    </>
                  ) : (
                    <span>Emitir NFS-e</span>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CADASTRO DE TOMADOR (COM BUSCA AUTOMÁTICA DE CNPJ) */}
      {/* ========================================================================= */}
      {showClientModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Cadastrar Tomador de Serviços</h3>
                  <p className="text-[10px] text-slate-400">Preenchimento automático do endereço via consulta de CNPJ na Receita Federal</p>
                </div>
              </div>
              <button onClick={() => setShowClientModal(false)} className="text-slate-400 hover:text-white font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">CNPJ ou CPF:</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      required
                      placeholder="00.000.000/0000-00"
                      value={clientDoc}
                      onChange={(e) => setClientDoc(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleLookupTomadorCnpj}
                      disabled={cnpjSearchingTomador}
                      className="px-3 py-2 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                      title="Buscar dados e endereço pelo CNPJ na Receita Federal"
                    >
                      {cnpjSearchingTomador ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      <span>Buscar</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Razão Social / Nome:</label>
                  <input
                    type="text"
                    required
                    placeholder="Nome ou Razão Social"
                    value={clientNome}
                    onChange={(e) => setClientNome(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              {/* Address Section */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Endereço do Tomador (Buscado pelo CNPJ ou Manual)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">CEP:</label>
                    <input
                      type="text"
                      placeholder="00000-000"
                      value={clientCep}
                      onChange={(e) => setClientCep(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] text-slate-400">Logradouro / Rua:</label>
                    <input
                      type="text"
                      placeholder="Av. Principal, Rua Exemplo"
                      value={clientLogradouro}
                      onChange={(e) => setClientLogradouro(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Número:</label>
                    <input
                      type="text"
                      placeholder="123 ou S/N"
                      value={clientNumero}
                      onChange={(e) => setClientNumero(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Bairro:</label>
                    <input
                      type="text"
                      placeholder="Centro"
                      value={clientBairro}
                      onChange={(e) => setClientBairro(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Município / Cidade:</label>
                    <input
                      type="text"
                      placeholder="Salvador"
                      value={clientMunicipio}
                      onChange={(e) => setClientMunicipio(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">UF:</label>
                    <select
                      value={clientUf}
                      onChange={(e) => setClientUf(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-semibold"
                    >
                      {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Contacts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">E-mail:</label>
                  <input
                    type="email"
                    placeholder="financeiro@empresa.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">WhatsApp:</label>
                  <input
                    type="text"
                    placeholder="5575999999999"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Fiscal Preferences */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Valor Padrão Mensal (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={clientValor}
                    onChange={(e) => setClientValor(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Alíquota ISS (%):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={clientAliquota}
                    onChange={(e) => setClientAliquota(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="client_iss_retido"
                  checked={clientIssRetido}
                  onChange={(e) => setClientIssRetido(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0 w-4 h-4"
                />
                <label htmlFor="client_iss_retido" className="text-xs text-slate-300 font-medium cursor-pointer">
                  Este tomador retém ISS na fonte por padrão
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Discriminação Padrão do Serviço:</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Prestação de serviços de assessoria e consultoria..."
                  value={clientDescricao}
                  onChange={(e) => setClientDescricao(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowClientModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl">Cancelar</button>
                <button type="submit" disabled={clientSaving} className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/20 cursor-pointer">
                  {clientSaving ? 'Salvando...' : 'Salvar Tomador'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
