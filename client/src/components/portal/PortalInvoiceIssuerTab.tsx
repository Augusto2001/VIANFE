import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
  Company, 
  EmitFastInvoiceDto, 
  FastInvoiceResult, 
  FavoriteCatalogItem, 
  RecurringClientItem 
} from '../../types';
import { PortalFavoritesModal } from './PortalFavoritesModal';
import { 
  Zap, 
  Search, 
  Sparkles, 
  User, 
  Building2, 
  FileText, 
  CheckCircle2, 
  Copy, 
  Check, 
  Share2, 
  Download, 
  ExternalLink, 
  ArrowRight, 
  ArrowLeft, 
  RefreshCw, 
  AlertCircle, 
  DollarSign, 
  QrCode, 
  Phone, 
  Mail, 
  MapPin, 
  MessageSquare,
  ShieldCheck,
  Package,
  Wrench,
  Clock
} from 'lucide-react';

interface PortalInvoiceIssuerTabProps {
  company: Company;
}

export const PortalInvoiceIssuerTab: React.FC<PortalInvoiceIssuerTabProps> = ({ company }) => {
  // Step indicator: 1: Cliente, 2: Serviço/Produto, 3: Revisão & Emissão
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Tomador
  const [cnpjCpf, setCnpjCpf] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [municipio, setMunicipio] = useState(company.uf === 'BA' ? 'Salvador' : 'Curitiba');
  const [uf, setUf] = useState(company.uf || 'BA');
  const [cep, setCep] = useState('');
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState('');
  const [saveClientCheck, setSaveClientCheck] = useState(true);
  const [searchingCnpj, setSearchingCnpj] = useState(false);

  // Step 2: Item / Serviço
  const [tipoNota, setTipoNota] = useState<'NFS-e' | 'NF-e'>('NFS-e');
  const [descricao, setDescricao] = useState('');
  const [valorUnitario, setValorUnitario] = useState('');
  const [aliquotaIss, setAliquotaIss] = useState(String(company.nfse_aliquota_padrao || '5.0'));
  const [issRetido, setIssRetido] = useState(false);
  const [itemServico, setItemServico] = useState(company.item_servico_padrao || '01.07');
  const [cnae, setCnae] = useState(company.cnae_padrao || '6202-3/00');
  const [ncm, setNcm] = useState('');
  const [cfop, setCfop] = useState('5.102');
  const [unidade, setUnidade] = useState('UN');
  const [condicaoPagamento, setCondicaoPagamento] = useState<'PIX' | 'Boleto' | 'A_VISTA' | 'PARCELADO'>('PIX');

  // Favorites & Recurring Clients
  const [favoritesModalOpen, setFavoritesModalOpen] = useState(false);
  const [recurringClients, setRecurringClients] = useState<RecurringClientItem[]>([]);
  const [quickFavorites, setQuickFavorites] = useState<FavoriteCatalogItem[]>([]);

  // Step 3: Emission State
  const [emitting, setEmitting] = useState(false);
  const [emissionSuccess, setEmissionSuccess] = useState<FastInvoiceResult | null>(null);
  const [emissionError, setEmissionError] = useState<string | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  // Recent invoices
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  // Load quick catalogs on mount
  const loadCatalogs = async () => {
    try {
      const [favs, clients, recents] = await Promise.all([
        api.getPortalFavorites(company.id),
        api.getPortalRecurringClients(company.id),
        api.getRecentPortalInvoices(company.id),
      ]);
      setQuickFavorites(favs || []);
      setRecurringClients(clients || []);
      setRecentInvoices(recents || []);
    } catch (err: any) {
      console.error('Erro ao carregar dados auxiliares:', err);
    }
  };

  useEffect(() => {
    loadCatalogs();
  }, [company.id]);

  // Mask formatting
  const formatCnpjCpfInput = (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (clean.length <= 11) {
      return clean
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return clean
      .substring(0, 14)
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCnpjCpf(formatCnpjCpfInput(e.target.value));
  };

  // CNPJ Online Lookup
  const handleLookupCnpj = async () => {
    const clean = cnpjCpf.replace(/\D/g, '');
    if (clean.length < 14) {
      alert('Digite um CNPJ válido com 14 dígitos para buscar na Receita Federal.');
      return;
    }

    try {
      setSearchingCnpj(true);
      const data = await api.lookupCnpj(clean);
      if (data) {
        setRazaoSocial(data.razao_social || data.nome || '');
        if (data.email) setEmail(data.email);
        if (data.telefone) setWhatsapp(data.telefone);
        if (data.logradouro) setLogradouro(data.logradouro);
        if (data.numero) setNumero(data.numero);
        if (data.complemento) setComplemento(data.complemento);
        if (data.bairro) setBairro(data.bairro);
        if (data.municipio) setMunicipio(data.municipio);
        if (data.uf) setUf(data.uf);
        if (data.cep) setCep(data.cep);
      }
    } catch (err: any) {
      alert(`Consulta CNPJ: ${err.message || 'Dados não localizados automaticamente'}`);
    } finally {
      setSearchingCnpj(false);
    }
  };

  // Select recurring client
  const handleSelectRecurringClient = (client: RecurringClientItem) => {
    setCnpjCpf(formatCnpjCpfInput(client.cnpj_cpf));
    setRazaoSocial(client.razao_social);
    setEmail(client.email || '');
    setWhatsapp(client.telefone_whatsapp || '');
    setLogradouro(client.logradouro || '');
    setNumero(client.numero || '');
    setComplemento(client.complemento || '');
    setBairro(client.bairro || '');
    setMunicipio(client.municipio || 'Salvador');
    setUf(client.uf || 'BA');
    setCep(client.cep || '');
    setInscricaoMunicipal(client.inscricao_municipal || '');
    if (client.item_servico) setItemServico(client.item_servico);
    if (client.discriminacao_padrao) setDescricao(client.discriminacao_padrao);
    if (client.valor_padrao) setValorUnitario(String(client.valor_padrao));
  };

  // Select favorite service / product
  const handleSelectFavoriteItem = (item: FavoriteCatalogItem) => {
    setTipoNota(item.tipo === 'servico' ? 'NFS-e' : 'NF-e');
    setDescricao(item.descricao_padrao);
    if (item.valor_padrao) setValorUnitario(String(item.valor_padrao));
    if (item.item_lista_servico) setItemServico(item.item_lista_servico);
    if (item.cnae) setCnae(item.cnae);
    if (item.aliquota_iss_padrao) setAliquotaIss(String(item.aliquota_iss_padrao));
    if (item.iss_retido_padrao !== undefined) setIssRetido(!!item.iss_retido_padrao);
    if (item.ncm) setNcm(item.ncm);
    if (item.cfop) setCfop(item.cfop);
    if (item.unidade_medida) setUnidade(item.unidade_medida);
  };

  // Step 1 Validation
  const canProceedStep1 = () => {
    return cnpjCpf.replace(/\D/g, '').length >= 11 && razaoSocial.trim().length > 2;
  };

  // Step 2 Validation
  const canProceedStep2 = () => {
    const val = parseFloat(valorUnitario.replace(',', '.'));
    return descricao.trim().length >= 3 && !isNaN(val) && val > 0;
  };

  // Execute Instant Emission
  const handleEmitFastInvoice = async () => {
    try {
      setEmitting(true);
      setEmissionError(null);

      const valNum = parseFloat(valorUnitario.replace(',', '.')) || 0;
      const issNum = parseFloat(aliquotaIss.replace(',', '.')) || 0;

      const payload: EmitFastInvoiceDto = {
        company_id: company.id,
        tipo: tipoNota,
        tomador: {
          cnpj_cpf: cnpjCpf.replace(/\D/g, ''),
          razao_social: razaoSocial.trim(),
          email: email.trim() || undefined,
          whatsapp: whatsapp.replace(/\D/g, '') || undefined,
          logradouro: logradouro.trim() || undefined,
          numero: numero.trim() || undefined,
          complemento: complemento.trim() || undefined,
          bairro: bairro.trim() || undefined,
          municipio: municipio.trim() || undefined,
          uf: uf.trim() || undefined,
          cep: cep.replace(/\D/g, '') || undefined,
          inscricao_municipal: inscricaoMunicipal.trim() || undefined,
        },
        item: {
          descricao: descricao.trim(),
          valor: valNum,
          aliquota_iss: issNum,
          iss_retido: issRetido,
          item_servico: itemServico || undefined,
          cnae: cnae || undefined,
          ncm: ncm || undefined,
          cfop: cfop || undefined,
          unidade: unidade || 'UN',
        },
        condicao_pagamento: condicaoPagamento,
      };

      // Save recurring client if checked
      if (saveClientCheck) {
        api.savePortalRecurringClient({
          company_id: company.id,
          cnpj_cpf: cnpjCpf.replace(/\D/g, ''),
          razao_social: razaoSocial.trim(),
          email: email.trim() || undefined,
          telefone_whatsapp: whatsapp.replace(/\D/g, '') || undefined,
          logradouro: logradouro.trim() || undefined,
          numero: numero.trim() || undefined,
          bairro: bairro.trim() || undefined,
          municipio: municipio.trim() || undefined,
          uf: uf.trim() || undefined,
          cep: cep.replace(/\D/g, '') || undefined,
          inscricao_municipal: inscricaoMunicipal.trim() || undefined,
          valor_padrao: valNum,
          discriminacao_padrao: descricao.trim(),
          condicao_pagamento_padrao: condicaoPagamento,
        }).catch(err => console.error('Erro ao salvar cliente recorrente:', err));
      }

      const result = await api.emitFastInvoice(payload);
      setEmissionSuccess(result);
      loadCatalogs();
    } catch (err: any) {
      console.error('Erro na emissão relâmpago:', err);
      setEmissionError(err.message || 'Falha ao autorizar nota fiscal junto à Prefeitura/SEFAZ.');
    } finally {
      setEmitting(false);
    }
  };

  const handleCopyPix = () => {
    if (!emissionSuccess?.pix_code) return;
    navigator.clipboard.writeText(emissionSuccess.pix_code);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 3000);
  };

  const resetForm = () => {
    setCurrentStep(1);
    setCnpjCpf('');
    setRazaoSocial('');
    setEmail('');
    setWhatsapp('');
    setLogradouro('');
    setNumero('');
    setComplemento('');
    setBairro('');
    setDescricao('');
    setValorUnitario('');
    setEmissionSuccess(null);
    setEmissionError(null);
  };

  const numVal = parseFloat(valorUnitario.replace(',', '.')) || 0;
  const issVal = numVal * ((parseFloat(aliquotaIss.replace(',', '.')) || 5) / 100);
  const liquidoVal = issRetido ? numVal - issVal : numVal;

  return (
    <div className="space-y-6">
      
      {/* Step Indicator Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3 h-3" /> Emissão Relâmpago
              </span>
              <span className="text-xs text-slate-400 font-mono">3 Passos Guiados</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
              Emissor de Notas Fiscais Integrado
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Emita NFS-e ou NF-e em menos de 1 minuto com geração automática de PDF e PIX para WhatsApp.
            </p>
          </div>

          <button
            onClick={() => setFavoritesModalOpen(true)}
            className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-md self-start sm:self-auto"
          >
            <Sparkles className="w-4 h-4" />
            <span>Catálogo de Favoritos</span>
          </button>
        </div>

        {/* 3 Steps Visual Tracker */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-5">
          <button
            onClick={() => !emissionSuccess && setCurrentStep(1)}
            className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 ${
              currentStep === 1
                ? 'bg-emerald-500/15 border-emerald-500/50 text-white shadow-md'
                : currentStep > 1
                ? 'bg-slate-950 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold font-mono shrink-0 ${
              currentStep === 1
                ? 'bg-emerald-500 text-slate-950'
                : currentStep > 1
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-slate-900 text-slate-500'
            }`}>
              {currentStep > 1 ? <Check className="w-4 h-4" /> : '1'}
            </div>
            <div className="min-w-0 hidden sm:block">
              <span className="text-[10px] uppercase font-bold tracking-wider block opacity-75">Passo 1</span>
              <span className="text-xs font-bold truncate block">Tomador / Cliente</span>
            </div>
          </button>

          <button
            onClick={() => !emissionSuccess && canProceedStep1() && setCurrentStep(2)}
            className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 ${
              currentStep === 2
                ? 'bg-emerald-500/15 border-emerald-500/50 text-white shadow-md'
                : currentStep > 2
                ? 'bg-slate-950 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold font-mono shrink-0 ${
              currentStep === 2
                ? 'bg-emerald-500 text-slate-950'
                : currentStep > 2
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-slate-900 text-slate-500'
            }`}>
              {currentStep > 2 ? <Check className="w-4 h-4" /> : '2'}
            </div>
            <div className="min-w-0 hidden sm:block">
              <span className="text-[10px] uppercase font-bold tracking-wider block opacity-75">Passo 2</span>
              <span className="text-xs font-bold truncate block">Item & Valores</span>
            </div>
          </button>

          <button
            onClick={() => !emissionSuccess && canProceedStep1() && canProceedStep2() && setCurrentStep(3)}
            className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 ${
              currentStep === 3
                ? 'bg-emerald-500/15 border-emerald-500/50 text-white shadow-md'
                : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold font-mono shrink-0 ${
              currentStep === 3
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-slate-900 text-slate-500'
            }`}>
              3
            </div>
            <div className="min-w-0 hidden sm:block">
              <span className="text-[10px] uppercase font-bold tracking-wider block opacity-75">Passo 3</span>
              <span className="text-xs font-bold truncate block">Revisão & Emissão</span>
            </div>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* EMISSION SUCCESS SCREEN */}
      {/* ========================================================================= */}
      {emissionSuccess ? (
        <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-fade-in">
          
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/60">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h3 className="text-2xl font-black text-white tracking-tight">Nota Fiscal Emitida com Sucesso!</h3>
            <p className="text-xs text-slate-300 max-w-md mx-auto">
              Autorizada oficialmente pela Prefeitura / SEFAZ sob o número <strong className="text-emerald-400 font-mono font-bold">#{emissionSuccess.numero_nota}</strong>.
            </p>
          </div>

          {/* Key Details Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400">Tomador</span>
              <div className="text-xs font-bold text-white truncate">{emissionSuccess.destinatario_nome}</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400">Valor Total</span>
              <div className="text-xs font-bold text-emerald-400 font-mono">
                R$ {(emissionSuccess.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400">Código de Verificação</span>
              <div className="text-xs font-bold text-slate-300 font-mono truncate">{emissionSuccess.codigo_verificacao}</div>
            </div>
          </div>

          {/* PIX Copia-e-Cola Box */}
          {emissionSuccess.pix_code && (
            <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4" /> Código PIX Copia-e-Cola para Cobrança:
                </span>
                <button
                  onClick={handleCopyPix}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-md"
                >
                  {copiedPix ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPix ? 'Copiado!' : 'Copiar PIX'}</span>
                </button>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 break-all select-all">
                {emissionSuccess.pix_code}
              </div>
            </div>
          )}

          {/* Action Buttons: WhatsApp + View PDF + New Emission */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2">
            
            {/* WhatsApp Share */}
            {emissionSuccess.whatsapp_share_url && (
              <a
                href={emissionSuccess.whatsapp_share_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3 bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 text-xs font-black rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                <span>Enviar no WhatsApp do Cliente</span>
              </a>
            )}

            {/* Direct PDF View */}
            {emissionSuccess.pdf_url && (
              <a
                href={emissionSuccess.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Visualizar DANFSE / PDF</span>
              </a>
            )}

            {/* New Emission */}
            <button
              onClick={resetForm}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              <span>Emitir Outra Nota</span>
            </button>
          </div>

        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* STEP 1: TOMADOR / CLIENTE */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6 animate-fade-in">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Passo 1: Identificação do Tomador / Cliente</h3>
                    <p className="text-xs text-slate-400">Informe o CNPJ ou CPF para preenchimento automático</p>
                  </div>
                </div>

                {/* Quick Recurring Selector Pills */}
                {recurringClients.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 whitespace-nowrap">Recorrentes:</span>
                    {recurringClients.slice(0, 3).map((cli) => (
                      <button
                        key={cli.id}
                        type="button"
                        onClick={() => handleSelectRecurringClient(cli)}
                        className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors"
                      >
                        {cli.razao_social.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                
                {/* CNPJ / CPF + Lookup Button */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">CNPJ ou CPF do Cliente:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={cnpjCpf}
                        onChange={handleCnpjChange}
                        placeholder="00.000.000/0000-00 ou 000.000.000-00"
                        className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleLookupCnpj}
                        disabled={searchingCnpj}
                        className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-md shrink-0"
                      >
                        <Search className={`w-3.5 h-3.5 ${searchingCnpj ? 'animate-spin' : ''}`} />
                        <span>{searchingCnpj ? 'Buscando...' : 'Buscar'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Razão Social */}
                  <div className="space-y-1.5 sm:col-span-3">
                    <label className="text-xs font-semibold text-slate-300">Razão Social / Nome Completo:</label>
                    <input
                      type="text"
                      value={razaoSocial}
                      onChange={(e) => setRazaoSocial(e.target.value)}
                      placeholder="Ex: EMPRESA CLIENTE LTDA"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-semibold"
                    />
                  </div>
                </div>

                {/* Contatos: WhatsApp e E-mail */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>WhatsApp do Cliente (Para envio imediato do PDF e PIX):</span>
                    </label>
                    <input
                      type="text"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="(71) 99999-9999"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-teal-400" />
                      <span>E-mail do Cliente:</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="financeiro@cliente.com.br"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Endereço */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Logradouro / Rua:</label>
                    <input
                      type="text"
                      value={logradouro}
                      onChange={(e) => setLogradouro(e.target.value)}
                      placeholder="Av. Tancredo Neves"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Número:</label>
                    <input
                      type="text"
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      placeholder="1000"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Bairro:</label>
                    <input
                      type="text"
                      value={bairro}
                      onChange={(e) => setBairro(e.target.value)}
                      placeholder="Caminho das Árvores"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Município:</label>
                    <input
                      type="text"
                      value={municipio}
                      onChange={(e) => setMunicipio(e.target.value)}
                      placeholder="Salvador"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">UF:</label>
                    <input
                      type="text"
                      value={uf}
                      onChange={(e) => setUf(e.target.value.toUpperCase())}
                      maxLength={2}
                      placeholder="BA"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white uppercase font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">CEP:</label>
                    <input
                      type="text"
                      value={cep}
                      onChange={(e) => setCep(e.target.value)}
                      placeholder="41820-021"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                </div>

                {/* Save to favorites checkbox */}
                <div className="pt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="saveClientCheck"
                    checked={saveClientCheck}
                    onChange={(e) => setSaveClientCheck(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                  />
                  <label htmlFor="saveClientCheck" className="text-xs text-slate-300 cursor-pointer">
                    Salvar tomador na lista de clientes frequentes para próximas emissões em 1 toque
                  </label>
                </div>

              </div>

              {/* Step 1 Footer Action */}
              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  disabled={!canProceedStep1()}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <span>Avançar para Serviço & Valores</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: PRODUTO / SERVIÇO & VALORES */}
          {/* ========================================================================= */}
          {currentStep === 2 && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6 animate-fade-in">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Passo 2: Serviço / Produto & Tributação</h3>
                    <p className="text-xs text-slate-400">Escolha do catálogo de favoritos ou digite livremente</p>
                  </div>
                </div>

                {/* Quick Favorite Pills */}
                {quickFavorites.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 whitespace-nowrap">Favoritos:</span>
                    {quickFavorites.slice(0, 3).map((fav) => (
                      <button
                        key={fav.id}
                        type="button"
                        onClick={() => handleSelectFavoriteItem(fav)}
                        className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors"
                      >
                        {fav.nome_atalho}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                
                {/* Tipo de Documento: NFS-e vs NF-e */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTipoNota('NFS-e')}
                    className={`py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                      tipoNota === 'NFS-e'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <Wrench className="w-4 h-4" />
                    <span>NFS-e (Prestação de Serviços)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipoNota('NF-e')}
                    className={`py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                      tipoNota === 'NF-e'
                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/50 shadow-md'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    <span>NF-e (Venda de Mercadorias)</span>
                  </button>
                </div>

                {/* Discriminação / Descrição */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Discriminação do Serviço / Descrição do Produto:</span>
                    <button
                      type="button"
                      onClick={() => setFavoritesModalOpen(true)}
                      className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Sparkles className="w-3 h-3" /> Escolher do Catálogo
                    </button>
                  </label>
                  <textarea
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    rows={3}
                    placeholder="Ex: Prestação de serviços de consultoria contábil e auditoria fiscal referente ao mês corrente..."
                    className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Valor & Alíquota ISS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Valor Total do Item (R$):</label>
                    <div className="relative">
                      <DollarSign className="w-4 h-4 text-emerald-400 absolute left-3 top-3" />
                      <input
                        type="number"
                        step="0.01"
                        value={valorUnitario}
                        onChange={(e) => setValorUnitario(e.target.value)}
                        placeholder="0,00"
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono font-bold"
                      />
                    </div>
                  </div>

                  {tipoNota === 'NFS-e' ? (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">Alíquota ISS (%):</label>
                        <input
                          type="number"
                          step="0.01"
                          value={aliquotaIss}
                          onChange={(e) => setAliquotaIss(e.target.value)}
                          placeholder="5.0"
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">Item LC 116 / CNAE:</label>
                        <input
                          type="text"
                          value={itemServico}
                          onChange={(e) => setItemServico(e.target.value)}
                          placeholder="01.07"
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">NCM:</label>
                        <input
                          type="text"
                          value={ncm}
                          onChange={(e) => setNcm(e.target.value)}
                          placeholder="8471.30.12"
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">CFOP:</label>
                        <input
                          type="text"
                          value={cfop}
                          onChange={(e) => setCfop(e.target.value)}
                          placeholder="5.102"
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Condição de Pagamento & ISS Retido */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Forma de Pagamento:</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(['PIX', 'Boleto', 'A_VISTA', 'PARCELADO'] as const).map((cond) => (
                        <button
                          key={cond}
                          type="button"
                          onClick={() => setCondicaoPagamento(cond)}
                          className={`py-2 rounded-xl text-[11px] font-bold transition-all border ${
                            condicaoPagamento === cond
                              ? 'bg-emerald-600 text-white border-emerald-500'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {cond === 'A_VISTA' ? 'À Vista' : cond}
                        </button>
                      ))}
                    </div>
                  </div>

                  {tipoNota === 'NFS-e' && (
                    <div className="space-y-1.5 flex flex-col justify-end">
                      <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-white block">ISS Retido na Fonte?</span>
                          <span className="text-[10px] text-slate-400">Desconta o ISS do valor líquido</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={issRetido}
                          onChange={(e) => setIssRetido(e.target.checked)}
                          className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Step 2 Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-5 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-all border border-slate-800 flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  disabled={!canProceedStep2()}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <span>Avançar para Espelho & Emissão</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: REVISÃO, ESPELHO DA NOTA & EMISSÃO */}
          {/* ========================================================================= */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Live RPS / DANFE Mirror Box */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white">Espelho da Nota Fiscal (Simulação Prévia)</h3>
                      <p className="text-xs text-slate-400">Verifique todas as informações antes da autorização oficial</p>
                    </div>
                  </div>

                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 self-start sm:self-auto font-mono">
                    {tipoNota} Padrão Viacont
                  </span>
                </div>

                {/* Simulated Document Sheet */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 font-sans">
                  
                  {/* Prestador / Emitente Header */}
                  <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider">Prestador de Serviços / Emitente</span>
                      <h4 className="text-sm font-black text-white mt-0.5">{company.razao_social}</h4>
                      <p className="text-xs text-slate-400 font-mono">
                        CNPJ: {company.cnpj} {company.inscricao_municipal ? `• IM: ${company.inscricao_municipal}` : ''}
                      </p>
                      <p className="text-xs text-slate-400">{company.uf} - Brasil</p>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Ambiente Fiscal</span>
                      <div className="text-xs font-bold text-white font-mono mt-0.5">Produção / Oficial</div>
                      <div className="text-xs text-slate-400">Regime: Simples Nacional</div>
                    </div>
                  </div>

                  {/* Tomador Box */}
                  <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800/90 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-teal-400 tracking-wider">Tomador dos Serviços / Destinatário</span>
                    <h5 className="text-xs font-black text-white">{razaoSocial}</h5>
                    <p className="text-xs text-slate-300 font-mono">
                      CNPJ/CPF: {cnpjCpf} {inscricaoMunicipal ? `• IM: ${inscricaoMunicipal}` : ''}
                    </p>
                    <p className="text-xs text-slate-400">
                      {logradouro ? `${logradouro}, ${numero || 'S/N'} - ${bairro || ''}, ${municipio} - ${uf}` : `${municipio} - ${uf}`}
                    </p>
                    {(whatsapp || email) && (
                      <p className="text-[11px] text-slate-400 pt-1">
                        Contato: {whatsapp ? `WhatsApp: ${whatsapp}` : ''} {email ? `• E-mail: ${email}` : ''}
                      </p>
                    )}
                  </div>

                  {/* Item Description & Values Table */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Discriminação dos Serviços / Produtos</span>
                    
                    <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {descricao}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/40 p-3.5 rounded-xl border border-slate-800 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Item LC 116</span>
                        <strong className="text-white font-mono">{itemServico}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Alíquota ISS</span>
                        <strong className="text-white font-mono">{aliquotaIss}%</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">ISS Retido</span>
                        <strong className={issRetido ? 'text-amber-400' : 'text-slate-300'}>
                          {issRetido ? 'SIM (Retido)' : 'NÃO'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Pagamento</span>
                        <strong className="text-emerald-400">{condicaoPagamento}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Totals Summary */}
                  <div className="border-t border-slate-800 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="text-xs text-slate-400 space-y-0.5">
                      <div>Valor dos Serviços: <strong className="text-slate-200">R$ {numVal.toFixed(2)}</strong></div>
                      <div>Valor do ISS ({aliquotaIss}%): <strong className="text-slate-200">R$ {issVal.toFixed(2)}</strong></div>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-xs text-slate-400 block">Valor Total a Pagar pelo Cliente:</span>
                      <span className="text-2xl font-black text-emerald-400 font-mono">
                        R$ {numVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                </div>

                {/* Error Banner if any */}
                {emissionError && (
                  <div className="p-4 bg-rose-500/15 border border-rose-500/40 rounded-2xl text-xs text-rose-300 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold block">Falha na Emissão da Nota:</strong>
                      <span>{emissionError}</span>
                    </div>
                  </div>
                )}

                {/* Actions: Voltar + Emitir */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    disabled={emitting}
                    className="px-5 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-all border border-slate-800 flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Voltar</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleEmitFastInvoice}
                    disabled={emitting}
                    className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-50 text-white text-sm font-black rounded-2xl transition-all shadow-xl shadow-emerald-950/60 flex items-center gap-2 cursor-pointer"
                  >
                    <Zap className={`w-5 h-5 ${emitting ? 'animate-bounce' : ''}`} />
                    <span>{emitting ? 'Autorizando junto à Prefeitura / SEFAZ...' : '⚡ Emitir Nota Fiscal Agora'}</span>
                  </button>
                </div>

              </div>

            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* RECENT INVOICES LIST */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-black text-white">Últimas Notas Fiscais Emitidas</h4>
          </div>
          <span className="text-xs text-slate-400 font-mono">{recentInvoices.length} notas recentes</span>
        </div>

        {recentInvoices.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-950/60 rounded-2xl border border-slate-800">
            Nenhuma nota fiscal emitida recentemente para esta empresa.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {recentInvoices.map((inv) => (
              <div
                key={inv.id}
                className="bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-emerald-500/30 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                      #{inv.numero || inv.id}
                    </span>
                    <span className="text-xs font-bold text-white truncate">
                      {inv.destinatario_nome || 'Cliente Tomador'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Emissão: {inv.data_emissao ? inv.data_emissao.split('T')[0].split('-').reverse().join('/') : '-'}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                  <span className="text-sm font-black text-emerald-400 font-mono">
                    R$ {(inv.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>

                  <a
                    href={api.getPortalInvoicePdfUrl(inv.numero || inv.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 transition-colors flex items-center gap-1 text-xs"
                    title="Baixar PDF"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">PDF</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Favorites Modal Dialog */}
      <PortalFavoritesModal
        companyId={company.id}
        isOpen={favoritesModalOpen}
        onClose={() => setFavoritesModalOpen(false)}
        onSelectFavorite={handleSelectFavoriteItem}
      />

    </div>
  );
};
