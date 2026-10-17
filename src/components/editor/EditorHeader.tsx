'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface EditorHeaderProps {
  title: string;
  clientName?: string;
  clientBrandStatus?: string;
  projectStatus: string;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  showSafeAreas: boolean;
  onToggleSafeAreas: () => void;
  onTitleChange: (newTitle: string) => void;
  onBrandCheck: () => void;
  onExport: () => void;
  onApprove: () => void;
  isExporting?: boolean;
  isApproving?: boolean;
}

export function EditorHeader({
  title,
  clientName,
  clientBrandStatus,
  projectStatus,
  saveStatus,
  zoom,
  onZoomChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  showSafeAreas,
  onToggleSafeAreas,
  onTitleChange,
  onBrandCheck,
  onExport,
  onApprove,
  isExporting = false,
  isApproving = false,
}: EditorHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(title);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (currentTitle.trim() && currentTitle !== title) {
      onTitleChange(currentTitle.trim());
    } else {
      setCurrentTitle(title);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800 font-medium">Aprovado</span>;
      case 'in_review':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-amber-950/60 text-amber-400 border border-amber-800 font-medium">Em Revisão</span>;
      case 'exported':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-blue-950/60 text-blue-400 border border-blue-800 font-medium">Exportado</span>;
      default:
        return <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-medium">Rascunho</span>;
    }
  };

  return (
    <header className="h-14 bg-[#0F1113] border-b border-zinc-800 px-4 flex items-center justify-between select-none z-20">
      {/* Left section: Breadcrumb & Title */}
      <div className="flex items-center gap-3">
        <Link
          href="/projects"
          className="text-zinc-400 hover:text-white p-1.5 rounded-md hover:bg-zinc-800/60 transition-colors flex items-center gap-1 text-xs"
          title="Voltar para Produções"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">Projetos</span>
        </Link>

        <div className="h-4 w-px bg-zinc-700" />

        {/* Project Title & Client */}
        <div className="flex items-center gap-2">
          {clientName && (
            <span className="text-xs font-semibold text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/60">
              {clientName}
            </span>
          )}

          {isEditingTitle ? (
            <input
              type="text"
              value={currentTitle}
              onChange={(e) => setCurrentTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
              autoFocus
              className="bg-zinc-900 text-white text-sm font-medium px-2 py-0.5 rounded border border-[#CEF52A] outline-none w-48 sm:w-64"
            />
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="text-white text-sm font-medium hover:text-[#CEF52A] transition-colors flex items-center gap-1.5 group max-w-[200px] sm:max-w-xs truncate"
              title="Clique para renomear"
            >
              <span className="truncate">{title}</span>
              <svg className="w-3.5 h-3.5 text-zinc-500 group-hover:text-[#CEF52A] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}

          {getStatusBadge(projectStatus)}
        </div>

        {/* Autosave status indicator */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs ml-2">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Salvando...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-zinc-400">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Salvo
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1 text-rose-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Erro ao salvar
            </span>
          )}
        </div>
      </div>

      {/* Middle section: Undo, Redo, Zoom, Safe Area */}
      <div className="flex items-center gap-1 bg-zinc-900/80 px-2 py-1 rounded-lg border border-zinc-800">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 hover:bg-zinc-800 transition"
          title="Desfazer (Ctrl+Z)"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2m-15-7l4-4m-4 4l4 4" />
          </svg>
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 hover:bg-zinc-800 transition"
          title="Refazer (Ctrl+Y)"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4" />
          </svg>
        </button>

        <div className="h-3 w-px bg-zinc-700 mx-1" />

        {/* Zoom controls */}
        <button
          onClick={() => onZoomChange(Math.max(0.2, zoom - 0.1))}
          className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 text-xs"
          title="Diminuir Zoom"
        >
          -
        </button>
        <span className="text-xs text-zinc-300 w-10 text-center font-mono">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => onZoomChange(Math.min(1.5, zoom + 0.1))}
          className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 text-xs"
          title="Aumentar Zoom"
        >
          +
        </button>
        <button
          onClick={() => onZoomChange(0.6)}
          className="px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition"
          title="Ajustar à tela"
        >
          Ajustar
        </button>

        <div className="h-3 w-px bg-zinc-700 mx-1" />

        {/* Safe Area Guides Toggle */}
        <button
          onClick={onToggleSafeAreas}
          className={`px-2 py-0.5 text-xs rounded transition flex items-center gap-1 ${
            showSafeAreas ? 'bg-[#CEF52A]/20 text-[#CEF52A] border border-[#CEF52A]/40' : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title="Exibir/Ocultar Guias de Margem Segura"
        >
          <span className="w-2 h-2 rounded-full border border-current" />
          <span className="hidden md:inline">Margens</span>
        </button>
      </div>

      {/* Right section: Brand Check, Export, Approve */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBrandCheck}
          className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors flex items-center gap-1.5"
          title="Executar verificação de conformidade de marca"
        >
          <svg className="w-3.5 h-3.5 text-[#CEF52A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="hidden sm:inline">Brand Check</span>
        </button>

        <button
          onClick={onExport}
          disabled={isExporting}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs font-medium text-white hover:bg-zinc-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>{isExporting ? 'Exportando...' : 'Exportar'}</span>
        </button>

        <button
          onClick={onApprove}
          disabled={isApproving || projectStatus === 'approved'}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            projectStatus === 'approved'
              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800 cursor-default'
              : 'bg-[#CEF52A] text-[#0F1113] hover:bg-[#b8dd24] shadow-sm'
          } disabled:opacity-60`}
          title="Aprovar produção e incorporar à memória visual do cliente"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span>{projectStatus === 'approved' ? 'Aprovado' : isApproving ? 'Aprovando...' : 'Aprovar'}</span>
        </button>
      </div>
    </header>
  );
}
