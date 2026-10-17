// src/components/clients/ClientPiecesModal.tsx
'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  X,
  Upload,
  Plus,
  Trash2,
  Sparkles,
  Image as ImageIcon,
  Tag,
  AlertCircle,
  CheckCircle2,
  FolderKanban,
  ZoomIn,
  Palette,
  Type,
  Layout,
  Sliders,
  Check,
  FileCheck2,
} from 'lucide-react';

export interface BrandReferenceItem {
  id: string;
  organization_id: string;
  client_id: string;
  title: string;
  description?: string | null;
  reference_type: string;
  tags: string[];
  image_url: string;
  ai_description?: string | null;
  visual_features?: {
    dominantColors?: string[];
    typographyStyle?: string;
    detectedWeights?: string[];
    layoutDensity?: string;
    aestheticMood?: string;
    contrastLevel?: string;
    compositionGrid?: string;
    keyElements?: string[];
  };
  created_at: string;
}

interface PendingBulkItem {
  id: string;
  file: File;
  previewUrl: string;
  filename: string;
  width: number;
  height: number;
  estimatedFormat: string;
  status: 'pending' | 'analyzing' | 'done' | 'error';
  error?: string;
}

interface ClientPiecesModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: {
    id: string;
    name: string;
    slug: string;
    niche?: string | null;
    logoAsset?: { storage_path: string } | null;
  };
  onCountChange?: (newCount: number) => void;
}

const REFERENCE_TYPES = [
  { value: 'instagram_post', label: 'Post Feed' },
  { value: 'carousel', label: 'Carrossel' },
  { value: 'story', label: 'Story / Reels' },
  { value: 'advertisement', label: 'Anúncio' },
  { value: 'cover', label: 'Capa / Banner' },
  { value: 'other', label: 'Outro' },
];

function estimateFormatLabel(width: number, height: number): string {
  if (width && height && height > 0) {
    const ratio = width / height;
    if (ratio <= 0.65) return 'Story (9:16)';
    if (ratio >= 0.72 && ratio <= 0.88) return 'Feed (4:5 Retrato)';
    if (ratio >= 0.92 && ratio <= 1.08) return 'Feed (1:1 Quadrado)';
    if (ratio >= 1.25) return 'Banner (16:9)';
  }
  return 'Post Feed';
}

