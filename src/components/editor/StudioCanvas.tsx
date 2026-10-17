'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Stage,
  Layer as KonvaLayer,
  Rect,
  Text as KonvaText,
  Image as KonvaImage,
  Group,
  Transformer,
} from 'react-konva';
import type {
  SlideDocument,
  Layer,
  TextLayer,
  ImageLayer,
  LogoLayer,
  ShapeLayer,
  OverlayLayer,
} from '@/types/domain/composition';
import type { FormatDefinition } from '@/config/formats';

interface StudioCanvasProps {
  document: SlideDocument;
  format: FormatDefinition;
  zoom: number; // e.g. 0.5, 0.75, 1
  selectedLayerId: string | null;
  onSelectLayer: (layerId: string | null) => void;
  onUpdateLayer: (layerId: string, updates: Partial<Layer>) => void;
  showSafeAreas?: boolean;
}

// Module-level image cache to eliminate re-fetch / re-decoding lag
const imageCache = new Map<string, HTMLImageElement>();

function useKonvaImage(url?: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(() => {
    if (!url) return null;
    return imageCache.get(url) || null;
  });

  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }

    if (imageCache.has(url)) {
      setImage(imageCache.get(url)!);
      return;
    }

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => {
      imageCache.set(url, img);
      setImage(img);
    };
    img.onerror = () => {
      console.warn('Falha ao carregar imagem no canvas:', url);
    };
  }, [url]);

  return image;
}

// Inner layer component for Image / Background (Memoized)
const CanvasImageItem = React.memo(function CanvasImageItem({
  layer,
  isSelected,
  onSelect,
  onChange,
}: {
  layer: ImageLayer;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updates: Partial<ImageLayer>) => void;
}) {
  const img = useKonvaImage(layer.imageUrl);
  const shapeRef = useRef<any>(null);

  return (
    <KonvaImage
      id={layer.id}
      ref={shapeRef}
      image={img || undefined}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      rotation={layer.rotation || 0}
      opacity={layer.opacity ?? 1}
      draggable={!layer.locked}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      stroke={isSelected ? '#CEF52A' : undefined}
      strokeWidth={isSelected ? 1.5 : 0}
      onDragEnd={(e) => {
        onChange({
          x: Math.round(e.target.x()),
          y: Math.round(e.target.y()),
        });
      }}
      onTransformEnd={() => {
        const node = shapeRef.current;
        if (!node) return;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          x: Math.round(node.x()),
          y: Math.round(node.y()),
          width: Math.max(20, Math.round(node.width() * scaleX)),
          height: Math.max(20, Math.round(node.height() * scaleY)),
          rotation: Math.round(node.rotation()),
        });
      }}
    />
  );
});

// Inner layer component for Logo (Memoized)
const CanvasLogoItem = React.memo(function CanvasLogoItem({
  layer,
  isSelected,
  onSelect,
  onChange,
}: {
  layer: LogoLayer;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updates: Partial<LogoLayer>) => void;
}) {
  const img = useKonvaImage(layer.logoUrl);
  const shapeRef = useRef<any>(null);

  return (
    <KonvaImage
      id={layer.id}
      ref={shapeRef}
      image={img || undefined}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      rotation={layer.rotation || 0}
      opacity={layer.opacity ?? 1}
      draggable={!layer.locked}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      stroke={isSelected ? '#CEF52A' : undefined}
      strokeWidth={isSelected ? 1.5 : 0}
      onDragEnd={(e) => {
        onChange({
          x: Math.round(e.target.x()),
          y: Math.round(e.target.y()),
        });
      }}
      onTransformEnd={() => {
        const node = shapeRef.current;
        if (!node) return;
        const scaleX = node.scaleX();
        node.scaleX(1);
        node.scaleY(1);
        const newW = Math.max(40, Math.round(node.width() * scaleX));
        const newH = Math.round(newW / (layer.aspectRatio || 2));
        onChange({
          x: Math.round(node.x()),
          y: Math.round(node.y()),
          width: newW,
          height: newH,
          rotation: Math.round(node.rotation()),
        });
      }}
    />
  );
});

// Inner layer component for Text (Memoized)
const CanvasTextItem = React.memo(function CanvasTextItem({
  layer,
  isSelected,
  onSelect,
  onChange,
}: {
  layer: TextLayer;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updates: Partial<TextLayer>) => void;
}) {
  const shapeRef = useRef<any>(null);

  return (
    <KonvaText
      id={layer.id}
      ref={shapeRef}
      text={layer.text}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      fontSize={layer.fontSize}
      fontFamily={layer.fontFamily}
      fontStyle={layer.fontWeight === 'bold' ? 'bold' : 'normal'}
      fill={layer.color}
      align={layer.align || 'left'}
      lineHeight={layer.lineHeight || 1.25}
      draggable={!layer.locked}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      stroke={isSelected ? '#CEF52A' : undefined}
      strokeWidth={isSelected ? 0.8 : 0}
      onDragEnd={(e) => {
        onChange({
          x: Math.round(e.target.x()),
          y: Math.round(e.target.y()),
        });
      }}
      onTransformEnd={() => {
        const node = shapeRef.current;
        if (!node) return;
        const scaleX = node.scaleX();
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          x: Math.round(node.x()),
          y: Math.round(node.y()),
          width: Math.max(50, Math.round(node.width() * scaleX)),
          rotation: Math.round(node.rotation()),
        });
      }}
    />
  );
});

