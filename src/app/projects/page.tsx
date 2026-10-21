'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/layout/AppSidebar';
import {
  FolderKanban,
  Sparkles,
  Search,
  Filter,
  Layers,
  ArrowRight,
  ArrowLeft,
  Clock,
  CheckCircle2,
  Calendar,
  Trash2,
  AlertTriangle,
  Eye,
  Copy,
  Archive,
  ArchiveRestore,
  Download,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { FormatId } from '@/config/formats';
import { FORMATS, getFormatDefinition } from '@/config/formats';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { ExportService } from '@/services/export/export.service';

interface ProjectListItem {
  id: string;
  title: string;
  project_type: 'single_post' | 'carousel';
  format: FormatId;
  width?: number;
  height?: number;
  status: 'draft' | 'in_review' | 'approved' | 'exported' | 'archived';
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
  thumbnail_url?: string | null;
  client?: {
    id?: string;
    name: string;
    slug: string;
    brand_status: string;
  } | null;
  slides?: {
    id: string;
    slide_index: number;
    status: string;
    preview_asset_id?: string | null;
  }[];
}

interface ProjectDetailState {
  project: ProjectListItem;
  slides: any[];
  compositions: any[];
}

export default function ProjectsDashboardPage() {
  const router = useRouter();

  // List & Data state
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('designer');

  // Filter state
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all'); // all, draft, in_review, approved, exported, archived
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Preview Modal state
  const [previewProjectId, setPreviewProjectId] = useState<string | null>(null);
  const [previewDetail, setPreviewDetail] = useState<ProjectDetailState | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Operations state
  const [projectToDelete, setProjectToDelete] = useState<ProjectListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Fetch User Role
  useEffect(() => {
    async function loadRole() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: member } = await (supabase as any)
            .from('organization_members')
            .select('role')
            .eq('user_id', user.id)
            .maybeSingle();
          if (member?.role) {
            setUserRole(member.role);
          }
        }
      } catch {
        // fallback
      }
    }
    loadRole();
  }, []);

  const isViewer = userRole === 'viewer';

  // 2. Fetch Projects with filters
  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const isArchived = statusFilter === 'archived';
      const params = new URLSearchParams();
      if (isArchived) {
        params.set('archived', 'true');
      } else if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (formatFilter !== 'all') params.set('format', formatFilter);
      if (clientFilter !== 'all') params.set('clientId', clientFilter);

      const res = await fetch(`/api/projects?${params.toString()}`);
      const data = await res.json();
      if (data.projects) {
        setProjects(data.projects);
      }
    } catch (err) {
      console.error('Falha ao carregar projetos:', err);
      showToast('Erro ao carregar lista de produções', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, formatFilter, clientFilter]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Unique clients for filter dropdown
  const uniqueClients = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) {
      if (p.client?.id && p.client?.name) {
        map.set(p.client.id, p.client.name);
      } else if (p.client?.name) {
        map.set(p.client.name, p.client.name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [projects]);

  // Filtered in-memory projects (by search and projectType)
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.client?.name?.toLowerCase().includes(q) ||
        p.client?.slug?.toLowerCase().includes(q);

      const matchesType = typeFilter === 'all' || p.project_type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [projects, search, typeFilter]);

  // 3. Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Aprovado
          </span>
        );
      case 'in_review':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Em Revisão
          </span>
        );
      case 'exported':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Exportado
          </span>
        );
      case 'archived':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-200 text-zinc-700 border border-zinc-300 flex items-center gap-1">
            <Archive className="w-3 h-3" />
            Arquivado
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
            Rascunho
          </span>
        );
    }
  };

  // 4. Load Project Detail for Preview Modal
  const openPreview = async (project: ProjectListItem) => {
    setPreviewProjectId(project.id);
    setActiveSlideIndex(0);
    setLoadingPreview(true);

    try {
      const res = await fetch(`/api/projects/${project.id}`);
      if (!res.ok) throw new Error('Não foi possível carregar os detalhes do projeto');
      const data = await res.json();
      setPreviewDetail({
        project: data.project || project,
        slides: (data.slides || []).sort((a: any, b: any) => a.slide_index - b.slide_index),
        compositions: data.compositions || [],
      });
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar preview', 'error');
      setPreviewProjectId(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const closePreview = () => {
    setPreviewProjectId(null);
    setPreviewDetail(null);
    setActiveSlideIndex(0);
  };

  // Keyboard navigation for preview modal
  useEffect(() => {
    if (!previewDetail) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePreview();
      if (e.key === 'ArrowLeft') {
        setActiveSlideIndex((prev) => Math.max(0, prev - 1));
      }
      if (e.key === 'ArrowRight') {
        setActiveSlideIndex((prev) => Math.min((previewDetail.slides?.length || 1) - 1, prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewDetail]);

  // 5. Duplicate Project (Zero AI)
  const handleDuplicateProject = async (projectId: string) => {
    if (isViewer) {
      showToast('Visualizadores possuem acesso somente leitura.', 'error');
      return;
    }
    try {
      setIsDuplicating(projectId);
      const res = await fetch(`/api/projects/${projectId}/duplicate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Falha ao duplicar produção.');
      }
      showToast('Produção duplicada com sucesso!');
      await fetchProjects();
    } catch (err: any) {
      showToast(err.message || 'Erro ao duplicar produção.', 'error');
    } finally {
      setIsDuplicating(null);
    }
  };

  // 6. Archive / Restore Project
  const handleArchiveToggle = async (project: ProjectListItem) => {
    if (isViewer) {
      showToast('Visualizadores possuem acesso somente leitura.', 'error');
      return;
    }
    const isCurrentlyArchived = project.status === 'archived' || !!project.archived_at;
    try {
      setIsArchiving(project.id);
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !isCurrentlyArchived }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Falha ao alterar status de arquivamento.');
      }
      showToast(
        isCurrentlyArchived ? 'Produção restaurada com sucesso!' : 'Produção arquivada com sucesso!'
      );
      if (previewProjectId === project.id) {
        closePreview();
      }
      await fetchProjects();
    } catch (err: any) {
      showToast(err.message || 'Erro ao arquivar/restaurar.', 'error');
    } finally {
      setIsArchiving(null);
    }
  };

  // 7. Permanent Delete Project (Drafts / Archived only)
  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    if (isViewer) {
      showToast('Visualizadores possuem acesso somente leitura.', 'error');
      return;
    }
    try {
      setDeleting(true);
      const res = await fetch(`/api/projects/${projectToDelete.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Falha ao excluir produção.');
      }
      setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id));
      showToast(`Produção "${projectToDelete.title}" excluída permanentemente.`);
      if (previewProjectId === projectToDelete.id) {
        closePreview();
      }
      setProjectToDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir produção.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // 8. Download PNG (Current Slide) & ZIP (All Slides)
  const handleDownloadSlide = async (mode: 'current' | 'all') => {
    if (!previewDetail) return;
    try {
      setIsExporting(true);
      const p = previewDetail.project;
      const clientSlug = p.client?.slug || p.client?.name || 'studio-fa';

      if (mode === 'current') {
        const activeSlide = previewDetail.slides[activeSlideIndex] || previewDetail.slides[0];
        const imgUrl = (activeSlide as any)?.image_url || (activeSlide as any)?.preview_url || p.thumbnail_url;

        if (!imgUrl) {
          showToast('Nenhuma imagem encontrada neste slide.', 'error');
          return;
        }

        const filename = ExportService.formatFilename({
          clientSlug,
          slideIndex: activeSlide?.slide_index ?? activeSlideIndex,
          ext: 'png',
        });

        await ExportService.triggerBrowserDownload(imgUrl, filename);
        showToast('Slide baixado com sucesso!');
      } else {
        // ZIP all slides
        const imagesToZip = previewDetail.slides
          .map((s, idx) => ({
            url: (s as any)?.image_url || (s as any)?.preview_url || (idx === 0 ? p.thumbnail_url : null),
            index: s.slide_index ?? idx,
          }))
          .filter((item): item is { url: string; index: number } => Boolean(item.url));

        if (imagesToZip.length === 0) {
          showToast('Nenhum slide renderizável encontrado para exportação.', 'error');
          return;
        }

        await ExportService.exportCarouselZip({
          clientSlug,
          images: imagesToZip,
        });

        showToast('Pacote ZIP baixado com sucesso!');
      }
    } catch (err: any) {
      showToast(`Falha no download: ${err.message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#F6F7F8] font-sans overflow-hidden">
      <AppSidebar />

      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Top Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between sticky top-0 z-10 shadow-2xs">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-black" />
              <span>Produções Criativas</span>
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Galeria visual completa de posts e carrosséis gerados para os clientes.
            </p>
          </div>

          {!isViewer && (
            <Link
              href="/create"
              className="px-5 py-2.5 bg-black hover:bg-gray-800 text-[#CEF52A] rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>Nova Produção</span>
            </Link>
          )}
        </div>

        {/* Content Area */}
        <div className="max-w-7xl w-full mx-auto p-8 space-y-6 flex-1">
          {/* Toast Notification */}
          {toastMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 animate-in slide-in-from-top-1 duration-150 border ${
                toastMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-red-50 border-red-300 text-red-800'
              }`}
            >
              {toastMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              )}
              <span className="font-semibold">{toastMessage.text}</span>
            </div>
          )}

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shadow-2xs">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Buscar por título ou cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-black"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                <Filter className="w-3.5 h-3.5" />
                <span>Filtros:</span>
              </div>

              {/* Client Filter */}
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-gray-300 bg-white focus:outline-none font-medium"
              >
                <option value="all">Todos os Clientes</option>
                {uniqueClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-gray-300 bg-white focus:outline-none font-medium"
              >
                <option value="all">Todos os Status</option>
                <option value="draft">Rascunhos</option>
                <option value="in_review">Em Revisão</option>
                <option value="approved">Aprovados</option>
                <option value="exported">Exportados</option>
                <option value="archived">Arquivados</option>
              </select>

              {/* Format Filter */}
              <select
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-gray-300 bg-white focus:outline-none font-medium"
              >
                <option value="all">Todos os Formatos</option>
                <option value="instagram_feed_4_5">Feed 4:5</option>
                <option value="instagram_square">Quadrado 1:1</option>
                <option value="instagram_story">Story 9:16</option>
                <option value="custom">Personalizado</option>
              </select>

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-gray-300 bg-white focus:outline-none font-medium"
              >
                <option value="all">Todos os Tipos</option>
                <option value="single_post">Post Único</option>
                <option value="carousel">Carrossel</option>
              </select>
            </div>
          </div>

          {/* Visual Gallery Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
                  <div className="aspect-4/5 bg-gray-200 animate-pulse" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
                <FolderKanban className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-gray-900 text-sm">Nenhuma produção encontrada</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                {statusFilter === 'archived'
                  ? 'Não há nenhuma produção arquivada no momento.'
                  : 'Não encontramos produções correspondentes aos filtros aplicados. Crie uma nova arte para começar!'}
              </p>
              {!isViewer && statusFilter !== 'archived' && (
                <Link
                  href="/create"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-[#CEF52A] rounded-xl font-bold text-xs hover:bg-gray-800 transition"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Criar Nova Produção</span>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => {
                const fmt = getFormatDefinition(project.format || 'instagram_feed_4_5', project.width, project.height);
                const slidesCount = project.slides?.length || 1;
                const isArchived = project.status === 'archived' || !!project.archived_at;

                return (
                  <div
                    key={project.id}
                    className="bg-white rounded-2xl border border-gray-200 hover:border-black/40 hover:shadow-lg transition-all duration-200 flex flex-col justify-between overflow-hidden group"
                  >
                    {/* Visual Art Box */}
                    <div
                      onClick={() => openPreview(project)}
                      className="relative w-full aspect-4/5 bg-zinc-950 overflow-hidden cursor-pointer"
                    >
                      {project.thumbnail_url ? (
                        <img
                          src={project.thumbnail_url}
                          alt={project.title}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-black">
                          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-3">
                            <Layers className="w-6 h-6 text-[#CEF52A]" />
                          </div>
                          <span className="text-xs font-semibold text-white/90 line-clamp-2 max-w-[200px]">
                            {project.title}
                          </span>
                          <span className="text-[10px] text-zinc-400 mt-1">
                            {slidesCount} {slidesCount === 1 ? 'lâmina' : 'lâminas'}
                          </span>
                        </div>
                      )}

                      {/* Top Floating Badges */}
                      <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
                        <span className="bg-black/75 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-1 rounded-lg truncate max-w-[150px] shadow-sm">
                          {project.client?.name || 'Cliente'}
                        </span>
                        <div className="pointer-events-auto">
                          {getStatusBadge(project.status)}
                        </div>
                      </div>

                      {/* Bottom Floating Badges */}
                      <div className="absolute bottom-3 inset-x-3 flex items-center justify-between pointer-events-none">
                        <span className="bg-black/75 backdrop-blur-xs text-[#CEF52A] text-[10px] font-bold px-2 py-0.5 rounded font-mono shadow-sm">
                          {fmt.name}
                        </span>
                        <span className="bg-black/75 backdrop-blur-xs text-white text-[10px] font-medium px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
                          <Layers className="w-3 h-3 text-[#CEF52A]" />
                          <span>{slidesCount} {slidesCount === 1 ? 'lâmina' : 'lâminas'}</span>
                        </span>
                      </div>

                      {/* Hover Overlay with Preview Button */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openPreview(project);
                          }}
                          className="px-3.5 py-2 bg-black/90 hover:bg-black text-[#CEF52A] rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg backdrop-blur-xs transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Visualizar</span>
                        </button>
                      </div>
                    </div>

                    {/* Metadata & Actions Area */}
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm line-clamp-1 group-hover:text-black">
                          {project.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                          <Clock className="w-3 h-3" />
                          <span>Atualizado em {new Date(project.updated_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {/* Duplicate */}
                          {!isViewer && (
                            <button
                              type="button"
                              onClick={() => handleDuplicateProject(project.id)}
                              disabled={isDuplicating === project.id}
                              className="p-1.5 text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg transition"
                              title="Duplicar produção (Zero IA)"
                            >
                              {isDuplicating === project.id ? (
                                <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin block" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          )}

                          {/* Archive / Restore */}
                          {!isViewer && (
                            <button
                              type="button"
                              onClick={() => handleArchiveToggle(project)}
                              disabled={isArchiving === project.id}
                              className="p-1.5 text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg transition"
                              title={isArchived ? 'Restaurar produção' : 'Arquivar produção'}
                            >
                              {isArchiving === project.id ? (
                                <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin block" />
                              ) : isArchived ? (
                                <ArchiveRestore className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Archive className="w-4 h-4" />
                              )}
                            </button>
                          )}

                          {/* Delete (if archived or draft) */}
                          {!isViewer && (isArchived || project.status === 'draft') && (
                            <button
                              type="button"
                              onClick={() => setProjectToDelete(project)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Excluir produção permanentemente"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Open Studio Button */}
                        <Link
                          href={`/projects/${project.id}`}
                          className="px-3 py-1.5 bg-black hover:bg-gray-800 text-[#CEF52A] rounded-lg font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
                        >
                          <span>{isViewer ? 'Ver no Estúdio' : 'Abrir Estúdio'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* PRODUCTION PREVIEW MODAL */}
      {previewProjectId && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
          onClick={closePreview}
        >
          <div
            className="bg-zinc-950 text-white rounded-3xl border border-zinc-800 shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-lg bg-zinc-800 text-[#CEF52A] text-xs font-bold font-mono">
                  {previewDetail?.project.client?.name || 'Cliente'}
                </span>
                <h3 className="font-bold text-sm text-white truncate max-w-md">
                  {previewDetail?.project.title || 'Carregando produção...'}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {previewDetail?.project && (
                  <div className="hidden sm:block">
                    {getStatusBadge(previewDetail.project.status)}
                  </div>
                )}
                <button
                  type="button"
                  onClick={closePreview}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            {loadingPreview || !previewDetail ? (
              <div className="flex-1 flex items-center justify-center text-zinc-500 text-xs">
                <span className="w-5 h-5 border-2 border-[#CEF52A] border-t-transparent rounded-full animate-spin mr-2" />
                <span>Carregando arte e composições...</span>
              </div>
            ) : (
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Visual Canvas Display Area */}
                <div className="flex-1 bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
                  {/* Active Slide Image */}
                  <div className="relative max-h-[58vh] max-w-full aspect-4/5 rounded-xl overflow-hidden shadow-2xl border border-zinc-800 bg-zinc-900 flex items-center justify-center">
                    {(() => {
                      const curSlide = previewDetail.slides[activeSlideIndex];
                      const comp = previewDetail.compositions.find((c: any) => c.slide_id === curSlide?.id);
                      const bgLayer = comp?.document?.layers?.find(
                        (l: any) => l.type === 'background' || l.type === 'image'
                      );
                      const displayUrl = bgLayer?.imageUrl || previewDetail.project.thumbnail_url;

                      if (displayUrl) {
                        return (
                          <img
                            src={displayUrl}
                            alt={`Slide ${activeSlideIndex + 1}`}
                            className="w-full h-full object-contain"
                          />
                        );
                      }

                      return (
                        <div className="p-8 text-center text-zinc-500 text-xs space-y-2">
                          <Layers className="w-8 h-8 text-[#CEF52A] mx-auto opacity-50" />
                          <p className="font-semibold text-zinc-300">
                            Lâmina {activeSlideIndex + 1}: {curSlide?.title || 'Sem título'}
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            Abra no Estúdio para editar e renderizar em alta resolução.
                          </p>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Carousel Left / Right Navigation */}
                  {previewDetail.slides.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveSlideIndex((prev) => Math.max(0, prev - 1))}
                        disabled={activeSlideIndex === 0}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white disabled:opacity-20 transition shadow-lg"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveSlideIndex((prev) =>
                            Math.min(previewDetail.slides.length - 1, prev + 1)
                          )
                        }
                        disabled={activeSlideIndex === previewDetail.slides.length - 1}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white disabled:opacity-20 transition shadow-lg"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}

                  {/* Filmstrip Bottom Thumbnails (if carousel) */}
                  {previewDetail.slides.length > 1 && (
                    <div className="flex items-center gap-2 mt-4 px-2 py-1 bg-zinc-900/70 backdrop-blur rounded-xl border border-zinc-800 max-w-full overflow-x-auto">
                      {previewDetail.slides.map((s, idx) => {
                        const isSelected = activeSlideIndex === idx;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setActiveSlideIndex(idx)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-[#CEF52A] text-black shadow-sm'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                            }`}
                          >
                            <span>#{idx + 1}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Sidebar Info & Actions Panel */}
                <div className="w-full md:w-80 bg-zinc-900/90 border-t md:border-t-0 md:border-l border-zinc-800 p-5 flex flex-col justify-between shrink-0">
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider block">
                        Detalhes da Produção
                      </span>
                      <h4 className="font-bold text-sm text-white mt-1">
                        {previewDetail.project.title}
                      </h4>
                    </div>

                    <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800/80 space-y-2.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Cliente:</span>
                        <span className="font-semibold text-zinc-200">
                          {previewDetail.project.client?.name || 'Não atribuído'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Formato:</span>
                        <span className="font-mono text-zinc-200">
                          {getFormatDefinition(previewDetail.project.format, previewDetail.project.width, previewDetail.project.height).name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Resolução:</span>
                        <span className="font-mono text-[#CEF52A]">
                          {previewDetail.project.width || 1080} × {previewDetail.project.height || 1350} px
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Lâminas:</span>
                        <span className="font-semibold text-zinc-200">
                          {previewDetail.slides.length} {previewDetail.slides.length === 1 ? 'lâmina' : 'lâminas'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Lâmina Ativa:</span>
                        <span className="font-bold text-[#CEF52A]">
                          #{activeSlideIndex + 1} de {previewDetail.slides.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="space-y-2 pt-4 border-t border-zinc-800">
                    {/* Baixar Slide Atual */}
                    <button
                      type="button"
                      onClick={() => handleDownloadSlide('current')}
                      disabled={isExporting}
                      className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      <Download className="w-4 h-4 text-[#CEF52A]" />
                      <span>{isExporting ? 'Processando...' : 'Baixar Slide Atual (PNG)'}</span>
                    </button>

                    {/* Baixar Carrossel Completo (ZIP) */}
                    {previewDetail.slides.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDownloadSlide('all')}
                        disabled={isExporting}
                        className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
                      >
                        <Download className="w-4 h-4 text-emerald-400" />
                        <span>Baixar Carrossel Completo (ZIP)</span>
                      </button>
                    )}

                    {/* Abrir no Estúdio */}
                    <Link
                      href={`/projects/${previewDetail.project.id}`}
                      className="w-full py-3 bg-[#CEF52A] hover:bg-[#b8dd20] text-black rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-md"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{isViewer ? 'Visualizar no Estúdio' : 'Abrir no Estúdio FA'}</span>
                    </Link>

                    {/* Quick Duplication & Archive for non-viewers */}
                    {!isViewer && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleDuplicateProject(previewDetail.project.id)}
                          disabled={isDuplicating === previewDetail.project.id}
                          className="py-2 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 rounded-xl font-semibold text-[11px] flex items-center justify-center gap-1.5 transition border border-zinc-800"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Duplicar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleArchiveToggle(previewDetail.project)}
                          disabled={isArchiving === previewDetail.project.id}
                          className="py-2 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 rounded-xl font-semibold text-[11px] flex items-center justify-center gap-1.5 transition border border-zinc-800"
                        >
                          {previewDetail.project.status === 'archived' || previewDetail.project.archived_at ? (
                            <>
                              <ArchiveRestore className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Restaurar</span>
                            </>
                          ) : (
                            <>
                              <Archive className="w-3.5 h-3.5" />
                              <span>Arquivar</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {projectToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setProjectToDelete(null)}
        >
          <div
            className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-900">Excluir Produção Permanentemente</h3>
                <p className="text-xs text-gray-500">Esta ação não poderá ser desfeita.</p>
              </div>
            </div>

            <p className="text-xs text-gray-700 bg-gray-50 p-3.5 rounded-xl border border-gray-200 leading-relaxed">
              Deseja realmente apagar a produção <strong className="text-black font-bold">&quot;{projectToDelete.title}&quot;</strong>?
              Todas as lâminas e composições vinculadas serão excluídas definitivamente.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteProject}
                disabled={deleting}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sim, Excluir Definitivamente</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
