// src/components/creative-chat/ReferencePickerModal.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { X, Check, Image as ImageIcon, Sparkles, ExternalLink } from 'lucide-react';
import type { ClientReferenceItem } from './ClientReferencesDrawer';

interface ReferencePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  clientId: string;
  pieces: ClientReferenceItem[];
  selectedReferenceId: string | null;
  onSelectReference: (pieceId: string) => void;
}

export function ReferencePickerModal({
  isOpen,
  onClose,
  clientName,
  clientId,
  pieces,
  selectedReferenceId,
  onSelectReference,
}: ReferencePickerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#101216] border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-zinc-200">
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-[#0E1116]">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#CEF52A]" />
              <h3 className="font-bold text-white text-base">
                Selecionar Referência de Estilo
              </h3>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Cliente atual: <strong className="text-white">{clientName}</strong> • Escolha 1 peça para orientar a direção de arte
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diretriz de Estilo (Seção 3) */}
        <div className="px-4 py-2.5 bg-[#14171D] border-b border-zinc-800/80 text-[11px] text-zinc-400 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-[#CEF52A] shrink-0 mt-0.5" />
          <span>
            <strong>Direção de arte:</strong> A IA usará a paleta, o contraste e o estilo visual desta peça para criar uma arte 100% original. Conteúdos e textos literais não serão copiados.
          </span>
        </div>

        {/* Conteúdo / Grid */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {pieces.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  Este cliente ainda não possui referências visuais.
                </h4>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
                  Cadastre peças de referência ou materiais da marca no perfil do cliente para alimentar o repertório visual.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href={`/clients/${clientId}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#CEF52A] hover:bg-[#b8dd24] text-black font-bold text-xs rounded-xl transition shadow"
                >
                  <span>Adicionar referências</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {pieces.map((piece) => {
                const isSelected = selectedReferenceId === piece.id;
                return (
                  <button
                    key={piece.id}
                    type="button"
                    onClick={() => {
                      onSelectReference(piece.id);
                      onClose();
                    }}
                    className={`relative rounded-xl overflow-hidden border text-left cursor-pointer transition select-none group aspect-[4/5] bg-black flex flex-col justify-end p-2.5 ${
                      isSelected
                        ? 'border-[#CEF52A] ring-2 ring-[#CEF52A]/40 shadow-lg scale-[1.01]'
                        : 'border-zinc-800 hover:border-zinc-600'
                    }`}
                  >
                    {/* Imagem */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={piece.imageUrl}
                      alt={piece.title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

                    {/* Checkmark Indicator */}
                    <div className="absolute top-2 right-2">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center border transition ${
                          isSelected
                            ? 'bg-[#CEF52A] border-[#CEF52A] text-black font-black'
                            : 'bg-black/60 border-white/20 text-transparent group-hover:border-white/40'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    {/* Badge e Título */}
                    <div className="relative z-10 space-y-0.5 pointer-events-none">
                      <span className="text-[9px] font-bold text-[#CEF52A] uppercase tracking-wider block">
                        {piece.pieceType === 'own_brand'
                          ? 'Marca Própria'
                          : piece.pieceType === 'promotional'
                          ? 'Promocional'
                          : 'Referência'}
                      </span>
                      <p className="text-xs font-bold text-white truncate drop-shadow">
                        {piece.title}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-[#0E1116] flex items-center justify-between text-xs shrink-0">
          <span className="text-zinc-400">
            {pieces.length} {pieces.length === 1 ? 'referência disponível' : 'referências disponíveis'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition text-xs font-semibold"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
