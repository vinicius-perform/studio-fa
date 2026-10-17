// src/app/clients/page.tsx
'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { ClientPiecesModal } from '@/components/clients/ClientPiecesModal';
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowRight,
  FolderKanban,
  Building2,
  UserPlus,
  Plus,
  X,
  Palette,
  Check,
  Globe,
  Instagram,
  FileText,
  Upload,
  Trash2,
  Type,
  Image as ImageIcon,
  Layers,
  AlertCircle,
} from 'lucide-react';

interface ClientListItem {
  id: string;
  name: string;
  slug: string;
  niche?: string | null;
  instagram_handle?: string | null;
  brand_status: 'ready' | 'analyzing' | 'insufficient_data';
  organization_id: string;
  referenceCount?: number;
  brandProfile?: {
    id: string;
    summary: string;
    colors: {
      primary: string[];
      accent: string[];
      text: string[];
      all?: string[];
      customPalette?: { color: string; label?: string }[];
    };
    typography: {
      detectedFonts: string[];
      primaryFont?: string;
    };
  } | null;
  logoAsset?: {
    id: string;
    storage_path: string;
  } | null;
}

interface CustomColorItem {
  id: string;
  color: string;
  label: string;
}

interface UploadedLogoFile {
  dataUrl: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface UploadedFontFile {
  id: string;
  dataUrl: string;
  filename: string;
  fontName: string;
  size: number;
}

const NICHE_SUGGESTIONS = [
  'Tecnologia & SaaS',
  'Moda & Vestuário',
  'Saúde & Bem-Estar',
  'Gastronomia & Restaurantes',
  'Imobiliário & Arquitetura',
  'Direito & Consultoria',
  'Educação & Cursos',
];

const STANDARD_FONTS = [
  'Inter, sans-serif',
  'Montserrat, sans-serif',
  'Plus Jakarta Sans, sans-serif',
  'Playfair Display, serif',
  'Outfit, sans-serif',
  'Poppins, sans-serif',
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal State: Create Client
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Modal State: Ver Peças (Client References)
  const [piecesModalClient, setPiecesModalClient] = useState<ClientListItem | null>(null);

  // Modal State: Excluir Cliente
  const [clientToDelete, setClientToDelete] = useState<ClientListItem | null>(null);
  const [deletingClient, setDeletingClient] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    niche: '',
    instagramHandle: '',
    website: '',
    summary: '',
    fontFamily: 'Inter, sans-serif',
  });
  const [slugModifiedByUser, setSlugModifiedByUser] = useState(false);

  // Custom Colors (Dynamic, no presets)
  const [customColors, setCustomColors] = useState<CustomColorItem[]>([
    { id: '1', color: '#0F1113', label: 'Primária' },
    { id: '2', color: '#CEF52A', label: 'Destaque' },
    { id: '3', color: '#FFFFFF', label: 'Texto' },
  ]);

  // Uploaded Logos
  const [primaryLogo, setPrimaryLogo] = useState<UploadedLogoFile | null>(null);
  const [secondaryLogo, setSecondaryLogo] = useState<UploadedLogoFile | null>(null);
  const [monochromeLogo, setMonochromeLogo] = useState<UploadedLogoFile | null>(null);
  const [draggingLogo, setDraggingLogo] = useState<'primary' | 'secondary' | 'monochrome' | null>(null);
  const primaryLogoInputRef = useRef<HTMLInputElement>(null);
  const secondaryLogoInputRef = useRef<HTMLInputElement>(null);
  const monochromeLogoInputRef = useRef<HTMLInputElement>(null);

  // Uploaded Fonts
  const [uploadedFonts, setUploadedFonts] = useState<UploadedFontFile[]>([]);
  const fontInputRef = useRef<HTMLInputElement>(null);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/clients');
      const data = await res.json();
      if (data.clients) {
        setClients(data.clients);
      }
    } catch (err) {
      console.error('Falha ao carregar clientes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleNameChange = (nameVal: string) => {
    setFormData((prev) => ({
      ...prev,
      name: nameVal,
      slug: slugModifiedByUser ? prev.slug : slugify(nameVal),
    }));
  };

  // Color handlers
  const handleAddColor = () => {
    const defaultLabels = ['Secundária', 'Fundo', 'Destaque 2', 'Acento', 'Neutro'];
    const nextLabel = defaultLabels[(customColors.length - 3) % defaultLabels.length] || 'Cor';
    setCustomColors((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        color: '#6366F1',
        label: nextLabel,
      },
    ]);
  };

  const handleUpdateColor = (id: string, updates: Partial<CustomColorItem>) => {
    setCustomColors((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const handleRemoveColor = (id: string) => {
    if (customColors.length <= 1) return;
    setCustomColors((prev) => prev.filter((c) => c.id !== id));
  };

  // Logo file processing & Drag and Drop handlers
  const processLogoFile = (
    file: File,
    setter: (logo: UploadedLogoFile | null) => void
  ) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor selecione um arquivo de imagem válido (PNG, SVG, WEBP, JPG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setter({
        dataUrl: reader.result as string,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      });
      setErrorMessage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleLogoFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (logo: UploadedLogoFile | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processLogoFile(file, setter);
    e.target.value = '';
  };

  const handleLogoDrop = (
    e: React.DragEvent<HTMLElement>,
    type: 'primary' | 'secondary' | 'monochrome',
    setter: (logo: UploadedLogoFile | null) => void
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingLogo(null);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processLogoFile(file, setter);
    }
  };

  // Font file handlers
  const handleFontFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validExtensions = ['.ttf', '.otf', '.woff', '.woff2'];

    Array.from(files).forEach((file) => {
      const lower = file.name.toLowerCase();
      const isValid = validExtensions.some((ext) => lower.endsWith(ext));
      if (!isValid) {
        setErrorMessage('Formato de fonte inválido. Suba arquivos .ttf, .otf, .woff ou .woff2.');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const cleanFontName = file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[-_]+/g, ' ')
          .replace(/\b(regular|bold|light|semibold|medium|black|italic)\b/gi, '')
          .trim() || 'Custom Font';

        setUploadedFonts((prev) => [
          ...prev,
          {
            id: `font-${Date.now()}-${Math.random()}`,
            dataUrl: reader.result as string,
            filename: file.name,
            fontName: cleanFontName,
            size: file.size,
          },
        ]);
        setErrorMessage(null);
      };
      reader.readAsDataURL(file);
    });

    if (fontInputRef.current) fontInputRef.current.value = '';
  };

  const handleRemoveFont = (id: string) => {
    setUploadedFonts((prev) => prev.filter((f) => f.id !== id));
  };

  // Submit new client
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMessage('O nome do cliente é obrigatório.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const effectiveFont =
        uploadedFonts[0]?.fontName || formData.fontFamily || 'Inter, sans-serif';

      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          slug: formData.slug.trim() || slugify(formData.name),
          niche: formData.niche.trim() || null,
          instagramHandle: formData.instagramHandle.trim() || null,
          website: formData.website.trim() || null,
          summary: formData.summary.trim() || null,
          customColors: customColors.map((c) => ({
            color: c.color,
            label: c.label.trim(),
          })),
          fontFamily: effectiveFont,
          fontFiles: uploadedFonts.map((f) => ({
            dataUrl: f.dataUrl,
            filename: f.filename,
            fontName: f.fontName,
            size: f.size,
          })),
          primaryLogo,
          secondaryLogo,
          monochromeLogo,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || 'Falha ao cadastrar cliente');
      }

      const { client } = await res.json();

      if (client) {
        setClients((prev) => [client, ...prev.filter((c) => c.id !== client.id)]);
      }

      setShowCreateModal(false);
      setSuccessToast(`Cliente "${client.name}" cadastrado com sucesso!`);
      setTimeout(() => setSuccessToast(null), 4000);

      // Reset form
      setFormData({
        name: '',
        slug: '',
        niche: '',
        instagramHandle: '',
        website: '',
        summary: '',
        fontFamily: 'Inter, sans-serif',
      });
      setSlugModifiedByUser(false);
      setCustomColors([
        { id: '1', color: '#0F1113', label: 'Primária' },
        { id: '2', color: '#CEF52A', label: 'Destaque' },
        { id: '3', color: '#FFFFFF', label: 'Texto' },
      ]);
      setPrimaryLogo(null);
      setSecondaryLogo(null);
      setMonochromeLogo(null);
      setUploadedFonts([]);

      // Refresh client list
      await fetchClients();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro inesperado ao criar cliente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateClientRefCount = (clientId: string, newCount: number) => {
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, referenceCount: newCount } : c))
    );
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;

    try {
      setDeletingClient(true);
      const res = await fetch(`/api/clients/${clientToDelete.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Falha ao excluir cliente.');
      }

      const clientName = clientToDelete.name;
      setClients((prev) => prev.filter((c) => c.id !== clientToDelete.id));
      setClientToDelete(null);
      setSuccessToast(`Cliente "${clientName}" excluído com sucesso.`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir cliente.');
    } finally {
      setDeletingClient(false);
    }
  };

  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase()) ||
      (c.niche && c.niche.toLowerCase().includes(search.toLowerCase())) ||
      (c.instagram_handle && c.instagram_handle.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || c.brand_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            DNA Visual Pronto
          </span>
        );
      case 'analyzing':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Em Análise
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Dados Insuficientes
          </span>
        );
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#F6F7F8] font-sans overflow-hidden">
      <AppSidebar />

      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Top Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between sticky top-0 z-10 shadow-2xs">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-black" />
              <span>Clientes & Memória Visual</span>
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Gestão de marcas, DNA visual, paletas de cores e produção de conteúdo da FA.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setErrorMessage(null);
                setShowCreateModal(true);
              }}
              className="px-4 py-2.5 bg-black hover:bg-zinc-800 text-[#CEF52A] rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>Novo Cliente</span>
            </button>

            <Link
              href="/create"
              className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-xl font-medium text-xs flex items-center gap-2 transition shadow-2xs"
            >
              <Sparkles className="w-4 h-4 text-gray-500" />
              <span>Nova Produção</span>
            </Link>
          </div>
        </div>

        {/* Success Toast */}
        {successToast && (
          <div className="fixed top-5 right-5 z-50 bg-emerald-900 text-emerald-100 px-4 py-3 rounded-xl border border-emerald-700 shadow-xl flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Content */}
        <div className="max-w-6xl w-full mx-auto p-8 space-y-6 flex-1">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por nome, nicho ou @instagram..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-black"
              />
            </div>

            {/* Filter Dropdown */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Filter className="w-3.5 h-3.5" />
                <span>Status de Marca:</span>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-gray-300 bg-white focus:outline-none"
              >
                <option value="all">Todos os Status</option>
                <option value="ready">DNA Visual Pronto</option>
                <option value="analyzing">Em Análise</option>
                <option value="insufficient_data">Dados Insuficientes</option>
              </select>
            </div>
          </div>

          {/* Client Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-56 bg-gray-200 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-gray-900 text-sm">
                {clients.length === 0 ? 'Nenhum cliente cadastrado' : 'Nenhum cliente encontrado'}
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                {clients.length === 0
                  ? 'Cadastre o primeiro cliente da agência para configurar seu DNA Visual, paleta de cores personalizada, logotipos e peças de referência.'
                  : 'Tente ajustar os filtros de busca para encontrar o cliente desejado.'}
              </p>
              {clients.length === 0 && (
                <button
                  onClick={() => {
                    setErrorMessage(null);
                    setShowCreateModal(true);
                  }}
                  className="px-5 py-2.5 bg-black hover:bg-zinc-800 text-[#CEF52A] rounded-xl font-bold text-xs inline-flex items-center gap-2 transition shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Cadastrar Primeiro Cliente</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClients.map((client) => {
                const profile = client.brandProfile;
                const fonts = profile?.typography?.detectedFonts || [];
                const primaryFont = profile?.typography?.primaryFont || fonts[0];

                // Gather colors
                const customColorsList = profile?.colors?.customPalette?.map((c) => c.color) || [];
                const colors = (
                  customColorsList.length > 0
                    ? customColorsList
                    : [
                        ...(profile?.colors?.primary || []),
                        ...(profile?.colors?.accent || []),
                        ...(profile?.colors?.text || []),
                      ]
                ).slice(0, 7);

                return (
                  <div
                    key={client.id}
                    className="bg-white rounded-2xl border border-gray-200 hover:border-black/30 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                  >
                    <div className="p-5 space-y-4">
                      {/* Header with Avatar/Logo and Status */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-gray-200 flex items-center justify-center font-bold text-sm text-[#CEF52A] uppercase shadow-2xs overflow-hidden shrink-0">
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
                            <h3 className="font-bold text-gray-900 text-sm group-hover:text-black">
                              {client.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-gray-400 font-mono">
                                @{client.slug}
                              </span>
                              {client.niche && (
                                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                  {client.niche}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {getStatusBadge(client.brand_status)}
                      </div>

                      {/* Summary or visual description */}
                      {profile?.summary ? (
                        <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                          {profile.summary}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 italic">
                          Aguardando consolidação do perfil de identidade visual.
                        </p>
                      )}

                      {/* Brand Palettes & Typography */}
                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                        {/* Swatches */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {colors.length > 0 ? (
                            colors.map((c, idx) => (
                              <span
                                key={idx}
                                style={{ backgroundColor: c }}
                                className="w-4 h-4 rounded-full border border-black/10 inline-block shadow-2xs shrink-0"
                                title={c}
                              />
                            ))
                          ) : (
                            <span className="text-[11px] text-gray-400">Sem cores</span>
                          )}
                        </div>

                        {/* Font badge */}
                        {primaryFont && (
                          <span
                            className="text-[10px] font-mono text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-200 truncate max-w-[130px]"
                            title={primaryFont}
                          >
                            {primaryFont.split(',')[0]}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="p-4 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between">
                      <button
                        onClick={() => setPiecesModalClient(client)}
                        className="text-xs font-semibold text-gray-700 hover:text-black flex items-center gap-1.5 transition py-1 px-2 rounded-lg hover:bg-gray-100"
                        title="Ver e gerenciar peças de referência visual do cliente"
                      >
                        <FolderKanban className="w-3.5 h-3.5 text-black" />
                        <span>Ver Peças</span>
                        <span className="text-[10px] bg-black/10 text-gray-800 font-bold px-1.5 py-0.2 rounded-full">
                          {client.referenceCount || 0}
                        </span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setClientToDelete(client)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                          title={`Excluir cliente ${client.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <Link
                          href={`/create?client=${client.id}`}
                          className="px-3 py-1.5 bg-black hover:bg-gray-800 text-[#CEF52A] rounded-lg font-bold text-xs flex items-center gap-1.5 transition shadow-2xs"
                        >
                          <span>Criar Arte</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* MODAL: MEMÓRIA VISUAL & PEÇAS DO CLIENTE */}
      {piecesModalClient && (
        <ClientPiecesModal
          isOpen={Boolean(piecesModalClient)}
          onClose={() => setPiecesModalClient(null)}
          client={piecesModalClient}
          onCountChange={(count) => handleUpdateClientRefCount(piecesModalClient.id, count)}
        />
      )}

      {/* MODAL: CADASTRAR NOVO CLIENTE */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/80 sticky top-0 z-20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-black text-[#CEF52A] flex items-center justify-center font-bold text-xs">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Cadastrar Novo Cliente</h3>
                  <p className="text-[11px] text-gray-500">
                    Defina os dados da marca, logotipos, fontes e paleta de cores personalizada.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateClient} className="flex-1 overflow-y-auto p-6 space-y-6">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* SEÇÃO 1: Dados Gerais */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider">
                  <Building2 className="w-3.5 h-3.5 text-black" />
                  <span>Informações do Cliente</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nome */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Nome do Cliente <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Studio Alpha, Barbearia Vintage"
                      value={formData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-black bg-white"
                    />
                  </div>

                  {/* Slug */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Identificador / Slug <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs text-gray-400">@</span>
                      <input
                        type="text"
                        required
                        placeholder="studio-alpha"
                        value={formData.slug}
                        onChange={(e) => {
                          setSlugModifiedByUser(true);
                          setFormData({ ...formData, slug: slugify(e.target.value) });
                        }}
                        className="w-full pl-7 pr-3 py-2 text-xs font-mono rounded-xl border border-gray-300 focus:outline-none focus:border-black bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Nicho / Segmento */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nicho / Segmento de Atuação
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Tecnologia & SaaS, Moda Feminina, Gastronomia"
                    value={formData.niche}
                    onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-black bg-white mb-2"
                  />
                  {/* Sugestões rápidas de nicho */}
                  <div className="flex flex-wrap gap-1.5">
                    {NICHE_SUGGESTIONS.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setFormData({ ...formData, niche: sug })}
                        className="text-[10px] px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition"
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Instagram & Website */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                      <Instagram className="w-3.5 h-3.5 text-gray-500" />
                      <span>Instagram</span>
                    </label>
                    <input
                      type="text"
                      placeholder="@nomedamarca"
                      value={formData.instagramHandle}
                      onChange={(e) =>
                        setFormData({ ...formData, instagramHandle: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-black bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-gray-500" />
                      <span>Website (opcional)</span>
                    </label>
                    <input
                      type="url"
                      placeholder="https://exemplo.com.br"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-black bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* SEÇÃO 2: Upload de Logotipos */}
              <div className="pt-4 border-t border-gray-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider">
                    <ImageIcon className="w-3.5 h-3.5 text-black" />
                    <span>Logotipos da Marca</span>
                  </div>
                  <span className="text-[11px] text-gray-400">
                    PNG transparente, SVG ou WEBP recomendado
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Logo Principal */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDraggingLogo('primary');
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDraggingLogo(null);
                    }}
                    onDrop={(e) => handleLogoDrop(e, 'primary', setPrimaryLogo)}
                  >
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Logo Principal
                    </label>
                    <input
                      ref={primaryLogoInputRef}
                      type="file"
                      accept="image/png, image/svg+xml, image/webp, image/jpeg"
                      onChange={(e) => handleLogoFile(e, setPrimaryLogo)}
                      className="hidden"
                      id="primary-logo-input"
                    />

                    {primaryLogo ? (
                      <div
                        className={`relative group rounded-xl border bg-zinc-900 p-2 h-28 flex flex-col items-center justify-center overflow-hidden transition ${
                          draggingLogo === 'primary'
                            ? 'border-[#CEF52A] ring-2 ring-[#CEF52A] bg-zinc-800'
                            : 'border-gray-300'
                        }`}
                      >
                        <img
                          src={primaryLogo.dataUrl}
                          alt="Logo Principal"
                          className="max-h-16 max-w-full object-contain"
                        />
                        <span className="text-[10px] text-zinc-400 truncate w-full text-center mt-1">
                          {primaryLogo.filename}
                        </span>
                        {draggingLogo === 'primary' ? (
                          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center p-2">
                            <Upload className="w-5 h-5 text-[#CEF52A] animate-bounce mb-1" />
                            <span className="text-[11px] font-bold text-[#CEF52A]">Solte para substituir</span>
                          </div>
                        ) : (
                          <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => primaryLogoInputRef.current?.click()}
                              className="px-2 py-1 bg-white text-black rounded text-[10px] font-bold"
                            >
                              Trocar
                            </button>
                            <button
                              type="button"
                              onClick={() => setPrimaryLogo(null)}
                              className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold"
                            >
                              Remover
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <label
                        htmlFor="primary-logo-input"
                        className={`cursor-pointer flex flex-col items-center justify-center h-28 border-2 border-dashed rounded-xl transition p-3 text-center ${
                          draggingLogo === 'primary'
                            ? 'border-black bg-lime-100/70 ring-2 ring-[#CEF52A]'
                            : 'border-gray-300 hover:border-black bg-gray-50/50 hover:bg-gray-50'
                        }`}
                      >
                        <Upload
                          className={`w-5 h-5 mb-1 ${
                            draggingLogo === 'primary' ? 'text-black animate-bounce' : 'text-gray-400'
                          }`}
                        />
                        <span className="text-xs font-semibold text-gray-800">
                          {draggingLogo === 'primary' ? 'Solte a imagem aqui!' : 'Arraste ou clique'}
                        </span>
                        <span className="text-[10px] text-gray-400">Versão Principal</span>
                      </label>
                    )}
                  </div>

                  {/* Logo Secundário / Símbolo */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDraggingLogo('secondary');
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDraggingLogo(null);
                    }}
                    onDrop={(e) => handleLogoDrop(e, 'secondary', setSecondaryLogo)}
                  >
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Logo Secundário / Símbolo
                    </label>
                    <input
                      ref={secondaryLogoInputRef}
                      type="file"
                      accept="image/png, image/svg+xml, image/webp, image/jpeg"
                      onChange={(e) => handleLogoFile(e, setSecondaryLogo)}
                      className="hidden"
                      id="secondary-logo-input"
                    />

                    {secondaryLogo ? (
                      <div
                        className={`relative group rounded-xl border bg-zinc-900 p-2 h-28 flex flex-col items-center justify-center overflow-hidden transition ${
                          draggingLogo === 'secondary'
                            ? 'border-[#CEF52A] ring-2 ring-[#CEF52A] bg-zinc-800'
                            : 'border-gray-300'
                        }`}
                      >
                        <img
                          src={secondaryLogo.dataUrl}
                          alt="Logo Secundário"
                          className="max-h-16 max-w-full object-contain"
                        />
                        <span className="text-[10px] text-zinc-400 truncate w-full text-center mt-1">
                          {secondaryLogo.filename}
                        </span>
                        {draggingLogo === 'secondary' ? (
                          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center p-2">
                            <Upload className="w-5 h-5 text-[#CEF52A] animate-bounce mb-1" />
                            <span className="text-[11px] font-bold text-[#CEF52A]">Solte para substituir</span>
                          </div>
                        ) : (
                          <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => secondaryLogoInputRef.current?.click()}
                              className="px-2 py-1 bg-white text-black rounded text-[10px] font-bold"
                            >
                              Trocar
                            </button>
                            <button
                              type="button"
                              onClick={() => setSecondaryLogo(null)}
                              className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold"
                            >
                              Remover
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <label
                        htmlFor="secondary-logo-input"
                        className={`cursor-pointer flex flex-col items-center justify-center h-28 border-2 border-dashed rounded-xl transition p-3 text-center ${
                          draggingLogo === 'secondary'
                            ? 'border-black bg-lime-100/70 ring-2 ring-[#CEF52A]'
                            : 'border-gray-300 hover:border-black bg-gray-50/50 hover:bg-gray-50'
                        }`}
                      >
                        <Upload
                          className={`w-5 h-5 mb-1 ${
                            draggingLogo === 'secondary' ? 'text-black animate-bounce' : 'text-gray-400'
                          }`}
                        />
                        <span className="text-xs font-semibold text-gray-800">
                          {draggingLogo === 'secondary' ? 'Solte a imagem aqui!' : 'Arraste ou clique'}
                        </span>
                        <span className="text-[10px] text-gray-400">Opcional (Ícone/Símbolo)</span>
                      </label>
                    )}
                  </div>

                  {/* Logo Monocromático */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDraggingLogo('monochrome');
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDraggingLogo(null);
                    }}
                    onDrop={(e) => handleLogoDrop(e, 'monochrome', setMonochromeLogo)}
                  >
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Logo Monocromático
                    </label>
                    <input
                      ref={monochromeLogoInputRef}
                      type="file"
                      accept="image/png, image/svg+xml, image/webp, image/jpeg"
                      onChange={(e) => handleLogoFile(e, setMonochromeLogo)}
                      className="hidden"
                      id="monochrome-logo-input"
                    />

                    {monochromeLogo ? (
                      <div
                        className={`relative group rounded-xl border bg-zinc-900 p-2 h-28 flex flex-col items-center justify-center overflow-hidden transition ${
                          draggingLogo === 'monochrome'
                            ? 'border-[#CEF52A] ring-2 ring-[#CEF52A] bg-zinc-800'
                            : 'border-gray-300'
                        }`}
                      >
                        <img
                          src={monochromeLogo.dataUrl}
                          alt="Logo Monocromático"
                          className="max-h-16 max-w-full object-contain"
                        />
                        <span className="text-[10px] text-zinc-400 truncate w-full text-center mt-1">
                          {monochromeLogo.filename}
                        </span>
                        {draggingLogo === 'monochrome' ? (
                          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center p-2">
                            <Upload className="w-5 h-5 text-[#CEF52A] animate-bounce mb-1" />
                            <span className="text-[11px] font-bold text-[#CEF52A]">Solte para substituir</span>
                          </div>
                        ) : (
                          <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => monochromeLogoInputRef.current?.click()}
                              className="px-2 py-1 bg-white text-black rounded text-[10px] font-bold"
                            >
                              Trocar
                            </button>
                            <button
                              type="button"
                              onClick={() => setMonochromeLogo(null)}
                              className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold"
                            >
                              Remover
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <label
                        htmlFor="monochrome-logo-input"
                        className={`cursor-pointer flex flex-col items-center justify-center h-28 border-2 border-dashed rounded-xl transition p-3 text-center ${
                          draggingLogo === 'monochrome'
                            ? 'border-black bg-lime-100/70 ring-2 ring-[#CEF52A]'
                            : 'border-gray-300 hover:border-black bg-gray-50/50 hover:bg-gray-50'
                        }`}
                      >
                        <Upload
                          className={`w-5 h-5 mb-1 ${
                            draggingLogo === 'monochrome' ? 'text-black animate-bounce' : 'text-gray-400'
                          }`}
                        />
                        <span className="text-xs font-semibold text-gray-800">
                          {draggingLogo === 'monochrome' ? 'Solte a imagem aqui!' : 'Arraste ou clique'}
                        </span>
                        <span className="text-[10px] text-gray-400">Opcional (Branco / Preto)</span>
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* SEÇÃO 3: Paleta de Cores Personalizada (Sem presets) */}
              <div className="pt-4 border-t border-gray-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider">
                    <Palette className="w-3.5 h-3.5 text-black" />
                    <span>Paleta de Cores Personalizada</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddColor}
                    className="text-xs font-bold text-black hover:text-zinc-700 flex items-center gap-1 px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Cor</span>
                  </button>
                </div>

                <p className="text-[11px] text-gray-500">
                  Adicione e personalize livremente as cores da marca. Sem paletas pré-definidas.
                </p>

                {/* Live Swatches Preview */}
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl border border-gray-200 overflow-x-auto">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider pl-1">
                    Visualização:
                  </span>
                  {customColors.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-gray-200 shadow-2xs shrink-0"
                    >
                      <span
                        style={{ backgroundColor: c.color }}
                        className="w-3.5 h-3.5 rounded-full border border-black/20"
                      />
                      <span className="text-[10px] font-semibold text-gray-800">{c.label}</span>
                      <span className="text-[9px] font-mono text-gray-400 uppercase">
                        {c.color}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Color Items List */}
                <div className="space-y-2.5">
                  {customColors.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2.5 bg-gray-50/80 rounded-xl border border-gray-200 hover:border-gray-300 transition"
                    >
                      {/* Native Color Picker */}
                      <input
                        type="color"
                        value={item.color}
                        onChange={(e) => handleUpdateColor(item.id, { color: e.target.value })}
                        className="w-9 h-9 rounded-lg border border-gray-300 cursor-pointer p-0.5 bg-white shrink-0"
                        title="Escolher cor"
                      />

                      {/* Hex text input */}
                      <div className="w-28 shrink-0">
                        <input
                          type="text"
                          value={item.color}
                          onChange={(e) => {
                            let val = e.target.value.trim();
                            if (!val.startsWith('#')) val = `#${val}`;
                            handleUpdateColor(item.id, { color: val });
                          }}
                          className="w-full px-2.5 py-1.5 text-xs font-mono uppercase rounded-lg border border-gray-300 bg-white focus:outline-none focus:border-black"
                          placeholder="#000000"
                        />
                      </div>

                      {/* Label input */}
                      <div className="flex-1">
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) => handleUpdateColor(item.id, { label: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 bg-white focus:outline-none focus:border-black"
                          placeholder="Ex: Primária, Destaque, Fundo escuro"
                        />
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveColor(item.id)}
                        disabled={customColors.length <= 1}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-200 transition disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Remover cor"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* SEÇÃO 4: Tipografia & Upload de Fontes */}
              <div className="pt-4 border-t border-gray-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider">
                    <Type className="w-3.5 h-3.5 text-black" />
                    <span>Tipografia & Arquivos de Fontes</span>
                  </div>
                  <span className="text-[11px] text-gray-400">TTF, OTF, WOFF ou WOFF2</span>
                </div>

                {/* Upload Dropzone */}
                <div>
                  <input
                    ref={fontInputRef}
                    type="file"
                    multiple
                    accept=".ttf, .otf, .woff, .woff2"
                    onChange={handleFontFile}
                    className="hidden"
                    id="font-file-input"
                  />

                  <label
                    htmlFor="font-file-input"
                    className="cursor-pointer flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 hover:border-black rounded-xl bg-gray-50/50 hover:bg-gray-50 transition text-center group"
                  >
                    <Upload className="w-5 h-5 text-gray-400 group-hover:text-black mb-1.5 transition" />
                    <span className="text-xs font-semibold text-gray-800">
                      Clique ou arraste arquivos de fontes da marca
                    </span>
                    <span className="text-[11px] text-gray-500 mt-0.5">
                      Suba arquivos .ttf, .otf, .woff ou .woff2 (pesos regular, bold, etc.)
                    </span>
                  </label>
                </div>

                {/* Uploaded Fonts List */}
                {uploadedFonts.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-gray-700">
                      Fontes Carregadas ({uploadedFonts.length}):
                    </span>
                    {uploadedFonts.map((font) => (
                      <div
                        key={font.id}
                        className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-200"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-black text-[#CEF52A] flex items-center justify-center font-bold text-xs">
                            <Type className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-800">
                                {font.fontName}
                              </span>
                              <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.2 rounded font-mono">
                                {font.filename.split('.').pop()?.toUpperCase()}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-400">
                              {font.filename} • {Math.round(font.size / 1024)} KB
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveFont(font.id)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded transition"
                          title="Remover fonte"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Standard / Fallback Font */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {uploadedFonts.length > 0
                      ? 'Fonte Padrão do Sistema (Fallback)'
                      : 'Fonte Padrão Sugerida'}
                  </label>
                  <select
                    value={formData.fontFamily}
                    onChange={(e) => setFormData({ ...formData, fontFamily: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-black bg-white"
                  >
                    {STANDARD_FONTS.map((font) => (
                      <option key={font} value={font}>
                        {font.split(',')[0]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SEÇÃO 5: Conceito Visual */}
              <div className="pt-4 border-t border-gray-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider">
                    <FileText className="w-3.5 h-3.5 text-black" />
                    <span>Conceito Visual & Diretrizes (Opcional)</span>
                  </div>
                  <span className="text-[11px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Ativação Automática de Memória IA
                  </span>
                </div>

                <div>
                  <textarea
                    rows={2}
                    placeholder="Ex: Visual minimalista contemporâneo, iluminação suave, alto contraste e foco em sofisticação tecnológica."
                    value={formData.summary}
                    onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-black bg-white resize-none"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-black hover:bg-zinc-800 text-[#CEF52A] rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-sm disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-[#CEF52A] border-t-transparent rounded-full animate-spin" />
                      <span>Cadastrando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Cadastrar e Ativar DNA</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO: EXCLUIR CLIENTE */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Excluir Cliente</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Tem certeza que deseja apagar o cliente{' '}
                  <strong className="text-gray-900 font-semibold">{clientToDelete.name}</strong>?
                </p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-800 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                <span>Esta ação não pode ser desfeita:</span>
              </p>
              <ul className="list-disc list-inside text-[11px] text-red-700 space-y-0.5 pl-1">
                <li>O DNA visual e a paleta de cores serão removidos</li>
                <li>Todas as peças e referências visuais serão apagadas</li>
                <li>Os arquivos de fontes e logotipos serão excluídos</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deletingClient}
                onClick={() => setClientToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={deletingClient}
                onClick={handleDeleteClient}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-sm disabled:opacity-50"
              >
                {deletingClient ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmar Exclusão</span>
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
