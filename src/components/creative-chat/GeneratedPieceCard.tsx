// src/components/creative-chat/GeneratedPieceCard.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Download,
  FolderKanban,
  RefreshCw,
  Sparkles,
  Check,
  BookmarkPlus,
  Maximize2,
  Copy,
  ExternalLink,
} from 'lucide-react';
import type { GeneratedChatPiece } from '@/types/domain/creative-chat';
import { ExportService } from '@/services/export/export.service';

interface GeneratedPieceCardProps {
  piece: GeneratedChatPiece;
  clientId?: string;
  conversationId?: string;
  onRegenerate?: (instruction?: string) => void;
  onUseAsReference?: (imageUrl: string) => void;
  isRegenerating?: boolean;
}

export function GeneratedPieceCard({
  piece,
  clientId,
  conversationId,
  onRegenerate,
  onUseAsReference,
  isRegenerating,
}: GeneratedPieceCardProps) {
  const [showRegenerateInput, setShowRegenerateInput] = useState(false);
  const [variationText, setVariationText] = useState('');
  const [isSavingProduction, setIsSavingProduction] = useState(false);
  const [savedProductionId, setSavedProductionId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Bloqueio estrito de falso sucesso (Seção 2, 5, 11):
  // Proibido renderizar card de arte pronta se não houver asset real ou se for SVG placeholder
  if (!piece || !piece.previewUrl || piece.previewUrl.startsWith('data:image/svg')) {
    return null;
  }

  // Proporção visual nativa baseada no aspectRatio
  const aspectClass =
    piece.aspectRatio === '9:16'
      ? 'aspect-[9/16] max-w-[280px]'
      : piece.aspectRatio === '1:1'
      ? 'aspect-square max-w-[360px]'
      : piece.aspectRatio === '16:9'
      ? 'aspect-[16/9] max-w-[480px]'
      : 'aspect-[4/5] max-w-[340px]'; // default 4:5

  const isCarousel = Boolean(piece.carouselSlides && piece.carouselSlides.length > 0);

  // 1. Download Direto do Asset Gerado (sem canvas, sem Konva)
  const handleDownload = async (customUrl?: string, customName?: string) => {
    setIsDownloading(true);
    try {
      const urlToDownload = customUrl || piece.previewUrl;
      const filename = customName || `studio-fa_${piece.aspectRatio.replace(':', '-')}_${Date.now()}.png`;
      await ExportService.triggerBrowserDownload(urlToDownload, filename);
    } finally {
      setIsDownloading(false);
    }
  };

  // Download de Todas as Lâminas do Carrossel
  const handleDownloadAllSlides = async () => {
    if (!piece.carouselSlides) return;
    setIsDownloading(true);
    try {
      for (const slide of piece.carouselSlides) {
        const filename = `studio-fa_carrossel_lamina-${slide.slideIndex + 1}_${Date.now()}.png`;
        await ExportService.triggerBrowserDownload(slide.previewUrl, filename);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  // 2. Salvar em Produções
  const handleSaveProduction = async () => {
    if (!clientId) return;
    setIsSavingProduction(true);
    try {
      const res = await fetch('/api/creative-chat/save-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          projectId: piece.projectId,
          conversationId,
          imageUrl: piece.previewUrl,
          title: piece.headline || piece.title || (isCarousel ? 'Carrossel Criativo' : 'Arte do Chat Criativo'),
          format: piece.format || piece.aspectRatio,
          projectType: isCarousel ? 'carousel' : 'single_post',
          slides: piece.carouselSlides,
        }),
      });
      const data = await res.json();
      if (res.ok && data.productionId) {
        setSavedProductionId(data.productionId);
      }
    } catch (err) {
      console.error('Falha ao salvar produção:', err);
    } finally {
      setIsSavingProduction(false);
    }
  };

  // 3. Variação / Refinamento
  const handleTriggerRegenerate = () => {
    if (onRegenerate) {
      onRegenerate(variationText.trim() || undefined);
      setShowRegenerateInput(false);
      setVariationText('');
    }
  };

  return (
    <div className="bg-[#101216] border border-zinc-800 rounded-2xl p-5 md:p-6 text-zinc-200 shadow-2xl space-y-4 max-w-xl my-3">
      {/* Header do Card */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <div>
          <span className="text-[10px] uppercase font-bold text-[#CEF52A] tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#CEF52A] animate-pulse" />
            {isCarousel
              ? `Carrossel Completo • ${piece.carouselSlides?.length || 0} Lâminas • Formato ${piece.aspectRatio}`
              : `Arte Criativa Pronta • Formato ${piece.aspectRatio}`}
          </span>
          <h3 className="text-sm font-bold text-white truncate mt-0.5">
            {piece.headline || piece.title}
          </h3>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
            GPT Image 2.5
          </span>
        </div>
      </div>

      {/* Preview: Carrossel ou Peça Única */}
      {isCarousel && piece.carouselSlides && piece.carouselSlides.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {piece.carouselSlides.map((slide) => (
              <div
                key={slide.slideId || slide.slideIndex}
                className="shrink-0 w-44 bg-[#0B0F17] rounded-xl border border-zinc-800 p-2 space-y-2 group"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-[#CEF52A]">Lâmina {slide.slideIndex + 1}</span>
                  <button
                    onClick={() =>
                      handleDownload(
                        slide.previewUrl,
                        `studio-fa_carrossel_lamina-${slide.slideIndex + 1}_${Date.now()}.png`
                      )
                    }
                    className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition"
                    title="Baixar esta lâmina"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                </div>
                <div className="relative aspect-[4/5] rounded-lg overflow-hidden border border-zinc-700/60 bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slide.previewUrl}
                    alt={slide.title}
                    className="w-full h-full object-cover"
                  />
                  <a
                    href={slide.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-1.5 right-1.5 p-1 bg-black/80 hover:bg-black text-white rounded backdrop-blur opacity-0 group-hover:opacity-100 transition"
                    title="Abrir em tamanho real"
                  >
                    <Maximize2 className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[10px] text-zinc-400 truncate text-center">
                  {slide.title}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Preview da Imagem com Qualidade Total */
        <div className="flex justify-center bg-black/70 rounded-xl p-3 border border-zinc-800/80 overflow-hidden relative group">
          <div className={`relative w-full ${aspectClass} rounded-lg overflow-hidden shadow-2xl border border-zinc-700/60 bg-[#0B0F17]`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={piece.previewUrl}
              alt={piece.title}
              className="w-full h-full object-cover select-none"
            />

            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <a
                href={piece.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 bg-black/80 hover:bg-black text-white rounded-md backdrop-blur border border-white/20 flex items-center gap-1 text-[11px]"
                title="Abrir em tamanho real"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Metadados e Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400 bg-[#16181D] p-2.5 rounded-xl border border-zinc-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#CEF52A]" />
          <span>Composição completa com tipografia e estética integradas</span>
          {typeof piece.activeReferencesCount === 'number' && (
            <span className="px-2 py-0.5 bg-[#CEF52A]/10 text-[#CEF52A] rounded-full text-[10px] font-semibold border border-[#CEF52A]/30">
              {piece.activeReferencesCount > 0
                ? `Baseada em ${piece.activeReferencesCount} ${piece.activeReferencesCount === 1 ? 'referência visual' : 'referências visuais'}`
                : 'Sem referências visuais ativas'}
            </span>
          )}
        </div>
        <span className="text-zinc-500 font-mono text-[10px]">
          {new Date(piece.createdAt).toLocaleTimeString('pt-BR')}
        </span>
      </div>

      {/* Drawer de Refinamento / Variação Inline */}
      {showRegenerateInput && (
        <div className="bg-zinc-900 border border-zinc-700 p-3 rounded-xl space-y-2">
          <label className="text-xs font-semibold text-white block">
            Como você quer refinar ou ajustar esta arte?
          </label>
          <input
            type="text"
            placeholder="Ex: deixe a composição mais premium e dê mais destaque à headline..."
            value={variationText}
            onChange={(e) => setVariationText(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-white text-xs outline-none focus:border-[#CEF52A]"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowRegenerateInput(false)}
              className="px-2.5 py-1 text-xs text-zinc-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              onClick={handleTriggerRegenerate}
              disabled={isRegenerating || !variationText.trim()}
              className="px-3 py-1 bg-[#CEF52A] hover:bg-[#b8dd24] text-black font-bold text-xs rounded-lg transition disabled:opacity-50"
            >
              {isRegenerating ? 'Refinando...' : 'Aplicar Refinamento'}
            </button>
          </div>
        </div>
      )}

      {/* Ações Principais da Imagem (Conforme Seção 26):
          - Baixar
          - Salvar em Produções
          - Gerar novamente
          - Usar como referência
      */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
        {/* 1. BAIXAR */}
        {isCarousel ? (
          <button
            onClick={handleDownloadAllSlides}
            disabled={isDownloading}
            className="py-2.5 px-3 bg-[#CEF52A] hover:bg-[#b8dd24] text-black font-bold text-xs rounded-xl transition shadow flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isDownloading ? 'Baixando...' : 'Baixar Todas'}</span>
          </button>
        ) : (
          <button
            onClick={() => handleDownload()}
            disabled={isDownloading}
            className="py-2.5 px-3 bg-[#CEF52A] hover:bg-[#b8dd24] text-black font-bold text-xs rounded-xl transition shadow flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isDownloading ? 'Baixando...' : 'Baixar'}</span>
          </button>
        )}

        {/* 2. SALVAR EM PRODUÇÕES */}
        <button
          onClick={handleSaveProduction}
          disabled={isSavingProduction || Boolean(savedProductionId)}
          className={`py-2.5 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 ${
            savedProductionId
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
          }`}
        >
          {savedProductionId ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isCarousel ? 'Carrossel Salvo' : 'Salva'}</span>
            </>
          ) : (
            <>
              <FolderKanban className="w-3.5 h-3.5 text-[#CEF52A]" />
              <span>{isSavingProduction ? 'Salvando...' : isCarousel ? 'Salvar Carrossel' : 'Salvar'}</span>
            </>
          )}
        </button>

        {/* 3. GERAR NOVAMENTE / REFINAR */}
        <button
          onClick={() => setShowRegenerateInput(!showRegenerateInput)}
          disabled={isRegenerating}
          className="py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 border border-zinc-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
          <span>Refinar</span>
        </button>

        {/* 4. USAR COMO REFERÊNCIA */}
        {onUseAsReference ? (
          <button
            onClick={() => onUseAsReference(piece.previewUrl)}
            className="py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 border border-zinc-700"
            title="Usar esta imagem como base para as próximas mensagens"
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-zinc-400" />
            <span>Referência</span>
          </button>
        ) : (
          <Link
            href={`/projects/${savedProductionId || piece.projectId}`}
            className="py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 border border-zinc-700"
          >
            <span>Ver Detalhe</span>
          </Link>
        )}
      </div>

      {/* Confirmação e link direto para Produções quando salvo */}
      {savedProductionId && (
        <div className="flex items-center justify-between p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Arte salva com sucesso em <strong>Produções</strong>!</span>
          </div>
          <Link
            href="/projects"
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg transition text-xs flex items-center gap-1.5 shadow"
          >
            <span>Ver nas Produções</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