export function ClientPiecesModal({
  isOpen,
  onClose,
  client,
  onCountChange,
}: ClientPiecesModalProps) {
  const [pieces, setPieces] = useState<BrandReferenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  // Bulk Upload State
  const [pendingItems, setPendingItems] = useState<PendingBulkItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState<{ current: number; total: number; filename: string } | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSuccessToast, setBulkSuccessToast] = useState<string | null>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // Modals for Inspection & Zoom
  const [selectedPieceForAnalysis, setSelectedPieceForAnalysis] = useState<BrandReferenceItem | null>(null);
  const [zoomedImage, setZoomedImage] = useState<BrandReferenceItem | null>(null);

  const fetchPieces = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/clients/${client.id}/references`);
      const data = await res.json();
      if (data.references) {
        setPieces(data.references);
        if (onCountChange) onCountChange(data.references.length);
      }
    } catch (err) {
      console.error('Erro ao buscar referências do cliente:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPieces();
    }
  }, [isOpen, client.id]);

  if (!isOpen) return null;

  // Handle file selection (Multi-file)
  const processFiles = (files: FileList | File[]) => {
    const validImageFiles = Array.from(files).filter((file) =>
      file.type.startsWith('image/')
    );

    if (validImageFiles.length === 0) {
      setBulkError('Selecione arquivos de imagem válidos (PNG, JPG, WEBP).');
      return;
    }

    setBulkError(null);

    validImageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const previewUrl = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const w = img.naturalWidth || 1080;
          const h = img.naturalHeight || 1080;
          const formatLabel = estimateFormatLabel(w, h);

          setPendingItems((prev) => [
            ...prev,
            {
              id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              file,
              previewUrl,
              filename: file.name,
              width: w,
              height: h,
              estimatedFormat: formatLabel,
              status: 'pending',
            },
          ]);
        };
        img.src = previewUrl;
      };
      reader.readAsDataURL(file);
    });

    if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
  };

  const handleBulkFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleRemovePendingItem = (id: string) => {
    setPendingItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Run Bulk AI Analysis & Upload
  const handleStartBulkAnalysis = async () => {
    if (pendingItems.length === 0 || isProcessing) return;

    try {
      setIsProcessing(true);
      setBulkError(null);

      const itemsToProcess = pendingItems.filter((i) => i.status !== 'done');
      const total = itemsToProcess.length;

      // Process in smaller batches of 3 or one-by-one with live progress
      for (let index = 0; index < total; index++) {
        const item = itemsToProcess[index];

        // Update item status to analyzing
        setPendingItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: 'analyzing' } : i))
        );
        setProcessProgress({
          current: index + 1,
          total,
          filename: item.filename,
        });

        // Call the bulk analysis API with this item
        const res = await fetch(`/api/clients/${client.id}/references/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pieces: [
              {
                imageUrl: item.previewUrl,
                filename: item.filename,
                width: item.width,
                height: item.height,
              },
            ],
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          setPendingItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, status: 'error', error: errData.error?.message || 'Falha na análise' }
                : i
            )
          );
        } else {
          setPendingItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, status: 'done' } : i))
          );
        }
      }

      setBulkSuccessToast(`${total} ${total === 1 ? 'peça analisada' : 'peças analisadas'} com sucesso pela IA!`);
      setTimeout(() => setBulkSuccessToast(null), 5000);

      // Clear pending queue after brief moment
      setTimeout(() => {
        setPendingItems([]);
      }, 1200);

      // Refresh gallery
      await fetchPieces();
    } catch (err: any) {
      setBulkError(err.message || 'Falha ao processar peças em lote.');
    } finally {
      setIsProcessing(false);
      setProcessProgress(null);
    }
  };

  const handleDeletePiece = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Deseja realmente remover esta peça de referência?')) return;

    try {
      const res = await fetch(`/api/clients/${client.id}/references?referenceId=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setPieces((prev) => {
          const updated = prev.filter((p) => p.id !== id);
          if (onCountChange) onCountChange(updated.length);
          return updated;
        });
      }
    } catch (err) {
      console.error('Falha ao excluir peça:', err);
    }
  };

  const filteredPieces = pieces.filter((p) => {
    if (activeFilter === 'all') return true;
    return p.reference_type === activeFilter;
  });

  const getTypeLabel = (type: string) => {
    const found = REFERENCE_TYPES.find((t) => t.value === type);
    return found ? found.label : type;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/90 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-900 border border-gray-200 flex items-center justify-center font-bold text-xs text-[#CEF52A] overflow-hidden shadow-2xs">
              {client.logoAsset?.storage_path ? (
                <img
                  src={client.logoAsset.storage_path}
                  alt={client.name}
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                client.name.substring(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900 text-sm">{client.name}</h3>
                <span className="text-[11px] font-mono text-gray-400">@{client.slug}</span>
                {client.niche && (
                  <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-medium">
                    {client.niche}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-black" />
                <span>
                  Memória Visual & Peças de Referência ({pieces.length}{' '}
                  {pieces.length === 1 ? 'peça' : 'peças'})
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* TOASTS / ALERTS */}
          {bulkSuccessToast && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs flex items-center gap-2.5 animate-in slide-in-from-top-1 duration-150">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-medium">{bulkSuccessToast}</span>
            </div>
          )}

          {bulkError && (
            <div className="p-3.5 bg-red-50 border border-red-300 rounded-xl text-red-800 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{bulkError}</span>
            </div>
          )}

          {/* BULK UPLOAD ZONE (PROMINENT ZERO-FRICTION) */}
          <div className="bg-zinc-950 text-white rounded-2xl border border-zinc-800 p-5 space-y-4 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#CEF52A]/10 border border-[#CEF52A]/30 flex items-center justify-center text-[#CEF52A]">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Upload em Massa com Análise de IA
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    Suba várias peças de uma vez. A IA detecta formato, estilo, paleta e tipografia automaticamente.
                  </p>
                </div>
              </div>

              {pendingItems.length > 0 && !isProcessing && (
                <button
                  type="button"
                  onClick={() => setPendingItems([])}
                  className="text-[11px] text-zinc-400 hover:text-red-400 transition"
                >
                  Limpar seleção ({pendingItems.length})
                </button>
              )}
            </div>

            {/* Hidden Input for Multiple Files */}
            <input
              ref={bulkFileInputRef}
              type="file"
              multiple
              accept="image/png, image/jpeg, image/webp"
              onChange={handleBulkFileInput}
              className="hidden"
              id="bulk-pieces-input"
            />

            {/* Drop Area */}
            {pendingItems.length === 0 ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => bulkFileInputRef.current?.click()}
                className={`cursor-pointer border-2 border-dashed rounded-xl p-8 text-center transition flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-[#CEF52A] bg-[#CEF52A]/5'
                    : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 hover:bg-zinc-900'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#CEF52A] shadow-inner">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-100">
                    Arraste ou clique para selecionar <span className="text-[#CEF52A]">múltiplas peças</span>
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-1 max-w-md mx-auto">
                    Selecione 1, 5, 10 ou 30 imagens simultaneamente (PNG, JPG ou WEBP).
                    Não é necessário preencher títulos ou formatos manualmente.
                  </p>
                </div>
                <button
                  type="button"
                  className="mt-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition"
                >
                  <Plus className="w-3.5 h-3.5 text-[#CEF52A]" />
                  <span>Escolher Arquivos em Massa</span>
                </button>
              </div>
            ) : (
              /* Pending Queue List & Actions */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-300">
                      {pendingItems.length} {pendingItems.length === 1 ? 'peça selecionada' : 'peças selecionadas'}:
                    </span>
                    <button
                      type="button"
                      onClick={() => bulkFileInputRef.current?.click()}
                      disabled={isProcessing}
                      className="text-[11px] text-[#CEF52A] hover:underline flex items-center gap-1 disabled:opacity-50"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Adicionar mais</span>
                    </button>
                  </div>

                  {/* Primary Submit Button */}
                  <button
                    type="button"
                    onClick={handleStartBulkAnalysis}
                    disabled={isProcessing || pendingItems.length === 0}
                    className="px-5 py-2.5 bg-[#CEF52A] hover:bg-[#bce022] text-black font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-md disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        <span>Analisando com IA...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-black" />
                        <span>Analisar e Salvar {pendingItems.length} Peças com IA</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Progress Bar (during analysis) */}
                {processProgress && (
                  <div className="p-3.5 bg-zinc-900 rounded-xl border border-zinc-800 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
                        <span className="w-2 h-2 rounded-full bg-[#CEF52A] animate-ping" />
                        <span>
                          Processando {processProgress.current} de {processProgress.total}:{' '}
                          <strong className="text-white">{processProgress.filename}</strong>
                        </span>
                      </span>
                      <span className="text-[#CEF52A] font-mono font-bold">
                        {Math.round((processProgress.current / processProgress.total) * 100)}%
                      </span>
                    </div>

                    <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#CEF52A] h-full transition-all duration-300 rounded-full"
                        style={{
                          width: `${(processProgress.current / processProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-zinc-500">
                      Extraindo paleta cromática, pesos tipográficos, layout e diretrizes de estilo da marca...
                    </p>
                  </div>
                )}

                {/* Pending Grid Previews */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-56 overflow-y-auto pr-1">
                  {pendingItems.map((item) => (
                    <div
                      key={item.id}
                      className={`relative group bg-zinc-900 rounded-xl border overflow-hidden flex flex-col ${
                        item.status === 'analyzing'
                          ? 'border-[#CEF52A] ring-1 ring-[#CEF52A]'
                          : item.status === 'done'
                          ? 'border-emerald-500'
                          : 'border-zinc-800'
                      }`}
                    >
                      <div className="aspect-square bg-black flex items-center justify-center p-1.5 relative">
                        <img
                          src={item.previewUrl}
                          alt={item.filename}
                          className="w-full h-full object-contain"
                        />

                        {/* Status Overlay */}
                        {item.status === 'analyzing' && (
                          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-1">
                            <span className="w-4 h-4 border-2 border-[#CEF52A] border-t-transparent rounded-full animate-spin" />
                            <span className="text-[9px] text-[#CEF52A] font-bold">IA Analisando</span>
                          </div>
                        )}
                        {item.status === 'done' && (
                          <div className="absolute top-1.5 right-1.5 bg-emerald-500 text-black rounded-full p-0.5 shadow">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <div className="p-2 text-left bg-zinc-900 border-t border-zinc-800/60 flex-1 flex flex-col justify-between">
                        <div>
                          <p className="text-[10px] font-medium text-zinc-200 truncate" title={item.filename}>
                            {item.filename}
                          </p>
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-zinc-800 text-[#CEF52A] rounded text-[9px] font-mono">
                            {item.estimatedFormat}
                          </span>
                        </div>

                        {!isProcessing && item.status !== 'done' && (
                          <button
                            type="button"
                            onClick={() => handleRemovePendingItem(item.id)}
                            className="text-[10px] text-zinc-500 hover:text-red-400 mt-1 flex items-center gap-1 transition"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                            <span>Remover</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* GALLERY SECTION */}
          <div className="space-y-4">
            {/* Gallery Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Galeria de Peças Analisadas
                </span>
                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-bold">
                  {filteredPieces.length}
                </span>
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition ${
                    activeFilter === 'all'
                      ? 'bg-black text-[#CEF52A] font-bold'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Todas ({pieces.length})
                </button>
                {REFERENCE_TYPES.map((t) => {
                  const count = pieces.filter((p) => p.reference_type === t.value).length;
                  if (count === 0 && activeFilter !== t.value) return null;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setActiveFilter(t.value)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition ${
                        activeFilter === t.value
                          ? 'bg-black text-[#CEF52A] font-bold'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {t.label} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grid */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="aspect-square bg-gray-200 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredPieces.length === 0 ? (
              <div className="text-center py-12 px-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center mx-auto text-gray-500">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-gray-800 text-sm">
                  Nenhuma peça de referência encontrada
                </h4>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  Utilize o campo de upload acima para subir as artes desta marca em massa.
                  A IA analisará o estilo, tipografia, cores e composição de cada uma para enriquecer a criação automática.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredPieces.map((piece) => (
                  <div
                    key={piece.id}
                    className="bg-white rounded-xl border border-gray-200 hover:border-black/40 overflow-hidden shadow-2xs group flex flex-col justify-between transition-all"
                  >
                    {/* Image Thumbnail Container */}
                    <div
                      onClick={() => setZoomedImage(piece)}
                      className="relative aspect-square bg-zinc-950 cursor-pointer overflow-hidden flex items-center justify-center"
                    >
                      <img
                        src={piece.image_url}
                        alt={piece.title}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                      />

                      {/* Top Badges */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        <span className="px-2 py-0.5 bg-black/80 backdrop-blur-xs text-[#CEF52A] text-[10px] font-bold rounded-md uppercase tracking-wider">
                          {getTypeLabel(piece.reference_type)}
                        </span>
                        {piece.visual_features && (
                          <span className="px-1.5 py-0.5 bg-[#CEF52A] text-black text-[9px] font-extrabold rounded-md flex items-center gap-1 shadow-xs">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>IA Analisada</span>
                          </span>
                        )}
                      </div>

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="p-2 bg-white/95 text-black rounded-full shadow-lg">
                          <ZoomIn className="w-4 h-4" />
                        </span>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-gray-900 text-xs truncate" title={piece.title}>
                          {piece.title}
                        </h4>
                        {piece.description && (
                          <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">
                            {piece.description}
                          </p>
                        )}
                      </div>

                      {/* Dominant Colors Preview (if analyzed by AI) */}
                      {piece.visual_features?.dominantColors && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <span className="text-[10px] text-gray-400 font-mono">Paleta:</span>
                          <div className="flex items-center gap-1">
                            {piece.visual_features.dominantColors.slice(0, 4).map((color, idx) => (
                              <span
                                key={idx}
                                className="w-3.5 h-3.5 rounded-full border border-gray-300 shadow-2xs"
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tags */}
                      {piece.tags && piece.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {piece.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action Footer */}
                    <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => handleDeletePiece(piece.id, e)}
                          className="text-gray-400 hover:text-red-600 p-1 rounded transition"
                          title="Excluir peça"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setSelectedPieceForAnalysis(piece)}
                          className="text-[11px] font-semibold text-zinc-700 hover:text-black p-1 flex items-center gap-1 rounded hover:bg-gray-200 transition"
                          title="Ver análise completa da IA"
                        >
                          <Sparkles className="w-3 h-3 text-purple-600" />
                          <span>Análise IA</span>
                        </button>
                      </div>

                      <Link
                        href={`/create?client=${client.id}`}
                        className="text-[11px] font-bold text-black hover:text-zinc-700 flex items-center gap-1 transition"
                      >
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        <span>Criar Arte</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <span className="text-[11px] text-gray-500">
            Peças adicionadas alimentam a Memória Visual do Studio FA para garantir coerência criativa em todas as gerações.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-xl text-xs font-semibold transition"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* AI ANALYSIS DETAILS MODAL */}
      {selectedPieceForAnalysis && (
        <div
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedPieceForAnalysis(null)}
        >
          <div
            className="bg-zinc-950 text-white rounded-2xl border border-zinc-800 shadow-2xl max-w-2xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#CEF52A] text-black flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{selectedPieceForAnalysis.title}</h3>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    Formato: {getTypeLabel(selectedPieceForAnalysis.reference_type)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedPieceForAnalysis(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-900 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thumbnail Preview & Description */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-4 bg-black rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center aspect-square">
                <img
                  src={selectedPieceForAnalysis.image_url}
                  alt={selectedPieceForAnalysis.title}
                  className="w-full h-full object-contain p-2"
                />
              </div>

              <div className="sm:col-span-8 space-y-3">
                <div>
                  <span className="text-[11px] font-bold text-[#CEF52A] uppercase tracking-wider block mb-1">
                    Análise e Direção Criativa por IA
                  </span>
                  <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
                    {selectedPieceForAnalysis.ai_description ||
                      selectedPieceForAnalysis.description ||
                      'Análise de composição visual estruturada pelo motor de IA do Studio FA.'}
                  </p>
                </div>

                {/* Dominant Palette */}
                {selectedPieceForAnalysis.visual_features?.dominantColors && (
                  <div>
                    <span className="text-[11px] font-bold text-zinc-400 flex items-center gap-1 mb-1.5">
                      <Palette className="w-3 h-3 text-[#CEF52A]" />
                      <span>Paleta Cromática Extraída</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedPieceForAnalysis.visual_features.dominantColors.map((hex, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-lg"
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20"
                            style={{ backgroundColor: hex }}
                          />
                          <span className="text-[10px] font-mono text-zinc-300">{hex}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Visual Features Breakdown */}
            {selectedPieceForAnalysis.visual_features && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-800/80">
                {/* Typography */}
                <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    <Type className="w-3.5 h-3.5 text-[#CEF52A]" />
                    <span>Estilo Tipográfico</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    {selectedPieceForAnalysis.visual_features.typographyStyle || 'Sans-serif moderna'}
                  </p>
                  {selectedPieceForAnalysis.visual_features.detectedWeights && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {selectedPieceForAnalysis.visual_features.detectedWeights.map((w, idx) => (
                        <span key={idx} className="text-[9px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded">
                          {w}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Composition & Layout */}
                <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    <Layout className="w-3.5 h-3.5 text-[#CEF52A]" />
                    <span>Diagramação & Grid</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    {selectedPieceForAnalysis.visual_features.compositionGrid || 'Grid estruturado com respiro visual'}
                  </p>
                  <div className="flex items-center gap-2 pt-1 text-[10px] text-zinc-400 font-mono">
                    <span>Densidade: {selectedPieceForAnalysis.visual_features.layoutDensity || 'equilibrado'}</span>
                    <span>•</span>
                    <span>Contraste: {selectedPieceForAnalysis.visual_features.contrastLevel || 'alto'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tags */}
            {selectedPieceForAnalysis.tags && selectedPieceForAnalysis.tags.length > 0 && (
              <div>
                <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1 mb-1.5">
                  <Tag className="w-3 h-3" />
                  <span>Tags Visuais Reconhecidas</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedPieceForAnalysis.tags.map((t, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] bg-zinc-900 text-zinc-300 border border-zinc-800 px-2 py-0.5 rounded-md font-mono"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setSelectedPieceForAnalysis(null)}
                className="px-4 py-2 bg-white text-black font-bold text-xs rounded-xl hover:bg-zinc-200 transition"
              >
                Concluir Visualização
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL IMAGE ZOOM MODAL */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="max-w-4xl max-h-[90vh] bg-zinc-900 rounded-2xl overflow-hidden flex flex-col border border-zinc-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between text-white bg-zinc-950">
              <span className="font-bold text-xs">{zoomedImage.title}</span>
              <button
                onClick={() => setZoomedImage(null)}
                className="p-1 text-zinc-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 p-2 flex items-center justify-center overflow-auto bg-black">
              <img
                src={zoomedImage.image_url}
                alt={zoomedImage.title}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
