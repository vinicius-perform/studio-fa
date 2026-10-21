// src/lib/dev-store.ts
import fs from 'fs';
import path from 'path';

export interface DevClient {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  legal_name?: string | null;
  niche?: string | null;
  instagram_handle?: string | null;
  website?: string | null;
  city?: string | null;
  state?: string | null;
  country: string;
  notes?: string | null;
  status: 'active' | 'paused' | 'archived';
  brand_status: 'ready' | 'analyzing' | 'insufficient_data' | 'empty' | 'collecting' | 'needs_review';
  created_at: string;
  updated_at: string;
}

export interface DevBrandProfile {
  id: string;
  organization_id: string;
  client_id: string;
  version: number;
  status: 'approved' | 'draft';
  source: 'manual' | 'ai';
  summary: string;
  colors: {
    primary: string[];
    secondary?: string[];
    accent: string[];
    background?: string[];
    text: string[];
    all?: string[];
    customPalette?: { color: string; label?: string }[];
  };
  typography: {
    detectedFonts: string[];
    primaryFont?: string;
  };
  composition?: any;
  photography?: any;
  created_at: string;
  updated_at: string;
}

export interface DevClientAsset {
  id: string;
  organization_id: string;
  client_id: string;
  asset_type: 'logo_primary' | 'logo_secondary' | 'logo_monochrome' | 'font' | 'reference_art' | 'other';
  label?: string | null;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
}

export interface DevBrandReference {
  id: string;
  organization_id: string;
  client_id: string;
  title: string;
  description?: string | null;
  reference_type: string;
  tags: string[];
  image_url: string;
  ai_description?: string | null;
  visual_features?: any;
  created_at: string;
}

export interface DevStoreData {
  organizationId: string;
  clients: DevClient[];
  brandProfiles: DevBrandProfile[];
  assets: DevClientAsset[];
  brandReferences: DevBrandReference[];
  projects: any[];
  slides: any[];
  compositions: any[];
  creativeConversations?: any[];
  creativeMessages?: any[];
  creativeAttachments?: any[];
  jobs?: any[];
  settings?: Record<string, any>;
  deletedClientIds?: string[];
}

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

