'use client';

import React, { useState, useEffect } from 'react';
import type { SlideDocument, Layer, TextLayer, ImageLayer, LogoLayer, ShapeLayer, OverlayLayer } from '@/types/domain/composition';
import type { BrandProfile } from '@/types/domain/brand';
import type { AIPresetId } from '@/config/presets';
import { AI_PRESETS } from '@/config/presets';
import { fitTextToBox } from '@/types/domain/composition';

export type InspectorTab = 'content' | 'style' | 'layers' | 'ai' | 'references';

interface InspectorPanelProps {
  document: SlideDocument;
  selectedLayerId: string | null;
  brandProfile?: BrandProfile | null;
  brandAssets?: any[];
  references?: any[];
  onSelectLayer: (layerId: string | null) => void;
  onUpdateLayer: (layerId: string, updates: Partial<Layer>) => void;
  onAddLayer: (layer: Layer) => void;
  onDeleteLayer: (layerId: string) => void;
  onReorderLayers: (newLayers: Layer[]) => void;
  onGenerateImage: (presetId: AIPresetId, variationInstruction?: string) => Promise<void>;
  isGenerating?: boolean;
}

export function InspectorPanel({
  document,
  selectedLayerId,
  brandProfile,
  brandAssets = [],
  references = [],
  onSelectLayer,
  onUpdateLayer,
  onAddLayer,
  onDeleteLayer,
  onReorderLayers,
  onGenerateImage,
  isGenerating = false,
}: InspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('content');
  const [selectedPreset, setSelectedPreset] = useState<AIPresetId>('production');
  const [variationInstruction, setVariationInstruction] = useState('');
  const [promptOverride, setPromptOverride] = useState('');

  const [aiConfig, setAiConfig] = useState<{ configured: boolean; previewKey: string | null } | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keyStatusMsg, setKeyStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showKeyForm, setShowKeyForm] = useState(false);

  useEffect(() => {
    fetch('/api/settings/ai')
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.configured === 'boolean') {
          setAiConfig(data);
        }
      })
      .catch((err) => console.error('Erro ao buscar status da IA:', err));
  }, []);

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    try {
      setIsSavingKey(true);
      setKeyStatusMsg(null);
      const res = await fetch('/api/settings/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Falha ao salvar chave');
      }
      setAiConfig({ configured: true, previewKey: data.previewKey });
      setApiKeyInput('');
      setShowKeyForm(false);
      setKeyStatusMsg({ type: 'success', text: 'Chave OpenAI salva com sucesso!' });
      setTimeout(() => setKeyStatusMsg(null), 4000);
    } catch (err: any) {
      setKeyStatusMsg({ type: 'error', text: err.message || 'Erro ao salvar chave' });
    } finally {
      setIsSavingKey(false);
    }
  };

  const selectedLayer = document.layers.find((l) => l.id === selectedLayerId);
  const bgLayer = document.layers.find((l) => l.id === 'layer-bg' || l.type === 'background') as ImageLayer | undefined;

  // Move layer up/down in stack
  const handleMoveLayer = (layerId: string, direction: 'up' | 'down') => {
    const sorted = [...document.layers].sort((a, b) => a.zIndex - b.zIndex);
    const index = sorted.findIndex((l) => l.id === layerId);
    if (index === -1) return;

    if (direction === 'up' && index < sorted.length - 1) {
      const current = sorted[index];
      const target = sorted[index + 1];
      const tempZ = current.zIndex;
      current.zIndex = target.zIndex;
      target.zIndex = tempZ;
      onReorderLayers(sorted);
    } else if (direction === 'down' && index > 0) {
      const current = sorted[index];
      const target = sorted[index - 1];
      const tempZ = current.zIndex;
      current.zIndex = target.zIndex;
      target.zIndex = tempZ;
      onReorderLayers(sorted);
    }
  };

  // Quick Layer creation helpers
  const handleAddText = () => {
    const newId = `layer-text-${Date.now()}`;
    const maxZ = Math.max(0, ...document.layers.map((l) => l.zIndex)) + 1;
    const font = brandProfile?.typography.detectedFonts?.[0] || 'Inter, sans-serif';
    const textColor = brandProfile?.colors.text[0] || '#FFFFFF';

    onAddLayer({
      id: newId,
      name: 'Novo Texto',
      type: 'text',
      text: 'Insira o seu texto aqui',
      fontFamily: font,
      fontSize: 36,
      fontWeight: 'bold',
      color: textColor,
      align: 'left',
      x: 100,
      y: 300,
      width: 600,
      height: 100,
      zIndex: maxZ,
      visible: true,
      locked: false,
    });
    onSelectLayer(newId);
  };

  const handleAddLogo = (logoUrl: string) => {
    const newId = `layer-logo-${Date.now()}`;
    const maxZ = Math.max(0, ...document.layers.map((l) => l.zIndex)) + 1;

    onAddLayer({
      id: newId,
      name: 'Logo da Marca',
      type: 'logo',
      logoUrl,
      aspectRatio: 3,
      x: 80,
      y: 80,
      width: 180,
      height: 60,
      zIndex: maxZ,
      visible: true,
      locked: false,
    });
    onSelectLayer(newId);
  };

  const handleAddButton = () => {
    const newId = `layer-btn-${Date.now()}`;
    const maxZ = Math.max(0, ...document.layers.map((l) => l.zIndex)) + 1;
    const accent = brandProfile?.colors.accent[0] || '#CEF52A';

    onAddLayer({
      id: newId,
      name: 'Botão / Card',
      type: 'shape',
      shapeType: 'rectangle',
      fillColor: accent,
      cornerRadius: 12,
      x: 100,
      y: 800,
      width: 280,
      height: 64,
      zIndex: maxZ,
      visible: true,
      locked: false,
    });
    onSelectLayer(newId);
  };

  return (
    <aside className="w-80 bg-[#0F1113] border-l border-zinc-800 flex flex-col h-full text-zinc-300 select-none">
      {/* Tab Navigation */}
      <div className="flex items-center border-b border-zinc-800 bg-zinc-950/40 text-xs">
        <button
          onClick={() => setActiveTab('content')}
          className={`flex-1 py-3 text-center font-medium border-b-2 transition-colors ${
            activeTab === 'content'
              ? 'border-[#CEF52A] text-white font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Conteúdo
        </button>
        <button
          onClick={() => setActiveTab('style')}
          className={`flex-1 py-3 text-center font-medium border-b-2 transition-colors ${
            activeTab === 'style'
              ? 'border-[#CEF52A] text-white font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Estilo
        </button>
        <button
          onClick={() => setActiveTab('layers')}
          className={`flex-1 py-3 text-center font-medium border-b-2 transition-colors ${
            activeTab === 'layers'
              ? 'border-[#CEF52A] text-white font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Camadas
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex-1 py-3 text-center font-medium border-b-2 transition-colors ${
            activeTab === 'ai'
              ? 'border-[#CEF52A] text-white font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          IA
        </button>
        <button
          onClick={() => setActiveTab('references')}
          className={`flex-1 py-3 text-center font-medium border-b-2 transition-colors ${
            activeTab === 'references'
              ? 'border-[#CEF52A] text-white font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
          title="Referências"
        >
          Ref
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* TAB 1: CONTEÚDO */}
        {activeTab === 'content' && (
          <div className="space-y-4">
            {selectedLayer && selectedLayer.type === 'text' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-white uppercase text-[11px] tracking-wider">
                    {selectedLayer.name}
                  </h4>
                  <button
                    onClick={() => {
                      const tl = selectedLayer as TextLayer;
                      const fitted = fitTextToBox({
                        text: tl.text,
                        fontSize: tl.fontSize,
                        boxWidth: tl.width,
                        boxHeight: tl.height || 200,
                      });
                      onUpdateLayer(tl.id, {
                        fontSize: fitted.fontSize,
                        overflowWarning: fitted.overflowWarning,
                      });
                    }}
                    className="text-[10px] text-[#CEF52A] hover:underline"
                    title="Ajustar automaticamente o tamanho do texto ao limite"
                  >
                    Auto-Fit
                  </button>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Texto</label>
                  <textarea
                    rows={4}
                    value={(selectedLayer as TextLayer).text}
                    onChange={(e) => onUpdateLayer(selectedLayer.id, { text: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white outline-none focus:border-[#CEF52A] font-sans text-sm resize-none"
                  />
                </div>

                {/* Font Size & Weight */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-zinc-400 mb-1">Tamanho ({selectedLayer && (selectedLayer as TextLayer).fontSize}px)</label>
                    <input
                      type="range"
                      min={16}
                      max={120}
                      value={(selectedLayer as TextLayer).fontSize}
                      onChange={(e) =>
                        onUpdateLayer(selectedLayer.id, { fontSize: parseInt(e.target.value, 10) })
                      }
                      className="w-full accent-[#CEF52A]"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">Peso</label>
                    <select
                      value={(selectedLayer as TextLayer).fontWeight || 'normal'}
                      onChange={(e) => onUpdateLayer(selectedLayer.id, { fontWeight: e.target.value as any })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-white outline-none"
                    >
                      <option value="normal">Normal</option>
                      <option value="600">Semi-Bold</option>
                      <option value="bold">Bold</option>
                      <option value="900">Black</option>
                    </select>
                  </div>
                </div>

                {/* Alignment */}
                <div>
                  <label className="block text-zinc-400 mb-1">Alinhamento</label>
                  <div className="flex gap-1 bg-zinc-900 p-1 rounded border border-zinc-800">
                    {(['left', 'center', 'right'] as const).map((align) => (
                      <button
                        key={align}
                        onClick={() => onUpdateLayer(selectedLayer.id, { align })}
                        className={`flex-1 py-1 rounded text-center capitalize ${
                          (selectedLayer as TextLayer).align === align
                            ? 'bg-zinc-700 text-white font-semibold'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {align === 'left' ? 'Esq' : align === 'center' ? 'Centro' : 'Dir'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Overflow Warning Badge */}
                {(selectedLayer as TextLayer).overflowWarning && (
                  <div className="p-2 bg-amber-950/60 border border-amber-800 rounded text-amber-300 text-[11px] flex items-center gap-1.5">
                    <span>⚠️ O texto pode estar ultrapassando a área delimitada.</span>
                  </div>
                )}
              </div>
            ) : selectedLayer ? (
              <div className="space-y-3">
                <h4 className="font-semibold text-white uppercase text-[11px] tracking-wider">
                  {selectedLayer.name} ({selectedLayer.type})
                </h4>

                <div className="grid grid-cols-2 gap-2 text-zinc-400">
                  <div>
                    <label className="block mb-1">Posição X</label>
                    <input
                      type="number"
                      value={selectedLayer.x}
                      onChange={(e) => onUpdateLayer(selectedLayer.id, { x: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block mb-1">Posição Y</label>
                    <input
                      type="number"
                      value={selectedLayer.y}
                      onChange={(e) => onUpdateLayer(selectedLayer.id, { y: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block mb-1">Largura</label>
                    <input
                      type="number"
                      value={selectedLayer.width}
                      onChange={(e) => onUpdateLayer(selectedLayer.id, { width: parseInt(e.target.value, 10) || 20 })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block mb-1">Altura</label>
                    <input
                      type="number"
                      value={selectedLayer.height}
                      onChange={(e) => onUpdateLayer(selectedLayer.id, { height: parseInt(e.target.value, 10) || 20 })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Opacidade ({Math.round((selectedLayer.opacity ?? 1) * 100)}%)</label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={selectedLayer.opacity ?? 1}
                    onChange={(e) => onUpdateLayer(selectedLayer.id, { opacity: parseFloat(e.target.value) })}
                    className="w-full accent-[#CEF52A]"
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500 space-y-2">
                <svg className="w-8 h-8 mx-auto text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <p>Nenhuma camada selecionada no canvas.</p>
                <p className="text-[11px] text-zinc-600">Clique em um elemento para editar seu texto ou propriedades.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ESTILO */}
        {activeTab === 'style' && (
          <div className="space-y-5">
            {/* Brand Colors */}
            <div>
              <h4 className="font-semibold text-white text-[11px] uppercase tracking-wider mb-2">
                Cores da Marca
              </h4>
              <div className="space-y-2">
                <div>
                  <span className="text-[10px] text-zinc-400 block mb-1">Primárias / Fundo</span>
                  <div className="flex flex-wrap gap-2">
                    {(brandProfile?.colors.primary || ['#0B0F17', '#1F2937']).map((color, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          if (selectedLayer && 'color' in selectedLayer) {
                            onUpdateLayer(selectedLayer.id, { color });
                          } else if (selectedLayer && 'fillColor' in selectedLayer) {
                            onUpdateLayer(selectedLayer.id, { fillColor: color });
                          }
                        }}
                        style={{ backgroundColor: color }}
                        className="w-7 h-7 rounded-full border border-white/20 hover:scale-110 transition shadow-sm"
                        title={`Aplicar cor: ${color}`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-400 block mb-1">Destaque (Accent)</span>
                  <div className="flex flex-wrap gap-2">
                    {(brandProfile?.colors.accent || ['#CEF52A']).map((color, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          if (selectedLayer && 'color' in selectedLayer) {
                            onUpdateLayer(selectedLayer.id, { color });
                          } else if (selectedLayer && 'fillColor' in selectedLayer) {
                            onUpdateLayer(selectedLayer.id, { fillColor: color });
                          }
                        }}
                        style={{ backgroundColor: color }}
                        className="w-7 h-7 rounded-full border border-white/20 hover:scale-110 transition shadow-sm"
                        title={`Aplicar destaque: ${color}`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-400 block mb-1">Texto</span>
                  <div className="flex flex-wrap gap-2">
                    {(brandProfile?.colors.text || ['#FFFFFF', '#D1D5DB']).map((color, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          if (selectedLayer && 'color' in selectedLayer) {
                            onUpdateLayer(selectedLayer.id, { color });
                          }
                        }}
                        style={{ backgroundColor: color }}
                        className="w-7 h-7 rounded-full border border-white/20 hover:scale-110 transition shadow-sm"
                        title={`Aplicar cor de texto: ${color}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Typography */}
            <div>
              <h4 className="font-semibold text-white text-[11px] uppercase tracking-wider mb-2">
                Tipografia Detectada
              </h4>
              <div className="space-y-1">
                {(brandProfile?.typography.detectedFonts || ['Inter']).map((font, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (selectedLayer && selectedLayer.type === 'text') {
                        onUpdateLayer(selectedLayer.id, { fontFamily: font });
                      }
                    }}
                    className="w-full text-left px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded border border-zinc-800 text-white font-medium flex items-center justify-between"
                  >
                    <span>{font}</span>
                    <span className="text-[10px] text-zinc-500">Oficial</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Overlay Control */}
            {document.layers.some((l) => l.type === 'overlay') && (
              <div className="border-t border-zinc-800 pt-3">
                <h4 className="font-semibold text-white text-[11px] uppercase tracking-wider mb-2">
                  Overlay de Legibilidade
                </h4>
                {document.layers
                  .filter((l) => l.type === 'overlay')
                  .map((overlay) => (
                    <div key={overlay.id} className="space-y-2 bg-zinc-900/60 p-2.5 rounded border border-zinc-800">
                      <div className="flex items-center justify-between text-zinc-400">
                        <span>Intensidade ({Math.round((overlay.opacity ?? 0.4) * 100)}%)</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={overlay.opacity ?? 0.4}
                        onChange={(e) => onUpdateLayer(overlay.id, { opacity: parseFloat(e.target.value) })}
                        className="w-full accent-[#CEF52A]"
                      />
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CAMADAS */}
        {activeTab === 'layers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-white text-[11px] uppercase tracking-wider">
                Ordem das Camadas
              </h4>
              <span className="text-[10px] text-zinc-500">{document.layers.length} camadas</span>
            </div>

            {/* Layer Stack (Descending zIndex: Top to Bottom) */}
            <div className="space-y-1.5">
              {[...document.layers]
                .sort((a, b) => b.zIndex - a.zIndex)
                .map((layer) => {
                  const isSelected = layer.id === selectedLayerId;
                  return (
                    <div
                      key={layer.id}
                      onClick={() => onSelectLayer(layer.id)}
                      className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition ${
                        isSelected
                          ? 'bg-zinc-800/90 border-[#CEF52A] text-white'
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {/* Layer icon */}
                        {layer.type === 'text' && (
                          <span className="text-zinc-400 font-serif font-bold text-xs">T</span>
                        )}
                        {layer.type === 'image' && (
                          <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                        {layer.type === 'logo' && (
                          <span className="text-[10px] bg-purple-900/60 text-purple-300 px-1 py-0.5 rounded font-mono">
                            LOGO
                          </span>
                        )}
                        {layer.type === 'shape' && (
                          <span className="w-3 h-3 bg-zinc-400 rounded-sm inline-block" />
                        )}
                        {layer.type === 'overlay' && (
                          <span className="w-3 h-3 bg-gradient-to-b from-transparent to-black border border-zinc-600 rounded-sm inline-block" />
                        )}

                        <span className="truncate text-xs font-medium">{layer.name}</span>
                      </div>

                      {/* Controls: Up, Down, Visibility, Lock, Delete */}
                      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveLayer(layer.id, 'up');
                          }}
                          className="p-1 hover:text-white text-zinc-400"
                          title="Mover para cima"
                        >
                          ▲
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveLayer(layer.id, 'down');
                          }}
                          className="p-1 hover:text-white text-zinc-400"
                          title="Mover para baixo"
                        >
                          ▼
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateLayer(layer.id, { visible: layer.visible === false });
                          }}
                          className="p-1 hover:text-white text-zinc-400"
                          title={layer.visible === false ? 'Exibir' : 'Ocultar'}
                        >
                          {layer.visible === false ? '👁️‍🗨️' : '👁️'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateLayer(layer.id, { locked: !layer.locked });
                          }}
                          className="p-1 hover:text-white text-zinc-400"
                          title={layer.locked ? 'Destravar' : 'Travar'}
                        >
                          {layer.locked ? '🔒' : '🔓'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteLayer(layer.id);
                          }}
                          className="p-1 text-zinc-500 hover:text-rose-400"
                          title="Excluir camada"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Add Layer Actions */}
            <div className="border-t border-zinc-800 pt-3 space-y-2">
              <span className="text-[11px] font-semibold text-zinc-400 block uppercase">
                Adicionar Camada
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleAddText}
                  className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-left text-zinc-300 font-medium flex items-center gap-1.5"
                >
                  <span className="text-[#CEF52A] font-bold">T</span>
                  <span>Texto</span>
                </button>
                <button
                  onClick={handleAddButton}
                  className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-left text-zinc-300 font-medium flex items-center gap-1.5"
                >
                  <span className="w-3 h-3 bg-[#CEF52A] rounded-sm" />
                  <span>Botão</span>
                </button>
              </div>

              {/* Add Client Logo button if logos exist */}
              {brandAssets.filter((a) => a.asset_type.startsWith('logo')).length > 0 && (
                <div className="pt-2">
                  <span className="text-[10px] text-zinc-500 block mb-1">Logos do Cliente</span>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {brandAssets
                      .filter((a) => a.asset_type.startsWith('logo'))
                      .map((logo) => (
                        <button
                          key={logo.id}
                          onClick={() =>
                            handleAddLogo(`/api/assets/raw?path=${encodeURIComponent(logo.storage_path)}`)
                          }
                          className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-[11px] text-zinc-300 whitespace-nowrap"
                        >
                          + {logo.label || 'Logo'}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: IA & VARIAÇÕES */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-white text-[11px] uppercase tracking-wider">
                Motor Visual de IA
              </h4>
              {aiConfig?.configured && (
                <span className="text-[10px] bg-emerald-950/70 border border-emerald-800 text-emerald-400 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  DALL-E 3 Ativo
                </span>
              )}
            </div>

            {/* OpenAI Key Configuration Card */}
            {(!aiConfig?.configured || showKeyForm) ? (
              <div className="bg-zinc-900 border border-zinc-700/80 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${aiConfig?.configured ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span className="text-[11px] font-bold text-white">
                      {aiConfig?.configured ? 'Atualizar Chave OpenAI' : 'Conectar Chave OpenAI'}
                    </span>
                  </div>
                  {aiConfig?.configured && (
                    <button
                      onClick={() => setShowKeyForm(false)}
                      className="text-[10px] text-zinc-400 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-zinc-400 leading-relaxed">
                  Para gerar artes ultra-realistas com <strong>DALL-E 3</strong> do zero a partir do briefing e das referências do cliente, insira sua chave.
                </p>
                <div className="space-y-1.5">
                  <input
                    type="password"
                    placeholder="sk-proj-..."
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded p-1.5 text-white text-xs outline-none focus:border-[#CEF52A] font-mono"
                  />
                  <button
                    onClick={handleSaveApiKey}
                    disabled={isSavingKey || !apiKeyInput.trim()}
                    className="w-full py-1.5 bg-[#CEF52A] hover:bg-[#b8dd24] text-[#0F1113] rounded font-bold text-xs transition disabled:opacity-50"
                  >
                    {isSavingKey ? 'Validando & Salvando...' : 'Salvar Chave OpenAI'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-zinc-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    OpenAI DALL-E 3
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                    {aiConfig.previewKey}
                  </div>
                </div>
                <button
                  onClick={() => setShowKeyForm(true)}
                  className="text-[10px] text-[#CEF52A] hover:underline font-medium"
                >
                  Alterar
                </button>
              </div>
            )}

            {keyStatusMsg && (
              <div
                className={`p-2 rounded text-[11px] flex items-center gap-1.5 ${
                  keyStatusMsg.type === 'success'
                    ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/60 border border-rose-800 text-rose-300'
                }`}
              >
                <span>{keyStatusMsg.type === 'success' ? '✓' : '⚠️'}</span>
                <span>{keyStatusMsg.text}</span>
              </div>
            )}

            {/* Explanation card about zero-generation */}
            <div className="p-2.5 bg-zinc-950 border border-zinc-800/80 rounded-lg text-[10px] text-zinc-400 space-y-1">
              <div className="text-zinc-200 font-semibold flex items-center gap-1">
                <span>🎨</span>
                <span>Criação do Zero & Negative Space</span>
              </div>
              <p className="leading-relaxed">
                A IA analisa a identidade do cliente e o estilo da peça de referência para criar um fundo novo exclusivo, com espaço reservado para os textos editáveis.
              </p>
            </div>

            {/* Presets */}
            <div>
              <label className="block text-zinc-400 mb-1">Preset de Qualidade</label>
              <div className="grid grid-cols-3 gap-1 bg-zinc-900 p-1 rounded border border-zinc-800">
                {(Object.keys(AI_PRESETS) as AIPresetId[]).map((presetId) => {
                  const p = AI_PRESETS[presetId];
                  return (
                    <button
                      key={presetId}
                      onClick={() => setSelectedPreset(presetId)}
                      className={`py-1.5 rounded text-center transition ${
                        selectedPreset === presetId
                          ? 'bg-[#CEF52A] text-[#0F1113] font-bold shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div className="text-xs">{p.name}</div>
                      <div className="text-[9px] opacity-80">{Math.round(p.timeoutMs / 1000)}s</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Main Generation Actions */}
            <div className="space-y-2 pt-2">
              <button
                onClick={() => onGenerateImage(selectedPreset)}
                disabled={isGenerating}
                className="w-full py-2.5 px-3 bg-[#CEF52A] hover:bg-[#b8dd24] text-[#0F1113] rounded-lg font-bold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-md"
              >
                {isGenerating ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Gerando imagem com IA...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Gerar Fundo da Lâmina</span>
                  </>
                )}
              </button>

              {/* Generate Variation with custom instruction */}
              <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800 space-y-2 mt-3">
                <span className="font-semibold text-zinc-300 text-[11px] block">
                  Gerar Variação Criativa
                </span>
                <input
                  type="text"
                  placeholder="Ex: fundo mais escuro, iluminação neon sutil..."
                  value={variationInstruction}
                  onChange={(e) => setVariationInstruction(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-white text-xs outline-none focus:border-[#CEF52A]"
                />
                <button
                  onClick={() => {
                    onGenerateImage(selectedPreset, variationInstruction);
                    setVariationInstruction('');
                  }}
                  disabled={isGenerating}
                  className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs font-medium transition disabled:opacity-50"
                >
                  Gerar Variação
                </button>
              </div>
            </div>

            {/* Image History / Versions for this slide */}
            {bgLayer?.imageHistory && bgLayer.imageHistory.length > 0 && (
              <div className="border-t border-zinc-800 pt-3 space-y-2">
                <span className="text-[11px] font-semibold text-zinc-400 block uppercase">
                  Histórico de Gerações ({bgLayer.imageHistory.length})
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {bgLayer.imageHistory.map((hist) => (
                    <div
                      key={hist.id}
                      className="p-2 bg-zinc-900 rounded border border-zinc-800 flex items-center justify-between"
                    >
                      <div className="truncate pr-2">
                        <div className="font-medium text-white truncate text-xs">{hist.label}</div>
                        <div className="text-[10px] text-zinc-500">
                          {new Date(hist.createdAt).toLocaleTimeString('pt-BR')}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          onUpdateLayer(bgLayer.id, {
                            imageUrl: hist.imageUrl,
                            assetId: hist.assetId,
                          });
                        }}
                        className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs text-[#CEF52A] rounded font-medium"
                      >
                        Restaurar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: REFERÊNCIAS USADAS */}
        {activeTab === 'references' && (
          <div className="space-y-3">
            <h4 className="font-semibold text-white text-[11px] uppercase tracking-wider">
              Referências do Cliente ({references.length})
            </h4>

            {references.length === 0 ? (
              <p className="text-zinc-500 text-xs py-4 text-center">
                Nenhuma referência visual cadastrada para este cliente.
              </p>
            ) : (
              <div className="space-y-2">
                {references.map((ref) => (
                  <div
                    key={ref.id}
                    className="p-2 bg-zinc-900/70 border border-zinc-800 rounded-lg space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-xs truncate">{ref.title}</span>
                      <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                        {ref.reference_type}
                      </span>
                    </div>
                    {ref.description && (
                      <p className="text-[11px] text-zinc-400 line-clamp-2">{ref.description}</p>
                    )}
                    {ref.tags && ref.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {ref.tags.map((tag: string, i: number) => (
                          <span
                            key={i}
                            className="text-[9px] bg-zinc-800/80 text-zinc-500 px-1 py-0.2 rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
