import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { FavoriteCatalogItem, CreateFavoriteDto, UpdateFavoriteDto } from '../../types';
import { 
  Sparkles, 
  Search, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Layers, 
  DollarSign, 
  Tag, 
  FileText, 
  Package, 
  Wrench,
  AlertCircle
} from 'lucide-react';

interface PortalFavoritesModalProps {
  companyId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectFavorite: (item: FavoriteCatalogItem) => void;
}

export const PortalFavoritesModal: React.FC<PortalFavoritesModalProps> = ({
  companyId,
  isOpen,
  onClose,
  onSelectFavorite,
}) => {
  const [favorites, setFavorites] = useState<FavoriteCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'servico' | 'produto'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Form mode: null | 'create' | 'edit'
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [formTipo, setFormTipo] = useState<'servico' | 'produto'>('servico');
  const [formNome, setFormNome] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formItemServico, setFormItemServico] = useState('');
  const [formCnae, setFormCnae] = useState('');
  const [formAliquotaIss, setFormAliquotaIss] = useState('5.0');
  const [formNcm, setFormNcm] = useState('');
  const [formCfop, setFormCfop] = useState('');
  const [formUnidade, setFormUnidade] = useState('UN');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      const data = await api.getPortalFavorites(companyId);
      setFavorites(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar favoritos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadFavorites();
      setFormMode(null);
      setErrorMessage(null);
    }
  }, [isOpen, companyId]);

  if (!isOpen) return null;

  const handleOpenCreate = () => {
    setFormMode('create');
    setEditingId(null);
    setFormTipo('servico');
    setFormNome('');
    setFormDescricao('');
    setFormValor('');
    setFormItemServico('01.07');
    setFormCnae('6202-3/00');
    setFormAliquotaIss('5.0');
    setFormNcm('');
    setFormCfop('');
    setFormUnidade('UN');
    setErrorMessage(null);
  };

  const handleOpenEdit = (item: FavoriteCatalogItem) => {
    setFormMode('edit');
    setEditingId(item.id);
    setFormTipo(item.tipo);
    setFormNome(item.nome_atalho);
    setFormDescricao(item.descricao_padrao);
    setFormValor(String(item.valor_padrao || ''));
    setFormItemServico(item.item_lista_servico || '');
    setFormCnae(item.cnae || '');
    setFormAliquotaIss(String(item.aliquota_iss_padrao ?? '5.0'));
    setFormNcm(item.ncm || '');
    setFormCfop(item.cfop || '');
    setFormUnidade(item.unidade_medida || 'UN');
    setErrorMessage(null);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome || !formDescricao) {
      setErrorMessage('Preencha o nome do atalho e a descrição.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const valNum = parseFloat(formValor.replace(',', '.')) || 0;
      const issNum = parseFloat(formAliquotaIss.replace(',', '.')) || 0;

      if (formMode === 'create') {
        const payload: CreateFavoriteDto = {
          company_id: companyId,
          tipo: formTipo,
          nome_atalho: formNome.trim(),
          descricao_padrao: formDescricao.trim(),
          valor_padrao: valNum,
          item_lista_servico: formItemServico || undefined,
          cnae: formCnae || undefined,
          aliquota_iss_padrao: issNum,
          ncm: formNcm || undefined,
          cfop: formCfop || undefined,
          unidade_medida: formUnidade || 'UN',
        };
        await api.createPortalFavorite(payload);
      } else if (formMode === 'edit' && editingId) {
        const payload: UpdateFavoriteDto = {
          nome_atalho: formNome.trim(),
          descricao_padrao: formDescricao.trim(),
          valor_padrao: valNum,
          tipo: formTipo,
          item_lista_servico: formItemServico || undefined,
          cnae: formCnae || undefined,
          aliquota_iss_padrao: issNum,
          ncm: formNcm || undefined,
          cfop: formCfop || undefined,
          unidade_medida: formUnidade || 'UN',
        };
        await api.updatePortalFavorite(editingId, payload);
      }

      await loadFavorites();
      setFormMode(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao salvar favorito.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja excluir este item favorito?')) return;
    try {
      await api.deletePortalFavorite(id);
      loadFavorites();
    } catch (err: any) {
      alert(`Erro ao excluir: ${err.message}`);
    }
  };

  const filteredFavorites = favorites.filter((fav) => {
    const matchesType = filterType === 'all' || fav.tipo === filterType;
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      fav.nome_atalho.toLowerCase().includes(term) ||
      fav.descricao_padrao.toLowerCase().includes(term) ||
      (fav.cnae && fav.cnae.toLowerCase().includes(term)) ||
      (fav.item_lista_servico && fav.item_lista_servico.toLowerCase().includes(term));
    return matchesType && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Catálogo de Favoritos em 1 Toque</h3>
              <p className="text-xs text-slate-400">Serviços e produtos recorrentes para preenchimento relâmpago</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* Create / Edit Form */}
          {formMode ? (
            <form onSubmit={handleSaveForm} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Tag className="w-4 h-4 text-emerald-400" />
                  <span>{formMode === 'create' ? 'Novo Item Favorito' : 'Editar Item Favorito'}</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setFormMode(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Tipo */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormTipo('servico')}
                  className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                    formTipo === 'servico'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Serviço (NFS-e)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormTipo('produto')}
                  className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                    formTipo === 'produto'
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Produto (NF-e)</span>
                </button>
              </div>

              {/* Nome do Atalho & Valor */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Nome do Atalho (Pílula Rápida):</label>
                  <input
                    type="text"
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    placeholder="Ex: Consultoria em TI, Honorários Mensais..."
                    required
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Valor Padrão (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formValor}
                    onChange={(e) => setFormValor(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Descrição Completa */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">Discriminação / Descrição da Nota:</label>
                <textarea
                  value={formDescricao}
                  onChange={(e) => setFormDescricao(e.target.value)}
                  placeholder="Descrição detalhada que sairá no espelho e no XML..."
                  rows={2}
                  required
                  className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Tributary Codes based on Tipo */}
              {formTipo === 'servico' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Item LC 116 / Serviço:</label>
                    <input
                      type="text"
                      value={formItemServico}
                      onChange={(e) => setFormItemServico(e.target.value)}
                      placeholder="01.07"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">CNAE Principal:</label>
                    <input
                      type="text"
                      value={formCnae}
                      onChange={(e) => setFormCnae(e.target.value)}
                      placeholder="6202-3/00"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Alíquota ISS (%):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formAliquotaIss}
                      onChange={(e) => setFormAliquotaIss(e.target.value)}
                      placeholder="5.0"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">NCM:</label>
                    <input
                      type="text"
                      value={formNcm}
                      onChange={(e) => setFormNcm(e.target.value)}
                      placeholder="8471.30.12"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">CFOP:</label>
                    <input
                      type="text"
                      value={formCfop}
                      onChange={(e) => setFormCfop(e.target.value)}
                      placeholder="5.102"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Unidade:</label>
                    <input
                      type="text"
                      value={formUnidade}
                      onChange={(e) => setFormUnidade(e.target.value)}
                      placeholder="UN"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFormMode(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-950/40"
                >
                  {submitting ? 'Salvando...' : 'Salvar Favorito'}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Type Switcher */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filterType === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Todos ({favorites.length})
                </button>
                <button
                  onClick={() => setFilterType('servico')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filterType === 'servico' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Serviços
                </button>
                <button
                  onClick={() => setFilterType('produto')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filterType === 'produto' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Produtos
                </button>
              </div>

              {/* Add Button */}
              <button
                onClick={handleOpenCreate}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Favorito</span>
              </button>
            </div>
          )}

          {/* Search Box */}
          {!formMode && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por atalho, descrição ou código fiscal..."
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          )}

          {/* List of Favorites */}
          {!formMode && (
            <div className="space-y-2.5">
              {loading ? (
                <div className="p-8 text-center text-xs text-slate-400">Carregando catálogo...</div>
              ) : filteredFavorites.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
                  <Sparkles className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">Nenhum item favorito encontrado.</p>
                  <button
                    onClick={handleOpenCreate}
                    className="text-xs text-emerald-400 font-bold hover:underline"
                  >
                    + Cadastrar primeiro atalho
                  </button>
                </div>
              ) : (
                filteredFavorites.map((fav) => (
                  <div
                    key={fav.id}
                    className="bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          fav.tipo === 'servico'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                        }`}>
                          {fav.tipo === 'servico' ? 'NFS-e Serviço' : 'NF-e Produto'}
                        </span>
                        <h5 className="text-sm font-bold text-white truncate">{fav.nome_atalho}</h5>
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-2">{fav.descricao_padrao}</p>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                        <span className="text-emerald-400 font-bold font-mono">
                          R$ {(fav.valor_padrao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        {fav.item_lista_servico && <span>LC 116: {fav.item_lista_servico}</span>}
                        {fav.cnae && <span>CNAE: {fav.cnae}</span>}
                        {fav.ncm && <span>NCM: {fav.ncm}</span>}
                        {fav.total_usos ? <span>{fav.total_usos} emissões</span> : null}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <button
                        onClick={() => handleOpenEdit(fav)}
                        className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition-colors"
                        title="Editar atalho"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => handleDelete(fav.id, e)}
                        className="p-2 bg-slate-900 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 rounded-xl border border-slate-800 hover:border-rose-800 transition-colors"
                        title="Excluir atalho"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          onSelectFavorite(fav);
                          onClose();
                        }}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Usar Este</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>{filteredFavorites.length} atalhos cadastrados</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
