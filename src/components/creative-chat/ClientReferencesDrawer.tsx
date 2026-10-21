// src/components/creative-chat/ClientReferencesDrawer.tsx
'use client';

import React, { useState } from 'react';
import { X, Check, Image as ImageIcon, Upload, Star, Layers, Sparkles } from 'lucide-react';

export interface ClientReferenceItem {
  id: string;
  title: string;
  imageUrl: string;
  pieceType: string;
  formatType?: string;
  qualityScore?: number;
}

interface ClientReferencesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pieces: ClientReferenceItem[];
  selectedPieceIds: string[];
  onTogglePiece: (pieceId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onUploadCustom: (file: File, isLayoutPrint: boolean) => Promise<void>;
  onConfirmSelection?: (selectedPieceIds: string[]) => void;
  isUploading?: boolean;
}

export function ClientReferencesDrawer({
  isOpen,
  onClose,
  pieces,
  selectedPieceIds,
  onTogglePiece,
  onSelectAll,
  onClearSelection,
  onUploadCustom,
  onConfirmSelection,
  isUploading,
}: ClientReferencesDrawerProps) {
  const [filterType, setFilterType] = useState<'all' | 'own_brand' | 'promotional' | 'external_reference'>('all');

  if (!isOpen) return null;

  const filtered = pieces.filter((p) => {
    if (filterType === 'all') return true;
    return p.pieceType === filterType;
  });

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>, isLayoutPrint: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      await onUploadCustom(file, isLayoutPrint);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#101216] border-l border-zinc-800 h-full flex flex-col shadow-2xl text-zinc-200">
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#CEF52A]" />
              <span>Memória Visual & Referências</span>
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Selecione as referências do cliente para orientar a IA
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Uploads Rápidos de Prints e Referências */}
        <div className="p-4 border-b border-zinc-800/80 bg-[#14171D] space-y-2">
          <span className="text-[11px] font-semibold text-zinc-300 block">
            Adicionar Novas Entradas à Sessão
          </span>
          <div className="grid grid-cols-2 gap-2">
            <label className="p-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 rounded-xl cursor-pointer flex flex-col items-center justify-center text-center transition group">
              <Upload className="w-4 h-4 text-[#CEF52A] mb-1 group-hover:scale-110 transition" />
              <span className="text-xs font-semibold text-white">Nova Referência</span>
              <span className="text-[9px] text-zinc-500">Imagem da marca</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isUploading}
                onChange={(e) => handleFileInput(e, false)}
              />
            </label>

            <label className="p-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 rounded-xl cursor-pointer flex flex-col items-center justify-center text-center transition group">
              <Sparkles className="w-4 h-4 text-purple-400 mb-1 group-hover:scale-110 transition" />
              <span className="text-xs font-semibold text-white">Print de Layout</span>
              <span className="text-[9px] text-zinc-500">Guia de estrutura</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isUploading}
                onChange={(e) => handleFileInput(e, true)}
              />
            </label>
          </div>
          {isUploading && (
            <div className="text-[11px] text-[#CEF52A] flex items-center gap-1.5 justify-center pt-1 animate-pulse">
              <span>Processando upload e registrando na memória...</span>
            </div>
          )}
        </div>

        {/* Barra de Filtros e Seleção Rápida */}
        <div className="px-4 py-2.5 border-b border-zinc-800/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={onSelectAll}
              className="text-[#CEF52A] hover:underline font-semibold text-[11px]"
            >
              Marcar Todas ({pieces.length})
            </button>
            <span className="text-zinc-600">•</span>
            <button
              onClick={onClearSelection}
              className="text-zinc-400 hover:text-white text-[11px]"
            >
              Desmarcar
            </button>
          </div>

          <span className="text-[11px] bg-[#CEF52A]/10 text-[#CEF52A] px-2 py-0.5 rounded font-mono font-bold">
            {selectedPieceIds.length} selecionadas
          </span>
        </div>

        {/* Galeria de Peças com Checkbox */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {pieces.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-xs">
              <ImageIcon className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
              <p>Nenhuma peça de referência cadastrada para este cliente.</p>
              <p className="text-[11px] text-zinc-600 mt-1">
                Envie prints ou imagens nos botões acima.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {filtered.map((piece) => {
                const isSelected = selectedPieceIds.includes(piece.id);
                return (
                  <div
                    key={piece.id}
                    onClick={() => onTogglePiece(piece.id)}
                    className={`relative rounded-xl overflow-hidden border cursor-pointer transition select-none group aspect-[4/5] bg-black ${
                      isSelected
                        ? 'border-[#CEF52A] shadow-md ring-2 ring-[#CEF52A]/30'
                        : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    {/* Imagem */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={piece.imageUrl}
                      alt={piece.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

                    {/* Checkmark Indicator */}
                    <div className="absolute top-2 right-2">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center border transition ${
                          isSelected
                            ? 'bg-[#CEF52A] border-[#CEF52A] text-black font-bold'
                            : 'bg-black/60 border-white/20 text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    {/* Footer Title */}
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-[11px] font-bold text-white truncate drop-shadow">
                        {piece.title}
                      </p>
                      <span className="text-[9px] text-zinc-400 block uppercase tracking-wider">
                        {piece.pieceType === 'own_brand'
                          ? 'Marca Própria'
                          : piece.pieceType === 'promotional'
                          ? 'Promocional'
                          : 'Referência Externa'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer com CTA de confirmação */}
        <div className="p-4 border-t border-zinc-800 flex items-center justify-between bg-[#121418]">
          <span className="text-xs text-zinc-400">
            {selectedPieceIds.length} {selectedPieceIds.length === 1 ? 'peça ativa' : 'peças ativas'} no chat
          </span>
          <button
            onClick={() => {
              if (onConfirmSelection) {
                onConfirmSelection(selectedPieceIds);
              }
              onClose();
            }}
            className="px-4 py-2 bg-[#CEF52A] hover:bg-[#b8dd24] text-black font-bold text-xs rounded-xl transition shadow"
          >
            Confirmar Seleção
          </button>
        </div>
      </div>
    </div>
  );
}
