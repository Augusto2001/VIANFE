import React, { useState, useMemo } from 'react';
import { 
  GitBranch, 
  CheckCircle2, 
  ExternalLink, 
  ShieldCheck, 
  FileText, 
  Search, 
  Sparkles, 
  Server, 
  ArrowRight, 
  Download, 
  Layers, 
  ChevronRight,
  AlertTriangle,
  FlaskConical,
  Clock,
  ArrowUp
} from 'lucide-react';
import { VERSIONS_CATALOG, VersionItem } from '../data/versionsData';

export const VersionsView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [highlightedVersion, setHighlightedVersion] = useState<string | null>('1.9');

  const categories = ['all', 'Fiscal & SEFAZ', 'Segurança & Infra', 'Documentos & PDFs', 'Interface & UI'];

  const filteredVersions = useMemo(() => {
    return VERSIONS_CATALOG.filter(v => {
      const matchesSearch = 
        v.version.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.shortCommit.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.novelties.some(n => n.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCat = selectedCategory === 'all' || v.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [searchQuery, selectedCategory]);

  const scrollToVersion = (version: string) => {
    setHighlightedVersion(version);
    const element = document.getElementById(`version-card-${version}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const scrollToTable = () => {
    const tableElem = document.getElementById('versions-table-section');
    if (tableElem) {
      tableElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleDownloadEnex = () => {
    // Baixar o arquivo .enex oficial pré-gerado
    const link = document.createElement('a');
    link.href = '/docs/versoes/vianfe_todas_as_versoes.enex';
    link.download = 'vianfe_todas_as_versoes.enex';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 p-6 md:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              Série Operacional 1 • Governança & Rastreabilidade Fiscal
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Central de Versões & Novidades Operacionais
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Catálogo oficial e auditável de todas as atualizações do ViaNFe. Clique em qualquer número de versão na tabela abaixo para navegar direto aos detalhes, contratos de segurança e notas de release.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Versão Ativa na Nuvem</p>
                <p className="text-sm font-extrabold text-emerald-400">v1.9 (09/10/2026)</p>
              </div>
            </div>

            <button
              onClick={handleDownloadEnex}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-2xl text-xs font-semibold border border-slate-700 transition-all shadow-sm"
              title="Baixar caderno de notas com todas as versões para Evernote (.ENEX)"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              Caderno Evernote (.ENEX)
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {cat === 'all' ? 'Todas as Categorias' : cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por versão, termo, NFC-e..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Interactive Versions Table */}
      <div id="versions-table-section" className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Tabela de Versões Disponíveis (Clique no número da versão)
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {filteredVersions.length} de {VERSIONS_CATALOG.length} versões listadas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/30">
                <th className="py-3 px-4">Versão</th>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Commit Git</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4 min-w-[300px]">Novidades & Resumo da Entrega</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredVersions.map((v) => {
                const isActive = v.status === 'active';
                const isHighlighted = highlightedVersion === v.version;

                return (
                  <tr
                    key={v.version}
                    className={`transition-colors hover:bg-slate-800/50 ${
                      isHighlighted ? 'bg-emerald-950/20' : ''
                    }`}
                  >
                    {/* Versão (Link Clicável) */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <button
                        onClick={() => scrollToVersion(v.version)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl font-bold font-mono text-xs transition-all ${
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 hover:scale-105'
                            : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white hover:scale-105'
                        }`}
                        title={`Clique para ir direto ao texto completo da versão ${v.version}`}
                      >
                        <span>v{v.version}</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                      </button>
                    </td>

                    {/* Data */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-400 font-mono">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {v.date}
                      </div>
                    </td>

                    {/* Commit */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono">
                      <a
                        href={`https://github.com/Augusto2001/VIANFE/commit/${v.commit}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-slate-400 hover:text-emerald-400 transition-colors text-[11px]"
                        title="Ver commit oficial no GitHub"
                      >
                        <GitBranch className="w-3 h-3" />
                        {v.shortCommit}
                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </a>
                    </td>

                    {/* Categoria */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-800/80 text-slate-300 border border-slate-700/60">
                        {v.category}
                      </span>
                    </td>

                    {/* Resumo */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white mb-0.5">{v.title}</div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{v.summary}</p>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          {v.statusLabel}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          {v.statusLabel}
                        </span>
                      )}
                    </td>

                    {/* Botão Ver Detalhes */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => scrollToVersion(v.version)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition-all text-xs font-medium group"
                      >
                        <span>Ler Notas</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section Divider */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            Detalhamento Completo das Versões & Relatórios de Release
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Visualização aprofundada com novidades técnicas, regras de segurança, testes no Docker e limitações declaradas.
          </p>
        </div>

        <button
          onClick={scrollToTable}
          className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
        >
          <ArrowUp className="w-3.5 h-3.5" />
          Voltar à Tabela
        </button>
      </div>

      {/* Detailed Cards Section */}
      <div className="space-y-6">
        {filteredVersions.map((v) => {
          const isActive = v.status === 'active';
          const isHighlighted = highlightedVersion === v.version;

          return (
            <div
              key={v.version}
              id={`version-card-${v.version}`}
              className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                isActive
                  ? 'bg-slate-900 border-emerald-500/40 shadow-xl shadow-emerald-950/20'
                  : 'bg-slate-900/80 border-slate-800'
              } ${isHighlighted ? 'ring-2 ring-emerald-500/80' : ''}`}
            >
              {/* Card Header */}
              <div className="p-5 md:p-6 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950/40">
                <div className="flex items-start md:items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-mono font-black text-sm shrink-0 shadow-inner ${
                    isActive 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}>
                    v{v.version}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base md:text-lg font-bold text-white">
                        {v.title}
                      </h3>
                      {isActive && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                          PRODUÇÃO ATIVA
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono flex-wrap">
                      <span>Data: {v.date}</span>
                      <span>•</span>
                      <a
                        href={`https://github.com/Augusto2001/VIANFE/commit/${v.commit}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        Commit: {v.shortCommit}
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                      <span>•</span>
                      <span className="text-slate-300">{v.category}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono">
                    Estado: <b className="text-slate-200">{v.statusLabel}</b>
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 md:p-6 space-y-6 text-xs text-slate-300 leading-relaxed">
                
                {/* Resumo */}
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-200 font-medium">
                  {v.summary}
                </div>

                {/* Novidades e Entregas */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Novidades & Entregas Desta Versão
                  </h4>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {v.novelties.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-slate-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Contratos de Segurança */}
                {v.securityRules && v.securityRules.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Regras de Segurança & Integridade Fiscal
                    </h4>
                    <div className="space-y-1.5">
                      {v.securityRules.map((rule, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-slate-300 bg-sky-950/20 border border-sky-900/30 p-2.5 rounded-xl">
                          <span className="text-sky-400 font-bold">•</span>
                          <span>{rule}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Testes e Evidências Reais */}
                {v.testsAndEvidence && v.testsAndEvidence.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <FlaskConical className="w-3.5 h-3.5" />
                      Testes Executados & Evidências Reais de Produção
                    </h4>
                    <div className="space-y-1.5">
                      {v.testsAndEvidence.map((ev, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-slate-300 bg-amber-950/20 border border-amber-900/30 p-2.5 rounded-xl">
                          <span className="text-amber-400 font-bold">✓</span>
                          <span>{ev}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Limitações e Pendências Declaradas */}
                {v.limitations && v.limitations.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Limitações Operacionais & Pendências Declaradas
                    </h4>
                    <div className="space-y-1.5">
                      {v.limitations.map((lim, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-slate-300 bg-rose-950/20 border border-rose-900/30 p-2.5 rounded-xl">
                          <span className="text-rose-400 font-bold">!</span>
                          <span>{lim}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
