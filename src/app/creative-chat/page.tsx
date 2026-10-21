// src/app/creative-chat/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppSidebar } from '@/components/layout/AppSidebar';
import {
  Send,
  Upload,
  Layers,
  Image as ImageIcon,
  Building2,
  ChevronDown,
  ArrowRight,
  RefreshCw,
  X,
  FileText,
  SlidersHorizontal,
  Compass,
  MessageSquare,
  Plus,
  Clock,
  Download,
  FolderKanban,
  AlertCircle,
  CheckCircle2,
  User,
  Camera,
} from 'lucide-react';
import { VisualAnalysisCard } from '@/components/creative-chat/VisualAnalysisCard';
import { GeneratedPieceCard } from '@/components/creative-chat/GeneratedPieceCard';
import {
  ClientReferencesDrawer,
  type ClientReferenceItem,
} from '@/components/creative-chat/ClientReferencesDrawer';
import { ReferencePickerModal } from '@/components/creative-chat/ReferencePickerModal';
import type { ChatMessage, ChatAttachment } from '@/types/domain/creative-chat';
import type { ProjectFormat } from '@/types/database';

const FORMAT_OPTIONS = [
  { id: 'instagram_feed_4_5' as ProjectFormat, label: 'Feed 4:5', dimensions: '1080 × 1350', aspectRatio: '4:5' },
  { id: 'instagram_story' as ProjectFormat, label: 'Story 9:16', dimensions: '1080 × 1920', aspectRatio: '9:16' },
  { id: 'instagram_square' as ProjectFormat, label: 'Quadrado 1:1', dimensions: '1080 × 1080', aspectRatio: '1:1' },
  { id: 'custom' as ProjectFormat, label: 'Horizontal 16:9', dimensions: '1920 × 1080', aspectRatio: '16:9' },
] as const;

const TYPE_OPTIONS = [
  { id: 'single_post' as const, label: 'Peça única' },
  { id: 'carousel' as const, label: 'Carrossel' },
] as const;

const SLIDE_COUNT_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

interface ClientOption {
  id: string;
  name: string;
  niche?: string | null;
  brand_status: string;
}

interface ConversationItem {
  id: string;
  title: string;
  updated_at: string;
  last_response_id?: string;
}

interface ClientLogoItem {
  id: string;
  type: 'logo_primary' | 'logo_secondary' | 'logo_monochrome';
  imageUrl: string;
}

interface DetectedFaceItem {
  id: string;
  box_2d: [number, number, number, number];
  cropDataUrl: string;
}

interface SubjectPhotoItem {
  id?: string;
  url: string;
  storagePath?: string;
  name: string;
  hasFace?: boolean;
  faceCount?: number;
  hasMultipleFaces?: boolean;
  faces?: DetectedFaceItem[];
  selectedFaceCropUrl?: string;
  validationStatus?: string;
  isDetectingFace?: boolean;
  cutoutUrl?: string;
  cutoutStoragePath?: string;
  isSegmenting?: boolean;
  segmentationStatus?: 'ready' | 'error' | 'pending';
  segmentationError?: string;
}