export function StudioCanvas({
  document,
  format,
  zoom,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  showSafeAreas = true,
}: StudioCanvasProps) {
  const [isClient, setIsClient] = useState(false);
  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Update Konva Transformer when selectedLayerId changes
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    const stage = stageRef.current.getStage?.() || stageRef.current;
    if (!stage) return;

    if (selectedLayerId) {
      const selectedNode = stage.findOne(`#${selectedLayerId}`);
      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer()?.batchDraw();
        return;
      }
    }
    transformerRef.current.nodes([]);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedLayerId, document.layers]);

  const w = document.canvas.width;
  const h = document.canvas.height;
  const displayWidth = Math.round(w * zoom);
  const displayHeight = Math.round(h * zoom);

  const sortedLayers = [...document.layers].sort((a, b) => a.zIndex - b.zIndex);

  if (!isClient) {
    return (
      <div
        style={{ width: displayWidth, height: displayHeight }}
        className="bg-fa-dark flex items-center justify-center text-gray-500 text-xs rounded-lg shadow-xl"
      >
        Carregando canvas...
      </div>
    );
  }

  return (
    <div
      className="relative flex items-center justify-center shadow-2xl rounded-lg overflow-hidden border border-zinc-800 bg-black/40"
      style={{ width: displayWidth, height: displayHeight }}
    >
      <Stage
        ref={stageRef}
        width={displayWidth}
        height={displayHeight}
        scaleX={zoom}
        scaleY={zoom}
        onMouseDown={(e) => {
          // Deselect when clicking on empty stage background
          if (e.target === e.target.getStage()) {
            onSelectLayer(null);
          }
        }}
      >
        <KonvaLayer>
          {/* Canvas Base Background */}
          <Rect
            x={0}
            y={0}
            width={w}
            height={h}
            fill={document.canvas.backgroundColor || '#0B0F17'}
          />

          {/* Render All Layers in zIndex Order */}
          {sortedLayers.map((layer) => {
            if (layer.visible === false) return null;
            const isSelected = layer.id === selectedLayerId;

            if (layer.type === 'shape' && 'fillColor' in layer) {
              const shapeLayer = layer as ShapeLayer;
              return (
                <Rect
                  id={layer.id}
                  key={layer.id}
                  x={layer.x}
                  y={layer.y}
                  width={layer.width}
                  height={layer.height}
                  fill={shapeLayer.fillColor || '#ffffff'}
                  cornerRadius={shapeLayer.cornerRadius || 0}
                  opacity={layer.opacity ?? 1}
                  draggable={!layer.locked}
                  stroke={isSelected ? '#CEF52A' : undefined}
                  strokeWidth={isSelected ? 1.5 : 0}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    onSelectLayer(layer.id);
                  }}
                  onTap={(e) => {
                    e.cancelBubble = true;
                    onSelectLayer(layer.id);
                  }}
                  onDragEnd={(e) => {
                    onUpdateLayer(layer.id, {
                      x: Math.round(e.target.x()),
                      y: Math.round(e.target.y()),
                    });
                  }}
                />
              );
            }

            if (layer.type === 'overlay' && 'color' in layer) {
              const overlay = layer as OverlayLayer;
              return (
                <Rect
                  key={layer.id}
                  x={layer.x}
                  y={layer.y}
                  width={layer.width}
                  height={layer.height}
                  fill={overlay.color}
                  opacity={layer.opacity ?? 0.4}
                  listening={false}
                />
              );
            }

            if (layer.type === 'image' || layer.type === 'background') {
              return (
                <CanvasImageItem
                  key={layer.id}
                  layer={layer as ImageLayer}
                  isSelected={isSelected}
                  onSelect={() => onSelectLayer(layer.id)}
                  onChange={(updates) => onUpdateLayer(layer.id, updates)}
                />
              );
            }

            if (layer.type === 'logo') {
              return (
                <CanvasLogoItem
                  key={layer.id}
                  layer={layer as LogoLayer}
                  isSelected={isSelected}
                  onSelect={() => onSelectLayer(layer.id)}
                  onChange={(updates) => onUpdateLayer(layer.id, updates)}
                />
              );
            }

            if (layer.type === 'text') {
              return (
                <CanvasTextItem
                  key={layer.id}
                  layer={layer as TextLayer}
                  isSelected={isSelected}
                  onSelect={() => onSelectLayer(layer.id)}
                  onChange={(updates) => onUpdateLayer(layer.id, updates)}
                />
              );
            }

            return null;
          })}

          {/* Konva Transformer for selected node */}
          <Transformer
            ref={transformerRef}
            borderStroke="#CEF52A"
            borderStrokeWidth={1.5}
            anchorStroke="#CEF52A"
            anchorFill="#0B0F17"
            anchorSize={7}
            anchorCornerRadius={2}
            rotateAnchorOffset={20}
            boundBoxFunc={(oldBox, newBox) => {
              if (Math.abs(newBox.width) < 10 || Math.abs(newBox.height) < 10) {
                return oldBox;
              }
              return newBox;
            }}
          />

          {/* Safe Area Guides (Faint overlay guides, never exported) */}
          {showSafeAreas && (
            <Group listening={false}>
              <Rect
                x={format.safeArea.left}
                y={format.safeArea.top}
                width={w - format.safeArea.left - format.safeArea.right}
                height={h - format.safeArea.top - format.safeArea.bottom}
                stroke="#CEF52A"
                strokeWidth={1}
                dash={[6, 6]}
                opacity={0.35}
              />
            </Group>
          )}
        </KonvaLayer>
      </Stage>
    </div>
  );
}

export default StudioCanvas;
