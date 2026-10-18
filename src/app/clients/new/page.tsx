// src/app/clients/new/page.tsx
'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppSidebar } from '@/components/layout/AppSidebar';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Building2,
  Palette,
  FileText,
  ImageIcon,
  CheckCircle2,
  Upload,
  Trash2,
  AlertCircle,
  Sparkles,
  Info,
  Layers,
  Globe,
  Instagram,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

interface LogoUpload {
  base64: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface PieceUploadItem {
  id: string;
  file: File;
  base64: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  aspectRatio: number;
  formatType: 'feed' | 'story' | 'square' | 'cover' | 'custom';
  formatLabel: string;
  pieceType: 'own_brand' | 'external_reference' | 'promotional';
}

const NICHE_SUGGESTIONS = [
  'Tecnologia & SaaS',
  'Moda & Vestuário',
  'Saúde & Bem-Estar',
  'Gastronomia & Restaurantes',
  'Imobiliário & Arquitetura',
  'Direito & Consultoria',
  'Educação & Cursos',
  'Finanças & Investimentos',
  'Beleza & Estética',
];

const STANDARD_FONTS = [
  'Inter',
  'Montserrat',
  'Plus Jakarta Sans',
  'Poppins',
  'Playfair Display',
  'Syne',
  'Space Grotesk',
  'Cinzel',
];

export default function NewClientWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitProgress, setSubmitProgress] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Passo 1: Dados do Cliente
  const [name, setName] = useState<string>('');
  const [niche, setNiche] = useState<string>('');
  const [instagram, setInstagram] = useState<string>('');
  const [website, setWebsite] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Passo 2: Identidade Visual & Logos
  const [primaryColor, setPrimaryColor] = useState<string>('#0F1113');
  const [secondaryColor, setSecondaryColor] = useState<string>('#1F2937');
  const [accentColor, setAccentColor] = useState<string>('#CEF52A');
  const [primaryFont, setPrimaryFont] = useState<string>('Inter');
  const [secondaryFont, setSecondaryFont] = useState<string>('Inter');

  const [primaryLogo, setPrimaryLogo] = useState<LogoUpload | null>(null);
  const [secondaryLogo, setSecondaryLogo] = useState<LogoUpload | null>(null);
  const [monochromeLogo, setMonochromeLogo] = useState<LogoUpload | null>(null);

  // Passo 3: Diretrizes Manuais da Marca (Soberanas)
  const [manualGuidelines, setManualGuidelines] = useState<string>('');

  // Passo 4: Peças de Referência (Opcional)
  const [pieces, setPieces] = useState<PieceUploadItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper para normalizar Instagram na visualização
  const cleanInstagram = instagram
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '')
    .replace(/^@+/, '')
    .trim();

  // Função para processar arquivo de logo
  const handleLogoFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (logo: LogoUpload | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor selecione um arquivo de imagem válido (PNG, SVG, WEBP, JPG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setter({
        base64: reader.result as string,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      });
      setErrorMessage(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Função para classificar proporção da imagem
  const detectImageFormat = (width: number, height: number): {
    formatType: 'feed' | 'story' | 'square' | 'cover' | 'custom';
    formatLabel: string;
    aspectRatio: number;
  } => {
    const ratio = Number((width / height).toFixed(4));
    if (ratio <= 0.65) {
      return { formatType: 'story', formatLabel: 'Story (9:16)', aspectRatio: ratio };
    }
    if (ratio >= 0.72 && ratio <= 0.88) {
      return { formatType: 'feed', formatLabel: 'Feed Retrato (4:5)', aspectRatio: ratio };
    }
    if (ratio >= 0.92 && ratio <= 1.08) {
      return { formatType: 'square', formatLabel: 'Quadrado (1:1)', aspectRatio: ratio };
    }
    if (ratio >= 1.25) {
      return { formatType: 'cover', formatLabel: 'Capa / Horizontal (16:9)', aspectRatio: ratio };
    }
    return { formatType: 'custom', formatLabel: `${width}x${height}`, aspectRatio: ratio };
  };

  // Processa upload de peças de referência em lote
  const handlePiecesUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remainingSlots = 30 - pieces.length;
    if (remainingSlots <= 0) {
      setErrorMessage('Limite máximo de 30 peças por cliente atingido.');
      return;
    }

    const selectedFiles = Array.from(files).slice(0, remainingSlots);

    selectedFiles.forEach((file) => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const { formatType, formatLabel, aspectRatio } = detectImageFormat(img.width, img.height);
          const newItem: PieceUploadItem = {
            id: `piece-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            file,
            base64,
            filename: file.name,
            mimeType: file.type,
            size: file.size,
            width: img.width,
            height: img.height,
            aspectRatio,
            formatType,
            formatLabel,
            pieceType: 'own_brand',
          };
          setPieces((prev) => [...prev, newItem]);
        };
        img.src = base64;
      };
      reader.readAsDataURL(file);
    });

    setErrorMessage(null);
  };

  const removePiece = (id: string) => {
    setPieces((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePieceType = (id: string, pieceType: 'own_brand' | 'external_reference' | 'promotional') => {
    setPieces((prev) => prev.map((p) => (p.id === id ? { ...p, pieceType } : p)));
  };

  // Validação de etapas
  const validateStep = (step: number): boolean => {
    if (step === 1) {
      if (!name || name.trim().length < 2) {
        setErrorMessage('Por favor, informe o nome do cliente (mínimo de 2 caracteres).');
        return false;
      }
    }
    setErrorMessage(null);
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handlePrev = () => {
    setErrorMessage(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Submissão final do cadastro unificado
  const handleFinalSubmit = async () => {
    if (!validateStep(1)) return;

    setSubmitting(true);
    setSubmitProgress('Criando cadastro do cliente no Studio FA...');
    setErrorMessage(null);

    try {
      // Monta payload
      const payload: any = {
        name: name.trim(),
        niche: niche.trim() || null,
        instagram_handle: cleanInstagram ? `@${cleanInstagram}` : null,
        website: website.trim() || null,
        notes: notes.trim() || null,
        manual_guidelines: manualGuidelines.trim() || null,
        primaryColors: [primaryColor],
        secondaryColors: [secondaryColor],
        accentColors: [accentColor],
        primaryFont,
        secondaryFont,
        primaryLogo: primaryLogo
          ? {
              base64: primaryLogo.base64,
              filename: primaryLogo.filename,
              mimeType: primaryLogo.mimeType,
              size: primaryLogo.size,
            }
          : undefined,
        secondaryLogo: secondaryLogo
          ? {
              base64: secondaryLogo.base64,
              filename: secondaryLogo.filename,
              mimeType: secondaryLogo.mimeType,
              size: secondaryLogo.size,
            }
          : undefined,
        monochromeLogo: monochromeLogo
          ? {
              base64: monochromeLogo.base64,
              filename: monochromeLogo.filename,
              mimeType: monochromeLogo.mimeType,
              size: monochromeLogo.size,
            }
          : undefined,
        initialPieces: pieces.map((p) => ({
          filename: p.filename,
          base64: p.base64,
          mimeType: p.mimeType,
          width: p.width,
          height: p.height,
          aspectRatio: p.aspectRatio,
          formatType: p.formatType,
          pieceType: p.pieceType,
        })),
      };

      setSubmitProgress(
        pieces.length > 0
          ? `Persistindo logos e ${pieces.length} peça(s) no Supabase Storage...`
          : 'Persistindo logos e identidade no Supabase...'
      );

      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || 'Falha ao salvar cliente.');
      }

      setSubmitProgress('Cliente cadastrado com sucesso! Redirecionando...');
      const createdId = data.client?.id;

      if (createdId) {
        router.push(`/clients/${createdId}`);
      } else {
        router.push('/clients');
      }
    } catch (err: any) {
      console.error('Erro na criação do cliente:', err);
      setErrorMessage(err?.message || 'Ocorreu um erro ao salvar o cliente. Tente novamente.');
      setSubmitting(false);
    }
  };

  const stepsList = [
    { number: 1, label: 'Dados do Cliente', icon: Building2 },
    { number: 2, label: 'Identidade & Logos', icon: Palette },
    { number: 3, label: 'Diretrizes Manuais', icon: FileText },
    { number: 4, label: 'Peças de Referência', icon: ImageIcon },
    { number: 5, label: 'Revisão & Conclusão', icon: CheckCircle2 },
  ];

  return (
    <div className="flex h-screen w-full bg-[#F6F7F8] font-sans overflow-hidden">
      <AppSidebar />

      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Top Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
          <div className="flex items-center gap-4">
            <Link
              href="/clients"
              className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-xl transition"
              title="Voltar para Clientes"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span>Cadastro Unificado de Cliente</span>
                <span className="text-[11px] bg-black text-[#CEF52A] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Fase B
                </span>
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Passo {currentStep} de 5: {stepsList[currentStep - 1].label}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/clients"
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-black transition"
            >
              Cancelar
            </Link>
          </div>
        </div>

        {/* Stepper Progress Bar */}
        <div className="bg-white border-b border-gray-200 px-8 py-3 sticky top-[73px] z-10">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            {stepsList.map((step, idx) => {
              const Icon = step.icon;
              const isDone = currentStep > step.number;
              const isCurrent = currentStep === step.number;

              return (
                <React.Fragment key={step.number}>
                  <div
                    onClick={() => {
                      if (step.number < currentStep) setCurrentStep(step.number);
                    }}
                    className={`flex items-center gap-2 cursor-pointer transition ${
                      isCurrent
                        ? 'text-black font-bold'
                        : isDone
                        ? 'text-emerald-700'
                        : 'text-gray-400'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition ${
                        isCurrent
                          ? 'bg-black text-[#CEF52A] shadow-2xs font-bold'
                          : isDone
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {isDone ? <Check className="w-4 h-4 stroke-[3]" /> : <Icon className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-xs hidden md:inline">{step.label}</span>
                  </div>
                  {idx < stepsList.length - 1 && (
                    <div
                      className={`flex-1 h-[2px] mx-3 transition-colors ${
                        currentStep > step.number ? 'bg-emerald-500' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="max-w-4xl mx-auto w-full px-8 pt-6">
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Wizard Form Body */}
        <div className="max-w-4xl w-full mx-auto p-8 flex-1">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-2xs">
            {/* ================= PASSO 1: DADOS DO CLIENTE ================= */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-black" />
                    <span>Dados Institucionais do Cliente</span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Informe os dados básicos da marca para identificação no sistema e contextualização das artes.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-800 mb-1.5">
                      Nome do Cliente ou Marca <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Studio FA, Nubank, Reserva, Clinica Bella..."
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-black font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-800 mb-1.5">
                      Nicho ou Segmento de Atuação
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Arquitetura & Interiores"
                      value={niche}
                      onChange={(e) => setNiche(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-black font-medium mb-2"
                    />
                    {/* Chips de sugestão rápida */}
                    <div className="flex flex-wrap gap-1.5">
                      {NICHE_SUGGESTIONS.map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => setNiche(sug)}
                          className={`text-[10px] px-2.5 py-1 rounded-lg border transition ${
                            niche === sug
                              ? 'bg-black text-[#CEF52A] border-black font-bold'
                              : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-800 mb-1.5 flex items-center gap-1.5">
                        <Instagram className="w-3.5 h-3.5 text-pink-600" />
                        <span>Perfil do Instagram</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-xs font-mono text-gray-400">@</span>
                        <input
                          type="text"
                          placeholder="usuario ou link do perfil"
                          value={instagram}
                          onChange={(e) => setInstagram(e.target.value)}
                          className="w-full pl-8 pr-3 py-2.5 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-black font-mono"
                        />
                      </div>
                      {cleanInstagram && (
                        <p className="text-[10px] text-gray-400 mt-1 font-mono">
                          Formatado como: @{cleanInstagram}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-800 mb-1.5 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-blue-600" />
                        <span>Website Oficial</span>
                      </label>
                      <input
                        type="url"
                        placeholder="https://suamarca.com.br"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        className="w-full px-4 py-2.5 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-black font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-800 mb-1.5">
                      Notas Internas & Observações da Conta
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Informações adicionais sobre o cliente, contexto de negócios, público-alvo ou responsáveis..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-black font-medium resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ================= PASSO 2: IDENTIDADE VISUAL & LOGOS ================= */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Palette className="w-5 h-5 text-black" />
                    <span>Identidade Visual, Paleta & Logotipos</span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Os arquivos são enviados diretamente para o Supabase Storage com proteção e nunca em Base64 no banco.
                  </p>
                </div>

                {/* Upload de Logos */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Logotipos da Marca
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Logo Principal */}
                    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 flex flex-col items-center justify-center text-center space-y-2">
                      <span className="text-xs font-bold text-gray-800">Logo Principal</span>
                      {primaryLogo ? (
                        <div className="relative group w-full h-24 bg-white rounded-lg border border-gray-200 p-2 flex items-center justify-center">
                          <img
                            src={primaryLogo.base64}
                            alt="Logo Principal"
                            className="max-h-full max-w-full object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => setPrimaryLogo(null)}
                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition shadow-xs"
                            title="Remover logo"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="w-full h-24 border-2 border-dashed border-gray-300 hover:border-black rounded-lg flex flex-col items-center justify-center cursor-pointer bg-white transition p-2">
                          <Upload className="w-5 h-5 text-gray-400 mb-1" />
                          <span className="text-[11px] font-semibold text-gray-700">Subir Logo Oficial</span>
                          <span className="text-[9px] text-gray-400">PNG, SVG, WEBP</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleLogoFile(e, setPrimaryLogo)}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>

                    {/* Logo Secundário */}
                    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 flex flex-col items-center justify-center text-center space-y-2">
                      <span className="text-xs font-bold text-gray-800">Logo Secundário / Ícone</span>
                      {secondaryLogo ? (
                        <div className="relative group w-full h-24 bg-white rounded-lg border border-gray-200 p-2 flex items-center justify-center">
                          <img
                            src={secondaryLogo.base64}
                            alt="Logo Secundário"
                            className="max-h-full max-w-full object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => setSecondaryLogo(null)}
                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition shadow-xs"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="w-full h-24 border-2 border-dashed border-gray-300 hover:border-black rounded-lg flex flex-col items-center justify-center cursor-pointer bg-white transition p-2">
                          <Upload className="w-5 h-5 text-gray-400 mb-1" />
                          <span className="text-[11px] font-semibold text-gray-700">Subir Versão Reduzida</span>
                          <span className="text-[9px] text-gray-400">Opcional</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleLogoFile(e, setSecondaryLogo)}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>

                    {/* Logo Monocromático */}
                    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 flex flex-col items-center justify-center text-center space-y-2">
                      <span className="text-xs font-bold text-gray-800">Versão Monocromática / Branca</span>
                      {monochromeLogo ? (
                        <div className="relative group w-full h-24 bg-zinc-900 rounded-lg border border-gray-800 p-2 flex items-center justify-center">
                          <img
                            src={monochromeLogo.base64}
                            alt="Logo Monocromático"
                            className="max-h-full max-w-full object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => setMonochromeLogo(null)}
                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition shadow-xs"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="w-full h-24 border-2 border-dashed border-gray-300 hover:border-black rounded-lg flex flex-col items-center justify-center cursor-pointer bg-white transition p-2">
                          <Upload className="w-5 h-5 text-gray-400 mb-1" />
                          <span className="text-[11px] font-semibold text-gray-700">Subir Logo Negativo</span>
                          <span className="text-[9px] text-gray-400">Para fundos escuros</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleLogoFile(e, setMonochromeLogo)}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                {/* Paleta de Cores */}
                <div className="space-y-3 pt-4 border-t border-gray-100">
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Paleta de Cores Institucionais
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Primária */}
                    <div className="border border-gray-200 rounded-xl p-3 bg-white space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-800">Cor Primária</span>
                        <div
                          style={{ backgroundColor: primaryColor }}
                          className="w-5 h-5 rounded-full border border-black/10 shadow-2xs"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                        />
                        <input
                          type="text"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg border border-gray-300 uppercase"
                        />
                      </div>
                    </div>

                    {/* Secundária */}
                    <div className="border border-gray-200 rounded-xl p-3 bg-white space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-800">Cor Secundária</span>
                        <div
                          style={{ backgroundColor: secondaryColor }}
                          className="w-5 h-5 rounded-full border border-black/10 shadow-2xs"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={secondaryColor}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                        />
                        <input
                          type="text"
                          value={secondaryColor}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg border border-gray-300 uppercase"
                        />
                      </div>
                    </div>

                    {/* Acento / CTA */}
                    <div className="border border-gray-200 rounded-xl p-3 bg-white space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-800">Cor de Acento / CTA</span>
                        <div
                          style={{ backgroundColor: accentColor }}
                          className="w-5 h-5 rounded-full border border-black/10 shadow-2xs"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                        />
                        <input
                          type="text"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg border border-gray-300 uppercase"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tipografia */}
                <div className="space-y-3 pt-4 border-t border-gray-100">
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Tipografia Oficial
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-800 mb-1.5">
                        Fonte de Títulos & Manchetes
                      </label>
                      <select
                        value={primaryFont}
                        onChange={(e) => setPrimaryFont(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 bg-white font-medium"
                      >
                        {STANDARD_FONTS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-800 mb-1.5">
                        Fonte de Apoio & Corpo de Texto
                      </label>
                      <select
                        value={secondaryFont}
                        onChange={(e) => setSecondaryFont(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 bg-white font-medium"
                      >
                        {STANDARD_FONTS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= PASSO 3: DIRETRIZES MANUAIS (SOBERANAS) ================= */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-black" />
                    <span>Diretrizes Manuais da Marca</span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Regras explícitas e soberanas que a IA e os designers devem obedecer estritamente.
                  </p>
                </div>

                {/* Banner de Precedência Soberana */}
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-900 space-y-1">
                    <p className="font-bold">Prioridade Absoluta das Diretrizes Manuais</p>
                    <p className="leading-relaxed text-emerald-800">
                      As diretrizes declaradas nesta seção têm <strong>precedência soberana</strong> sobre qualquer inferência ou análise estatística da Inteligência Artificial. Se houver divergência entre as peças de referência e estas diretrizes, <strong>estas regras sempre vencerão</strong>.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-semibold text-gray-800 mb-1">
                    Regras Estéticas, Tom de Voz e Proibições
                  </label>
                  <textarea
                    rows={8}
                    placeholder="Exemplo de diretrizes:
- Nossa cor principal é rigorosamente #0F1113 com acento #CEF52A. Nunca usar tons azulados ou gradientes saturados.
- Tipografia: Sempre usar caixa alta nos títulos principais.
- Tom de voz: Sofisticado, conciso, editorial e minimalista.
- Imagens: Sempre usar pessoas em ângulos naturais ou produtos com fundo limpo.
- Proibido: Não usar molduras grossas, nem sombras difusas artificiais, nem 3D genérico flutuante.
- Logo: Sempre preservar margem de respiro e posicionar no rodapé ou canto superior esquerdo."
                    value={manualGuidelines}
                    onChange={(e) => setManualGuidelines(e.target.value)}
                    className="w-full px-4 py-3 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-black font-medium leading-relaxed resize-none"
                  />
                  <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    <Info className="w-3.5 h-3.5 text-gray-400" />
                    <span>
                      Você também poderá editar ou acrescentar novas diretrizes a qualquer momento no perfil do cliente.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ================= PASSO 4: PEÇAS DE REFERÊNCIA (OPCIONAL) ================= */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-black" />
                    <span>Peças de Referência Visual</span>
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">
                      Opcional
                    </span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Envie até 30 peças gráficas já produzidas da marca para alimentar o aprendizado visual da IA.
                  </p>
                </div>

                {/* Banner de Envio Opcional */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-900 space-y-1">
                    <p className="font-bold">Envio Opcional no Cadastro Inicial</p>
                    <p className="leading-relaxed text-blue-800">
                      Caso não possua as peças agora, você pode pular esta etapa tranquilamente clicando em &quot;Avançar&quot;. O cliente será criado com o status <em>Aguardando Peças</em> e você poderá subir as artes mais tarde no perfil do cliente.
                    </p>
                  </div>
                </div>

                {/* Zona de Drop & Upload */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 hover:border-black bg-gray-50/50 hover:bg-gray-50 rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2"
                >
                  <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 shadow-2xs">
                    <Upload className="w-6 h-6 text-black" />
                  </div>
                  <h4 className="text-xs font-bold text-gray-900">
                    Clique para selecionar ou arraste imagens até aqui
                  </h4>
                  <p className="text-[11px] text-gray-500 max-w-sm">
                    Suporta PNG, JPG e WEBP em lotes de até 30 arquivos. A proporção (Feed 4:5, Story 9:16, 1:1) é calculada automaticamente.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handlePiecesUpload(e.target.files)}
                    className="hidden"
                  />
                </div>

                {/* Grid de Peças Selecionadas */}
                {pieces.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-800">
                        {pieces.length} peça(s) selecionada(s)
                      </span>
                      <button
                        type="button"
                        onClick={() => setPieces([])}
                        className="text-[11px] text-red-600 hover:underline"
                      >
                        Limpar todas
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto p-1">
                      {pieces.map((piece) => (
                        <div
                          key={piece.id}
                          className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs flex flex-col justify-between group relative"
                        >
                          <div className="relative aspect-4/5 bg-gray-100 flex items-center justify-center overflow-hidden">
                            <img
                              src={piece.base64}
                              alt={piece.filename}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removePiece(piece.id);
                              }}
                              className="absolute top-1.5 right-1.5 p-1 bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition shadow-xs"
                              title="Remover peça"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <span className="absolute bottom-1.5 left-1.5 text-[9px] font-mono bg-black/75 text-white px-1.5 py-0.5 rounded backdrop-blur-xs">
                              {piece.formatLabel}
                            </span>
                          </div>

                          <div className="p-2 space-y-1 bg-gray-50/80 border-t border-gray-100">
                            <p className="text-[10px] font-medium text-gray-800 truncate" title={piece.filename}>
                              {piece.filename}
                            </p>
                            <select
                              value={piece.pieceType}
                              onChange={(e) =>
                                updatePieceType(
                                  piece.id,
                                  e.target.value as 'own_brand' | 'external_reference' | 'promotional'
                                )
                              }
                              className="w-full text-[9px] px-1.5 py-1 rounded border border-gray-200 bg-white font-medium focus:outline-none"
                            >
                              <option value="own_brand">Arte Oficial da Marca</option>
                              <option value="external_reference">Referência Externa</option>
                              <option value="promotional">Campanha Promocional</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ================= PASSO 5: REVISÃO & CONCLUSÃO ================= */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-black" />
                    <span>Revisão do Cadastro</span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Confira os dados antes de finalizar. Ao confirmar, o cliente será gravado no banco e os arquivos no Supabase Storage.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  {/* Bloco 1: Dados */}
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      1. Informações Básicas
                    </span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-gray-500 block text-[11px]">Nome:</span>
                        <span className="font-bold text-gray-900">{name || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[11px]">Nicho:</span>
                        <span className="font-medium text-gray-800">{niche || 'Geral'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[11px]">Instagram:</span>
                        <span className="font-mono text-gray-800">
                          {cleanInstagram ? `@${cleanInstagram}` : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[11px]">Website:</span>
                        <span className="font-medium text-gray-800 truncate block">
                          {website || '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bloco 2: Cores e Logos */}
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      2. Identidade Visual & Logos
                    </span>
                    <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-[11px]">Cores:</span>
                          <span
                            style={{ backgroundColor: primaryColor }}
                            className="w-5 h-5 rounded-full border border-black/10 inline-block shadow-2xs"
                            title={`Primária: ${primaryColor}`}
                          />
                          <span
                            style={{ backgroundColor: secondaryColor }}
                            className="w-5 h-5 rounded-full border border-black/10 inline-block shadow-2xs"
                            title={`Secundária: ${secondaryColor}`}
                          />
                          <span
                            style={{ backgroundColor: accentColor }}
                            className="w-5 h-5 rounded-full border border-black/10 inline-block shadow-2xs"
                            title={`Acento: ${accentColor}`}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-[11px]">Fontes:</span>
                          <span className="font-mono bg-white px-2 py-0.5 rounded border border-gray-200 text-[11px]">
                            {primaryFont} / {secondaryFont}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-[11px]">Logotipos:</span>
                        <span className="font-medium text-gray-800">
                          {[primaryLogo, secondaryLogo, monochromeLogo].filter(Boolean).length} arquivo(s)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bloco 3: Diretrizes */}
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      3. Diretrizes Manuais Soberanas
                    </span>
                    {manualGuidelines ? (
                      <p className="text-xs text-gray-700 font-medium whitespace-pre-wrap line-clamp-3">
                        {manualGuidelines}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 italic">
                        Nenhuma diretriz manual específica informada.
                      </p>
                    )}
                  </div>

                  {/* Bloco 4: Peças */}
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      4. Peças de Referência
                    </span>
                    <p className="text-xs text-gray-800 font-medium">
                      {pieces.length > 0
                        ? `${pieces.length} peça(s) anexada(s) para upload inicial.`
                        : 'Nenhuma peça anexada no momento. O cliente iniciará com o status "Aguardando Peças".'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Navigation Buttons */}
            <div className="pt-6 mt-8 border-t border-gray-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentStep === 1 || submitting}
                className={`px-4 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 ${
                  currentStep === 1 || submitting
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-700 hover:text-black hover:bg-gray-100'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <div className="flex items-center gap-3">
                {currentStep < 5 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-5 py-2.5 bg-black hover:bg-zinc-800 text-[#CEF52A] rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-2xs"
                  >
                    <span>Avançar</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFinalSubmit}
                    disabled={submitting}
                    className="px-6 py-2.5 bg-black hover:bg-zinc-800 text-[#CEF52A] rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-sm disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#CEF52A]" />
                        <span>{submitProgress || 'Salvando...'}</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Concluir & Criar Cliente</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
