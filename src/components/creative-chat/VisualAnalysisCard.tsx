// src/components/creative-chat/VisualAnalysisCard.tsx
'use client';

import React from 'react';
import { CheckCircle2, XCircle, Sparkles, Award, ArrowUpRight, Palette, Layers, Compass } from 'lucide-react';
import type { VisualAnalysisReport } from '@/types/domain/creative-chat';

interface VisualAnalysisCardProps {
  report: VisualAnalysisReport;
  onQuickAction?: (promptText: string) => void;
}

export function VisualAnalysisCard({ report, onQuickAction }: VisualAnalysisCardProps) {
  return (
    <div className="bg-[#101216] border border-zinc-800 rounded-2xl p-5 md:p-6 text-zinc-200 shadow-2xl space-y-6 max-w-3xl my-3">
      {/* Header com síntese e conceito */}
      <div className="border-b border-zinc-800/80 pb-5">
        <div className="flex items-center gap-2 text-xs text-[#CEF52A] font-semibold tracking-wider uppercase mb-1">
          <Sparkles className="w-4 h-4 text-[#CEF52A]" />
          <span>Leitura Visual Estruturada • {report.clientName}</span>
        </div>
        <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
          {report.executiveSummary}
        </p>

        <div className="bg-[#181B20] border border-zinc-700/60 rounded-xl p-3.5">
          <span className="text-[11px] text-zinc-400 font-medium block mb-1">
            Conceito Visual Síntese:
          </span>
          <div className="text-sm md:text-base font-bold text-white tracking-tight flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#CEF52A] animate-pulse" />
            <span>{report.concept}</span>
          </div>
        </div>
      </div>

      {/* 1. DNA visual da marca */}
      <div className="space-y-3.5">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Palette className="w-4 h-4 text-[#CEF52A]" />
          <span>1. DNA visual da marca</span>
        </h3>

        {/* Paleta identificada */}
        <div>
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span className="font-semibold text-zinc-300">Paleta principal identificada</span>
            <span className="text-[10px] text-zinc-500 font-mono">Estimativa Visual</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {report.colorPalette.map((color, idx) => (
              <div
                key={idx}
                className="bg-[#16181D] border border-zinc-800 rounded-xl p-2.5 flex flex-col justify-between"
              >
                <div
                  className="w-full h-12 rounded-lg mb-2 border border-white/10 shadow-inner"
                  style={{ backgroundColor: color.hex }}
                />
                <div>
                  <div className="text-xs font-bold text-white truncate flex items-center justify-between">
                    <span>{color.name}</span>
                    {color.isAccent && (
                      <span className="text-[9px] bg-[#CEF52A]/20 text-[#CEF52A] px-1 rounded">Acento</span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400 mt-0.5">{color.hex}</div>
                  <div className="text-[10px] text-zinc-500 leading-tight mt-1 line-clamp-1">
                    {color.role}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabela de Elementos */}
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#14171C]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1B1E24] text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="py-2.5 px-3.5 font-semibold w-1/4">Elemento</th>
                <th className="py-2.5 px-3.5 font-semibold">Diretriz Identificada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              <tr>
                <td className="py-2.5 px-3.5 font-medium text-zinc-400">Estética</td>
                <td className="py-2.5 px-3.5 text-white">{report.elements.aesthetic}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3.5 font-medium text-zinc-400">Fundo</td>
                <td className="py-2.5 px-3.5">{report.elements.background}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3.5 font-medium text-zinc-400">Tipografia</td>
                <td className="py-2.5 px-3.5">{report.elements.typography}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3.5 font-medium text-zinc-400">Hierarquia</td>
                <td className="py-2.5 px-3.5">{report.elements.hierarchy}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3.5 font-medium text-zinc-400">Composição</td>
                <td className="py-2.5 px-3.5">{report.elements.composition}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3.5 font-medium text-zinc-400">Fotografia</td>
                <td className="py-2.5 px-3.5">{report.elements.photography}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3.5 font-medium text-zinc-400">Elementos gráficos</td>
                <td className="py-2.5 px-3.5">{report.elements.graphicElements}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3.5 font-medium text-zinc-400">Comunicação</td>
                <td className="py-2.5 px-3.5">{report.elements.communication}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Os estilos predominantes */}
      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#CEF52A]" />
          <span>2. Os estilos predominantes</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {report.predominantStyles.map((style) => (
            <div
              key={style.id}
              className="bg-[#14171C] border border-zinc-800 rounded-xl p-3 flex flex-col justify-between hover:border-zinc-700 transition"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="w-6 h-6 rounded-md bg-[#CEF52A]/15 text-[#CEF52A] font-bold text-xs flex items-center justify-center">
                    {style.letter}
                  </span>
                  <span className="text-[10px] text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-full font-medium">
                    {style.tag}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white mb-1">{style.title}</h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{style.description}</p>
              </div>

              {onQuickAction && (
                <button
                  onClick={() =>
                    onQuickAction(
                      `Gere um post 4:5 no estilo "${style.title}", respeitando a paleta e diretrizes da marca.`
                    )
                  }
                  className="mt-3 text-[10px] text-[#CEF52A] hover:underline flex items-center gap-1 font-semibold pt-1 border-t border-zinc-800/60"
                >
                  <span>Criar com este estilo</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 3. O que torna essa identidade reconhecível */}
      <div className="space-y-2.5 pt-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Compass className="w-4 h-4 text-[#CEF52A]" />
          <span>3. O que torna essa identidade reconhecível?</span>
        </h3>
        <div className="bg-[#14171C] border border-zinc-800/90 rounded-xl p-3.5 space-y-2 text-xs text-zinc-300">
          {report.recognizableFeatures.map((feat, i) => (
            <div key={i} className="flex items-start gap-2 leading-relaxed">
              <span className="text-[#CEF52A] font-bold mt-0.5">•</span>
              <span>{feat.replace(/^\d+\.\s*/, '')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Diretrizes para as próximas criações (Manter vs Evitar) */}
      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Award className="w-4 h-4 text-[#CEF52A]" />
          <span>4. Diretrizes para as próximas criações</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Manter */}
          <div className="bg-[#121915] border border-emerald-900/50 rounded-xl p-3.5 space-y-2">
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-emerald-900/40">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Manter (Do)</span>
            </div>
            <ul className="space-y-1.5 text-xs text-emerald-100/90">
              {report.guidelines.keep.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Evitar */}
          <div className="bg-[#1c1214] border border-rose-900/50 rounded-xl p-3.5 space-y-2">
            <div className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-rose-900/40">
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Evitar (Don&apos;t)</span>
            </div>
            <ul className="space-y-1.5 text-xs text-rose-100/90">
              {report.guidelines.avoid.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-rose-400 font-bold">✕</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 5. Avaliação como Direção de Arte */}
      <div className="bg-[#181B20] border border-zinc-700/70 rounded-xl p-4 space-y-3 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white flex items-center gap-2">
            <span>5. Avaliação como Direção de Arte</span>
          </span>
          <span className="text-xs font-bold text-[#CEF52A] bg-[#CEF52A]/10 px-2 py-0.5 rounded border border-[#CEF52A]/20">
            {report.artDirectionReview.scoreLabel}
          </span>
        </div>

        {/* Progress bar */}
        <div>
          <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-[#CEF52A] h-2.5 rounded-full transition-all duration-700"
              style={{ width: `${report.artDirectionReview.consistencyScore}%` }}
            />
          </div>
          <span className="text-[10px] text-zinc-500 mt-1 block">
            Avaliação criada com base nas referências visuais oficiais do cliente.
          </span>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed italic border-l-2 border-[#CEF52A] pl-3">
          &ldquo;{report.artDirectionReview.conclusion}&rdquo;
        </p>

        {onQuickAction && (
          <div className="pt-2 flex flex-wrap gap-2">
            <button
              onClick={() =>
                onQuickAction(
                  'Gere um post 4:5 usando a identidade visual oficial da marca e este conceito consolidado.'
                )
              }
              className="px-3 py-1.5 bg-[#CEF52A] hover:bg-[#b8dd24] text-[#0B0F17] font-bold text-xs rounded-lg transition shadow flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Gerar Peça 4:5 com este DNA</span>
            </button>
            <button
              onClick={() =>
                onQuickAction(
                  'Crie uma capa de carrossel de alto impacto com espaço reservado para headline de autoridade.'
                )
              }
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs rounded-lg transition"
            >
              Capa de Carrossel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
