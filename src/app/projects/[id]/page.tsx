// src/app/projects/[id]/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppSidebar } from '@/components/layout/AppSidebar';
import {
  ArrowLeft,
  Download,
  Bot,
  Calendar,
  Building2,
  Maximize2,
  Archive,
  RefreshCw,
  FolderKanban,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { ExportService } from '@/services/export/export.service';

interface ProductionDetail {
  id: string;
  name: string;
  format: string;
  status: 'active' | 'archived';
  created_at: string;
  client: {
    id: string;
    name: string;
    slug?: string;
    niche?: string;
  };
  slides: {
    id: string;
    slide_index: number;
    thumbnail_url?: string;
    image_url?: string;
  }[];
  conversation_id?: string;
}

export default function ProductionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [production, setProduction] = useState<ProductionDetail | null>(null);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isTogglingArchive, setIsTogglingArchive] = useState(false);

  useEffect(() => {
    async function loadProduction() {
      try {
        setLoading(true);
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) {
          throw new Error('Falha ao carregar os detalhes da produção.');
        }
        const data = await res.json();
        
        // Mapeia slides para obter URLs de imagens salvas
        const slides = (data.slides || []).map((s: any, idx: number) => {
          // Busca URL da composição antiga ou asset direto
          let url = s.thumbnail_url;
          if (!url && data.compositions) {
            const comp = data.compositions.find((c: any) => c.slide_id === s.id);
            if (comp?.document?.layers) {
              const bg = comp.document.layers.find((l: any) => l.type === 'background' || l.type === 'image');
              if (bg?.imageUrl) url = bg.imageUrl;
            }
          }
          return {
            id: s.id,
            slide_index: s.slide_index ?? idx,
            thumbnail_url: url || s.thumbnail_url,
            image_url: url || s.thumbnail_url,
          };
        });

        setProduction({
          id: data.project.id,
          name: data.project.name,
          format: data.project.format || '4:5',
          status: data.project.status || 'active',
          created_at: data.project.created_at,
          client: data.project.client || {
            id: data.project.client_id,
            name: 'Cliente',
            slug: 'cliente',
          },
          slides,
          conversation_id: data.project.conversation_id,
        });
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar produção.');
      } finally {
        setLoading(false);
      }
    }

    if (projectId) {
      loadProduction();
    }
  }, [projectId]);

  // Download da imagem selecionada
  const handleDownloadActive = async () => {
    if (!production) return;
    const activeSlide = production.slides[selectedSlideIndex] || production.slides[0];
    const imgUrl = activeSlide?.image_url;
    if (!imgUrl) return;

    setIsExporting(true);
    try {
      const filename = ExportService.formatFilename({
        clientSlug: production.client.slug || production.client.name,
        slideIndex: selectedSlideIndex,
        ext: 'png',
      });
      await ExportService.triggerBrowserDownload(imgUrl, filename);
    } finally {
      setIsExporting(false);
    }
  };

  // Download do carrossel completo em ZIP
  const handleDownloadAllZip = async () => {
    if (!production || production.slides.length <= 1) return;
    setIsExporting(true);
    try {
      const imagesToZip = production.slides
        .filter((s) => Boolean(s.image_url))
        .map((s, idx) => ({
          url: s.image_url!,
          index: idx,
        }));

      await ExportService.exportCarouselZip({
        clientSlug: production.client.slug || production.client.name,
        images: imagesToZip,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Arquivar / Desarquivar
  const handleToggleArchive = async () => {
    if (!production) return;
    setIsTogglingArchive(true);
    try {
      const newStatus = production.status === 'archived' ? 'active' : 'archived';
      const res = await fetch(`/api/projects/${production.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setProduction((prev) => prev ? { ...prev, status: newStatus } : null);
      }
    } finally {
      setIsTogglingArchive(false);
    }
  };

  const activeSlide = production?.slides[selectedSlideIndex] || production?.slides[0];

  return (
    <div className="flex h-screen bg-[#090B0E] text-white overflow-hidden">
      <AppSidebar />

      <main className="flex-1 flex flex-col h-full overflow-y-auto">
        {/* Top Navbar */}
        <header className="h-16 border-b border-zinc-800 bg-[#0E1116] px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Link
              href="/projects"
              className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition"
              title="Voltar para Produções"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">
                  {production?.name || 'Detalhe da Produção'}
                </h1>
                {production?.status === 'archived' && (
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">
                    Arquivada
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                <span>{production?.client.name}</span>
                <span>•</span>
                <span className="font-mono text-zinc-500 uppercase">{production?.format}</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {production?.client && (
              <Link
                href={`/creative-chat?client=${production.client.id}`}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#CEF52A] hover:bg-[#b8dd24] text-black text-xs font-bold rounded-lg transition shadow-sm"
              >
                <Bot className="w-4 h-4" />
                <span>Continuar no Chat</span>
              </Link>
            )}

            {production?.slides && production.slides.length > 1 && (
              <button
                onClick={handleDownloadAllZip}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-lg transition border border-zinc-700"
              >
                <Download className="w-4 h-4 text-zinc-400" />
                <span>Baixar ZIP ({production.slides.length})</span>
              </button>
            )}

            <button
              onClick={handleDownloadActive}
              disabled={isExporting || !activeSlide?.image_url}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-lg transition border border-zinc-700 disabled:opacity-40"
            >
              <Download className="w-4 h-4 text-[#CEF52A]" />
              <span>Baixar Imagem</span>
            </button>

            <button
              onClick={handleToggleArchive}
              disabled={isTogglingArchive}
              className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition border border-zinc-800"
              title={production?.status === 'archived' ? 'Desarquivar' : 'Arquivar'}
            >
              <Archive className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content Body */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
            <RefreshCw className="w-5 h-5 animate-spin mr-2 text-[#CEF52A]" />
            Carregando detalhes da produção...
          </div>
        ) : error || !production ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <p className="text-rose-400 text-sm font-semibold mb-3">{error || 'Produção não encontrada.'}</p>
            <Link
              href="/projects"
              className="px-4 py-2 bg-zinc-800 text-white text-xs rounded-lg hover:bg-zinc-700 transition"
            >
              Voltar para Produções
            </Link>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 max-w-7xl mx-auto w-full">
            {/* Main Image Showcase */}
            <div className="lg:col-span-8 flex flex-col items-center justify-center bg-[#111419] border border-zinc-800/80 rounded-2xl p-6 relative overflow-hidden min-h-[500px]">
              {activeSlide?.image_url ? (
                <div className="relative group max-h-[70vh] flex items-center justify-center">
                  <img
                    src={activeSlide.image_url}
                    alt={production.name}
                    className="max-h-[68vh] w-auto object-contain rounded-xl shadow-2xl border border-zinc-700/50"
                  />
                  <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={activeSlide.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-black/80 hover:bg-black text-white rounded-lg backdrop-blur border border-white/20 flex items-center gap-1.5 text-xs font-semibold"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Ver em tela cheia</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-zinc-500 text-sm text-center">
                  <Layers className="w-12 h-12 mx-auto mb-2 text-zinc-600" />
                  Nenhuma imagem disponível nesta lâmina.
                </div>
              )}

              {/* Se for carrossel, mostra seletor de lâminas inferior */}
              {production.slides.length > 1 && (
                <div className="flex items-center gap-2 mt-6 overflow-x-auto max-w-full pb-2">
                  {production.slides.map((s, idx) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSlideIndex(idx)}
                      className={`relative rounded-lg overflow-hidden shrink-0 border-2 transition ${
                        selectedSlideIndex === idx
                          ? 'border-[#CEF52A] shadow-md scale-105'
                          : 'border-zinc-800 hover:border-zinc-600 opacity-70 hover:opacity-100'
                      }`}
                      style={{ width: '56px', height: '70px' }}
                    >
                      {s.thumbnail_url ? (
                        <img src={s.thumbnail_url} alt={`Lâmina ${idx + 1}`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                          #{idx + 1}
                        </div>
                      )}
                      <span className="absolute bottom-1 right-1 bg-black/80 text-[9px] text-white px-1 rounded font-mono">
                        {idx + 1}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar Details Info */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-[#12151B] border border-zinc-800/80 rounded-2xl p-5 space-y-4">
                <h2 className="text-sm font-bold text-white border-b border-zinc-800 pb-3 flex items-center justify-between">
                  <span>Informações da Peça</span>
                  <span className="text-[10px] font-mono text-[#CEF52A] bg-[#CEF52A]/10 px-2 py-0.5 rounded border border-[#CEF52A]/20">
                    IA Concluída
                  </span>
                </h2>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-zinc-500 block mb-0.5">Cliente</span>
                    <span className="text-white font-semibold flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#CEF52A]" />
                      {production.client.name}
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-500 block mb-0.5">Formato</span>
                    <span className="text-white font-mono bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/60 inline-block uppercase">
                      {production.format}
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-500 block mb-0.5">Lâminas no projeto</span>
                    <span className="text-white font-semibold">
                      {production.slides.length} {production.slides.length === 1 ? 'lâmina (post único)' : 'lâminas (carrossel)'}
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-500 block mb-0.5">Data de Criação</span>
                    <span className="text-zinc-300 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                      {new Date(production.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-800 space-y-2">
                  <button
                    onClick={handleDownloadActive}
                    disabled={isExporting || !activeSlide?.image_url}
                    className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition border border-zinc-700 flex items-center justify-center gap-2 text-xs"
                  >
                    <Download className="w-4 h-4 text-[#CEF52A]" />
                    <span>Baixar Arquivo da Peça</span>
                  </button>

                  <Link
                    href={`/creative-chat?client=${production.client.id}`}
                    className="w-full py-2.5 bg-[#CEF52A] hover:bg-[#b8dd24] text-black font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 text-xs"
                  >
                    <Bot className="w-4 h-4" />
                    <span>Abrir e Refinar no Chat</span>
                  </Link>
                </div>
              </div>

              {/* Card de Diretrizes Rápidas */}
              <div className="bg-[#12151B] border border-zinc-800/80 rounded-2xl p-4 text-xs space-y-2">
                <span className="text-zinc-400 font-bold block flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#CEF52A]" />
                  Fluxo Conversacional
                </span>
                <p className="text-zinc-400 leading-relaxed text-[11px]">
                  Esta peça foi gerada pelo Chat Criativo integrada ao Brand DNA de {production.client.name}. Para gerar variações ou novas lâminas, continue conversando com a IA.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
