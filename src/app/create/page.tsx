'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppSidebar } from '@/components/layout/AppSidebar';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Image as ImageIcon,
  Check,
  Search,
  Plus,
  Trash2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Wand2,
  LayoutList,
  Eye,
  Upload,
} from 'lucide-react';
import { FORMATS, type FormatId } from '@/config/formats';

interface ClientItem {
  id: string;
  name: string;
  slug: string;
  brand_status: 'ready' | 'analyzing' | 'insufficient_data';
  organization_id: string;
  niche?: string | null;
  brandProfile?: {
    id: string;
    summary: string;
    colors: {
      primary: string[];
      accent: string[];
      text: string[];
    };
    typography: {
      detectedFonts: string[];
    };
  } | null;
  logoAsset?: {
    id: string;
    storage_path: string;
  } | null;
}

interface BrandReferenceItem {
  id: string;
  client_id: string;
  title: string;
  description?: string | null;
  reference_type: string;
  tags?: string[];
  image_url: string;
}

interface SlideDraft {
  title: string;
  body: string;
  cta?: string;
  subtitle?: string;
  instructions?: string;
  referenceType?: 'none' | 'client_piece' | 'external_upload';
  referenceImageUrl?: string;
  referenceTitle?: string;
}

function CreateProjectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get('client');

  // Wizard Step (1: Client, 2: Format & Type, 3: Content)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Data fetching state
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [clientSearch, setClientSearch] = useState('');

  // Form state
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [projectType, setProjectType] = useState<'single_post' | 'carousel'>('carousel');
  const [slideCount, setSlideCount] = useState<number>(4);
  const [format, setFormat] = useState<FormatId>('instagram_feed_4_5');

  // Step 3 Simplified State
  const [themePrompt, setThemePrompt] = useState('');
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'tabs' | 'list'>('tabs');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [globalDirective, setGlobalDirective] = useState('');

  const [slides, setSlides] = useState<SlideDraft[]>([
    {
      title: 'Como acelerar seus resultados com IA',
      body: 'Guia definitivo e prático para transformar sua operação visual.',
      cta: '',
    },
    {
      title: 'O maior desafio das operações criativas',
      body: 'Processos manuais consomem mais de 40% do tempo produtivo da sua equipe.',
      cta: '',
    },
    {
      title: 'A solução: Consistência e Automação',
      body: 'Preserve o DNA da sua marca e produza peças com precisão e escala.',
      cta: '',
    },
    {
      title: 'Pronto para transformar sua criação?',
      body: 'Descubra como o Studio FA potencializa sua agência.',
      cta: 'Fale Conosco',
    },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [clientReferences, setClientReferences] = useState<BrandReferenceItem[]>([]);
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [referenceTab, setReferenceTab] = useState<'client' | 'external'>('client');
  const [isDraggingExternalRef, setIsDraggingExternalRef] = useState(false);
  const externalRefFileInputRef = useRef<HTMLInputElement>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/settings/ai')
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.configured === 'boolean') {
          setAiConfigured(data.configured);
        }
      })
      .catch(() => {});
  }, []);

  // Load clients
  useEffect(() => {
    async function fetchClients() {
      try {
        setLoadingClients(true);
        const res = await fetch('/api/clients');
        const data = await res.json();
        if (data.clients) {
          setClients(data.clients);
          if (data.clients.length > 0) {
            const matched = preselectedClientId
              ? data.clients.find(
                  (c: ClientItem) => c.id === preselectedClientId || c.slug === preselectedClientId
                )
              : null;
            if (matched) {
              setSelectedClientId(matched.id);
              setStep(2);
            } else {
              setSelectedClientId(data.clients[0].id);
            }
          }
        }
      } catch (err) {
        console.error('Falha ao carregar clientes:', err);
      } finally {
        setLoadingClients(false);
      }
    }
    fetchClients();
  }, [preselectedClientId]);

  // Load client references whenever selectedClientId changes
  useEffect(() => {
    if (!selectedClientId) {
      setClientReferences([]);
      return;
    }
    let active = true;
    setLoadingReferences(true);
    fetch(`/api/clients/${selectedClientId}/references`)
      .then((res) => res.json())
      .then((data) => {
        if (active && data.references) {
          setClientReferences(data.references);
        }
      })
      .catch((err) => console.error('Falha ao carregar referências do cliente:', err))
      .finally(() => {
        if (active) setLoadingReferences(false);
      });

    return () => {
      active = false;
    };
  }, [selectedClientId]);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  // Visual Reference Handlers
  const handleSelectClientReference = (ref: BrandReferenceItem) => {
    setSlides((prev) => {
      const next = [...prev];
      next[activeSlideIndex] = {
        ...next[activeSlideIndex],
        referenceType: 'client_piece',
        referenceImageUrl: ref.image_url,
        referenceTitle: ref.title,
      };
      return next;
    });
  };

  const handleExternalRefFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor selecione um arquivo de imagem válido (PNG, JPG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setSlides((prev) => {
        const next = [...prev];
        next[activeSlideIndex] = {
          ...next[activeSlideIndex],
          referenceType: 'external_upload',
          referenceImageUrl: dataUrl,
          referenceTitle: file.name,
        };
        return next;
      });
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSlideReference = (slideIdx: number) => {
    setSlides((prev) => {
      const next = [...prev];
      next[slideIdx] = {
        ...next[slideIdx],
        referenceType: undefined,
        referenceImageUrl: undefined,
        referenceTitle: undefined,
      };
      return next;
    });
  };

  const handleApplyReferenceToAllSlides = (slideIdx: number) => {
    const currentRef = slides[slideIdx];
    if (!currentRef?.referenceImageUrl) return;
    setSlides((prev) =>
      prev.map((s) => ({
        ...s,
        referenceType: currentRef.referenceType,
        referenceImageUrl: currentRef.referenceImageUrl,
        referenceTitle: currentRef.referenceTitle,
      }))
    );
  };

  // Handle Project Type Change
  const handleTypeChange = (type: 'single_post' | 'carousel') => {
    setProjectType(type);
    if (type === 'single_post') {
      setSlides((prev) => [
        prev[0] || {
          title: 'Novo Post',
          body: 'Texto descritivo e contextual da arte.',
          cta: 'Saiba Mais',
        },
      ]);
      setActiveSlideIndex(0);
    } else {
      handleSlideCountChange(Math.max(2, slideCount));
    }
  };

  // Sync slides array length
  const handleSlideCountChange = (count: number) => {
    setSlideCount(count);
    setSlides((prev) => {
      const next = [...prev];
      while (next.length < count) {
        const idx = next.length + 1;
        next.push({
          title: idx === count ? 'Chamada para Ação' : `Tópico ${idx}`,
          body: '',
          cta: idx === count ? 'Saiba Mais' : undefined,
        });
      }
      return next.slice(0, count);
    });
    if (activeSlideIndex >= count) {
      setActiveSlideIndex(count - 1);
    }
  };

  const updateSlideField = (index: number, field: keyof SlideDraft, value: string) => {
    setSlides((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddSlide = () => {
    const nextCount = slides.length + 1;
    handleSlideCountChange(nextCount);
    setActiveSlideIndex(nextCount - 1);
  };

  const handleRemoveSlide = (indexToRemove: number) => {
    if (slides.length <= 1) return;
    setSlides((prev) => prev.filter((_, i) => i !== indexToRemove));
    setSlideCount((prev) => prev - 1);
    if (activeSlideIndex >= slides.length - 1) {
      setActiveSlideIndex(Math.max(0, slides.length - 2));
    }
  };

  // AI Instant Copy Generator
  const handleGenerateCopyFromTheme = () => {
    if (!themePrompt.trim()) return;

    setIsGeneratingCopy(true);
    const theme = themePrompt.trim();
    const clientNiche = selectedClient?.niche || 'Geral';

    setTimeout(() => {
      if (projectType === 'single_post') {
        setSlides([
          {
            title: theme,
            body: `Descubra as principais estratégias e soluções práticas no segmento de ${clientNiche}. Conteúdo exclusivo e direto ao ponto.`,
            cta: 'Saiba Mais',
          },
        ]);
      } else {
        const generated: SlideDraft[] = [];
        const count = slides.length;

        for (let i = 0; i < count; i++) {
          if (i === 0) {
            generated.push({
              title: theme,
              body: `O guia definitivo com os passos essenciais para dominar este tema em ${clientNiche}.`,
              cta: '',
            });
          } else if (i === count - 1) {
            generated.push({
              title: 'Gostou deste conteúdo?',
              body: `Aplique essas dicas hoje mesmo para acelerar seus resultados. Salve este carrossel e compartilhe com sua equipe!`,
              cta: 'Fale Conosco',
            });
          } else {
            const stepNum = i;
            generated.push({
              title: `Passo ${stepNum}: Estratégia Prática`,
              body: `Foque na consistência e na aplicação clara dos princípios para maximizar a eficiência no dia a dia.`,
              cta: '',
            });
          }
        }
        setSlides(generated);
      }

      setIsGeneratingCopy(false);
    }, 400);
  };

  // Submit and create project
  const handleSubmit = async () => {
    if (!selectedClient) {
      setErrorMsg('Selecione um cliente para prosseguir.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const title =
        projectTitle.trim() ||
        `${projectType === 'carousel' ? 'Carrossel' : 'Post'} ${selectedClient.name} — ${new Date().toLocaleDateString('pt-BR')}`;

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: selectedClient.organization_id,
          clientId: selectedClient.id,
          title,
          projectType,
          format,
          globalCreativeDirective: globalDirective,
          slides: projectType === 'single_post' ? [slides[0]] : slides,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || 'Falha ao criar projeto');
      }

      const { project } = await res.json();
      router.push(`/projects/${project.id}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado ao gerar projeto');
      setSubmitting(false);
    }
  };

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.slug.toLowerCase().includes(clientSearch.toLowerCase())
  );

  return (
    <div className="flex h-screen w-full bg-[#F6F7F8] font-sans overflow-hidden">
      <AppSidebar />

      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Top Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between sticky top-0 z-10 shadow-2xs">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-black" />
              <span>Nova Produção Criativa</span>
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Crie posts e carrosséis com IA mantendo a identidade visual da marca.
            </p>
          </div>

          {/* Stepper Progress */}
          <div className="flex items-center gap-3">
            {[
              { num: 1, label: 'Cliente' },
              { num: 2, label: 'Formato' },
              { num: 3, label: 'Conteúdo' },
            ].map((s) => (
              <div key={s.num} className="flex items-center gap-2">
                <button
                  onClick={() => s.num < step && setStep(s.num as any)}
                  disabled={s.num > step}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                    step === s.num
                      ? 'bg-black text-[#CEF52A]'
                      : step > s.num
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                </button>
                <span
                  className={`text-xs font-medium hidden sm:inline ${
                    step === s.num ? 'text-gray-900 font-bold' : 'text-gray-400'
                  }`}
                >
                  {s.label}
                </span>
                {s.num < 3 && <div className="w-6 h-px bg-gray-300 hidden sm:block" />}
              </div>
            ))}
          </div>
        </div>

        {/* Wizard Step Body */}
        <div className="max-w-4xl w-full mx-auto p-6 sm:p-8 flex-1">
          {errorMsg && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: CLIENT SELECTION */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Selecione o Cliente</h2>
                  <p className="text-xs text-gray-500">
                    O Studio FA carregará automaticamente as cores, fontes, logos e referências da marca.
                  </p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              {loadingClients ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-28 bg-gray-200 animate-pulse rounded-2xl" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredClients.map((client) => {
                    const isSelected = client.id === selectedClientId;

                    return (
                      <div
                        key={client.id}
                        onClick={() => setSelectedClientId(client.id)}
                        className={`p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer relative bg-white ${
                          isSelected
                            ? 'border-black shadow-md ring-1 ring-black'
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gray-950 border border-gray-200 flex items-center justify-center font-bold text-sm text-[#CEF52A] uppercase overflow-hidden shadow-2xs">
                              {client.logoAsset?.storage_path ? (
                                <img
                                  src={client.logoAsset.storage_path}
                                  alt={client.name}
                                  className="w-full h-full object-contain p-1"
                                />
                              ) : (
                                client.name.substring(0, 2)
                              )}
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900 text-sm">{client.name}</h3>
                              <p className="text-[11px] text-gray-400 font-mono">@{client.slug}</p>
                            </div>
                          </div>

                          {isSelected && (
                            <span className="w-6 h-6 rounded-full bg-black text-[#CEF52A] flex items-center justify-center">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            DNA Visual Ativo
                          </span>

                          {client.niche && (
                            <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded truncate max-w-[160px]">
                              {client.niche}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setStep(2)}
                  disabled={!selectedClientId}
                  className="px-6 py-3 bg-black text-[#CEF52A] rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-gray-800 transition disabled:opacity-50 shadow-sm"
                >
                  <span>Continuar para Formato</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: FORMAT & PROJECT TYPE */}
          {step === 2 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Tipo de Produção</h2>
                <p className="text-xs text-gray-500">
                  Escolha entre um post único ou uma sequência narrativa em carrossel.
                </p>
              </div>

              {/* Post Único vs Carrossel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => handleTypeChange('single_post')}
                  className={`p-6 rounded-2xl border-2 transition-all cursor-pointer bg-white ${
                    projectType === 'single_post'
                      ? 'border-black shadow-md ring-1 ring-black'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-4 text-black">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">Post Único</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    1 lâmina com mensagem direta e alto impacto visual.
                  </p>
                </div>

                <div
                  onClick={() => handleTypeChange('carousel')}
                  className={`p-6 rounded-2xl border-2 transition-all cursor-pointer bg-white ${
                    projectType === 'carousel'
                      ? 'border-black shadow-md ring-1 ring-black'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-4 text-black">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">Carrossel Narrativo</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Sequência contínua com capa, conteúdo e fechamento com chamada para ação.
                  </p>
                </div>
              </div>

              {/* Number of Slides (for carousel) */}
              {projectType === 'carousel' && (
                <div className="bg-white p-5 rounded-2xl border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider">
                        Quantidade de Lâminas
                      </h4>
                      <p className="text-xs text-gray-500">Escolha o tamanho ideal para sua narrativa</p>
                    </div>

                    <span className="text-sm font-black text-black bg-[#CEF52A] px-3 py-1 rounded-xl">
                      {slideCount} lâminas
                    </span>
                  </div>

                  {/* Quick Select Buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[3, 4, 5, 7, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleSlideCountChange(num)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          slideCount === num
                            ? 'bg-black text-[#CEF52A]'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {num} slides {num === 4 ? '(Padrão)' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Format Selection */}
              <div>
                <h3 className="font-bold text-gray-900 text-sm mb-1">Formato da Imagem</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Proporções nativas otimizadas para o feed e stories do Instagram.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(Object.keys(FORMATS) as FormatId[]).map((fmtKey) => {
                    const fmt = FORMATS[fmtKey];
                    const isSelected = format === fmtKey;

                    return (
                      <div
                        key={fmtKey}
                        onClick={() => setFormat(fmtKey)}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer bg-white text-center flex flex-col justify-between ${
                          isSelected
                            ? 'border-black shadow-sm ring-1 ring-black'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-gray-900">{fmt.name}</div>
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                            {fmt.aspectRatio} ({fmt.exportWidth}x{fmt.exportHeight})
                          </div>
                        </div>

                        {fmtKey === 'instagram_feed_4_5' && (
                          <span className="mt-2 text-[10px] text-emerald-700 font-semibold bg-emerald-50 py-0.5 px-2 rounded-full self-center">
                            Recomendado
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Stepper Buttons */}
              <div className="flex justify-between pt-4 border-t border-gray-200">
                <button
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium text-xs hover:bg-gray-50 transition flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="px-6 py-3 bg-black text-[#CEF52A] rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-gray-800 transition shadow-sm"
                >
                  <span>Continuar para Conteúdo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: CONTENT & CREATIVE DIRECTION (SIMPLIFIED & FUNCTIONAL) */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Header with Title and Mode Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Conteúdo das Lâminas</h2>
                  <p className="text-xs text-gray-500">
                    Digite o tema para gerar com IA ou preencha diretamente os textos de cada lâmina.
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-gray-200 p-1 rounded-xl self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setViewMode('tabs')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                      viewMode === 'tabs'
                        ? 'bg-white text-black shadow-2xs font-bold'
                        : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Por Lâmina</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                      viewMode === 'list'
                        ? 'bg-white text-black shadow-2xs font-bold'
                        : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                    <span>Ver Todas</span>
                  </button>
                </div>
              </div>

              {/* FAST AI GENERATOR BOX (SUPER SIMPLE) */}
              <div className="bg-zinc-950 text-white p-5 rounded-2xl border border-zinc-800 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#CEF52A] uppercase tracking-wider">
                    <Wand2 className="w-4 h-4" />
                    <span>Gerador Rápido com IA (Roteiro em 1 Clique)</span>
                  </div>
                  {aiConfigured !== null && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1.5 ${
                        aiConfigured
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                          : 'bg-zinc-900 text-zinc-400 border border-zinc-700'
                      }`}
                      title={
                        aiConfigured
                          ? 'OpenAI DALL-E 3 ativo para geração de fundos originais'
                          : 'Chave OpenAI não configurada (usando gerador vetorial de marca)'
                      }
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${aiConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                      {aiConfigured ? 'DALL-E 3 Conectado' : 'Modo Vetorial (Sem Chave)'}
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    placeholder="Digite o tema, ideia ou cole o roteiro (Ex: 5 erros comuns de design e como evitar)"
                    value={themePrompt}
                    onChange={(e) => setThemePrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerateCopyFromTheme()}
                    className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-[#CEF52A]"
                  />

                  <button
                    type="button"
                    onClick={handleGenerateCopyFromTheme}
                    disabled={isGeneratingCopy || !themePrompt.trim()}
                    className="px-5 py-2.5 bg-[#CEF52A] hover:bg-[#bce022] text-black font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50 shrink-0"
                  >
                    {isGeneratingCopy ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        <span>Preenchendo...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Preencher Lâminas com IA</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* TABBED SLIDE EDITOR (FOCUS MODE) */}
              {viewMode === 'tabs' && (
                <div className="space-y-4">
                  {/* Slide Tabs Navigation Bar */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {slides.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveSlideIndex(idx)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                          activeSlideIndex === idx
                            ? 'bg-black text-[#CEF52A] shadow-xs'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span>{idx + 1}.</span>
                        <span>
                          {idx === 0
                            ? 'Capa'
                            : idx === slides.length - 1
                            ? 'CTA Final'
                            : `Lâmina ${idx + 1}`}
                        </span>
                      </button>
                    ))}

                    {projectType === 'carousel' && (
                      <button
                        type="button"
                        onClick={handleAddSlide}
                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1 transition"
                        title="Adicionar Lâmina"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Adicionar</span>
                      </button>
                    )}
                  </div>

                  {/* Active Slide Form Card (Minimal, 2 Simple Fields) */}
                  {slides[activeSlideIndex] && (
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs space-y-4 animate-in fade-in duration-100">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-black text-[#CEF52A] flex items-center justify-center font-bold text-xs">
                            {activeSlideIndex + 1}
                          </span>
                          <span className="font-bold text-sm text-gray-900">
                            {activeSlideIndex === 0
                              ? 'Lâmina 1 — Capa Principal'
                              : activeSlideIndex === slides.length - 1
                              ? `Lâmina ${activeSlideIndex + 1} — Chamada Final (CTA)`
                              : `Lâmina ${activeSlideIndex + 1} — Conteúdo`}
                          </span>
                        </div>

                        {slides.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSlide(activeSlideIndex)}
                            className="text-gray-400 hover:text-red-500 p-1 rounded transition text-xs flex items-center gap-1"
                            title="Remover esta lâmina"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="text-[11px]">Remover lâmina</span>
                          </button>
                        )}
                      </div>

                      {/* Field 1: Título Principal */}
                      <div>
                        <label className="block text-xs font-bold text-gray-800 mb-1">
                          Título Principal da Lâmina <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Digite a frase principal ou manchete"
                          value={slides[activeSlideIndex].title}
                          onChange={(e) => updateSlideField(activeSlideIndex, 'title', e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-gray-300 focus:outline-none focus:border-black bg-white"
                        />
                      </div>

                      {/* Field 2: Texto de Apoio (Opcional) */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Texto de Apoio / Explicativo (Opcional)
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Texto secundário para complementar o título (opcional)..."
                          value={slides[activeSlideIndex].body}
                          onChange={(e) => updateSlideField(activeSlideIndex, 'body', e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-black bg-white resize-none"
                        />
                      </div>

                      {/* CTA Field (Only for final slide or single post) */}
                      {(activeSlideIndex === slides.length - 1 || projectType === 'single_post') && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Botão de Chamada para Ação / CTA (Opcional)
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: Fale Conosco / Saiba Mais / Comente EU QUERO"
                            value={slides[activeSlideIndex].cta || ''}
                            onChange={(e) => updateSlideField(activeSlideIndex, 'cta', e.target.value)}
                            className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-black bg-white"
                          />
                        </div>
                      )}

                      {/* Visual Reference Section */}
                      <div className="pt-3 border-t border-gray-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5 text-black" />
                            <span>Referência Visual / Estilo (Opcional)</span>
                          </label>
                          {slides[activeSlideIndex].referenceImageUrl && (
                            <div className="flex items-center gap-2">
                              {projectType === 'carousel' && (
                                <button
                                  type="button"
                                  onClick={() => handleApplyReferenceToAllSlides(activeSlideIndex)}
                                  className="text-[11px] text-gray-500 hover:text-black font-medium transition flex items-center gap-1"
                                  title="Usar esta mesma referência em todas as lâminas deste carrossel"
                                >
                                  <Layers className="w-3 h-3" />
                                  <span>Aplicar a todas as lâminas</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveSlideReference(activeSlideIndex)}
                                className="text-[11px] text-red-500 hover:text-red-700 font-semibold flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Remover</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {slides[activeSlideIndex].referenceImageUrl ? (
                          // Reference Active Preview
                          <div className="flex items-center gap-3 p-3 bg-zinc-900 text-white rounded-xl border border-zinc-800 shadow-xs">
                            <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700">
                              <img
                                src={slides[activeSlideIndex].referenceImageUrl}
                                alt={slides[activeSlideIndex].referenceTitle || 'Referência'}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded bg-[#CEF52A] text-black text-[10px] font-bold">
                                  {slides[activeSlideIndex].referenceType === 'client_piece'
                                    ? 'Peça do Cliente'
                                    : 'Upload Externo'}
                                </span>
                                <span className="text-xs font-bold text-white truncate">
                                  {slides[activeSlideIndex].referenceTitle || 'Imagem de Referência'}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                                A composição utilizará este design/fundo como referência visual.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveSlideReference(activeSlideIndex)}
                              className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-medium transition"
                            >
                              Trocar
                            </button>
                          </div>
                        ) : (
                          // Select Reference (Client Pieces vs External Upload with Dropdown/Dropzone)
                          <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setReferenceTab('client')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                                  referenceTab === 'client'
                                    ? 'bg-black text-[#CEF52A] shadow-xs'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-black'
                                }`}
                              >
                                <Layers className="w-3.5 h-3.5" />
                                <span>Peças do Cliente ({clientReferences.length})</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setReferenceTab('external')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                                  referenceTab === 'external'
                                    ? 'bg-black text-[#CEF52A] shadow-xs'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-black'
                                }`}
                              >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Upload Externo (Drag & Drop)</span>
                              </button>
                            </div>

                            {referenceTab === 'client' && (
                              <div>
                                {loadingReferences ? (
                                  <div className="p-4 text-center text-xs text-gray-500 bg-gray-50 rounded-xl">
                                    Carregando peças do cliente...
                                  </div>
                                ) : clientReferences.length === 0 ? (
                                  <div className="p-4 text-center text-xs text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                    <p className="font-semibold text-gray-700">Nenhuma peça cadastrada para este cliente.</p>
                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                      Cadastre peças na aba de Clientes ou faça o upload de uma referência externa ao lado.
                                    </p>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1">
                                    {clientReferences.map((ref) => (
                                      <button
                                        key={ref.id}
                                        type="button"
                                        onClick={() => handleSelectClientReference(ref)}
                                        className="group relative rounded-xl border border-gray-200 hover:border-black p-1 text-left bg-white hover:shadow-xs transition flex flex-col items-center"
                                      >
                                        <div className="w-full h-20 rounded-lg overflow-hidden bg-gray-100 relative">
                                          <img
                                            src={ref.image_url}
                                            alt={ref.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                          />
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="px-2 py-1 bg-black text-[#CEF52A] text-[10px] font-bold rounded-md">
                                              Usar Peça
                                            </span>
                                          </div>
                                        </div>
                                        <span className="text-[11px] font-medium text-gray-800 truncate w-full mt-1 px-1">
                                          {ref.title}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {referenceTab === 'external' && (
                              <div>
                                <input
                                  ref={externalRefFileInputRef}
                                  type="file"
                                  accept="image/png, image/jpeg, image/webp"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleExternalRefFile(file);
                                    e.target.value = '';
                                  }}
                                />

                                <div
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsDraggingExternalRef(true);
                                  }}
                                  onDragLeave={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsDraggingExternalRef(false);
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsDraggingExternalRef(false);
                                    const file = e.dataTransfer.files?.[0];
                                    if (file) handleExternalRefFile(file);
                                  }}
                                  onClick={() => externalRefFileInputRef.current?.click()}
                                  className={`cursor-pointer rounded-xl border-2 border-dashed p-5 flex flex-col items-center justify-center text-center transition ${
                                    isDraggingExternalRef
                                      ? 'border-black bg-lime-100/70 ring-2 ring-[#CEF52A]'
                                      : 'border-gray-300 hover:border-black bg-gray-50/50 hover:bg-gray-50'
                                  }`}
                                >
                                  <Upload
                                    className={`w-6 h-6 mb-1.5 ${
                                      isDraggingExternalRef ? 'text-black animate-bounce' : 'text-gray-400'
                                    }`}
                                  />
                                  <span className="text-xs font-bold text-gray-800">
                                    {isDraggingExternalRef
                                      ? 'Solte a imagem aqui!'
                                      : 'Arraste a referência aqui ou clique para selecionar'}
                                  </span>
                                  <span className="text-[10px] text-gray-400 mt-0.5">
                                    PNG, JPG ou WEBP (Será usada como referência de estilo/layout)
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Navigation between slides */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <button
                          type="button"
                          disabled={activeSlideIndex === 0}
                          onClick={() => setActiveSlideIndex((prev) => Math.max(0, prev - 1))}
                          className="text-xs text-gray-600 hover:text-black font-semibold flex items-center gap-1 disabled:opacity-30 disabled:hover:text-gray-600"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Lâmina Anterior</span>
                        </button>

                        <span className="text-[11px] text-gray-400 font-mono">
                          {activeSlideIndex + 1} de {slides.length}
                        </span>

                        <button
                          type="button"
                          disabled={activeSlideIndex === slides.length - 1}
                          onClick={() => setActiveSlideIndex((prev) => Math.min(slides.length - 1, prev + 1))}
                          className="text-xs text-gray-600 hover:text-black font-semibold flex items-center gap-1 disabled:opacity-30 disabled:hover:text-gray-600"
                        >
                          <span>Próxima Lâmina</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* LIST VIEW (COMPACT) */}
              {viewMode === 'list' && (
                <div className="space-y-3">
                  {slides.map((s, idx) => (
                    <div
                      key={idx}
                      className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-gray-900 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-black text-[#CEF52A] flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </span>
                          <span>
                            {idx === 0
                              ? 'Capa Principal'
                              : idx === slides.length - 1
                              ? 'Chamada Final (CTA)'
                              : `Lâmina ${idx + 1}`}
                          </span>
                        </span>

                        {slides.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSlide(idx)}
                            className="text-gray-400 hover:text-red-500 p-1"
                            title="Remover lâmina"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          placeholder="Título Principal *"
                          value={s.title}
                          onChange={(e) => updateSlideField(idx, 'title', e.target.value)}
                          className="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-300 focus:outline-none focus:border-black bg-white"
                        />

                        <input
                          type="text"
                          placeholder="Texto de Apoio (Opcional)"
                          value={s.body}
                          onChange={(e) => updateSlideField(idx, 'body', e.target.value)}
                          className="px-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-black bg-white"
                        />
                      </div>

                      {idx === slides.length - 1 && (
                        <input
                          type="text"
                          placeholder="Texto do Botão CTA (Ex: Saiba Mais)"
                          value={s.cta || ''}
                          onChange={(e) => updateSlideField(idx, 'cta', e.target.value)}
                          className="w-full sm:w-1/2 px-3 py-1.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-black bg-white"
                        />
                      )}

                      {/* Reference Preview or Quick Button in List View */}
                      {s.referenceImageUrl ? (
                        <div className="flex items-center justify-between p-2 bg-zinc-900 text-white rounded-lg text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={s.referenceImageUrl}
                              alt="Referência"
                              className="w-6 h-6 rounded object-cover border border-zinc-700 shrink-0"
                            />
                            <span className="text-[11px] truncate">
                              Ref: {s.referenceTitle || 'Imagem'} ({s.referenceType === 'client_piece' ? 'Peça do Cliente' : 'Upload'})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveSlideReference(idx)}
                            className="text-zinc-400 hover:text-red-400 p-1"
                            title="Remover referência"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSlideIndex(idx);
                              setViewMode('tabs');
                            }}
                            className="text-[11px] text-gray-500 hover:text-black flex items-center gap-1 font-medium"
                          >
                            <ImageIcon className="w-3 h-3" />
                            <span>Definir Referência Visual</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {projectType === 'carousel' && (
                    <button
                      type="button"
                      onClick={handleAddSlide}
                      className="w-full py-2.5 rounded-xl border border-dashed border-gray-300 hover:border-black text-gray-600 hover:text-black text-xs font-semibold flex items-center justify-center gap-1.5 transition bg-white/60 hover:bg-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar Nova Lâmina</span>
                    </button>
                  )}
                </div>
              )}

              {/* COLLAPSIBLE ADVANCED OPTIONS (OUT OF SIGHT BY DEFAULT) */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  className="text-xs text-gray-500 hover:text-black flex items-center gap-1.5 transition font-medium"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Configurações Opcionais (Título do Projeto & Instruções Globais)</span>
                  {showAdvancedOptions ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {showAdvancedOptions && (
                  <div className="mt-3 bg-white p-4 rounded-xl border border-gray-200 space-y-3 animate-in fade-in duration-100">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Título do Projeto
                      </label>
                      <input
                        type="text"
                        placeholder={`Ex: Carrossel ${selectedClient?.name} — ${new Date().toLocaleDateString('pt-BR')}`}
                        value={projectTitle}
                        onChange={(e) => setProjectTitle(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-black bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Diretriz Criativa Geral (Opcional)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Instruções gerais sobre o tom, iluminação ou estilo..."
                        value={globalDirective}
                        onChange={(e) => setGlobalDirective(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-black bg-white resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Final Actions */}
              <div className="flex justify-between items-center pt-6 border-t border-gray-200">
                <button
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium text-xs hover:bg-gray-50 transition flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-8 py-3.5 bg-black hover:bg-gray-800 text-[#CEF52A] rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-lg disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-[#CEF52A] border-t-transparent rounded-full animate-spin" />
                      <span>Criando Produção...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Criar e Abrir no Estúdio FA</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function CreateProjectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full bg-[#F6F7F8] items-center justify-center text-xs text-gray-500">
          Carregando criação de produções...
        </div>
      }
    >
      <CreateProjectContent />
    </Suspense>
  );
}
