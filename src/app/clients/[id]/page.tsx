// src/app/clients/[id]/page.tsx
'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppSidebar } from '@/components/layout/AppSidebar';
import {
  ArrowLeft,
  Building2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Upload,
  Trash2,
  FileText,
  Palette,
  Layers,
  Image as ImageIcon,
  Check,
  X,
  ExternalLink,
  Instagram,
  Globe,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  Eye,
  Info,
  Sliders,
  ChevronRight,
  Loader2,
  FolderKanban,
  Bot,
  Download,
} from 'lucide-react';
import { BrandDNA, normalizeBrandDNAForDisplay, DisplayBrandDNA } from '@/types/domain/dna';
import { ClientPieceItem, PieceAnalysis } from '@/types/domain/piece';

export default function ClientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<any>(null);
  const [pieces, setPieces] = useState<ClientPieceItem[]>([]);
  const [dna, setDna] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'dna' | 'pieces' | 'logos' | 'guidelines'>('dna');

  // Estados de gerenciamento de logotipos da marca
  const [uploadingLogoType, setUploadingLogoType] = useState<string | null>(null);
  const [logoActionError, setLogoActionError] = useState<string | null>(null);
  const primaryLogoInputRef = useRef<HTMLInputElement>(null);
  const secondaryLogoInputRef = useRef<HTMLInputElement>(null);
  const monochromeLogoInputRef = useRef<HTMLInputElement>(null);

  // Normalização segura para visualização sem assumptions de propriedades obrigatórias
  const displayDna: DisplayBrandDNA | null = useMemo(() => normalizeBrandDNAForDisplay(dna), [dna]);

  // Resolução do status da memória visual com base nos dados do cliente e peças
  const visualStatus: string =
    client?.visual_memory_status ||
    (pieces.length > 0 || (client?.pieces_count && client.pieces_count > 0)
      ? displayDna
        ? 'ready'
        : 'awaiting_analysis'
      : 'awaiting_references');

  // Estados de análise e reanálise
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analyzeMessage, setAnalyzeMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal de inspeção individual de peça
  const [selectedPiece, setSelectedPiece] = useState<ClientPieceItem | null>(null);

  // Modal de upload de novas peças
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [newPiecesUpload, setNewPiecesUpload] = useState<
    Array<{
      file: File;
      base64: string;
      filename: string;
      mimeType: string;
      width: number;
      height: number;
      formatType: string;
      pieceType: string;
    }>
  >([]);
  const [uploadingPieces, setUploadingPieces] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado de edição de diretrizes manuais
  const [manualGuidelinesText, setManualGuidelinesText] = useState<string>('');
  const [isSavingGuidelines, setIsSavingGuidelines] = useState<boolean>(false);

  // Carrega dados do cliente e peças
  const loadClientData = async () => {
    try {
      setLoading(true);
      const [resClient, resPieces] = await Promise.all([
        fetch(`/api/clients/${clientId}`),
        fetch(`/api/clients/${clientId}/pieces`),
      ]);

      if (!resClient.ok) {
        throw new Error('Falha ao carregar dados do cliente.');
      }

      const clientData = await resClient.json();
      setClient(clientData.client);
      const rawDna = clientData.client?.dna;
      const hasDna =
        rawDna &&
        typeof rawDna === 'object' &&
        Object.keys(rawDna).length > 0 &&
        Boolean(rawDna.summary || rawDna.colorSystem || rawDna.typography || rawDna.version);
      setDna(hasDna ? rawDna : null);
      setManualGuidelinesText(clientData.client?.manual_guidelines || '');

      if (resPieces.ok) {
        const piecesData = await resPieces.json();
        setPieces(piecesData.pieces || []);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      loadClientData();
    }
  }, [clientId]);

  // Dispara análise das peças com IA
  const handleTriggerAnalysis = async (force = false, pieceId?: string) => {
    try {
      setIsAnalyzing(true);
      setAnalyzeMessage(
        pieceId
          ? 'Analisando peça com OpenAI Vision...'
          : 'Executando auditoria visual com IA em lote...'
      );
      setErrorMessage(null);
      setSuccessMessage(null);

      const res = await fetch(`/api/clients/${clientId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pieceIds: pieceId ? [pieceId] : undefined,
          forceReanalyze: force,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || 'Falha na análise com IA.');
      }

      if (data.failedCount > 0 && data.successCount === 0) {
        setErrorMessage(
          `Falha na análise: ${data.results?.[0]?.error || 'Erro ao processar imagem na OpenAI.'}`
        );
      } else {
        setSuccessMessage(
          `Análise concluída com sucesso! ${data.successCount} peça(s) auditada(s) e Brand DNA consolidado.`
        );
      }

      // Recarrega dados completos
      await loadClientData();
    } catch (err: any) {
      console.error('Erro na análise:', err);
      setErrorMessage(err?.message || 'Falha de comunicação com o servidor.');
    } finally {
      setIsAnalyzing(false);
      setAnalyzeMessage(null);
    }
  };

  // Reconsolidar DNA manualmente
  const handleReconsolidateDNA = async () => {
    try {
      setIsAnalyzing(true);
      setAnalyzeMessage('Reconsolidando Brand DNA oficial com prioridade para as diretrizes manuais...');
      setErrorMessage(null);

      const res = await fetch(`/api/clients/${clientId}/dna`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || 'Falha ao reconsolidar DNA.');
      }

      setDna(data.dna);
      setSuccessMessage('Brand DNA reconsolidado com sucesso!');
      await loadClientData();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao reconsolidar DNA.');
    } finally {
      setIsAnalyzing(false);
      setAnalyzeMessage(null);
    }
  };

  // Salvar diretrizes manuais
  const handleSaveGuidelines = async () => {
    try {
      setIsSavingGuidelines(true);
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual_guidelines: manualGuidelinesText }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message || 'Falha ao salvar diretrizes.');
      }

      setSuccessMessage('Diretrizes manuais salvas com sucesso! Você pode reconsolidar o DNA para aplicar as novas regras.');
      await loadClientData();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao salvar diretrizes.');
    } finally {
      setIsSavingGuidelines(false);
    }
  };

  // Upload ou substituição de logotipo da marca
  const handleLogoUpload = async (assetType: string, file: File) => {
    try {
      setUploadingLogoType(assetType);
      setLogoActionError(null);
      setErrorMessage(null);

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch(`/api/clients/${clientId}/logos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetType,
          base64,
          filename: file.name,
          mimeType: file.type,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Falha ao salvar logotipo.');
      }

      setSuccessMessage(`Logotipo "${data.asset?.label || assetType}" atualizado com sucesso!`);
      await loadClientData();
    } catch (err: any) {
      setLogoActionError(err?.message || 'Erro ao processar logotipo.');
    } finally {
      setUploadingLogoType(null);
    }
  };

  // Remoção de logotipo
  const handleLogoDelete = async (assetType: string, label: string) => {
    if (!confirm(`Deseja realmente remover o "${label}" deste cliente?`)) return;

    try {
      setUploadingLogoType(assetType);
      setLogoActionError(null);
      setErrorMessage(null);

      const res = await fetch(`/api/clients/${clientId}/logos?assetType=${assetType}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Falha ao remover logotipo.');
      }

      setSuccessMessage(`Logotipo removido com sucesso.`);
      await loadClientData();
    } catch (err: any) {
      setLogoActionError(err?.message || 'Erro ao remover logotipo.');
    } finally {
      setUploadingLogoType(null);
    }
  };

  // Excluir peça
  const handleDeletePiece = async (pieceId: string) => {
    if (!confirm('Deseja realmente remover esta peça de referência?')) return;

    try {
      const res = await fetch(`/api/clients/${clientId}/pieces/${pieceId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Falha ao excluir peça.');
      }

      setPieces((prev) => prev.filter((p) => p.id !== pieceId));
      if (selectedPiece?.id === pieceId) setSelectedPiece(null);
      setSuccessMessage('Peça removida com sucesso.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao excluir peça.');
    }
  };

  // Upload de novas peças no modal
  const handleSelectNewPieces = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remainingSlots = 30 - pieces.length - newPiecesUpload.length;
    if (remainingSlots <= 0) {
      setErrorMessage('Limite máximo de 30 peças por cliente atingido.');
      return;
    }

    const selected = Array.from(files).slice(0, remainingSlots);

    selected.forEach((file) => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const ratio = img.width / img.height;
          let formatType = 'feed';
          if (ratio <= 0.65) formatType = 'story';
          else if (ratio >= 0.92 && ratio <= 1.08) formatType = 'square';
          else if (ratio >= 1.25) formatType = 'cover';

          setNewPiecesUpload((prev) => [
            ...prev,
            {
              file,
              base64,
              filename: file.name,
              mimeType: file.type,
              width: img.width,
              height: img.height,
              formatType,
              pieceType: 'own_brand',
            },
          ]);
        };
        img.src = base64;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleUploadNewPiecesSubmit = async () => {
    if (newPiecesUpload.length === 0) return;

    try {
      setUploadingPieces(true);
      const res = await fetch(`/api/clients/${clientId}/pieces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pieces: newPiecesUpload }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Falha ao enviar peças.');
      }

      setSuccessMessage(`${data.count || newPiecesUpload.length} nova(s) peça(s) enviada(s) com sucesso!`);
      setNewPiecesUpload([]);
      setShowUploadModal(false);
      await loadClientData();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao enviar novas peças.');
    } finally {
      setUploadingPieces(false);
    }
  };

  // Helper de badge de status de memória visual
  const getVisualMemoryBadge = (status?: string) => {
    switch (status) {
      case 'ready':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>DNA Visual Pronto</span>
          </span>
        );
      case 'analyzing':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
            <span>Analisando com IA...</span>
          </span>
        );
      case 'awaiting_analysis':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>Peças Aguardando Análise</span>
          </span>
        );
      case 'needs_refresh':
      case 'needs_review':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Revisão Necessária</span>
          </span>
        );
      case 'error':
      case 'failed':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Erro na Análise</span>
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-500" />
            <span>Aguardando Peças</span>
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full bg-[#F6F7F8] font-sans overflow-hidden">
        <AppSidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-black" />
            <p className="text-xs text-gray-500 font-medium">Carregando perfil do cliente e DNA Visual...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex h-screen w-full bg-[#F6F7F8] font-sans overflow-hidden">
        <AppSidebar />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center space-y-4 max-w-md">
            <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
            <h3 className="font-bold text-gray-900 text-base">Cliente Não Encontrado</h3>
            <p className="text-xs text-gray-500">
              O cliente solicitado não existe ou você não possui permissão para acessá-lo.
            </p>
            <Link
              href="/clients"
              className="px-4 py-2 bg-black text-[#CEF52A] rounded-xl font-bold text-xs inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para Clientes</span>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const completedPiecesCount = pieces.filter((p) => p.analysis_status === 'completed').length;
  const pendingPiecesCount = pieces.filter((p) => p.analysis_status === 'pending').length;
  const failedPiecesCount = pieces.filter((p) => p.analysis_status === 'failed').length;

  const primaryLogo = client?.assets?.find((a: any) => a.asset_type === 'logo_primary') || null;
  const secondaryLogo = client?.assets?.find((a: any) => a.asset_type === 'logo_secondary') || null;
  const monochromeLogo = client?.assets?.find((a: any) => a.asset_type === 'logo_monochrome') || null;
  const logosCount = [primaryLogo, secondaryLogo, monochromeLogo].filter(Boolean).length;

  return (
    <div className="flex h-screen w-full bg-[#F6F7F8] font-sans overflow-hidden">
      <AppSidebar />

      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Top Bar Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
          <div className="flex items-center gap-4">
            <Link
              href="/clients"
              className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-xl transition"
              title="Voltar para Clientes"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-gray-200 flex items-center justify-center font-bold text-sm text-[#CEF52A] uppercase shadow-2xs overflow-hidden shrink-0">
                {client.logoPrimaryUrl ? (
                  <img
                    src={client.logoPrimaryUrl}
                    alt={client.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  client.name.substring(0, 2).toUpperCase()
                )}
              </div>

              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-lg font-bold text-gray-900">{client.name}</h1>
                  {getVisualMemoryBadge(visualStatus)}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  {client.niche && (
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[11px] font-medium">
                      {client.niche}
                    </span>
                  )}
                  {client.instagram_handle && (
                    <a
                      href={`https://instagram.com/${client.instagram_handle.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-gray-600 hover:text-pink-600 font-mono transition text-[11px]"
                    >
                      <Instagram className="w-3.5 h-3.5" />
                      <span>{client.instagram_handle}</span>
                    </a>
                  )}
                  {client.website && (
                    <a
                      href={client.website.startsWith('http') ? client.website : `https://${client.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-gray-600 hover:text-blue-600 transition text-[11px]"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[150px]">{client.website}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Botão Ver Produções do Cliente */}
            <Link
              href={`/projects?client=${client.id}`}
              className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition shadow-2xs"
            >
              <FolderKanban className="w-4 h-4 text-gray-500" />
              <span className="hidden sm:inline">Ver Produções</span>
            </Link>

            {/* Botão de Análise com IA */}
            <button
              onClick={() => handleTriggerAnalysis(false)}
              disabled={isAnalyzing || (pieces.length === 0 && (!client.pieces_count || client.pieces_count === 0))}
              className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-2xs disabled:opacity-50"
              title="Executar análise visual com OpenAI Vision nas peças pendentes"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>{isAnalyzing ? 'Analisando...' : 'Analisar Peças com IA'}</span>
            </button>

            {/* Botão de Criar no Chat (Novo Núcleo Único) */}
            <Link
              href={`/creative-chat?client=${client.id}`}
              className="px-4 py-2 bg-black hover:bg-zinc-800 text-[#CEF52A] rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-sm"
              title="Criar com este cliente no Chat Criativo"
            >
              <Bot className="w-4 h-4 text-[#CEF52A]" />
              <span>Criar no Chat</span>
            </Link>
          </div>
        </div>

        {/* Notificações / Banners de Feedback */}
        {analyzeMessage && (
          <div className="bg-indigo-900 text-indigo-100 px-8 py-3 flex items-center gap-3 text-xs animate-in fade-in">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-300 shrink-0" />
            <span>{analyzeMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-50 border-b border-red-200 px-8 py-3 flex items-center justify-between text-xs text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {logoActionError && (
          <div className="bg-red-50 border-b border-red-200 px-8 py-3 flex items-center justify-between text-xs text-red-700 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{logoActionError}</span>
            </div>
            <button onClick={() => setLogoActionError(null)} className="text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-8 py-3 flex items-center justify-between text-xs text-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white border-b border-gray-200 px-8 sticky top-[89px] z-10">
          <div className="max-w-6xl mx-auto flex items-center gap-8">
            <button
              onClick={() => setActiveTab('dna')}
              className={`py-3.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
                activeTab === 'dna'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>DNA Visual Consolidado</span>
              {displayDna && (
                <span className="text-[10px] bg-black text-[#CEF52A] px-1.5 py-0.2 rounded-full font-bold">
                  v{displayDna.version || 1}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('pieces')}
              className={`py-3.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
                activeTab === 'pieces'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>Peças de Referência</span>
              <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.2 rounded-full font-bold">
                {pieces.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('logos')}
              className={`py-3.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
                activeTab === 'logos'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>Logotipos da Marca</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  logosCount > 0 ? 'bg-black text-[#CEF52A]' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {logosCount}/3
              </span>
            </button>

            <button
              onClick={() => setActiveTab('guidelines')}
              className={`py-3.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
                activeTab === 'guidelines'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Diretrizes Manuais Soberanas</span>
              {client.manual_guidelines && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Diretrizes ativas" />
              )}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="max-w-6xl w-full mx-auto p-8 space-y-6 flex-1">
          {/* ================= ABA 1: DNA VISUAL ================= */}
          {activeTab === 'dna' && (
            <div className="space-y-6">
              {/* Banner de Precedência Soberana se houver diretrizes manuais */}
              {client.manual_guidelines && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-emerald-900">
                        Diretrizes Manuais com Prioridade Soberana Ativas
                      </h4>
                      <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                        Este Brand DNA foi consolidado garantindo que as diretrizes declaradas manualmente pelo usuário prevaleçam integralmente sobre deduções da IA.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleReconsolidateDNA}
                    disabled={isAnalyzing}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shrink-0"
                    title="Reconsolidar Brand DNA com base nas regras atuais"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                    <span>Reconsolidar DNA</span>
                  </button>
                </div>
              )}

              {/* ESTADO 1: ANALISANDO COM IA */}
              {isAnalyzing || visualStatus === 'analyzing' ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-4 shadow-2xs">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                    <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-gray-900 text-base">Analisando Identidade Visual com IA...</h3>
                    <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
                      A Inteligência Artificial está auditando as peças de referência cadastradas para consolidar a paleta de cores, tipografia e diretrizes de arte da marca.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs font-medium">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span>Processamento em lote em andamento</span>
                  </div>
                </div>
              ) : visualStatus === 'error' || visualStatus === 'failed' ? (
                /* ESTADO 2: ERRO NA ANÁLISE */
                <div className="bg-white rounded-2xl border border-rose-200 p-12 text-center space-y-4 shadow-2xs">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6 text-rose-600" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-gray-900 text-sm">Erro na Análise da Memória Visual</h3>
                    <p className="text-xs text-gray-500 max-w-md mx-auto">
                      Ocorreu uma falha ao auditar as peças de referência com a Inteligência Artificial. Verifique as peças na aba ao lado ou tente novamente.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={() => handleTriggerAnalysis(true)}
                      disabled={isAnalyzing}
                      className="px-4 py-2 bg-black text-[#CEF52A] rounded-xl font-bold text-xs inline-flex items-center gap-2 transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                      <span>Tentar Novamente</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('pieces')}
                      className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 transition"
                    >
                      <ImageIcon className="w-4 h-4 text-gray-500" />
                      <span>Revisar Peças</span>
                    </button>
                  </div>
                </div>
              ) : visualStatus === 'awaiting_analysis' ? (
                /* ESTADO 3: PEÇAS ENVIADAS / AGUARDANDO ANÁLISE */
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-2xs space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-100">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <Clock className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5">
                            <h3 className="font-bold text-gray-900 text-base">Peças enviadas com sucesso</h3>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {pieces.length || client.pieces_count || 0} peças cadastradas
                            </span>
                          </div>
                          <p className="text-xs text-indigo-700 font-semibold">
                            Memória visual aguardando análise
                          </p>
                          <p className="text-xs text-gray-500 max-w-xl leading-relaxed">
                            As referências gráficas da marca foram recebidas e persistidas com segurança. Inicie a auditoria com IA para extrair a paleta cromática, hierarquia tipográfica e consolidar o Brand DNA.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={() => handleTriggerAnalysis(false)}
                          disabled={isAnalyzing || (pieces.length === 0 && (!client.pieces_count || client.pieces_count === 0))}
                          className="px-5 py-2.5 bg-black hover:bg-zinc-800 text-[#CEF52A] rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-sm disabled:opacity-50"
                        >
                          <Sparkles className="w-4 h-4 text-[#CEF52A]" />
                          <span>Analisar peças</span>
                        </button>
                        <button
                          onClick={() => setActiveTab('pieces')}
                          className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-xl font-bold text-xs flex items-center gap-1.5 transition"
                        >
                          <ImageIcon className="w-4 h-4 text-gray-500" />
                          <span>Ver Peças</span>
                        </button>
                      </div>
                    </div>

                    {/* Galeria de Miniaturas das peças cadastradas */}
                    {pieces.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-700">Peças Prontas para Análise ({pieces.length})</span>
                          <button
                            onClick={() => setActiveTab('pieces')}
                            className="text-gray-500 hover:text-black font-semibold flex items-center gap-1"
                          >
                            <span>Ver todas na galeria</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                          {pieces.slice(0, 6).map((piece) => (
                            <div
                              key={piece.id}
                              onClick={() => { setSelectedPiece(piece); setActiveTab('pieces'); }}
                              className="aspect-4/5 rounded-xl border border-gray-200 bg-gray-100 overflow-hidden cursor-pointer hover:border-black transition group relative"
                            >
                              {piece.signedUrl ? (
                                <img
                                  src={piece.signedUrl}
                                  alt={piece.original_filename}
                                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                  <ImageIcon className="w-5 h-5" />
                                </div>
                              )}
                            </div>
                          ))}
                          {pieces.length > 6 && (
                            <button
                              onClick={() => setActiveTab('pieces')}
                              className="aspect-4/5 rounded-xl border border-dashed border-gray-300 hover:border-black bg-gray-50 flex flex-col items-center justify-center p-2 text-center transition"
                            >
                              <span className="text-xs font-bold text-gray-700">+{pieces.length - 6}</span>
                              <span className="text-[10px] text-gray-400">mais peças</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : visualStatus === 'awaiting_references' && !displayDna ? (
                /* ESTADO 4: AGUARDANDO PEÇAS DE REFERÊNCIA */
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-4 shadow-2xs">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-gray-900 text-sm">DNA Visual Ainda Não Consolidado</h3>
                    <p className="text-xs text-gray-500 max-w-md mx-auto">
                      Envie peças de referência gráfica na aba de peças ou preencha as diretrizes manuais da marca para alimentar o aprendizado visual da IA.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('pieces');
                      setShowUploadModal(true);
                    }}
                    className="px-4 py-2 bg-black text-[#CEF52A] rounded-xl font-bold text-xs inline-flex items-center gap-2 transition"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Enviar Peças de Referência</span>
                  </button>
                </div>
              ) : displayDna ? (
                /* ESTADO 5: READY OU NEEDS_REFRESH COM DNA CONSOLIDADO */
                <div className="space-y-6">
                  {/* Banner de aviso se needs_refresh ou needs_review */}
                  {(visualStatus === 'needs_refresh' || visualStatus === 'needs_review') && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-amber-900">
                            Atualização de Memória Visual Pendente
                          </h4>
                          <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                            Novas peças foram adicionadas ou diretrizes manuais foram alteradas. O Brand DNA abaixo reflete a consolidação anterior.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleTriggerAnalysis(true)}
                        disabled={isAnalyzing}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shrink-0"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                        <span>Reconsolidar DNA</span>
                      </button>
                    </div>
                  )}

                  {/* Resumo Executivo */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-black" />
                        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                          Síntese Executiva da Identidade Visual
                        </h3>
                      </div>
                      <span className="text-[11px] text-gray-400 font-mono">
                        Última consolidação: {displayDna.lastConsolidatedAt ? new Date(displayDna.lastConsolidatedAt).toLocaleDateString('pt-BR') : 'Manual'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed font-medium">
                      {displayDna.summary}
                    </p>
                    {displayDna.toneAndVoice && (
                      <div className="pt-2 border-t border-gray-100 flex items-center gap-2 text-xs">
                        <span className="font-bold text-gray-700">Tom & Voz Visual:</span>
                        <span className="text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                          {displayDna.toneAndVoice}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Grid de 2 Colunas: Cores & Tipografia */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Sistema de Cores */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-black" />
                        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                          Sistema Cromático Oficial
                        </h3>
                      </div>

                      {displayDna.colorSystem ? (
                        <>
                          <div className="grid grid-cols-3 gap-3">
                            {/* Primária */}
                            <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 space-y-1.5">
                              <span className="text-[10px] font-bold text-gray-500 uppercase">Primária</span>
                              {displayDna.colorSystem.primary ? (
                                <div
                                  style={{ backgroundColor: displayDna.colorSystem.primary }}
                                  className="h-10 rounded-lg border border-black/10 shadow-2xs flex items-center justify-center text-[10px] font-mono font-bold text-white drop-shadow-sm"
                                >
                                  {displayDna.colorSystem.primary}
                                </div>
                              ) : (
                                <div className="h-10 rounded-lg border border-dashed border-gray-300 bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 italic">
                                  Não identificado
                                </div>
                              )}
                            </div>

                            {/* Secundária */}
                            <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 space-y-1.5">
                              <span className="text-[10px] font-bold text-gray-500 uppercase">Secundária</span>
                              {displayDna.colorSystem.secondary ? (
                                <div
                                  style={{ backgroundColor: displayDna.colorSystem.secondary }}
                                  className="h-10 rounded-lg border border-black/10 shadow-2xs flex items-center justify-center text-[10px] font-mono font-bold text-white drop-shadow-sm"
                                >
                                  {displayDna.colorSystem.secondary}
                                </div>
                              ) : (
                                <div className="h-10 rounded-lg border border-dashed border-gray-300 bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 italic">
                                  Não identificado
                                </div>
                              )}
                            </div>

                            {/* Acento / CTA */}
                            <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 space-y-1.5">
                              <span className="text-[10px] font-bold text-gray-500 uppercase">Acento / CTA</span>
                              {displayDna.colorSystem.accent ? (
                                <div
                                  style={{ backgroundColor: displayDna.colorSystem.accent }}
                                  className="h-10 rounded-lg border border-black/10 shadow-2xs flex items-center justify-center text-[10px] font-mono font-bold text-black drop-shadow-sm"
                                >
                                  {displayDna.colorSystem.accent}
                                </div>
                              ) : (
                                <div className="h-10 rounded-lg border border-dashed border-gray-300 bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 italic">
                                  Não identificado
                                </div>
                              )}
                            </div>
                          </div>

                          {displayDna.colorSystem.distributionRules && (
                            <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-1">
                              <span className="font-bold text-gray-800 block text-[11px]">
                                Regra de Distribuição Proporcional:
                              </span>
                              <p>{displayDna.colorSystem.distributionRules}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-xs text-gray-500 bg-gray-50 p-4 rounded-xl border border-gray-200 italic">
                          Sistema cromático não identificado ou ainda não consolidado.
                        </div>
                      )}
                    </div>

                    {/* Tipografia */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-black" />
                        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                          Hierarquia Tipográfica
                        </h3>
                      </div>

                      {displayDna.typography ? (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 space-y-1">
                              <span className="text-[10px] font-bold text-gray-500 uppercase">
                                Títulos & Manchetes
                              </span>
                              <p className="text-xs font-bold text-gray-900 font-mono truncate">
                                {displayDna.typography.titleFont || 'Não identificado'}
                              </p>
                            </div>

                            <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 space-y-1">
                              <span className="text-[10px] font-bold text-gray-500 uppercase">
                                Apoio & Leitura
                              </span>
                              <p className="text-xs font-bold text-gray-900 font-mono truncate">
                                {displayDna.typography.bodyFont || 'Não identificado'}
                              </p>
                            </div>
                          </div>

                          {displayDna.typography.hierarchyGuidelines && (
                            <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-1">
                              <span className="font-bold text-gray-800 block text-[11px]">
                                Diretrizes de Escala & Contraste:
                              </span>
                              <p>{displayDna.typography.hierarchyGuidelines}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-xs text-gray-500 bg-gray-50 p-4 rounded-xl border border-gray-200 italic">
                          Hierarquia tipográfica não identificada ou ainda não consolidada.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Do's & Don'ts */}
                  {(displayDna.do.length > 0 || displayDna.dont.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Do's */}
                      {displayDna.do.length > 0 && (
                        <div className="bg-emerald-50/50 rounded-2xl border border-emerald-200 p-6 space-y-3">
                          <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs uppercase tracking-wider">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Obrigatório / Boas Práticas (DO)</span>
                          </div>
                          <ul className="space-y-2 text-xs text-emerald-950">
                            {displayDna.do.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Don'ts */}
                      {displayDna.dont.length > 0 && (
                        <div className="bg-rose-50/50 rounded-2xl border border-rose-200 p-6 space-y-3">
                          <div className="flex items-center gap-2 text-rose-900 font-bold text-xs uppercase tracking-wider">
                            <AlertTriangle className="w-4 h-4 text-rose-600" />
                            <span>Proibições Estritas (DON&apos;T)</span>
                          </div>
                          <ul className="space-y-2 text-xs text-rose-950">
                            {displayDna.dont.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <X className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* ================= ABA 2: PEÇAS DE REFERÊNCIA ================= */}
          {activeTab === 'pieces' && (
            <div className="space-y-6">
              {/* Top Action Bar de Peças */}
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
                <div>
                  <h3 className="text-xs font-bold text-gray-900">
                    Galeria de Referências Visuais ({pieces.length} peças)
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {completedPiecesCount} auditada(s) com IA • {pendingPiecesCount} pendente(s) • {failedPiecesCount} com erro
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="px-3.5 py-2 bg-black hover:bg-zinc-800 text-[#CEF52A] rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-2xs"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Enviar Novas Peças</span>
                  </button>

                  <button
                    onClick={() => handleTriggerAnalysis(true)}
                    disabled={isAnalyzing || pieces.length === 0}
                    className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-2xs disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                    <span>Reanalisar Todas</span>
                  </button>
                </div>
              </div>

              {/* Grid de Peças */}
              {pieces.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">Nenhuma Peça Cadastrada</h3>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    Envie artes anteriores, posts de feed ou stories para alimentar a memória visual da IA.
                  </p>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="px-4 py-2 bg-black text-[#CEF52A] rounded-xl font-bold text-xs inline-flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Enviar Primeiras Peças</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {pieces.map((piece) => {
                    const isCompleted = piece.analysis_status === 'completed';
                    const isFailed = piece.analysis_status === 'failed';
                    const isRunning = piece.analysis_status === 'analyzing';

                    return (
                      <div
                        key={piece.id}
                        className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-2xs flex flex-col justify-between group hover:border-black/30 transition-all relative"
                      >
                        {/* Imagem / Preview com Signed URL */}
                        <div
                          onClick={() => setSelectedPiece(piece)}
                          className="relative aspect-4/5 bg-gray-100 cursor-pointer overflow-hidden flex items-center justify-center"
                        >
                          {piece.signedUrl ? (
                            <img
                              src={piece.signedUrl}
                              alt={piece.original_filename}
                              className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
                            />
                          ) : (
                            <div className="text-gray-400 flex flex-col items-center gap-1 text-[11px]">
                              <ImageIcon className="w-6 h-6" />
                              <span>Sem imagem</span>
                            </div>
                          )}

                          {/* Badge de Formato */}
                          <span className="absolute bottom-2 left-2 text-[10px] font-mono font-bold bg-black/80 text-white px-2 py-0.5 rounded backdrop-blur-xs">
                            {piece.format_type === 'story'
                              ? 'Story 9:16'
                              : piece.format_type === 'square'
                              ? 'Square 1:1'
                              : piece.format_type === 'cover'
                              ? 'Capa 16:9'
                              : 'Feed 4:5'}
                          </span>

                          {/* Badge de Qualidade */}
                          {isCompleted && piece.quality_score && (
                            <span className="absolute top-2 right-2 text-[10px] font-bold bg-black text-[#CEF52A] px-2 py-0.5 rounded-full shadow-2xs">
                              ★ {piece.quality_score}
                            </span>
                          )}
                        </div>

                        {/* Card Info Footer */}
                        <div className="p-3 space-y-2 bg-gray-50/70 border-t border-gray-100">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-gray-800 truncate" title={piece.original_filename}>
                              {piece.original_filename}
                            </span>

                            <button
                              onClick={() => handleDeletePiece(piece.id)}
                              className="text-gray-400 hover:text-red-600 p-1 rounded transition"
                              title="Excluir peça"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Status da Análise */}
                          <div className="flex items-center justify-between pt-1">
                            {isCompleted ? (
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Auditada</span>
                              </span>
                            ) : isRunning ? (
                              <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Analisando...</span>
                              </span>
                            ) : isFailed ? (
                              <span className="text-[10px] text-red-700 bg-red-50 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1" title={piece.analysis_error || ''}>
                                <AlertTriangle className="w-3 h-3" />
                                <span>Falha</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md font-medium">
                                Pendente
                              </span>
                            )}

                            <button
                              onClick={() => setSelectedPiece(piece)}
                              className="text-[10px] text-gray-700 hover:text-black font-bold flex items-center gap-0.5 underline"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Detalhes</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= ABA 3: LOGOTIPOS DA MARCA ================= */}
          {activeTab === 'logos' && (
            <div className="space-y-6">
              {/* Header da Aba */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Palette className="w-4 h-4 text-black" />
                    <span>Logotipos Oficiais da Marca</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
                    Estes arquivos são armazenados no Supabase Storage e ficam disponíveis para uso direto no Creative Chat,
                    garantindo que toda criação conversacional aplique a assinatura oficial e as proporções exatas da marca.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start md:self-auto bg-gray-50 px-3.5 py-2 rounded-xl border border-gray-200">
                  <span className="text-xs text-gray-500 font-medium">Logos ativos:</span>
                  <span className="text-xs font-bold text-black bg-white px-2 py-0.5 rounded-lg border border-gray-200">
                    {logosCount} de 3
                  </span>
                </div>
              </div>

              {/* Grid dos 3 Slots Oficiais */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. LOGO PRINCIPAL */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col justify-between shadow-2xs relative overflow-hidden group">
                  {uploadingLogoType === 'logo_primary' && (
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-2xs z-20 flex flex-col items-center justify-center gap-2 text-xs font-bold text-gray-700">
                      <Loader2 className="w-6 h-6 animate-spin text-black" />
                      <span>Salvando Logo Principal...</span>
                    </div>
                  )}

                  <input
                    ref={primaryLogoInputRef}
                    type="file"
                    accept="image/png,image/svg+xml,image/webp,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload('logo_primary', file);
                      e.target.value = '';
                    }}
                  />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider">Logo Principal</h4>
                      </div>
                      {primaryLogo && (
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                          Ativo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed min-h-[32px]">
                      Identidade primária usada na maioria dos layouts, posts e cabeçalhos de campanha.
                    </p>

                    {/* Preview Area */}
                    {primaryLogo?.signedUrl ? (
                      <div className="w-full h-44 rounded-xl border border-gray-200 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:12px_12px] bg-gray-50/60 p-4 flex items-center justify-center relative group/img overflow-hidden">
                        <img
                          src={primaryLogo.signedUrl}
                          alt="Logo Principal"
                          className="max-h-full max-w-full object-contain filter drop-shadow-2xs transition group-hover/img:scale-105"
                        />
                      </div>
                    ) : (
                      <div
                        onClick={() => primaryLogoInputRef.current?.click()}
                        className="w-full h-44 border-2 border-dashed border-gray-300 hover:border-black rounded-xl flex flex-col items-center justify-center p-4 cursor-pointer bg-gray-50/40 hover:bg-gray-50 transition text-center space-y-2"
                      >
                        <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 shadow-2xs">
                          <Upload className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-gray-800 block">Enviar Logo Principal</span>
                          <span className="text-[10px] text-gray-400">PNG transparente, SVG ou WEBP</span>
                        </div>
                      </div>
                    )}

                    {primaryLogo && (
                      <div className="text-[11px] text-gray-500 flex items-center justify-between px-1">
                        <span className="truncate max-w-[170px]" title={primaryLogo.original_filename}>
                          {primaryLogo.original_filename || 'logo_primary.png'}
                        </span>
                        {primaryLogo.file_size_bytes && (
                          <span className="font-mono text-[10px] text-gray-400">
                            {(primaryLogo.file_size_bytes / 1024).toFixed(0)} KB
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  {primaryLogo ? (
                    <div className="pt-4 border-t border-gray-100 flex items-center gap-2 mt-4">
                      <a
                        href={primaryLogo.signedUrl}
                        download={primaryLogo.original_filename || 'logo_primary.png'}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Baixar</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => primaryLogoInputRef.current?.click()}
                        className="flex-1 py-2 px-3 bg-black hover:bg-zinc-800 text-[#CEF52A] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Trocar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLogoDelete('logo_primary', 'Logo Principal')}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                        title="Remover logotipo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* 2. LOGO SECUNDÁRIO / ÍCONE */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col justify-between shadow-2xs relative overflow-hidden group">
                  {uploadingLogoType === 'logo_secondary' && (
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-2xs z-20 flex flex-col items-center justify-center gap-2 text-xs font-bold text-gray-700">
                      <Loader2 className="w-6 h-6 animate-spin text-black" />
                      <span>Salvando Logo Secundário...</span>
                    </div>
                  )}

                  <input
                    ref={secondaryLogoInputRef}
                    type="file"
                    accept="image/png,image/svg+xml,image/webp,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload('logo_secondary', file);
                      e.target.value = '';
                    }}
                  />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider">Logo Secundário / Ícone</h4>
                      </div>
                      {secondaryLogo && (
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                          Ativo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed min-h-[32px]">
                      Versão reduzida, símbolo, monograma ou assinatura compacta para avatares e rodapés.
                    </p>

                    {/* Preview Area */}
                    {secondaryLogo?.signedUrl ? (
                      <div className="w-full h-44 rounded-xl border border-gray-200 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:12px_12px] bg-gray-50/60 p-4 flex items-center justify-center relative group/img overflow-hidden">
                        <img
                          src={secondaryLogo.signedUrl}
                          alt="Logo Secundário"
                          className="max-h-full max-w-full object-contain filter drop-shadow-2xs transition group-hover/img:scale-105"
                        />
                      </div>
                    ) : (
                      <div
                        onClick={() => secondaryLogoInputRef.current?.click()}
                        className="w-full h-44 border-2 border-dashed border-gray-300 hover:border-black rounded-xl flex flex-col items-center justify-center p-4 cursor-pointer bg-gray-50/40 hover:bg-gray-50 transition text-center space-y-2"
                      >
                        <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 shadow-2xs">
                          <Upload className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-gray-800 block">Enviar Símbolo / Ícone</span>
                          <span className="text-[10px] text-gray-400">PNG transparente, SVG ou WEBP</span>
                        </div>
                      </div>
                    )}

                    {secondaryLogo && (
                      <div className="text-[11px] text-gray-500 flex items-center justify-between px-1">
                        <span className="truncate max-w-[170px]" title={secondaryLogo.original_filename}>
                          {secondaryLogo.original_filename || 'logo_secondary.png'}
                        </span>
                        {secondaryLogo.file_size_bytes && (
                          <span className="font-mono text-[10px] text-gray-400">
                            {(secondaryLogo.file_size_bytes / 1024).toFixed(0)} KB
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  {secondaryLogo ? (
                    <div className="pt-4 border-t border-gray-100 flex items-center gap-2 mt-4">
                      <a
                        href={secondaryLogo.signedUrl}
                        download={secondaryLogo.original_filename || 'logo_secondary.png'}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Baixar</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => secondaryLogoInputRef.current?.click()}
                        className="flex-1 py-2 px-3 bg-black hover:bg-zinc-800 text-[#CEF52A] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Trocar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLogoDelete('logo_secondary', 'Logo Secundário')}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                        title="Remover logotipo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* 3. LOGO MONOCROMÁTICO / BRANCO (COM FUNDO ESCURO DEDICADO) */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col justify-between shadow-2xs relative overflow-hidden group">
                  {uploadingLogoType === 'logo_monochrome' && (
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-2xs z-20 flex flex-col items-center justify-center gap-2 text-xs font-bold text-gray-700">
                      <Loader2 className="w-6 h-6 animate-spin text-black" />
                      <span>Salvando Logo Monocromático...</span>
                    </div>
                  )}

                  <input
                    ref={monochromeLogoInputRef}
                    type="file"
                    accept="image/png,image/svg+xml,image/webp,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload('logo_monochrome', file);
                      e.target.value = '';
                    }}
                  />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-zinc-900 border border-zinc-700" />
                        <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider">Monocromático / Branco</h4>
                      </div>
                      {monochromeLogo && (
                        <span className="text-[10px] font-bold bg-zinc-900 text-[#CEF52A] px-2 py-0.5 rounded-full">
                          Ativo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed min-h-[32px]">
                      Versão branca/vazada ideal para contraste máximo em fundos pretos ou escuros.
                    </p>

                    {/* Preview Area (Dark Container para contraste de logo branco) */}
                    {monochromeLogo?.signedUrl ? (
                      <div className="w-full h-44 rounded-xl border border-zinc-800 bg-[#090B0E] p-4 flex items-center justify-center relative group/img overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(#1f242d_1px,transparent_1px)] [background-size:12px_12px] opacity-40 pointer-events-none" />
                        <img
                          src={monochromeLogo.signedUrl}
                          alt="Logo Monocromático"
                          className="max-h-full max-w-full object-contain filter drop-shadow-[0_2px_8px_rgba(255,255,255,0.15)] relative z-10 transition group-hover/img:scale-105"
                        />
                      </div>
                    ) : (
                      <div
                        onClick={() => monochromeLogoInputRef.current?.click()}
                        className="w-full h-44 border-2 border-dashed border-gray-300 hover:border-black rounded-xl flex flex-col items-center justify-center p-4 cursor-pointer bg-gray-50/40 hover:bg-gray-50 transition text-center space-y-2"
                      >
                        <div className="w-9 h-9 rounded-xl bg-zinc-900 text-[#CEF52A] border border-zinc-800 flex items-center justify-center shadow-2xs">
                          <Upload className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-gray-800 block">Enviar Versão Branca</span>
                          <span className="text-[10px] text-gray-400">PNG transparente branco ou SVG</span>
                        </div>
                      </div>
                    )}

                    {monochromeLogo && (
                      <div className="text-[11px] text-gray-500 flex items-center justify-between px-1">
                        <span className="truncate max-w-[170px]" title={monochromeLogo.original_filename}>
                          {monochromeLogo.original_filename || 'logo_monochrome.png'}
                        </span>
                        {monochromeLogo.file_size_bytes && (
                          <span className="font-mono text-[10px] text-gray-400">
                            {(monochromeLogo.file_size_bytes / 1024).toFixed(0)} KB
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  {monochromeLogo ? (
                    <div className="pt-4 border-t border-gray-100 flex items-center gap-2 mt-4">
                      <a
                        href={monochromeLogo.signedUrl}
                        download={monochromeLogo.original_filename || 'logo_monochrome.png'}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Baixar</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => monochromeLogoInputRef.current?.click()}
                        className="flex-1 py-2 px-3 bg-black hover:bg-zinc-800 text-[#CEF52A] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Trocar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLogoDelete('logo_monochrome', 'Logo Monocromático')}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                        title="Remover logotipo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* ================= ABA 4: DIRETRIZES MANUAIS ================= */}
          {activeTab === 'guidelines' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 shadow-2xs">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Diretrizes Manuais e Soberania Estética</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Qualquer regra definida aqui terá precedência absoluta sobre as inferências da Inteligência Artificial.
                  </p>
                </div>

                <textarea
                  rows={10}
                  value={manualGuidelinesText}
                  onChange={(e) => setManualGuidelinesText(e.target.value)}
                  placeholder="Defina aqui regras explícitas da marca:
- Proibições estritas de cores, fontes ou grafismos
- Regras de posicionamento e respiro do logo
- Tratamento e estilo fotográfico mandatório
- Tom de voz e densidade dos textos"
                  className="w-full px-4 py-3 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-black font-medium leading-relaxed resize-none"
                />

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-gray-400">
                    Após salvar, você poderá reconsolidar o DNA na aba principal para incorporar as diretrizes ao perfil oficial.
                  </span>

                  <button
                    onClick={handleSaveGuidelines}
                    disabled={isSavingGuidelines}
                    className="px-5 py-2.5 bg-black hover:bg-zinc-800 text-[#CEF52A] rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-2xs disabled:opacity-50"
                  >
                    {isSavingGuidelines ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#CEF52A]" />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Salvar Diretrizes Manuais</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ================= MODAL: INSPEÇÃO DETALHADA DE PEÇA ================= */}
      {selectedPiece && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/80 sticky top-0 z-20">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-black text-[#CEF52A] flex items-center justify-center font-bold text-xs">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm truncate max-w-md">
                    {selectedPiece.original_filename}
                  </h3>
                  <p className="text-[11px] text-gray-500 font-mono">
                    Formato: {selectedPiece.format_type} • Tipo: {selectedPiece.piece_type}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedPiece(null)}
                className="p-1.5 text-gray-400 hover:text-black rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Coluna 1: Imagem */}
              <div className="space-y-3">
                <div className="bg-gray-100 rounded-xl overflow-hidden border border-gray-200 flex items-center justify-center max-h-[500px]">
                  {selectedPiece.signedUrl ? (
                    <img
                      src={selectedPiece.signedUrl}
                      alt={selectedPiece.original_filename}
                      className="max-h-[500px] w-auto object-contain"
                    />
                  ) : (
                    <div className="p-12 text-gray-400 text-xs">Imagem indisponível</div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                  <span>Dimensões: {selectedPiece.width && selectedPiece.height ? `${selectedPiece.width}x${selectedPiece.height}` : 'Automáticas'}</span>
                  <button
                    onClick={() => {
                      const id = selectedPiece.id;
                      setSelectedPiece(null);
                      handleTriggerAnalysis(true, id);
                    }}
                    className="text-indigo-600 hover:underline font-bold flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reanalisar esta peça</span>
                  </button>
                </div>
              </div>

              {/* Coluna 2: Análise da IA */}
              <div className="space-y-4">
                {selectedPiece.analysis_status === 'completed' && selectedPiece.analysis_json ? (
                  (() => {
                    const a = selectedPiece.analysis_json as PieceAnalysis;
                    return (
                      <div className="space-y-4 text-xs">
                        {/* Score Header */}
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                          <span className="font-bold text-gray-700">Qualidade de Design:</span>
                          <span className="font-bold text-black bg-[#CEF52A] px-2.5 py-0.5 rounded-full text-xs">
                            ★ {a.qualityScore} / 10
                          </span>
                        </div>

                        {/* Resumo */}
                        <div>
                          <span className="font-bold text-gray-800 uppercase tracking-wider text-[10px] block mb-1">
                            Resumo do Diretor de Arte
                          </span>
                          <p className="text-gray-700 leading-relaxed font-medium bg-gray-50/70 p-3 rounded-xl border border-gray-200">
                            {a.summary}
                          </p>
                        </div>

                        {/* Cores */}
                        <div>
                          <span className="font-bold text-gray-800 uppercase tracking-wider text-[10px] block mb-1.5">
                            Cores Identificadas na Peça
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                            {(a.colors?.palette || []).map((col, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-gray-200 bg-white"
                              >
                                <span
                                  style={{ backgroundColor: col }}
                                  className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                                />
                                <span className="font-mono text-[10px] text-gray-700">{col}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Composição & Diagramação */}
                        <div className="space-y-1">
                          <span className="font-bold text-gray-800 uppercase tracking-wider text-[10px] block">
                            Diagramação & Composição
                          </span>
                          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-1 text-gray-600">
                            <p><strong>Estilo:</strong> {a.composition?.layoutStyle || 'Não identificado'}</p>
                            <p><strong>Alinhamento:</strong> {a.composition?.alignment || 'Não identificado'}</p>
                            <p><strong>Espaço Negativo / Respiro:</strong> {a.composition?.whiteSpace || 'Não identificado'}</p>
                          </div>
                        </div>

                        {/* Tipografia */}
                        <div className="space-y-1">
                          <span className="font-bold text-gray-800 uppercase tracking-wider text-[10px] block">
                            Tipografia
                          </span>
                          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-1 text-gray-600">
                            <p><strong>Estilo Dominante:</strong> {a.typography?.primaryStyle || 'Não identificado'}</p>
                            <p><strong>Peso dos Títulos:</strong> {a.typography?.titleWeight || 'Não identificado'}</p>
                            {a.typography?.observedFamilies && a.typography.observedFamilies.length > 0 && (
                              <p><strong>Fontes Observadas:</strong> {a.typography.observedFamilies.join(', ')}</p>
                            )}
                          </div>
                        </div>

                        {/* Pontos Fortes & Oportunidades */}
                        {a.strengths?.length > 0 && (
                          <div>
                            <span className="font-bold text-emerald-800 uppercase tracking-wider text-[10px] block mb-1">
                              Pontos Fortes da Direção de Arte
                            </span>
                            <ul className="space-y-1 text-emerald-950">
                              {a.strengths.map((s, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <Check className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                                  <span>{s}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : selectedPiece.analysis_status === 'failed' ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2 text-xs text-red-700">
                    <div className="flex items-center gap-2 font-bold text-red-800">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <span>Falha na Análise com OpenAI</span>
                    </div>
                    <p className="leading-relaxed">
                      {selectedPiece.analysis_error || 'A IA não conseguiu interpretar a imagem.'}
                    </p>
                    <p className="text-[11px] text-red-600 pt-1">
                      Verifique se a OpenAI API key está configurada na aba de Integrações e se a imagem possui formato válido.
                    </p>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-gray-500 space-y-3">
                    <Clock className="w-6 h-6 text-gray-400 mx-auto" />
                    <p>Esta peça ainda não foi analisada pela Inteligência Artificial.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: UPLOAD DE NOVAS PEÇAS ================= */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-black text-[#CEF52A] flex items-center justify-center font-bold text-xs">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Enviar Peças de Referência</h3>
                  <p className="text-[11px] text-gray-500">
                    Adicione até 30 imagens gráficas da marca para alimentar a memória visual.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setNewPiecesUpload([]);
                }}
                className="p-1.5 text-gray-400 hover:text-black rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 hover:border-black bg-gray-50/50 hover:bg-gray-50 rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2"
              >
                <Upload className="w-6 h-6 text-black" />
                <h4 className="text-xs font-bold text-gray-900">Clique para selecionar imagens</h4>
                <p className="text-[11px] text-gray-500">PNG, JPG ou WEBP</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleSelectNewPieces(e.target.files)}
                  className="hidden"
                />
              </div>

              {newPiecesUpload.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-gray-800">
                    {newPiecesUpload.length} peça(s) pronta(s) para upload:
                  </span>
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                    {newPiecesUpload.map((p, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                        <img src={p.base64} alt={p.filename} className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 left-1 text-[8px] bg-black/80 text-white px-1 py-0.2 rounded font-mono">
                          {p.formatType}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setNewPiecesUpload([]);
                }}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-black transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleUploadNewPiecesSubmit}
                disabled={uploadingPieces || newPiecesUpload.length === 0}
                className="px-5 py-2 bg-black hover:bg-zinc-800 text-[#CEF52A] rounded-xl font-bold text-xs flex items-center gap-2 transition disabled:opacity-50"
              >
                {uploadingPieces ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#CEF52A]" />
                    <span>Enviando para o Storage...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Confirmar Upload ({newPiecesUpload.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
