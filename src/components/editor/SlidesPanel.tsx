'use client';

import React from 'react';
import {
  Plus,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { FormatDefinition } from '@/config/formats';

export interface SlideItem {
  id: string;
  slide_index: number;
  slide_type?: string | null;
  title?: string | null;
  subtitle?: string | null;
  status: string;
}

interface SlidesPanelProps {
  slides: SlideItem[];
  activeSlideId: string;
  onSelectSlide: (slideId: string) => void;
  onAddSlide: () => void;
  onDuplicateSlide: (slideId: string) => void;
  onDeleteSlide: (slideId: string) => void;
  onMoveSlide: (index: number, direction: 'up' | 'down') => void;
  format: FormatDefinition;
  clientName: string;
}

export function SlidesPanel({
  slides,
  activeSlideId,
  onSelectSlide,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onMoveSlide,
  format,
  clientName,
}: SlidesPanelProps) {
  const sortedSlides = [...slides].sort((a, b) => a.slide_index - b.slide_index);

  return (
    <aside className="w-64 bg-fa-dark border-r border-fa-border flex flex-col justify-between shrink-0 h-full overflow-hidden select-none">
      {/* Header Info */}
      <div className="p-4 border-b border-fa-border">
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
          Cliente
        </div>
        <div className="text-sm font-bold text-white truncate">{clientName}</div>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
          <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-[11px]">
            {format.name}
          </span>
          <span>{slides.length} {slides.length === 1 ? 'lâmina' : 'lâminas'}</span>
        </div>
      </div>

      {/* Slide Thumbnails List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {sortedSlides.map((slide, idx) => {
          const isActive = slide.id === activeSlideId;

          return (
            <div
              key={slide.id}
              onClick={() => onSelectSlide(slide.id)}
              className={`group relative p-2.5 rounded-xl border transition-all cursor-pointer ${
                isActive
                  ? 'bg-white/15 border-fa-green text-white shadow-lg'
                  : 'bg-white/5 border-transparent text-gray-300 hover:bg-white/10 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      isActive ? 'bg-fa-green text-black' : 'bg-gray-800 text-gray-300'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-xs font-semibold capitalize truncate max-w-[110px]">
                    {slide.slide_type || `Lâmina ${idx + 1}`}
                  </span>
                </div>

                {/* Move arrows on hover */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    disabled={idx === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveSlide(idx, 'up');
                    }}
                    className="p-1 hover:text-white disabled:opacity-30"
                    title="Mover para cima"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={idx === sortedSlides.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveSlide(idx, 'down');
                    }}
                    className="p-1 hover:text-white disabled:opacity-30"
                    title="Mover para baixo"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Mini Preview Box */}
              <div
                className={`w-full aspect-[4/5] rounded-lg bg-black/50 border flex flex-col justify-center items-center p-2 text-center overflow-hidden ${
                  isActive ? 'border-fa-green/50' : 'border-gray-800'
                }`}
              >
                {slide.title ? (
                  <p className="text-[10px] text-gray-200 line-clamp-3 font-medium">
                    {slide.title}
                  </p>
                ) : (
                  <Layers className="w-4 h-4 text-gray-600" />
                )}
                {slide.status === 'generating' && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center gap-1.5 text-[10px] text-fa-green font-medium animate-pulse">
                    <Sparkles className="w-3.5 h-3.5" />
                    Gerando...
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-1 mt-2 pt-1 border-t border-white/5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicateSlide(slide.id);
                  }}
                  className="p-1 text-gray-400 hover:text-white rounded"
                  title="Duplicar lâmina"
                >
                  <Copy className="w-3 h-3" />
                </button>
                {sortedSlides.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSlide(slide.id);
                    }}
                    className="p-1 text-gray-400 hover:text-red-400 rounded"
                    title="Excluir lâmina"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Slide Button */}
      <div className="p-3 border-t border-fa-border bg-fa-dark">
        <button
          onClick={onAddSlide}
          className="w-full py-2.5 px-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-white/10"
        >
          <Plus className="w-3.5 h-3.5 text-fa-green" />
          <span>Adicionar Lâmina</span>
        </button>
      </div>
    </aside>
  );
}