function CreativeChatContent() {
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get('client');
  const preselectedConversationId = searchParams.get('conversation');

  // Estado dos Clientes
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientContext, setClientContext] = useState<any>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  // Estado das Conversas
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isSidebarHistoryOpen, setIsSidebarHistoryOpen] = useState(false);

  // Drawer de referências
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [clientPieces, setClientPieces] = useState<ClientReferenceItem[]>([]);
  const [selectedPieceIds, setSelectedPieceIds] = useState<string[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  // Novo Composer de Geração Baseado em Referência (MVP 2.1)
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<ProjectFormat>('instagram_feed_4_5');
  const [selectedType, setSelectedType] = useState<'single_post' | 'carousel'>('single_post');
  const [carouselSlideCount, setCarouselSlideCount] = useState<number>(5);
  const [clientLogos, setClientLogos] = useState<ClientLogoItem[]>([]);
  const [selectedLogoType, setSelectedLogoType] = useState<string>('none');
  const [subjectPhoto, setSubjectPhoto] = useState<SubjectPhotoItem | null>(null);
  const [personHandlingMode, setPersonHandlingMode] = useState<'preserve_person' | 'inspire_person'>('preserve_person');
  const [isUploadingSubjectPhoto, setIsUploadingSubjectPhoto] = useState(false);
  const subjectPhotoInputRef = useRef<HTMLInputElement>(null);
  const [isReferencePickerOpen, setIsReferencePickerOpen] = useState(false);
  const [noReferenceWarning, setNoReferenceWarning] = useState<string | null>(null);

  // Mensagens do Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [stagedAttachments, setStagedAttachments] = useState<ChatAttachment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Carrega lista de clientes
  useEffect(() => {
    fetch('/api/clients')
      .then((r) => r.json())
      .then((data) => {
        const list: ClientOption[] = data.clients || [];
        setClients(list);
        if (list.length > 0) {
          const initial =
            preselectedClientId && list.find((c) => c.id === preselectedClientId)
              ? preselectedClientId
              : list[0].id;
          setSelectedClientId(initial);
        }
      })
      .catch((err) => console.error('Erro ao buscar clientes:', err));
  }, [preselectedClientId]);

  // 2. Quando o cliente muda, busca contexto e conversas
  useEffect(() => {
    if (!selectedClientId) return;

    // Regra 12: Troca de cliente limpa automaticamente referência selecionada e contexto anterior
    setSelectedReferenceId(null);
    setSubjectPhoto(null);
    setPersonHandlingMode('preserve_person');
    setNoReferenceWarning(null);
    setStagedAttachments([]);

    setLoadingContext(true);
    Promise.all([
      fetch(`/api/creative-chat/context?clientId=${selectedClientId}`).then((r) => r.json()),
      fetch(`/api/creative-chat/conversations?clientId=${selectedClientId}`).then((r) => r.json()),
    ])
      .then(([contextData, convData]) => {
        setClientContext(contextData);
        const pieces = (contextData.pieces || []) as ClientReferenceItem[];
        setClientPieces(pieces);

        // Logos do cliente disponíveis para o composer
        const logos = (contextData.logos || []) as ClientLogoItem[];
        setClientLogos(logos);
        const hasPrimary = logos.some((l) => l.type === 'logo_primary');
        if (hasPrimary) {
          setSelectedLogoType('logo_primary');
        } else if (logos.length > 0) {
          setSelectedLogoType(logos[0].type);
        } else {
          setSelectedLogoType('none');
        }

        // Restaura seleção da memória visual: localStorage do cliente ou todas as peças cadastradas
        let initialSelected: string[] = [];
        if (selectedClientId && typeof window !== 'undefined') {
          try {
            const cached = localStorage.getItem(`studio_fa_active_refs_${selectedClientId}`);
            if (cached) {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) initialSelected = parsed;
            }
          } catch {}
        }
        if (initialSelected.length === 0) {
          initialSelected = pieces.map((p) => p.id);
        }
        setSelectedPieceIds(initialSelected);

        const convList: ConversationItem[] = convData.conversations || [];
        setConversations(convList);

        const clientName = contextData.client?.name || 'Cliente';

        // Se houver uma conversa pré-selecionada ou existente
        if (preselectedConversationId && convList.some((c) => c.id === preselectedConversationId)) {
          loadConversation(preselectedConversationId);
        } else {
          // Inicializa feed limpo com mensagem acolhedora
          setActiveConversationId(null);
          setMessages([
            {
              id: `msg-welcome-${Date.now()}`,
              role: 'assistant',
              content: `Olá! Sou seu **Copiloto Criativo** no Studio FA. Carreguei a memória visual e **${pieces.length} referências** de **${clientName}**.\n\nVocê pode pedir uma análise visual estruturada, anexar prints de layout ou pedir uma arte completa em linguagem natural (ex: *"crie um post 4:5 com a headline: Como acelerar com IA"*).`,
              createdAt: new Date().toISOString(),
            },
          ]);
        }
      })
      .catch((err) => console.error('Erro ao buscar dados do chat:', err))
      .finally(() => setLoadingContext(false));
  }, [selectedClientId]);

  // Carrega mensagens de uma conversa existente
  const loadConversation = async (convId: string) => {
    try {
      setIsProcessing(true);
      const res = await fetch(`/api/creative-chat/conversations/${convId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveConversationId(convId);
        if (data.conversation?.active_reference_piece_ids && Array.isArray(data.conversation.active_reference_piece_ids)) {
          setSelectedPieceIds(data.conversation.active_reference_piece_ids);
          if (selectedClientId && typeof window !== 'undefined') {
            try {
              localStorage.setItem(`studio_fa_active_refs_${selectedClientId}`, JSON.stringify(data.conversation.active_reference_piece_ids));
            } catch {}
          }
        }
        if (data.messages && data.messages.length > 0) {
          setMessages(
            data.messages.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              visualAnalysis: m.metadata?.visualAnalysis,
              generatedPiece: m.metadata?.generatedPiece,
              attachments: m.metadata?.attachments,
              createdAt: m.created_at,
            }))
          );
        }
      }
    } catch (e) {
      console.error('Falha ao carregar conversa:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Cria uma nova conversa
  const handleStartNewConversation = async () => {
    if (!selectedClientId) return;
    try {
      const res = await fetch('/api/creative-chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClientId,
          title: `Nova Conversa • ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        }),
      });
      const data = await res.json();
      if (data.conversation) {
        setConversations((prev) => [data.conversation, ...prev]);
        setActiveConversationId(data.conversation.id);
        const clientName = clientContext?.client?.name || 'Cliente';
        setMessages([
          {
            id: `msg-welcome-${Date.now()}`,
            role: 'assistant',
            content: `Nova conversa iniciada para **${clientName}**.\nO que vamos criar hoje?`,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      console.error('Erro ao criar nova conversa:', err);
    }
  };

  // Scroll automático para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  // Seleção de peças
  const handleTogglePiece = (pieceId: string) => {
    setSelectedPieceIds((prev) =>
      prev.includes(pieceId) ? prev.filter((id) => id !== pieceId) : [...prev, pieceId]
    );
  };

  const handleSelectAllPieces = () => {
    setSelectedPieceIds(clientPieces.map((p) => p.id));
  };

  const handleClearPieces = () => {
    setSelectedPieceIds([]);
  };

  const handleConfirmSelection = async (newIds: string[]) => {
    setSelectedPieceIds(newIds);
    if (selectedClientId && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`studio_fa_active_refs_${selectedClientId}`, JSON.stringify(newIds));
      } catch {}
    }
    if (activeConversationId) {
      try {
        await fetch(`/api/creative-chat/conversations/${activeConversationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active_reference_piece_ids: newIds }),
        });
      } catch (err) {
        console.error('Falha ao persistir seleção de referências na conversa:', err);
      }
    }
  };

  // Upload de arquivos (prints / referências)
  const handleFileUpload = async (filesInput: FileList | File[] | File | null, isLayoutPrint = false) => {
    if (!filesInput || !selectedClientId) return;
    const files: File[] = filesInput instanceof File ? [filesInput] : Array.from(filesInput as any);
    if (files.length === 0) return;

    setIsUploadingAttachment(true);
    setStatusMessage('Enviando imagem de referência...');

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();

        const base64Data = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const res = await fetch('/api/creative-chat/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: selectedClientId,
            fileBase64: base64Data,
            filename: file.name,
            isLayoutPrint,
            title: file.name.replace(/\.[^/.]+$/, ''),
          }),
        });

        const result = await res.json();

        if (res.ok && result.piece) {
          const newAtt: ChatAttachment = {
            id: result.piece.id,
            type: isLayoutPrint ? 'layout_print' : 'image',
            url: result.piece.imageUrl,
            storagePath: result.piece.storagePath,
            name: file.name,
            isPrimary: false,
            isLayoutPrint,
          };
          setStagedAttachments((prev) => [...prev, newAtt]);

          setClientPieces((prev) => [
            {
              id: result.piece.id,
              title: file.name,
              imageUrl: result.piece.imageUrl,
              formatType: result.piece.formatType || 'instagram_feed_4_5',
              pieceType: isLayoutPrint ? 'print' : 'own_brand',
            },
            ...prev,
          ]);

          setSelectedPieceIds((prev) => [...prev, result.piece.id]);
        }
      }
    } catch (err: any) {
      console.error('Falha no upload de anexo:', err);
    } finally {
      setIsUploadingAttachment(false);
      setStatusMessage('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Ação "Usar como referência" na imagem gerada
  const handleUseAsReference = (imageUrl: string) => {
    const newAtt: ChatAttachment = {
      id: `ref-img-${Date.now()}`,
      type: 'image',
      url: imageUrl,
      name: 'Arte Anterior como Referência',
      isPrimary: false,
      isLayoutPrint: false,
    };
    setStagedAttachments((prev) => [...prev, newAtt]);
  };

  // Upload do Objeto Principal (Foto do Cliente / Produto com Presença Obrigatória na Arte)
  const handleSubjectPhotoUpload = async (filesInput: FileList | File[] | File | null) => {
    if (!filesInput || !selectedClientId) return;
    const file = filesInput instanceof File ? filesInput : filesInput[0];
    if (!file) return;

    setIsUploadingSubjectPhoto(true);
    setStatusMessage('Carregando foto do objeto principal...');

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Invalida estados anteriores imediatamente ao trocar ou subir nova foto (Seção 16 e 17)
      setSubjectPhoto({
        url: base64Data,
        name: file.name,
        isDetectingFace: true,
        isSegmenting: true,
        hasFace: false,
        faceCount: 0,
        faces: [],
        selectedFaceCropUrl: undefined,
        cutoutUrl: undefined,
        cutoutStoragePath: undefined,
        segmentationStatus: 'pending',
        validationStatus: 'Isolando pessoa e analisando identidade facial...',
      });

      // Dispara upload e detecção facial/segmentação em paralelo
      const uploadPromise = fetch('/api/creative-chat/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClientId,
          fileBase64: base64Data,
          filename: file.name,
          isSubjectPhoto: true,
          title: `Objeto Principal — ${file.name}`,
        }),
      }).then((r) => r.json());

      const faceDetectPromise = fetch('/api/creative-chat/detect-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClientId,
          fileBase64: base64Data,
        }),
      }).then((r) => r.json()).catch(() => null);

      const [uploadResult, detectResult] = await Promise.all([uploadPromise, faceDetectPromise]);

      const hasFace = detectResult?.hasFace ?? false;
      const faceCount = detectResult?.faceCount ?? 0;
      const hasMultipleFaces = detectResult?.hasMultipleFaces ?? false;
      const faces: DetectedFaceItem[] = detectResult?.faces ?? [];
      const primaryCrop = detectResult?.primaryFaceCropDataUrl;
      const cutoutUrl = detectResult?.cutoutDataUrl;
      const cutoutStoragePath = detectResult?.cutoutStoragePath;
      const segmentationStatus = detectResult?.segmentationStatus || (detectResult?.hasCutout ? 'ready' : 'error');
      const segmentationError = detectResult?.segmentationError;

      const statusText = segmentationStatus === 'ready'
        ? (hasFace ? 'Pessoa isolada com sucesso — identidade preservada' : 'Objeto isolado do fundo')
        : (detectResult?.segmentationError || 'Não foi possível separar a pessoa do fundo.');

      setSubjectPhoto((prev) => ({
        url: uploadResult?.piece?.url || prev?.url || base64Data,
        id: uploadResult?.piece?.id || prev?.id,
        storagePath: uploadResult?.piece?.storagePath || prev?.storagePath,
        name: file.name,
        hasFace,
        faceCount,
        hasMultipleFaces,
        faces,
        selectedFaceCropUrl: primaryCrop,
        cutoutUrl,
        cutoutStoragePath,
        isSegmenting: false,
        segmentationStatus,
        segmentationError,
        validationStatus: statusText,
        isDetectingFace: false,
      }));
    } catch (err: any) {
      console.error('Falha ao enviar foto do cliente:', err);
      setSubjectPhoto((prev) => prev ? { ...prev, isDetectingFace: false, validationStatus: 'Erro na análise da imagem' } : null);
    } finally {
      setIsUploadingSubjectPhoto(false);
      setStatusMessage('');
      if (subjectPhotoInputRef.current) subjectPhotoInputRef.current.value = '';
    }
  };

  // Envio de Mensagem no Chat
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputText.trim();
    if ((!textToSend && stagedAttachments.length === 0 && !subjectPhoto) || isProcessing) return;

    const currentAttachments = [...stagedAttachments];
    if (subjectPhoto) {
      currentAttachments.unshift({
        id: subjectPhoto.id || `subject-${Date.now()}`,
        type: 'image',
        url: subjectPhoto.url,
        storagePath: subjectPhoto.storagePath,
        name: `Objeto Principal: ${subjectPhoto.name}`,
        isPrimary: true,
        isSubjectPhoto: true,
      });
    }

    const userMessageText = textToSend || 'Use essas referências e a foto do cliente para gerar uma arte.';

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessageText,
      attachments: currentAttachments,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setStagedAttachments([]);

    setIsProcessing(true);

    const isAnalysisRequest =
      /analis(e|ar)|leitura visual|estratégia visual|dna visual|referências visuais/i.test(userMessageText) &&
      !/gere|crie|faça|monte|post|carrossel/i.test(userMessageText);

    // Regra 10: Se usuário tentar gerar sem selecionar referência: NÃO gerar
    if (!isAnalysisRequest && !selectedReferenceId) {
      setNoReferenceWarning('Selecione uma referência visual para orientar a criação.');
      setIsReferencePickerOpen(true);
      setIsProcessing(false);
      return;
    }

    try {
      if (isAnalysisRequest) {
        setStatusMessage('Analisando a memória visual e repertório do cliente...');
        const res = await fetch('/api/creative-chat/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: selectedClientId,
            conversationId: activeConversationId,
            selectedPieceIds: selectedReferenceId ? [selectedReferenceId] : selectedPieceIds,
            customInstruction: userMessageText,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Falha ao analisar referências.');

        const assistantMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: `Realizei a análise visual aprofundada de **${clientContext?.client?.name || 'Cliente'}** com base na referência selecionada:`,
          visualAnalysis: data.report,
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        // Pedido de Criação / Geração de Arte
        setStatusMessage(
          selectedType === 'carousel'
            ? `Gerando carrossel de ${carouselSlideCount} lâminas com GPT Image 2.5...`
            : 'Gerando arte completa com GPT Image 2.5...'
        );
        const layoutPrint = currentAttachments.find((a) => a.isLayoutPrint)?.url;
        const formatObj = FORMAT_OPTIONS.find((f) => f.id === selectedFormat);

        const res = await fetch('/api/creative-chat/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: selectedClientId,
            conversationId: activeConversationId,
            userMessage: userMessageText,
            selectedPieceIds: [selectedReferenceId],
            format: selectedFormat,
            aspectRatio: formatObj?.aspectRatio || '4:5',
            projectType: selectedType,
            slideCount: selectedType === 'carousel' ? carouselSlideCount : 1,
            selectedLogoType: selectedLogoType !== 'none' ? selectedLogoType : undefined,
            subjectPhotoUrl: subjectPhoto?.url,
            subjectPhotoStoragePath: subjectPhoto?.storagePath,
            faceCropDataUrl: subjectPhoto?.selectedFaceCropUrl,
            subjectCutoutDataUrl: subjectPhoto?.cutoutUrl,
            subjectCutoutStoragePath: subjectPhoto?.cutoutStoragePath,
            personHandlingMode,
            layoutPrintUrl: layoutPrint,
            uploadedPieces: currentAttachments.map((a) => ({
              title: a.name || a.title,
              url: a.url,
              storagePath: a.storagePath,
              isLayoutPrint: a.isLayoutPrint,
              isSubjectPhoto: a.isSubjectPhoto || (a.name?.includes('Objeto Principal') ?? false),
              isPrimary: true,
            })),
            profile: 'SMOKE',
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          const errObj = new Error(data.error?.message || 'Falha ao gerar peça criativa.');
          (errObj as any).code = data.error?.code;
          (errObj as any).technicalDetails = data.error?.technicalDetails;
          throw errObj;
        }

        // Validação Estrita de Imagem Real (Seção 2, 10 e 11):
        // NUNCA aceitar SVG de fallback fake ou ausência de URL como sucesso.
        if (!data.piece || !data.piece.previewUrl || data.piece.previewUrl.startsWith('data:image/svg')) {
          const errObj = new Error('Falha na geração: a OpenAI não retornou um asset visual válido.');
          (errObj as any).code = 'INVALID_ASSET_RETURNED';
          throw errObj;
        }

        const isCar = selectedType === 'carousel' && data.piece?.carouselSlides;
        const assistantMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: isCar
            ? `Aqui está o seu **Carrossel (${data.piece.carouselSlides.length} lâminas)** gerado com a identidade de **${clientContext?.client?.name || 'Cliente'}**:`
            : `Aqui está a sua arte gerada com a identidade de **${clientContext?.client?.name || 'Cliente'}**:`,
          generatedPiece: {
            ...data.piece,
            activeReferencesCount: 1,
          },
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err: any) {
      console.error('Erro no processamento da mensagem:', err);
      const isAuthError =
        err?.code === 'OPENAI_AUTH_ERROR' ||
        err?.message?.includes('Chave de API') ||
        err?.message?.includes('401') ||
        err?.message?.includes('Incorrect API key');

      const isQuotaError =
        err?.code === 'OPENAI_QUOTA_ERROR' ||
        err?.message?.includes('cota') ||
        err?.message?.includes('429');

      let userFacingMessage = err?.message || 'Erro inesperado ao gerar a imagem.';
      if (isAuthError) {
        userFacingMessage =
          'Chave de API da OpenAI inválida ou sem permissão para o modelo de imagem. Atualize suas credenciais em Configurações > Integrações.';
      } else if (isQuotaError) {
        userFacingMessage =
          'Limite de requisições ou cota da OpenAI atingido. Verifique o saldo ou plano da sua conta OpenAI.';
      }

      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: '',
        generationError: {
          message: userFacingMessage,
          code: err?.code,
          technicalDetails: err?.technicalDetails || err?.message,
          failedPrompt: userMessageText,
          selectedReferenceId: selectedReferenceId || undefined,
        },
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
    }
  };

  const currentClient = clients.find((c) => c.id === selectedClientId);
  const selectedReference = clientPieces.find((p) => p.id === selectedReferenceId);

  return (
    <div className="flex h-screen bg-[#090B0E] text-white overflow-hidden">
      <AppSidebar />

      {/* Container Principal */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header Superior: Seletor de Cliente, Conversas e Memória Visual */}
        <header className="h-16 border-b border-zinc-800 bg-[#0E1116] px-4 md:px-6 flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-3">
            {/* Seletor de Cliente */}
            <div className="relative">
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                disabled={loadingContext || isProcessing}
                className="bg-[#16181D] border border-zinc-700/80 text-white text-xs md:text-sm font-semibold rounded-xl pl-3 pr-8 py-2 appearance-none outline-none focus:border-[#CEF52A] transition cursor-pointer"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#121418] text-white">
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            {/* Botão Nova Conversa */}
            <button
              onClick={handleStartNewConversation}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-lg border border-zinc-700 transition"
              title="Iniciar nova conversa para este cliente"
            >
              <Plus className="w-3.5 h-3.5 text-[#CEF52A]" />
              <span className="hidden sm:inline">Nova Conversa</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão Ver Produções */}
            <Link
              href="/projects"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-lg border border-zinc-700/60 transition"
            >
              <FolderKanban className="w-3.5 h-3.5 text-zinc-400" />
              <span>Produções</span>
            </Link>

            {/* Botão Drawer de Memória Visual */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#181B20] hover:bg-zinc-800 text-zinc-200 text-xs font-semibold rounded-xl border border-zinc-700 transition"
            >
              <Layers className="w-4 h-4 text-[#CEF52A]" />
              <span className="hidden md:inline">Memória Visual:</span>
              <span className="bg-[#CEF52A]/10 text-[#CEF52A] px-1.5 py-0.5 rounded text-[11px] font-mono font-bold">
                {selectedPieceIds.length} / {clientPieces.length} peças
              </span>
            </button>
          </div>
        </header>

        {/* Feed de Conversa */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-[#CEF52A] text-black font-black flex items-center justify-center text-xs shrink-0 shadow-sm mt-1">
                    FA
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-xs md:text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#181D24] text-white border border-zinc-700/60 shadow'
                      : 'bg-[#101216] text-zinc-200 border border-zinc-800/90 shadow-md'
                  }`}
                >
                  {/* Anexos da Mensagem */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {msg.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="relative rounded-lg overflow-hidden border border-zinc-700 bg-black/50 group"
                          style={{ width: '80px', height: '80px' }}
                        >
                          <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                          {att.isLayoutPrint && (
                            <span className="absolute bottom-1 left-1 bg-black/80 text-[8px] text-[#CEF52A] px-1 rounded font-bold">
                              PRINT
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Conteúdo textual */}
                  {msg.content && <div className="whitespace-pre-line">{msg.content}</div>}

                  {/* Card de Erro Explícito de Geração (Estado C - Seções 5 e 12) */}
                  {msg.generationError && (
                    <div className="bg-[#141214] border border-red-500/40 rounded-2xl p-4 md:p-5 text-zinc-200 shadow-xl max-w-lg space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0 text-red-400">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            Não foi possível gerar a imagem
                          </h4>
                          <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                            {msg.generationError.message}
                          </p>
                        </div>
                      </div>

                      {/* Detalhes técnicos opcionais */}
                      {msg.generationError.technicalDetails && (
                        <details className="text-[11px] bg-black/40 border border-zinc-800 rounded-lg p-2 text-zinc-400">
                          <summary className="cursor-pointer font-mono hover:text-zinc-200 select-none">
                            Ver detalhes técnicos
                          </summary>
                          <p className="mt-2 font-mono whitespace-pre-wrap break-all text-[10px] text-zinc-500">
                            {msg.generationError.technicalDetails}
                          </p>
                        </details>
                      )}

                      {/* Ações: Tentar novamente / Trocar referência / Configurar */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/80">
                        <button
                          type="button"
                          onClick={() => handleSendMessage(msg.generationError?.failedPrompt)}
                          disabled={isProcessing}
                          className="px-3 py-1.5 bg-[#CEF52A] hover:bg-[#b8dd24] text-black font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Tentar novamente
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsReferencePickerOpen(true)}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs rounded-xl border border-zinc-700 transition flex items-center gap-1.5"
                        >
                          <Layers className="w-3.5 h-3.5 text-[#CEF52A]" />
                          Trocar referência
                        </button>

                        {(msg.generationError.code === 'OPENAI_AUTH_ERROR' ||
                          msg.generationError.message.includes('Configurações')) && (
                          <Link
                            href="/settings/integrations"
                            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-semibold text-xs rounded-xl border border-zinc-800 transition flex items-center gap-1"
                          >
                            Configurar Integração →
                          </Link>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Card de Análise Visual Estruturada */}
                  {msg.visualAnalysis && (
                    <div className="mt-4">
                      <VisualAnalysisCard
                        report={msg.visualAnalysis}
                        onQuickAction={(prompt) => handleSendMessage(prompt)}
                      />
                    </div>
                  )}

                  {/* Card de Peça Gerada */}
                  {msg.generatedPiece && (
                    <div className="mt-4">
                      <GeneratedPieceCard
                        piece={msg.generatedPiece}
                        clientId={selectedClientId}
                        conversationId={activeConversationId || undefined}
                        onRegenerate={(instruction) =>
                          handleSendMessage(
                            instruction
                              ? `Ajuste esta peça: ${instruction}`
                              : 'Gere uma variação alternativa desta composição.'
                          )
                        }
                        onUseAsReference={handleUseAsReference}
                        isRegenerating={isProcessing}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Skeleton de Processamento */}
            {isProcessing && (
              <div className="flex gap-3.5 items-start">
                <div className="w-8 h-8 rounded-lg bg-[#CEF52A] text-black font-black flex items-center justify-center text-xs shrink-0 shadow-sm animate-pulse">
                  FA
                </div>
                <div className="bg-[#101216] border border-zinc-800/90 rounded-2xl p-4 text-xs text-zinc-300 flex items-center gap-3">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#CEF52A]" />
                  <span>{statusMessage || 'Processando com IA...'}</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Barra Inferior: Novo Composer de Geração Baseado em Referência (MVP 2.1) */}
        <div className="p-4 bg-[#0E1116] border-t border-zinc-800 shrink-0">
          <div className="max-w-3xl mx-auto space-y-3">
            {/* 1. SELEÇÃO DE DIREÇÃO VISUAL: ESTILO DA ARTE (OBRIGATÓRIO) + OBJETO PRINCIPAL (IDENTIDADE) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {/* CARD 1: ESTILO DA ARTE (REFERÊNCIA DE ESTILO OBRIGATÓRIA) */}
              {selectedReference ? (
                <div className="flex items-center justify-between p-2.5 bg-[#121418] border border-zinc-700/80 rounded-xl shadow-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-[#CEF52A]/50 shrink-0 bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedReference.imageUrl}
                        alt={selectedReference.title}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute -bottom-0.5 inset-x-0 bg-black/80 text-[7px] text-[#CEF52A] text-center font-bold">
                        ESTILO
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold text-[#CEF52A] tracking-wider">
                          ESTILO DA ARTE:
                        </span>
                        <span className="text-[9px] text-zinc-500 bg-zinc-800 px-1.5 py-0.2 rounded font-mono">
                          {selectedReference.pieceType === 'own_brand' ? 'Marca' : 'Ref'}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-white truncate mt-0.5" title={selectedReference.title}>
                        {selectedReference.title}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsReferencePickerOpen(true)}
                    className="px-2.5 py-1 text-xs text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition shrink-0 ml-2"
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-2.5 bg-[#121418] border border-dashed border-zinc-700 rounded-xl">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 shrink-0">
                      <Layers className="w-4 h-4 text-[#CEF52A]" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white block truncate uppercase tracking-wider">
                        ESTILO DA ARTE
                      </span>
                      <span className="text-[10px] text-zinc-400 block truncate">
                        {clientPieces.length === 0 ? 'Cadastre referências no cliente' : 'Selecione 1 peça para orientar o estilo'}
                      </span>
                    </div>
                  </div>

                  {clientPieces.length === 0 ? (
                    <Link
                      href={`/clients/${selectedClientId}`}
                      className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-[#CEF52A] font-bold text-xs rounded-lg border border-[#CEF52A]/30 transition shrink-0 ml-2"
                    >
                      Adicionar
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsReferencePickerOpen(true)}
                      className="px-3 py-1.5 bg-[#CEF52A] hover:bg-[#b8dd24] text-black font-bold text-xs rounded-lg transition shadow shrink-0 ml-2"
                    >
                      Selecionar
                    </button>
                  )}
                </div>
              )}

              {/* CARD 2: OBJETO PRINCIPAL (PRESERVAÇÃO OBRIGATÓRIA DE IDENTIDADE FACIAL) */}
              {subjectPhoto ? (
                <div className="p-2.5 bg-[#121418] border border-[#CEF52A]/40 rounded-xl shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-[#CEF52A] shrink-0 bg-black">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={subjectPhoto.url}
                          alt="Objeto Principal"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute -bottom-0.5 inset-x-0 bg-black/90 text-[6.5px] text-[#CEF52A] text-center font-bold">
                          HERO
                        </span>
                      </div>

                      {/* Mini thumbnail do crop facial se detectado */}
                      {subjectPhoto.selectedFaceCropUrl && (
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-emerald-400 shrink-0 bg-black" title="Crop Facial em Alta Fidelidade">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={subjectPhoto.selectedFaceCropUrl}
                            alt="Crop Facial"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute -bottom-0.5 inset-x-0 bg-emerald-950/90 text-[6.5px] text-emerald-300 text-center font-bold">
                            ROSTO
                          </span>
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] uppercase font-bold text-[#CEF52A] tracking-wider">
                            OBJETO PRINCIPAL:
                          </span>
                          <span className="text-[8px] bg-[#CEF52A]/20 text-[#CEF52A] px-1 py-0.2 rounded font-bold">
                            Obrigatório
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-white truncate mt-0.5" title={subjectPhoto.name}>
                          {subjectPhoto.name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => subjectPhotoInputRef.current?.click()}
                        className="px-2 py-1 text-xs text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition"
                        title="Substituir foto"
                      >
                        Trocar
                      </button>
                      <button
                        type="button"
                        onClick={() => setSubjectPhoto(null)}
                        className="p-1 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                        title="Remover foto"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Estado de Validação Facial e Seletor de Modo (Seções 10, 11, 12) */}
                  <div className="pt-1.5 border-t border-zinc-800/80 space-y-2">
                    {subjectPhoto.isDetectingFace ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                        <RefreshCw className="w-3 h-3 animate-spin text-[#CEF52A]" />
                        <span>Detectando rosto humano...</span>
                      </div>
                    ) : subjectPhoto.hasFace ? (
                      <div className="space-y-2">
                        {/* Seletor Oficial dos Dois Modos: Inspirar vs Preservar (Seção 10) */}
                        <div className="p-2 bg-black/40 rounded-lg border border-zinc-800/80 space-y-1.5">
                          <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                            Modo de Fidelidade Humana:
                          </span>
                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <label className="flex items-center gap-1.5 cursor-pointer text-zinc-100 hover:text-white">
                              <input
                                type="radio"
                                name="personHandlingMode"
                                value="preserve_person"
                                checked={personHandlingMode === 'preserve_person'}
                                onChange={() => setPersonHandlingMode('preserve_person')}
                                className="accent-[#CEF52A] w-3.5 h-3.5 cursor-pointer"
                              />
                              <span className="font-semibold text-white">Preservar exatamente a pessoa</span>
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer text-zinc-400 hover:text-zinc-200">
                              <input
                                type="radio"
                                name="personHandlingMode"
                                value="inspire_person"
                                checked={personHandlingMode === 'inspire_person'}
                                onChange={() => setPersonHandlingMode('inspire_person')}
                                className="accent-[#CEF52A] w-3.5 h-3.5 cursor-pointer"
                              />
                              <span>Usar como inspiração</span>
                            </label>
                          </div>

                          {/* Mensagem oficial de garantia de identidade e isolamento (Seções 15 e 6) */}
                          <div className="text-[11px] pt-0.5">
                            {personHandlingMode === 'preserve_person' ? (
                              subjectPhoto.segmentationStatus === 'error' ? (
                                <div className="flex items-center justify-between text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 rounded-lg">
                                  <span className="flex items-center gap-1.5 font-medium">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    Não foi possível separar a pessoa do fundo.
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => subjectPhotoInputRef.current?.click()}
                                    className="underline text-[11px] hover:text-white ml-2 shrink-0"
                                  >
                                    Trocar foto
                                  </button>
                                </div>
                              ) : subjectPhoto.isSegmenting ? (
                                <span className="text-zinc-400 font-medium flex items-center gap-1.5 text-xs">
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#CEF52A]" />
                                  Isolando pessoa e removendo fundo...
                                </span>
                              ) : (
                                <span className="text-emerald-400 font-semibold flex items-center gap-1.5 text-xs">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  ✓ Pessoa isolada — identidade preservada
                                </span>
                              )
                            ) : (
                              <span className="text-zinc-400">
                                A foto servirá como referência e a IA gerará uma pessoa parecida.
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-zinc-400">
                        <span>Objeto principal anexado (sem rosto humano detectado)</span>
                      </div>
                    )}

                    {/* Múltiplas Pessoas: Seletor de Rosto Principal (Seção 15) */}
                    {subjectPhoto.hasMultipleFaces && subjectPhoto.faces && subjectPhoto.faces.length > 1 && (
                      <div className="mt-2 pt-1.5 border-t border-zinc-800/60">
                        <span className="text-[10px] text-amber-400 font-semibold block mb-1">
                          Mais de 1 pessoa detectada ({subjectPhoto.faces.length} rostos). Selecione a pessoa principal:
                        </span>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {subjectPhoto.faces.map((f, idx) => {
                            const isSelected = subjectPhoto.selectedFaceCropUrl === f.cropDataUrl;
                            return (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() =>
                                  setSubjectPhoto((prev) =>
                                    prev ? { ...prev, selectedFaceCropUrl: f.cropDataUrl } : null
                                  )
                                }
                                className={`relative w-8 h-8 rounded-lg overflow-hidden border-2 transition shrink-0 ${
                                  isSelected
                                    ? 'border-[#CEF52A] shadow-[0_0_8px_rgba(206,245,42,0.4)]'
                                    : 'border-zinc-700 opacity-60 hover:opacity-100'
                                }`}
                                title={`Pessoa ${idx + 1}`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={f.cropDataUrl} alt={`Pessoa ${idx + 1}`} className="w-full h-full object-cover" />
                                {isSelected && (
                                  <span className="absolute bottom-0 inset-x-0 bg-[#CEF52A] text-black text-[6px] font-bold text-center">
                                    HERO
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => subjectPhotoInputRef.current?.click()}
                  className="flex items-center justify-between p-2.5 bg-[#121418] border border-dashed border-zinc-700 hover:border-zinc-500 rounded-xl cursor-pointer transition group"
                  title="Se você enviar a foto de uma pessoa, a IA irá preservar o rosto dela na arte gerada."
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 group-hover:border-[#CEF52A]/50 flex items-center justify-center text-zinc-400 group-hover:text-[#CEF52A] transition shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white group-hover:text-[#CEF52A] transition block truncate uppercase tracking-wider">
                        OBJETO PRINCIPAL
                      </span>
                      <span className="text-[10px] text-zinc-400 block truncate" title="Se você enviar a foto de uma pessoa, a IA irá preservar o rosto dela na arte gerada.">
                        Se você enviar a foto de uma pessoa, a IA irá preservar o rosto dela na arte gerada.
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      subjectPhotoInputRef.current?.click();
                    }}
                    className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-bold text-xs rounded-lg border border-zinc-700 transition shrink-0 ml-2 flex items-center gap-1.5"
                  >
                    <Upload className="w-3 h-3 text-[#CEF52A]" />
                    <span>{isUploadingSubjectPhoto ? 'Enviando...' : 'Subir foto'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Input file invisível para Objeto Principal */}
            <input
              ref={subjectPhotoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => handleSubjectPhotoUpload(e.target.files)}
            />

            {/* Aviso se tentar gerar sem referência */}
            {noReferenceWarning && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center justify-between animate-in fade-in">
                <span>{noReferenceWarning}</span>
                <button
                  type="button"
                  onClick={() => setIsReferencePickerOpen(true)}
                  className="text-xs font-bold text-[#CEF52A] underline ml-2"
                >
                  Selecionar agora
                </button>
              </div>
            )}

            {/* 2. CONTROLES: TAMANHO, TIPO E LÂMINAS */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Tamanho */}
              <div className="flex items-center gap-1.5 bg-[#16181D] border border-zinc-800 rounded-xl px-2.5 py-1.5">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  Tamanho:
                </span>
                <select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value as any)}
                  className="bg-transparent text-white text-xs outline-none cursor-pointer font-medium"
                >
                  {FORMAT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id} className="bg-[#121418] text-white">
                      {f.label} ({f.dimensions})
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo */}
              <div className="flex items-center gap-1.5 bg-[#16181D] border border-zinc-800 rounded-xl px-2.5 py-1.5">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  Tipo:
                </span>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as any)}
                  className="bg-transparent text-white text-xs outline-none cursor-pointer font-medium"
                >
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#121418] text-white">
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Logotipo da Marca */}
              <div className="flex items-center gap-1.5 bg-[#16181D] border border-zinc-800 rounded-xl px-2.5 py-1.5">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  Logo:
                </span>
                <select
                  value={selectedLogoType}
                  onChange={(e) => setSelectedLogoType(e.target.value)}
                  className="bg-transparent text-white text-xs outline-none cursor-pointer font-medium"
                >
                  <option value="none" className="bg-[#121418] text-zinc-400">
                    Sem logo
                  </option>
                  {clientLogos.some((l) => l.type === 'logo_primary') && (
                    <option value="logo_primary" className="bg-[#121418] text-white">
                      Logo Principal
                    </option>
                  )}
                  {clientLogos.some((l) => l.type === 'logo_secondary') && (
                    <option value="logo_secondary" className="bg-[#121418] text-white">
                      Logo Secundário / Ícone
                    </option>
                  )}
                  {clientLogos.some((l) => l.type === 'logo_monochrome') && (
                    <option value="logo_monochrome" className="bg-[#121418] text-white">
                      Monocromático / Branco
                    </option>
                  )}
                </select>

                {/* Mini Preview Thumbnail se selecionado */}
                {selectedLogoType !== 'none' && (() => {
                  const currentLogo = clientLogos.find((l) => l.type === selectedLogoType);
                  if (!currentLogo) return null;
                  return (
                    <div
                      className={`w-5 h-5 rounded p-0.5 shrink-0 flex items-center justify-center border ${
                        selectedLogoType === 'logo_monochrome'
                          ? 'bg-black border-zinc-700'
                          : 'bg-zinc-800 border-zinc-700'
                      }`}
                      title={`Logo aplicado: ${selectedLogoType}`}
                    >
                      <img
                        src={currentLogo.imageUrl}
                        alt="Logo"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  );
                })()}

                {/* Link para adicionar se não tiver logos */}
                {clientLogos.length === 0 && selectedClientId && (
                  <Link
                    href={`/clients/${selectedClientId}`}
                    className="text-[10px] text-zinc-500 hover:text-[#CEF52A] underline ml-0.5"
                    title="Adicionar logotipos no perfil do cliente"
                  >
                    + Adicionar
                  </Link>
                )}
              </div>

              {/* Quantidade de lâminas (apenas se carrossel) */}
              {selectedType === 'carousel' && (
                <div className="flex items-center gap-1.5 bg-[#16181D] border border-[#CEF52A]/30 rounded-xl px-2.5 py-1.5 animate-in fade-in">
                  <span className="text-[10px] font-bold text-[#CEF52A] uppercase tracking-wider">
                    Lâminas:
                  </span>
                  <select
                    value={carouselSlideCount}
                    onChange={(e) => setCarouselSlideCount(Number(e.target.value))}
                    className="bg-transparent text-white text-xs outline-none cursor-pointer font-bold"
                  >
                    {SLIDE_COUNT_OPTIONS.map((num) => (
                      <option key={num} value={num} className="bg-[#121418] text-white">
                        {num} lâminas
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Previews de Anexos Estagiados */}
            {stagedAttachments.length > 0 && (
              <div className="flex items-center gap-2 p-2 bg-[#121418] border border-zinc-700/60 rounded-xl overflow-x-auto">
                {stagedAttachments.map((att) => (
                  <div key={att.id} className="relative group shrink-0">
                    <img
                      src={att.url}
                      alt={att.name}
                      className="w-14 h-14 object-cover rounded-lg border border-zinc-600"
                    />
                    <button
                      onClick={() =>
                        setStagedAttachments((prev) => prev.filter((a) => a.id !== att.id))
                      }
                      className="absolute -top-1 -right-1 p-0.5 bg-rose-500 text-white rounded-full opacity-80 hover:opacity-100 transition shadow"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {att.isLayoutPrint && (
                      <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[7px] text-[#CEF52A] text-center font-bold">
                        PRINT
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 3. CAMPO DE PROMPT E BOTÃO GERAR */}
            <div
              className={`flex items-end gap-2 bg-[#16181D] border rounded-2xl p-2 transition ${
                !selectedReferenceId
                  ? 'border-zinc-800 opacity-60'
                  : 'border-zinc-700/80 focus-within:border-[#CEF52A]'
              }`}
            >
              {/* Botão de Anexo */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files, false)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAttachment || isProcessing || !selectedReferenceId}
                className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Anexar prints adicionais de estrutura"
              >
                <Upload className="w-4 h-4" />
              </button>

              {/* Textarea Multi-linha */}
              <textarea
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  if (noReferenceWarning) setNoReferenceWarning(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={!selectedReferenceId || isProcessing}
                placeholder={
                  !selectedReferenceId
                    ? 'Selecione uma referência visual acima para liberar o prompt...'
                    : selectedType === 'carousel'
                    ? 'Descreva o carrossel que você quer criar...'
                    : 'Descreva o que você quer criar...'
                }
                rows={1}
                className="flex-1 bg-transparent text-white text-xs md:text-sm outline-none resize-none px-2 py-1 max-h-32 min-h-[38px] placeholder:text-zinc-500 disabled:cursor-not-allowed"
              />

              {/* Botão GERAR */}
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={isProcessing || !selectedReferenceId || !inputText.trim()}
                className="px-4 py-2.5 bg-[#CEF52A] hover:bg-[#b8dd24] text-black font-extrabold text-xs rounded-xl transition shadow-md disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-1.5 tracking-wider"
              >
                <span>GERAR</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] text-zinc-500 px-1">
              <span>Pressione Enter para enviar • Shift + Enter para nova linha</span>
              <span className="font-mono">OpenAI GPT Image 2.5 • Responses</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Seleção de Referência Estrita */}
      <ReferencePickerModal
        isOpen={isReferencePickerOpen}
        onClose={() => setIsReferencePickerOpen(false)}
        clientName={clientContext?.client?.name || 'Cliente'}
        clientId={selectedClientId}
        pieces={clientPieces}
        selectedReferenceId={selectedReferenceId}
        onSelectReference={(pieceId) => {
          setSelectedReferenceId(pieceId);
          setNoReferenceWarning(null);
        }}
      />

      {/* Drawer de Memória Visual & Peças */}
      <ClientReferencesDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        pieces={clientPieces}
        selectedPieceIds={selectedPieceIds}
        onTogglePiece={handleTogglePiece}
        onSelectAll={handleSelectAllPieces}
        onClearSelection={handleClearPieces}
        onConfirmSelection={handleConfirmSelection}
        onUploadCustom={async (file: File, isPrint: boolean) => {
          await handleFileUpload(file, isPrint);
        }}
        isUploading={isUploadingAttachment}
      />
    </div>
  );
}

export default function CreativeChatPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#0E1116] flex items-center justify-center text-zinc-400 text-sm">
          Carregando Chat Criativo...
        </div>
      }
    >
      <CreativeChatContent />
    </React.Suspense>
  );
}
