'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppSidebar } from '@/components/layout/AppSidebar';
import {
  FolderKanban,
  Sparkles,
  Search,
  Filter,
  Layers,
  ArrowRight,
  Clock,
  CheckCircle2,
  Calendar,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import type { FormatId } from '@/config/formats';
import { FORMATS } from '@/config/formats';

interface ProjectListItem {
  id: string;
  title: string;
  project_type: 'single_post' | 'carousel';
  format: FormatId;
  status: 'draft' | 'in_review' | 'approved' | 'exported';
  created_at: string;
  updated_at: string;
  client?: {
    name: string;
    slug: string;
    brand_status: string;
  } | null;
  slides?: {
    id: string;
    slide_index: number;
    status: string;
  }[];
}

export default function ProjectsDashboardPage() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [projectToDelete, setProjectToDelete] = useState<ProjectListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteSuccessToast, setDeleteSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProjects() {
      try {
        setLoading(true);
        const res = await fetch('/api/projects');
        const data = await res.json();
        if (data.projects) {
          setProjects(data.projects);
        }
      } catch (err) {
        console.error('Falha ao carregar projetos:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, []);

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.client?.name.toLowerCase().includes(search.toLowerCase()) ||
      p.client?.slug.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesFormat = formatFilter === 'all' || p.format === formatFilter;

    return matchesSearch && matchesStatus && matchesFormat;
  });

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
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
            Rascunho
          </span>
        );
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;

    try {
      setDeleting(true);
      const res = await fetch(`/api/projects?id=${projectToDelete.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Falha ao excluir rascunho.');
      }

      setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id));
      setDeleteSuccessToast(`Rascunho "${projectToDelete.title}" excluído com sucesso.`);
      setProjectToDelete(null);
      setTimeout(() => setDeleteSuccessToast(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Erro ao apagar rascunho');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#F6F7F8] font-sans overflow-hidden">
      <AppSidebar />

      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-black" />
              <span>Produções Criativas</span>
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Gerencie todos os posts e carrosséis gerados pela equipe da FA.
            </p>
          </div>

          <Link
            href="/create"
            className="px-5 py-2.5 bg-black hover:bg-gray-800 text-[#CEF52A] rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span>Nova Produção</span>
          </Link>
        </div>

        {/* Content Area */}
        <div className="max-w-6xl w-full mx-auto p-8 space-y-6 flex-1">
          {/* Toast Notification */}
          {deleteSuccessToast && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs flex items-center gap-2.5 animate-in slide-in-from-top-1 duration-150">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-semibold">{deleteSuccessToast}</span>
            </div>
          )}

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por título ou cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-black"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Filter className="w-3.5 h-3.5" />
                <span>Filtros:</span>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-gray-300 bg-white focus:outline-none"
              >
                <option value="all">Todos os Status</option>
                <option value="draft">Rascunho</option>
                <option value="in_review">Em Revisão</option>
                <option value="approved">Aprovado</option>
                <option value="exported">Exportado</option>
              </select>

              <select
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-gray-300 bg-white focus:outline-none"
              >
                <option value="all">Todos os Formatos</option>
                <option value="instagram_feed_4_5">Feed 4:5 (1080x1350)</option>
                <option value="instagram_square">Quadrado 1:1 (1080x1080)</option>
                <option value="instagram_story">Story 9:16 (1080x1920)</option>
              </select>
            </div>
          </div>

          {/* Projects Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-48 bg-gray-200 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
                <FolderKanban className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-gray-900 text-sm">Nenhuma produção encontrada</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Não encontramos projetos correspondentes aos filtros aplicados. Crie uma nova peça para começar!
              </p>
              <Link
                href="/create"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-[#CEF52A] rounded-xl font-bold text-xs hover:bg-gray-800 transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>Criar Primeiro Post</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => {
                const fmt = FORMATS[project.format] || FORMATS.instagram_feed_4_5;
                const slidesCount = project.slides?.length || 1;

                return (
                  <div
                    key={project.id}
                    className="bg-white rounded-2xl border border-gray-200 hover:border-black/30 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                  >
                    <div className="p-5 space-y-4">
                      {/* Client & Status header */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-lg truncate max-w-[150px]">
                          {project.client?.name || 'Cliente'}
                        </span>
                        {getStatusBadge(project.status)}
                      </div>

                      {/* Project Title */}
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm line-clamp-2 group-hover:text-black">
                          {project.title}
                        </h3>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-gray-400" />
                            <span>{slidesCount} {slidesCount === 1 ? 'lâmina' : 'lâminas'}</span>
                          </span>
                          <span className="font-mono text-[11px] bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                            {fmt.aspectRatio}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer with Date & Action */}
                    <div className="p-4 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(project.updated_at).toLocaleDateString('pt-BR')}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setProjectToDelete(project)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                          title="Apagar rascunho"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <Link
                          href={`/projects/${project.id}`}
                          className="px-3.5 py-1.5 bg-black hover:bg-gray-800 text-[#CEF52A] rounded-lg font-bold text-xs flex items-center gap-1.5 transition"
                        >
                          <span>Abrir Estúdio</span>
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
                <h3 className="font-bold text-sm text-gray-900">Apagar Rascunho</h3>
                <p className="text-xs text-gray-500">Esta ação não poderá ser desfeita.</p>
              </div>
            </div>

            <p className="text-xs text-gray-700 bg-gray-50 p-3.5 rounded-xl border border-gray-200 leading-relaxed">
              Deseja realmente apagar a produção <strong className="text-black font-bold">&quot;{projectToDelete.title}&quot;</strong>?
              Todas as lâminas e composições vinculadas a este rascunho serão removidas permanentemente.
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
                    <span>Apagando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sim, Apagar Rascunho</span>
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
