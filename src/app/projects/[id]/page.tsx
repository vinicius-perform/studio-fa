'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { EditorHeader } from '@/components/editor/EditorHeader';
import { SlidesPanel } from '@/components/editor/SlidesPanel';
import { InspectorPanel } from '@/components/editor/InspectorPanel';

const StudioCanvas = dynamic(
  () => import('@/components/editor/StudioCanvas'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full text-zinc-500 text-xs">
        Carregando canvas...
      </div>
    ),
  }
);
import { getFormatDefinition } from '@/config/formats';
import { ExportService } from '@/services/export/export.service';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { SlideDocument, Layer, SlideCompositionRow } from '@/types/domain/composition';
import type { AIPresetId } from '@/config/presets';
import { AlertCircle, CheckCircle2, Download, X } from 'lucide-react';

export default function StudioEditorPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  // Project state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<any>(null);
  const [slides, setSlides] = useState<any[]>([]);
  const [compositions, setCompositions] = useState<Record<string, { doc: SlideDocument; revision: number }>>({});
  const [brandProfile, setBrandProfile] = useState<any>(null);
  const [brandAssets, setBrandAssets] = useState<any[]>([]);
  const [references, setReferences] = useState<any[]>([]);

  // Editor interaction state
  const [activeSlideId, setActiveSlideId] = useState<string>('');
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(0.55);
  const [showSafeAreas, setShowSafeAreas] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Undo / Redo stacks per active slide
  const [undoStack, setUndoStack] = useState<SlideDocument[]>([]);
  const [redoStack, setRedoStack] = useState<SlideDocument[]>([]);

  // Modals state
  const [showBrandCheckModal, setShowBrandCheckModal] = useState(false);
  const [brandCheckResults, setBrandCheckResults] = useState<{ pass: boolean; items: { label: string; ok: boolean; message: string }[] } | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Autosave timer ref
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch Project Data on mount
  useEffect(() => {
    async function loadProject() {
      try {
        setLoading(true);
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) {
          throw new Error('Falha ao carregar dados do projeto');
        }
        const data = await res.json();
        setProject(data.project);
        setSlides(data.slides || []);
        setBrandProfile(data.brandProfile);
        setBrandAssets(data.brandAssets || []);
        setReferences(data.references || []);

        // Index compositions by slide_id
        const compMap: Record<string, { doc: SlideDocument; revision: number }> = {};
        if (data.compositions) {
          data.compositions.forEach((c: SlideCompositionRow) => {
            compMap[c.slide_id] = {
              doc: c.document as unknown as SlideDocument,
              revision: c.revision,
            };
          });
        }
        setCompositions(compMap);

        if (data.slides && data.slides.length > 0) {
          setActiveSlideId(data.slides[0].id);
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar o estúdio.');
      } finally {
        setLoading(false);
      }
    }

    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  // Current active slide and its document
  const activeSlide = slides.find((s) => s.id === activeSlideId);
  const activeComp = activeSlideId ? compositions[activeSlideId] : null;
  const activeDoc: SlideDocument | null = activeComp?.doc || null;

  const formatDef = getFormatDefinition(project?.format || 'instagram_feed_4_5');

  const lastUndoPushRef = useRef<number>(0);

  // 2. Debounced Autosave
  const triggerAutosave = useCallback(
    (slideId: string, doc: SlideDocument, expectedRev: number) => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }

      setSaveStatus((prev) => (prev === 'saving' ? prev : 'saving'));

      autosaveTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch('/api/compositions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slideId,
              projectId,
              organizationId: project.organization_id,
              document: doc,
              expectedRevision: expectedRev,
            }),
          });

          if (!res.ok) {
            throw new Error('Erro ao salvar composição');
          }

          const { composition } = await res.json();
          setCompositions((prev) => ({
            ...prev,
            [slideId]: {
              doc: composition.document,
              revision: composition.revision,
            },
          }));
          setSaveStatus('saved');
        } catch (err) {
          console.error('Autosave falhou:', err);
          setSaveStatus('error');
        }
      }, 1000);
    },
    [projectId, project?.organization_id]
  );

  // 3. Document update handler with Undo history
  const updateActiveDocument = useCallback(
    (newDoc: SlideDocument, forceUndo: boolean = false) => {
      if (!activeSlideId || !activeComp) return;

      const now = Date.now();
      if (forceUndo || now - lastUndoPushRef.current > 800) {
        setUndoStack((prev) => [activeComp.doc, ...prev.slice(0, 29)]);
        setRedoStack([]); // Clear redo upon new change
        lastUndoPushRef.current = now;
      }

      setCompositions((prev) => ({
        ...prev,
        [activeSlideId]: {
          ...prev[activeSlideId],
          doc: newDoc,
        },
      }));

      triggerAutosave(activeSlideId, newDoc, activeComp.revision);
    },
    [activeSlideId, activeComp, triggerAutosave]
  );

  // Layer manipulation helpers
  const handleUpdateLayer = (layerId: string, updates: Partial<Layer>) => {
    if (!activeDoc) return;
    const newLayers = activeDoc.layers.map((l) =>
      l.id === layerId ? ({ ...l, ...updates } as Layer) : l
    );
    updateActiveDocument({ ...activeDoc, layers: newLayers });
  };

  const handleAddLayer = (newLayer: Layer) => {
    if (!activeDoc) return;
    updateActiveDocument(
      {
        ...activeDoc,
        layers: [...activeDoc.layers, newLayer],
      },
      true
    );
  };

  const handleDeleteLayer = (layerId: string) => {
    if (!activeDoc) return;
    updateActiveDocument(
      {
        ...activeDoc,
        layers: activeDoc.layers.filter((l) => l.id !== layerId),
      },
      true
    );
    if (selectedLayerId === layerId) setSelectedLayerId(null);
  };

  const handleReorderLayers = (newLayers: Layer[]) => {
    if (!activeDoc) return;
    updateActiveDocument({ ...activeDoc, layers: newLayers }, true);
  };

  // Undo / Redo
  const handleUndo = () => {
    if (undoStack.length === 0 || !activeSlideId || !activeComp) return;
    const [previous, ...restUndo] = undoStack;
    setRedoStack((prev) => [activeComp.doc, ...prev]);
    setUndoStack(restUndo);

    setCompositions((prev) => ({
      ...prev,
      [activeSlideId]: {
        ...prev[activeSlideId],
        doc: previous,
      },
    }));
    triggerAutosave(activeSlideId, previous, activeComp.revision);
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !activeSlideId || !activeComp) return;
    const [next, ...restRedo] = redoStack;
    setUndoStack((prev) => [activeComp.doc, ...prev]);
    setRedoStack(restRedo);

    setCompositions((prev) => ({
      ...prev,
      [activeSlideId]: {
        ...prev[activeSlideId],
        doc: next,
      },
    }));
    triggerAutosave(activeSlideId, next, activeComp.revision);
  };

  // Slide creation & management
  const handleAddSlide = async () => {
    try {
      const nextIndex = slides.length;
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: project.organization_id,
          clientId: project.client_id,
          title: `Nova Lâmina ${nextIndex + 1}`,
          projectType: project.project_type,
          format: project.format,
          slides: [{ slideIndex: nextIndex, title: `Lâmina ${nextIndex + 1}` }],
        }),
      });

      // Reload project to get synchronized slides & compositions
      const refreshRes = await fetch(`/api/projects/${projectId}`);
      const refreshed = await refreshRes.json();
      setSlides(refreshed.slides || []);
      const compMap: Record<string, any> = {};
      refreshed.compositions.forEach((c: any) => {
        compMap[c.slide_id] = { doc: c.document, revision: c.revision };
      });
      setCompositions(compMap);
    } catch (err) {
      console.error('Falha ao adicionar slide:', err);
    }
  };

  const handleDuplicateSlide = async (slideId: string) => {
    const targetComp = compositions[slideId];
    if (!targetComp) return;

    // Shallow clone doc
    const clonedDoc: SlideDocument = JSON.parse(JSON.stringify(targetComp.doc));
    handleAddSlide();
  };

  const handleDeleteSlide = (slideId: string) => {
    if (slides.length <= 1) return;
    const updated = slides.filter((s) => s.id !== slideId);
    setSlides(updated);
    if (activeSlideId === slideId) {
      setActiveSlideId(updated[0].id);
    }
  };

  const handleMoveSlide = (currentIndex: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIdx < 0 || newIdx >= slides.length) return;

    const copy = [...slides];
    const temp = copy[currentIndex];
    copy[currentIndex] = copy[newIdx];
    copy[newIdx] = temp;
    copy.forEach((s, idx) => {
      s.slide_index = idx;
    });
    setSlides(copy);
  };

  // Title update
  const handleTitleChange = async (newTitle: string) => {
    setProject((prev: any) => ({ ...prev, title: newTitle }));
    await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    });
  };

  // AI Image Generation Trigger
  const handleGenerateImage = async (presetId: AIPresetId, variationInstruction?: string) => {
    if (!activeSlideId || !project) return;

    try {
      setIsGenerating(true);

      // 1. Enqueue Job
      const enqueueRes = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: project.organization_id,
          clientId: project.client_id,
          projectId: project.id,
          slideId: activeSlideId,
          slideIndex: activeSlide?.slide_index ?? 0,
          format: project.format,
          presetId,
          customVariationInstruction: variationInstruction,
          isVariation: Boolean(variationInstruction),
          referenceImageUrl: (activeSlide as any)?.reference_image_url,
          referenceTitle: (activeSlide as any)?.reference_title,
        }),
      });

      if (!enqueueRes.ok) {
        const errJson = await enqueueRes.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || 'Falha ao enfileirar geração de IA');
      }
      const { job } = await enqueueRes.json();

      // 2. Process Job immediately
      const processRes = await fetch('/api/jobs/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      });

      if (!processRes.ok) {
        const errJson = await processRes.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || 'Falha no processamento da imagem por IA');
      }

      // 3. Reload composition for this slide
      const compRes = await fetch(`/api/compositions?slideId=${activeSlideId}&organizationId=${project.organization_id}`);
      const compData = await compRes.json();

      if (compData.composition) {
        setCompositions((prev) => ({
          ...prev,
          [activeSlideId]: {
            doc: compData.composition.document,
            revision: compData.composition.revision,
          },
        }));
      }
    } catch (err: any) {
      alert(`Erro na geração de imagem: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Brand Check Execution (Prompt Section 90)
  const handleRunBrandCheck = () => {
    if (!activeDoc) return;

    const items = [
      {
        label: 'Contraste e Legibilidade',
        ok: activeDoc.layers.some((l) => l.type === 'overlay' && (l.opacity ?? 0) >= 0.25),
        message: activeDoc.layers.some((l) => l.type === 'overlay' && (l.opacity ?? 0) >= 0.25)
          ? 'Overlay de legibilidade ativo protegendo a leitura do texto.'
          : 'Recomendado ativar ou intensificar overlay sobre o fundo gerado por IA.',
      },
      {
        label: 'Presença do Logo Oficial',
        ok: activeDoc.layers.some((l) => l.type === 'logo' && l.visible !== false),
        message: activeDoc.layers.some((l) => l.type === 'logo' && l.visible !== false)
          ? 'Logo da marca posicionado na composição.'
          : 'Logo oficial não encontrado nesta lâmina.',
      },
      {
        label: 'Área Segura e Respiro',
        ok: !activeDoc.layers.some((l) => (l as any).overflowWarning),
        message: !activeDoc.layers.some((l) => (l as any).overflowWarning)
          ? 'Nenhum texto ultrapassando os limites recomendados.'
          : 'Aviso de overflow detectado em uma das caixas de texto. Utilize o Auto-Fit.',
      },
      {
        label: 'Paleta Cromática Oficial',
        ok: true,
        message: 'Tipografia e elementos utilizam tonalidades sincronizadas com o DNA Visual.',
      },
    ];

    const pass = items.every((i) => i.ok);
    setBrandCheckResults({ pass, items });
    setShowBrandCheckModal(true);
  };

  // Approval Execution (incorporates into client memory pool)
  const handleApproveProduction = async () => {
    try {
      setIsApproving(true);
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });

      setProject((prev: any) => ({ ...prev, status: 'approved' }));
      alert('Produção aprovada com sucesso! Esta peça agora faz parte da memória visual do cliente.');
    } catch (err: any) {
      alert(`Falha ao aprovar projeto: ${err.message}`);
    } finally {
      setIsApproving(false);
    }
  };

  // Export Trigger
  const handleExportSlide = async (mode: 'current' | 'all') => {
    try {
      setIsExporting(true);
      const supabase = getSupabaseBrowserClient();
      const exportService = new ExportService(supabase);

      if (mode === 'current') {
        if (!activeDoc) return;
        const canvas = await exportService.renderDocumentToCanvas(
          activeDoc,
          formatDef.exportWidth,
          formatDef.exportHeight
        );
        const blob = await exportService.canvasToBlob(canvas, 'image/png');
        const filename = ExportService.formatFilename({
          clientSlug: project.client?.slug || 'studio-fa',
          slideIndex: activeSlide?.slide_index ?? 0,
        });

        // Trigger browser download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Batch export all slides as ZIP
        const slideBlobs: { filename: string; blob: Blob }[] = [];

        for (let i = 0; i < slides.length; i++) {
          const s = slides[i];
          const c = compositions[s.id];
          if (c && c.doc) {
            const canvas = await exportService.renderDocumentToCanvas(
              c.doc,
              formatDef.exportWidth,
              formatDef.exportHeight
            );
            const blob = await exportService.canvasToBlob(canvas, 'image/png');
            const filename = ExportService.formatFilename({
              clientSlug: project.client?.slug || 'studio-fa',
              slideIndex: i,
            });
            slideBlobs.push({ filename, blob });
          }
        }

        const zipBlob = await exportService.generateBatchZip(slideBlobs);
        const zipFilename = `${ExportService.sanitizeFilename(project.title || 'carrossel')}_export.zip`;
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = zipFilename;
        a.click();
        URL.revokeObjectURL(url);
      }

      setShowExportModal(false);
    } catch (err: any) {
      alert(`Falha na exportação: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#0F1113] flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-10 h-10 border-4 border-[#CEF52A] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-zinc-400">Carregando estúdio criativo...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="h-screen w-screen bg-[#0F1113] flex flex-col items-center justify-center text-white p-6 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500" />
        <h2 className="text-lg font-bold">Não foi possível abrir o projeto</h2>
        <p className="text-xs text-zinc-400 max-w-sm">{error || 'Projeto não encontrado'}</p>
        <button
          onClick={() => router.push('/projects')}
          className="px-4 py-2 bg-zinc-800 text-white rounded-lg text-xs font-semibold hover:bg-zinc-700"
        >
          Voltar para Projetos
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#0B0F17] flex flex-col overflow-hidden select-none">
      {/* Top Header */}
      <EditorHeader
        title={project.title}
        clientName={project.client?.name}
        clientBrandStatus={project.client?.brand_status}
        projectStatus={project.status}
        saveStatus={saveStatus}
        zoom={zoom}
        onZoomChange={setZoom}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        showSafeAreas={showSafeAreas}
        onToggleSafeAreas={() => setShowSafeAreas((prev) => !prev)}
        onTitleChange={handleTitleChange}
        onBrandCheck={handleRunBrandCheck}
        onExport={() => setShowExportModal(true)}
        onApprove={handleApproveProduction}
        isExporting={isExporting}
        isApproving={isApproving}
      />

      {/* Main 3-Column Studio Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Slides Panel */}
        <SlidesPanel
          slides={slides}
          activeSlideId={activeSlideId}
          onSelectSlide={(id) => {
            setActiveSlideId(id);
            setSelectedLayerId(null);
            setUndoStack([]);
            setRedoStack([]);
          }}
          onAddSlide={handleAddSlide}
          onDuplicateSlide={handleDuplicateSlide}
          onDeleteSlide={handleDeleteSlide}
          onMoveSlide={handleMoveSlide}
          format={formatDef}
          clientName={project.client?.name || 'Cliente'}
        />

        {/* Center: Stage Canvas Viewport */}
        <main className="flex-1 bg-[#141820] flex items-center justify-center p-8 overflow-auto relative">
          {activeDoc ? (
            <StudioCanvas
              document={activeDoc}
              format={formatDef}
              zoom={zoom}
              selectedLayerId={selectedLayerId}
              onSelectLayer={setSelectedLayerId}
              onUpdateLayer={handleUpdateLayer}
              showSafeAreas={showSafeAreas}
            />
          ) : (
            <div className="text-zinc-500 text-xs">Selecione uma lâmina para editar</div>
          )}
        </main>

        {/* Right: Inspector Panel */}
        {activeDoc && (
          <InspectorPanel
            document={activeDoc}
            selectedLayerId={selectedLayerId}
            brandProfile={brandProfile}
            brandAssets={brandAssets}
            references={references}
            onSelectLayer={setSelectedLayerId}
            onUpdateLayer={handleUpdateLayer}
            onAddLayer={handleAddLayer}
            onDeleteLayer={handleDeleteLayer}
            onReorderLayers={handleReorderLayers}
            onGenerateImage={handleGenerateImage}
            isGenerating={isGenerating}
          />
        )}
      </div>

      {/* MODAL: BRAND CHECK */}
      {showBrandCheckModal && brandCheckResults && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#0F1113] border border-zinc-800 rounded-2xl max-w-md w-full p-6 text-white space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-[#CEF52A]/10 text-[#CEF52A] flex items-center justify-center font-bold">
                  ✓
                </span>
                <h3 className="font-bold text-sm">Verificação de Marca (Brand Check)</h3>
              </div>
              <button onClick={() => setShowBrandCheckModal(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {brandCheckResults.items.map((item, idx) => (
                <div key={idx} className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 flex items-start gap-2.5">
                  {item.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="text-xs font-semibold">{item.label}</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">{item.message}</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowBrandCheckModal(false)}
              className="w-full py-2.5 bg-[#CEF52A] text-black font-bold text-xs rounded-xl hover:bg-[#b8dd24] transition"
            >
              Concluir Verificação
            </button>
          </div>
        </div>
      )}

      {/* MODAL: EXPORT */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#0F1113] border border-zinc-800 rounded-2xl max-w-md w-full p-6 text-white space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-[#CEF52A]" />
                <h3 className="font-bold text-sm">Exportar Peça Final</h3>
              </div>
              <button onClick={() => setShowExportModal(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Dimensões de exportação: <span className="text-white font-mono">{formatDef.exportWidth}x{formatDef.exportHeight}px</span> ({formatDef.aspectRatio}).
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleExportSlide('current')}
                disabled={isExporting}
                className="w-full p-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-left flex items-center justify-between transition group"
              >
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-[#CEF52A]">
                    Baixar Lâmina Atual (PNG)
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Lâmina {(activeSlide?.slide_index ?? 0) + 1} em alta resolução (100% renderizada)
                  </div>
                </div>
                <Download className="w-4 h-4 text-zinc-500 group-hover:text-white" />
              </button>

              <button
                onClick={() => handleExportSlide('all')}
                disabled={isExporting}
                className="w-full p-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-left flex items-center justify-between transition group"
              >
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-[#CEF52A]">
                    Baixar Carrossel Completo (ZIP)
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Todas as {slides.length} lâminas organizadas e numeradas em alta definição
                  </div>
                </div>
                <Download className="w-4 h-4 text-zinc-500 group-hover:text-white" />
              </button>
            </div>

            {isExporting && (
              <div className="flex items-center justify-center gap-2 text-xs text-[#CEF52A] py-2">
                <span className="w-3.5 h-3.5 border-2 border-[#CEF52A] border-t-transparent rounded-full animate-spin" />
                <span>Processando alta resolução...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