const INITIAL_DATA: DevStoreData = {
  organizationId: DEFAULT_ORG_ID,
  deletedClientIds: [],
  clients: [
    {
      id: 'c1111111-1111-1111-1111-111111111111',
      organization_id: DEFAULT_ORG_ID,
      name: 'Studio Alpha',
      slug: 'studio-alpha',
      niche: 'Tecnologia & SaaS',
      instagram_handle: '@studioalpha',
      website: 'https://studioalpha.com.br',
      country: 'BR',
      status: 'active',
      brand_status: 'ready',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  brandProfiles: [
    {
      id: 'bp111111-1111-1111-1111-111111111111',
      organization_id: DEFAULT_ORG_ID,
      client_id: 'c1111111-1111-1111-1111-111111111111',
      version: 1,
      status: 'approved',
      source: 'manual',
      summary: 'Marca minimalista moderna com forte contraste visual, foco tecnológico e tipografia limpa.',
      colors: {
        primary: ['#0F1113'],
        secondary: ['#22262B'],
        accent: ['#CEF52A'],
        text: ['#FFFFFF', '#111827'],
      },
      typography: {
        detectedFonts: ['Inter, sans-serif'],
        primaryFont: 'Inter, sans-serif',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  assets: [],
  brandReferences: [],
  projects: [],
  slides: [],
  compositions: [],
  creativeConversations: [],
  creativeMessages: [],
  creativeAttachments: [],
};

const DATA_FILE_PATH = path.join(process.cwd(), '.dev-store-data.json');

class DevDataStore {
  private cache: DevStoreData | null = null;

  private load(): DevStoreData {
    if (this.cache) return this.cache;

    try {
      if (fs.existsSync(DATA_FILE_PATH)) {
        const raw = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        this.cache = {
          organizationId: parsed.organizationId || DEFAULT_ORG_ID,
          clients: Array.isArray(parsed.clients) ? parsed.clients : [],
          brandProfiles: Array.isArray(parsed.brandProfiles) ? parsed.brandProfiles : [],
          assets: Array.isArray(parsed.assets) ? parsed.assets : [],
          brandReferences: Array.isArray(parsed.brandReferences) ? parsed.brandReferences : [],
          projects: Array.isArray(parsed.projects) ? parsed.projects : [],
          slides: Array.isArray(parsed.slides) ? parsed.slides : [],
          compositions: Array.isArray(parsed.compositions) ? parsed.compositions : [],
          jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
          settings: typeof parsed.settings === 'object' && parsed.settings !== null ? parsed.settings : {},
          deletedClientIds: Array.isArray(parsed.deletedClientIds) ? parsed.deletedClientIds : [],
        };
        return this.cache;
      }
    } catch (e) {
      console.warn('Falha ao ler .dev-store-data.json, inicializando dados padrão:', e);
    }

    if (this.cache) return this.cache;

    this.cache = { ...INITIAL_DATA, deletedClientIds: [] };
    this.save();
    return this.cache;
  }

  private save(dataToSave?: DevStoreData): void {
    const toSave = dataToSave || this.cache;
    if (!toSave) return;
    this.cache = toSave;
    try {
      fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(toSave), 'utf-8');
    } catch (e) {
      console.error('Falha ao persistir .dev-store-data.json:', e);
    }
  }

  getOrganizationId(): string {
    return this.load().organizationId || DEFAULT_ORG_ID;
  }

  listClients(): (DevClient & { brandProfile?: DevBrandProfile | null; logoAsset?: DevClientAsset | null; referenceCount?: number })[] {
    const data = this.load();
    return data.clients.map((c) => {
      const profile = data.brandProfiles.find((bp) => bp.client_id === c.id && bp.status === 'approved') || null;
      const logo =
        data.assets.find((a) => a.client_id === c.id && a.asset_type === 'logo_primary') ||
        data.assets.find((a) => a.client_id === c.id && a.asset_type === 'logo_monochrome') ||
        data.assets.find((a) => a.client_id === c.id && a.asset_type === 'logo_secondary') ||
        null;
      const refCount = data.brandReferences.filter((r) => r.client_id === c.id).length;

      return {
        ...c,
        brandProfile: profile,
        logoAsset: logo,
        referenceCount: refCount,
      };
    });
  }

  getClientById(id: string) {
    const data = this.load();
    const client = data.clients.find((c) => c.id === id);
    if (!client) return null;
    const profile = data.brandProfiles.find((bp) => bp.client_id === client.id && bp.status === 'approved') || null;
    const logo =
      data.assets.find((a) => a.client_id === client.id && a.asset_type === 'logo_primary') ||
      data.assets.find((a) => a.client_id === client.id && a.asset_type === 'logo_monochrome') ||
      data.assets.find((a) => a.client_id === client.id && a.asset_type === 'logo_secondary') ||
      null;
    const refCount = data.brandReferences.filter((r) => r.client_id === client.id).length;

    return {
      ...client,
      brandProfile: profile,
      logoAsset: logo,
      referenceCount: refCount,
    };
  }

  addClient(
    clientInput: Omit<DevClient, 'id' | 'created_at' | 'updated_at'>,
    brandProfileInput?: Omit<DevBrandProfile, 'id' | 'client_id' | 'created_at' | 'updated_at'>
  ): DevClient & { brandProfile?: DevBrandProfile | null; logoAsset?: DevClientAsset | null; referenceCount?: number } {
    const data = this.load();
    const id = `c-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();

    // Directly clear tombstone if slug was deleted previously
    if (data.deletedClientIds) {
      data.deletedClientIds = data.deletedClientIds.filter(
        (x) => x !== id && x !== clientInput.slug
      );
    }

    const newClient: DevClient = {
      ...clientInput,
      id,
      created_at: now,
      updated_at: now,
    };

    data.clients.unshift(newClient);

    let createdProfile: DevBrandProfile | null = null;
    if (brandProfileInput) {
      const bpId = `bp-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      createdProfile = {
        ...brandProfileInput,
        id: bpId,
        client_id: id,
        created_at: now,
        updated_at: now,
      };
      data.brandProfiles.unshift(createdProfile);
    }

    this.save(data);
    return {
      ...newClient,
      brandProfile: createdProfile,
      logoAsset: null,
      referenceCount: 0,
    };
  }

  deleteClient(id: string): boolean {
    const data = this.load();
    const target = data.clients.find((c) => c.id === id);
    const targetSlug = target?.slug;

    const initLen = data.clients.length;
    data.clients = data.clients.filter((c) => c.id !== id);
    data.brandProfiles = data.brandProfiles.filter((bp) => bp.client_id !== id);
    data.assets = data.assets.filter((a) => a.client_id !== id);
    data.brandReferences = data.brandReferences.filter((r) => r.client_id !== id);

    // Record deleted ID and slug so remote queries don't resurrect it
    if (!data.deletedClientIds) data.deletedClientIds = [];
    if (!data.deletedClientIds.includes(id)) data.deletedClientIds.push(id);
    if (targetSlug && !data.deletedClientIds.includes(targetSlug)) data.deletedClientIds.push(targetSlug);

    const clientProjects = data.projects.filter((p) => p.client_id === id);
    const clientProjectIds = clientProjects.map((p) => p.id);
    const clientSlideIds = data.slides
      .filter((s) => clientProjectIds.includes(s.project_id))
      .map((s) => s.id);

    data.projects = data.projects.filter((p) => p.client_id !== id);
    data.slides = data.slides.filter((s) => !clientProjectIds.includes(s.project_id));
    data.compositions = data.compositions.filter((c) => !clientSlideIds.includes(c.slide_id));

    const removed = data.clients.length < initLen;
    this.save(data);
    return removed;
  }

  isClientDeleted(idOrSlug: string): boolean {
    const data = this.load();
    return Boolean(data.deletedClientIds && data.deletedClientIds.includes(idOrSlug));
  }

  undeleteClient(idOrSlug: string): void {
    const data = this.load();
    if (data.deletedClientIds && data.deletedClientIds.includes(idOrSlug)) {
      data.deletedClientIds = data.deletedClientIds.filter((x) => x !== idOrSlug);
      this.save(data);
    }
  }

  addAsset(assetInput: Omit<DevClientAsset, 'id' | 'created_at'>): DevClientAsset {
    const data = this.load();
    const newAsset: DevClientAsset = {
      ...assetInput,
      id: `asset-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      created_at: new Date().toISOString(),
    };
    data.assets.unshift(newAsset);
    this.save(data);
    return newAsset;
  }

  listAssetsByClient(clientId: string, assetType?: string): DevClientAsset[] {
    const data = this.load();
    return data.assets.filter((a) => a.client_id === clientId && (!assetType || a.asset_type === assetType));
  }

  addBrandReference(refInput: Omit<DevBrandReference, 'id' | 'created_at'>): DevBrandReference {
    const data = this.load();
    const newRef: DevBrandReference = {
      ...refInput,
      id: `ref-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      created_at: new Date().toISOString(),
    };
    data.brandReferences.unshift(newRef);
    this.save(data);
    return newRef;
  }

  listBrandReferences(clientId: string): DevBrandReference[] {
    const data = this.load();
    return data.brandReferences.filter((r) => r.client_id === clientId);
  }

  deleteBrandReference(id: string): boolean {
    const data = this.load();
    const initLen = data.brandReferences.length;
    data.brandReferences = data.brandReferences.filter((r) => r.id !== id);
    const removed = data.brandReferences.length < initLen;
    if (removed) this.save(data);
    return removed;
  }

  listProjects(clientId?: string, status?: string, format?: string, archived?: boolean) {
    const data = this.load();
    let res = data.projects;
    if (clientId) res = res.filter((p) => p.client_id === clientId);
    if (format) res = res.filter((p) => p.format === format);

    if (status === 'archived' || archived) {
      res = res.filter((p) => p.status === 'archived' || p.archived_at !== null);
    } else {
      res = res.filter((p) => p.status !== 'archived' && !p.archived_at);
      if (status && status !== 'all') {
        res = res.filter((p) => p.status === status);
      }
    }

    return res.map((p) => {
      const client = data.clients.find((c) => c.id === p.client_id);
      const slides = data.slides
        .filter((s) => s.project_id === p.id)
        .sort((a, b) => a.slide_index - b.slide_index);

      // Compute thumbnail_url from first slide composition or asset
      let thumbnailUrl: string | null = null;
      if (slides.length > 0) {
        const firstSlide = slides[0];
        const comp = data.compositions.find((c) => c.slide_id === firstSlide.id);
        if (comp?.document?.layers) {
          const bgLayer = comp.document.layers.find(
            (l: any) => l.type === 'background' || l.type === 'image'
          ) as any;
          if (bgLayer?.imageUrl) {
            thumbnailUrl = bgLayer.imageUrl;
          }
        }
      }

      return {
        ...p,
        client: client ? { name: client.name, slug: client.slug, brand_status: client.brand_status } : null,
        slides,
        thumbnail_url: thumbnailUrl,
      };
    });
  }

  duplicateProject(id: string) {
    const data = this.load();
    const original = data.projects.find((p) => p.id === id);
    if (!original) return null;

    const newProjectId = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const clonedProject = {
      ...original,
      id: newProjectId,
      title: `${original.title} — Cópia`,
      status: 'draft',
      archived_at: null,
      approved_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const originalSlides = data.slides
      .filter((s) => s.project_id === id)
      .sort((a, b) => a.slide_index - b.slide_index);

    const clonedSlides: any[] = [];
    const clonedComps: any[] = [];

    for (const slide of originalSlides) {
      const newSlideId = `slide-${Date.now()}-${slide.slide_index}-${Math.random().toString(36).substring(2, 7)}`;
      const originalComp = data.compositions.find((c) => c.slide_id === slide.id);

      clonedSlides.push({
        ...slide,
        id: newSlideId,
        project_id: newProjectId,
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (originalComp) {
        clonedComps.push({
          id: `comp-${Date.now()}-${slide.slide_index}`,
          slide_id: newSlideId,
          document: JSON.parse(JSON.stringify(originalComp.document)),
          revision: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }

    data.projects.unshift(clonedProject);
    data.slides.push(...clonedSlides);
    data.compositions.push(...clonedComps);
    this.save(data);

    return {
      project: clonedProject,
      slides: clonedSlides,
      compositions: clonedComps,
    };
  }

  getProjectById(id: string) {
    const data = this.load();
    const project = data.projects.find((p) => p.id === id);
    if (!project) return null;

    const client = data.clients.find((c) => c.id === project.client_id) || null;
    const profile = client
      ? data.brandProfiles.find((bp) => bp.client_id === client.id && bp.status === 'approved') || null
      : null;
    const slides = data.slides.filter((s) => s.project_id === id).sort((a, b) => a.slide_index - b.slide_index);
    const slideIds = slides.map((s) => s.id);
    const compositions = data.compositions.filter((c) => slideIds.includes(c.slide_id));
    const assets = data.assets.filter((a) => a.client_id === project.client_id);
    const references = data.brandReferences.filter((r) => r.client_id === project.client_id);

    return {
      project: {
        ...project,
        client,
      },
      slides,
      compositions,
      brandProfile: profile,
      brandAssets: assets,
      references,
    };
  }

  addProject(project: any, slides: any[], compositions: any[]) {
    const data = this.load();
    data.projects.unshift(project);
    data.slides.push(...slides);
    data.compositions.push(...compositions);
    this.save(data);
  }

  getProject(id: string) {
    const data = this.load();
    return data.projects.find((p) => p.id === id) || null;
  }

  createProject(project: any) {
    this.addProject(project, [], []);
    return project;
  }

  createSlide(slide: any) {
    const data = this.load();
    data.slides.push(slide);
    this.save(data);
    return slide;
  }

  deleteProject(id: string): boolean {
    const data = this.load();
    const initLen = data.projects.length;
    const projectSlideIds = data.slides
      .filter((s) => s.project_id === id)
      .map((s) => s.id);

    data.projects = data.projects.filter((p) => p.id !== id);
    data.slides = data.slides.filter((s) => s.project_id !== id);
    data.compositions = data.compositions.filter((c) => !projectSlideIds.includes(c.slide_id));

    const removed = data.projects.length < initLen;
    if (removed) this.save(data);
    return removed;
  }

  updateProject(id: string, updates: any) {
    const data = this.load();
    const projIdx = data.projects.findIndex((p) => p.id === id);
    if (projIdx !== -1) {
      data.projects[projIdx] = {
        ...data.projects[projIdx],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      this.save(data);
      return data.projects[projIdx];
    }
    return null;
  }

  getComposition(slideId: string) {
    const data = this.load();
    return data.compositions.find((c) => c.slide_id === slideId) || null;
  }

  updateComposition(slideId: string, doc: any, expectedRevision: number) {
    const data = this.load();
    const compIdx = data.compositions.findIndex((c) => c.slide_id === slideId);
    if (compIdx !== -1) {
      data.compositions[compIdx] = {
        ...data.compositions[compIdx],
        document: doc,
        revision: (data.compositions[compIdx].revision || 0) + 1,
        updated_at: new Date().toISOString(),
      };
      this.save(data);
      return data.compositions[compIdx];
    } else {
      const newComp = {
        id: `comp-${Date.now()}`,
        slide_id: slideId,
        document: doc,
        revision: 1,
        updated_at: new Date().toISOString(),
      };
      data.compositions.push(newComp);
      this.save(data);
      return newComp;
    }
  }

  getSetting(key: string, defaultValue: any = null): any {
    const data = this.load();
    return data.settings && key in data.settings ? data.settings[key] : defaultValue;
  }

  setSetting(key: string, value: any): void {
    const data = this.load();
    if (!data.settings) data.settings = {};
    data.settings[key] = value;
    this.save(data);
  }

  getJob(jobId: string): any {
    const data = this.load();
    return (data.jobs || []).find((j: any) => j.id === jobId) || null;
  }

  saveJob(job: any): any {
    const data = this.load();
    if (!data.jobs) data.jobs = [];
    const idx = data.jobs.findIndex((j: any) => j.id === job.id);
    if (idx !== -1) {
      data.jobs[idx] = { ...data.jobs[idx], ...job };
      this.save(data);
      return data.jobs[idx];
    } else {
      data.jobs.push(job);
      this.save(data);
      return job;
    }
  }

  listJobs(projectId?: string): any[] {
    const data = this.load();
    let jobs = data.jobs || [];
    if (projectId) {
      jobs = jobs.filter((j: any) => j.project_id === projectId);
    }
    return jobs;
  }

  // Creative Chat Support
  listCreativeConversations(orgId: string, clientId?: string): any[] {
    const data = this.load();
    let res = (data.creativeConversations || []).filter(c => c.organization_id === orgId);
    if (clientId) res = res.filter(c => c.client_id === clientId);
    return res.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  getCreativeConversation(id: string): any | null {
    const data = this.load();
    return (data.creativeConversations || []).find(c => c.id === id) || null;
  }

  saveCreativeConversation(conv: any): any {
    const data = this.load();
    if (!data.creativeConversations) data.creativeConversations = [];
    const idx = data.creativeConversations.findIndex(c => c.id === conv.id);
    if (idx >= 0) {
      data.creativeConversations[idx] = { ...data.creativeConversations[idx], ...conv, updated_at: new Date().toISOString() };
      this.save(data);
      return data.creativeConversations[idx];
    } else {
      const newConv = {
        id: conv.id || crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...conv,
      };
      data.creativeConversations.unshift(newConv);
      this.save(data);
      return newConv;
    }
  }

  listCreativeMessages(conversationId: string): any[] {
    const data = this.load();
    return (data.creativeMessages || [])
      .filter(m => m.conversation_id === conversationId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  addCreativeMessage(msg: any): any {
    const data = this.load();
    if (!data.creativeMessages) data.creativeMessages = [];
    const newMsg = {
      id: msg.id || crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...msg,
    };
    data.creativeMessages.push(newMsg);
    
    // Atualiza timestamp da conversa
    if (data.creativeConversations) {
      const conv = data.creativeConversations.find(c => c.id === msg.conversation_id);
      if (conv) {
        conv.updated_at = new Date().toISOString();
        if (msg.response_id) conv.last_response_id = msg.response_id;
      }
    }
    
    this.save(data);
    return newMsg;
  }
}

export const devStore = new DevDataStore();
