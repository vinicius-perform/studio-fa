// src/app/api/clients/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireSessionContext, AuthError, ForbiddenError } from '@/lib/auth/server-guards';
import { isAdmin } from '@/lib/auth/permissions';
import { formatError } from '@/lib/errors';
import { devStore } from '@/lib/dev-store';
import { isDevStoreAllowed } from '@/config/env';
import { StorageService } from '@/services/storage/storage.service';
import { VisualAnalyzerService } from '@/services/ai/visual-analyzer.service';

/**
 * Normaliza o identificador do Instagram para o formato padrão @usuario.
 */
function normalizeInstagramHandle(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let clean = raw.trim();
  clean = clean.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '');
  clean = clean.replace(/\/.*$/, ''); // remove subdiretórios
  clean = clean.replace(/^@+/, ''); // remove @ extra
  clean = clean.trim();
  return clean ? `@${clean}` : null;
}

export async function GET(req: Request) {
  try {
    if (isDevStoreAllowed()) {
      const localClients = devStore.listClients();
      return NextResponse.json({ clients: localClients });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    let query = supabase
      .from('clients')
      .select('id, organization_id, name, slug, niche, instagram_handle, website, status, brand_status, dna, manual_guidelines, visual_memory_status, created_at, updated_at')
      .eq('organization_id', session.organizationId)
      .neq('status', 'archived')
      .order('name', { ascending: true });

    if (!isAdmin(session.role)) {
      if (session.assignedClientIds.length === 0) {
        return NextResponse.json({ clients: [] });
      }
      query = query.in('id', session.assignedClientIds);
    }

    const { data: rawClients, error: clientsErr } = await query;
    let clients: any[] = (rawClients || []) as any[];

    if (clientsErr) {
      if (clientsErr.code === '42703') {
        // Fallback resiliente caso o banco remoto ainda esteja executando a delta migration
        let fallbackQuery = supabase
          .from('clients')
          .select('id, organization_id, name, slug, niche, instagram_handle, website, status, brand_status, created_at, updated_at')
          .eq('organization_id', session.organizationId)
          .neq('status', 'archived')
          .order('name', { ascending: true });

        if (!isAdmin(session.role)) {
          if (session.assignedClientIds.length === 0) {
            return NextResponse.json({ clients: [] });
          }
          fallbackQuery = fallbackQuery.in('id', session.assignedClientIds);
        }

        const { data: fallbackClients, error: fallbackErr } = await fallbackQuery;
        if (fallbackErr) {
          return NextResponse.json({ error: { message: fallbackErr.message } }, { status: 503 });
        }
        clients = (fallbackClients || []).map((c: any) => ({
          ...c,
          dna: null,
          manual_guidelines: null,
          visual_memory_status: 'awaiting_references',
        }));
      } else {
        console.error('Erro ao consultar clients no Supabase:', clientsErr);
        return NextResponse.json(
          { error: { message: 'Não foi possível consultar os clientes. Tente novamente.' } },
          { status: 503 }
        );
      }
    }

    // Popula perfis de marca, peças e signed URLs dos logos
    const populatedClients = await Promise.all(
      (clients || []).map(async (c: any) => {
        const { data: profileData } = await (supabase as any)
          .from('brand_profiles')
          .select('id, version, summary, colors, typography, graphical_elements')
          .eq('client_id', c.id)
          .eq('status', 'approved')
          .maybeSingle();

        const { data: logoAssetData } = await (supabase as any)
          .from('client_assets')
          .select('storage_bucket, storage_path, original_filename')
          .eq('client_id', c.id)
          .eq('asset_type', 'logo_primary')
          .maybeSingle();

        // Contagem de peças cadastradas
        let piecesCount = 0;
        try {
          const { count } = await (supabase as any)
            .from('client_pieces')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', c.id);
          piecesCount = count || 0;
        } catch {
          piecesCount = 0;
        }

        const profile = profileData as any;
        const logoAsset = logoAssetData as any;
        const colorsObj = (profile?.colors as any) || {};

        let logoSignedUrl: string | null = null;
        if (logoAsset?.storage_path) {
          logoSignedUrl = await StorageService.createSignedUrl(
            logoAsset.storage_bucket || 'client-brand-assets',
            logoAsset.storage_path
          );
        }

        return {
          id: c.id,
          organization_id: c.organization_id,
          name: c.name,
          slug: c.slug,
          niche: c.niche || null,
          instagram_handle: c.instagram_handle || null,
          website: c.website || null,
          status: c.status || 'active',
          brand_status: c.brand_status || 'ready',
          visual_memory_status: c.visual_memory_status || (piecesCount > 0 ? 'awaiting_analysis' : 'awaiting_references'),
          dna: c.dna || null,
          manual_guidelines: c.manual_guidelines || null,
          pieces_count: piecesCount,
          created_at: c.created_at,
          updated_at: c.updated_at,
          brandProfile: profile
            ? {
                summary: profile.summary,
                primaryColors: colorsObj.primary || [],
                secondaryColors: colorsObj.secondary || [],
                accentColors: colorsObj.accent || [],
                backgroundColors: colorsObj.background || [],
                textColors: colorsObj.text || [],
                allColors: colorsObj.all || [],
                customPalette: colorsObj.customPalette || [],
                primaryFont: (profile.typography as any)?.primaryFont || 'Inter',
                detectedFonts: (profile.typography as any)?.detectedFonts || ['Inter'],
              }
            : null,
          logoPrimaryUrl: logoSignedUrl,
        };
      })
    );

    return NextResponse.json({ clients: populatedClients });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    return NextResponse.json(
      { error: { message: 'Não foi possível conectar ao Studio FA. Tente novamente.' } },
      { status: 503 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let {
      name,
      slug,
      niche,
      instagram_handle,
      instagramHandle,
      website,
      city,
      state,
      notes,
      manual_guidelines,
      manualGuidelines,
      contentGuidelines,
      primaryColors,
      secondaryColors,
      accentColors,
      customColors,
      primaryFont,
      secondaryFont,
      detectedFonts,
      brandVoice,
      visualStyle,
      primaryLogo,
      secondaryLogo,
      monochromeLogo,
      initialPieces, // array opcional de até 30 peças
    } = body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { error: { message: 'Nome do cliente é obrigatório (mínimo 2 caracteres).' } },
        { status: 400 }
      );
    }

    // Normalização de Instagram
    const normalizedInstagram = normalizeInstagramHandle(instagram_handle || instagramHandle);

    // Normalização de manual guidelines
    const manualRules = (manual_guidelines || manualGuidelines || contentGuidelines || '').trim();

    // Auto-sanitização do slug
    if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
      slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    } else {
      slug = slug
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9-]+/g, '')
        .replace(/^-+|-+$/g, '');
    }

    if (!slug) {
      slug = `cliente-${Date.now()}`;
    }

    // Processamento de paleta de cores
    const hasCustomColors = Array.isArray(customColors) && customColors.length > 0;
    const colorsList: string[] = hasCustomColors
      ? customColors.map((c: any) => (typeof c === 'string' ? c : c.color))
      : primaryColors || [];

    const computedPrimary = hasCustomColors
      ? customColors
          .filter((c: any) => {
            const l = (c.label || '').toLowerCase();
            return l.includes('prim') || l.includes('marca');
          })
          .map((c: any) => c.color)
      : primaryColors;

    const primaryFinal: string[] =
      computedPrimary && computedPrimary.length > 0
        ? computedPrimary
        : colorsList[0]
        ? [colorsList[0]]
        : ['#0F1113'];

    const computedAccent = hasCustomColors
      ? customColors
          .filter((c: any) => {
            const l = (c.label || '').toLowerCase();
            return l.includes('destaque') || l.includes('accent');
          })
          .map((c: any) => c.color)
      : accentColors;

    const accentFinal: string[] =
      computedAccent && computedAccent.length > 0
        ? computedAccent
        : colorsList.length > 1
        ? [colorsList[1]]
        : ['#CEF52A'];

    const secondaryFinal: string[] =
      secondaryColors && secondaryColors.length > 0
        ? secondaryColors
        : colorsList.length > 2
        ? [colorsList[2]]
        : ['#1F2937'];

    const allColorsCombined = Array.from(
      new Set([...primaryFinal, ...secondaryFinal, ...accentFinal, ...colorsList])
    );

    // Validação de peças iniciais opcionais
    const hasInitialPieces = Array.isArray(initialPieces) && initialPieces.length > 0;
    const piecesToCreate = hasInitialPieces ? initialPieces.slice(0, 30) : [];
    const initialVisualStatus = piecesToCreate.length > 0 ? 'awaiting_analysis' : 'awaiting_references';

    // 1. Modo DevStore explícito
    if (isDevStoreAllowed()) {
      const orgId = devStore.getOrganizationId();
      const devCreated = devStore.addClient(
        {
          organization_id: orgId,
          name: name.trim(),
          slug,
          niche: niche || null,
          instagram_handle: normalizedInstagram,
          website: website || null,
          city: city || null,
          state: state || null,
          country: 'Brasil',
          notes: notes || null,
          status: 'active',
          brand_status: 'ready',
        },
        {
          organization_id: orgId,
          version: 1,
          status: 'approved',
          source: 'manual',
          summary: `Identidade da marca ${name.trim()}. Nicho: ${niche || 'Geral'}.`,
          colors: {
            primary: primaryFinal,
            secondary: secondaryFinal,
            accent: accentFinal,
            all: allColorsCombined,
            customPalette: hasCustomColors ? customColors : undefined,
            text: ['#FFFFFF', '#000000'],
          },
          typography: {
            detectedFonts: Array.from(new Set([primaryFont || 'Inter', ...(detectedFonts || [])])),
            primaryFont: primaryFont || 'Inter',
          },
        }
      );

      return NextResponse.json({ client: devStore.getClientById(devCreated.id) || devCreated });
    }

    // 2. Supabase como fonte oficial
    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    // Viewer é bloqueado de criar clientes
    if (session.role === 'viewer') {
      return NextResponse.json(
        { error: { message: 'Visualizadores não possuem permissão para criar novos clientes.' } },
        { status: 403 }
      );
    }

    const orgId = session.organizationId;

    // Monta payload de inserção de cliente
    const clientInsertPayload: any = {
      organization_id: orgId,
      name: name.trim(),
      slug,
      niche: niche || null,
      instagram_handle: normalizedInstagram,
      website: website || null,
      city: city || null,
      state: state || null,
      country: 'Brasil',
      notes: notes || null,
      status: 'active',
      brand_status: piecesToCreate.length > 0 ? 'collecting' : 'ready',
      visual_memory_status: initialVisualStatus,
      manual_guidelines: manualRules || null,
      dna: {},
      created_by: session.userId,
    };

    let newClient: any = null;

    try {
      const { data, error: clientErr } = await (supabase as any)
        .from('clients')
        .insert(clientInsertPayload)
        .select('*')
        .single();

      if (clientErr) throw clientErr;
      newClient = data;
    } catch (insertErr: any) {
      // Fallback gracioso caso as colunas novas da migration 13 ainda estejam pendentes de execução manual no SQL Editor
      if (insertErr?.code === '42703' || insertErr?.message?.includes('column')) {
        console.warn('[POST /api/clients] Detectada coluna pendente no schema remoto, aplicando inserção retrocompatível...');
        delete clientInsertPayload.dna;
        delete clientInsertPayload.manual_guidelines;
        delete clientInsertPayload.visual_memory_status;

        const { data: retryData, error: retryErr } = await (supabase as any)
          .from('clients')
          .insert(clientInsertPayload)
          .select('*')
          .single();

        if (retryErr || !retryData) {
          throw new Error(retryErr?.message || 'Falha ao salvar cliente no banco de dados.');
        }
        newClient = retryData;
      } else {
        throw insertErr;
      }
    }

    // Se o criador for Designer, cria atribuição imediata
    if (session.role === 'designer') {
      await (supabase as any).from('client_assignments').insert({
        organization_id: orgId,
        client_id: newClient.id,
        user_id: session.userId,
        assigned_by: session.userId,
      });
    }

    // Cria Brand Profile inicial
    await (supabase as any).from('brand_profiles').insert({
      organization_id: orgId,
      client_id: newClient.id,
      version: 1,
      status: 'approved',
      source: 'manual',
      summary: `Identidade da marca ${newClient.name}. Nicho: ${niche || 'Geral'}.`,
      colors: {
        primary: primaryFinal,
        secondary: secondaryFinal,
        accent: accentFinal,
        all: allColorsCombined,
        customPalette: hasCustomColors ? customColors : [],
        text: ['#FFFFFF', '#000000'],
      },
      typography: {
        detectedFonts: Array.from(new Set([primaryFont || 'Inter', ...(detectedFonts || [])])),
        primaryFont: primaryFont || 'Inter',
      },
      graphical_elements: visualStyle ? { style: visualStyle } : {},
    });

    // Processamento e Upload Seguro de Logos no Supabase Storage (NUNCA Base64 no banco)
    let logoSignedUrl: string | null = null;
    const logosToProcess = [
      { logo: primaryLogo, type: 'logo_primary', label: 'Logo Principal' },
      { logo: secondaryLogo, type: 'logo_secondary', label: 'Logo Secundário' },
      { logo: monochromeLogo, type: 'logo_monochrome', label: 'Logo Monocromático' },
    ];

    for (const item of logosToProcess) {
      if (item.logo && (item.logo.dataUrl || item.logo.base64)) {
        const rawContent = item.logo.dataUrl || item.logo.base64;
        try {
          const uploadResult = await StorageService.uploadBase64({
            bucket: 'client-brand-assets',
            organizationId: orgId,
            clientId: newClient.id,
            folder: 'logos',
            originalFilename: item.logo.filename || `${item.type}.png`,
            base64Data: rawContent,
            mimeType: item.logo.mimeType,
          });

          await (supabase as any).from('client_assets').insert({
            organization_id: orgId,
            client_id: newClient.id,
            asset_type: item.type,
            label: item.label,
            storage_bucket: uploadResult.storageBucket,
            storage_path: uploadResult.storagePath,
            original_filename: item.logo.filename || `${item.type}.png`,
            mime_type: uploadResult.mimeType,
            file_size_bytes: uploadResult.fileSizeBytes,
            uploaded_by: session.userId,
          });

          if (item.type === 'logo_primary') {
            logoSignedUrl = await StorageService.createSignedUrl('client-brand-assets', uploadResult.storagePath);
          }
        } catch (uploadErr: any) {
          console.error(`[POST /api/clients] Erro ao fazer upload do logo ${item.type}:`, uploadErr);
        }
      }
    }

    // Processamento e Upload Seguro de Peças de Referência Iniciais (Opcionais)
    let savedPiecesCount = 0;
    if (piecesToCreate.length > 0) {
      for (const piece of piecesToCreate) {
        if (!piece.base64 && !piece.dataUrl) continue;
        const rawData = piece.base64 || piece.dataUrl;

        try {
          const uploadResult = await StorageService.uploadBase64({
            bucket: 'client-pieces',
            organizationId: orgId,
            clientId: newClient.id,
            folder: 'pieces',
            originalFilename: piece.filename || 'referencia.png',
            base64Data: rawData,
            mimeType: piece.mimeType,
          });

          const detected = VisualAnalyzerService.detectFormat(piece.width, piece.height, piece.filename);
          const formatType = piece.formatType || detected.formatType;
          const pieceType = piece.pieceType || 'own_brand';

          // Tenta salvar na tabela client_pieces
          try {
            await (supabase as any).from('client_pieces').insert({
              organization_id: orgId,
              client_id: newClient.id,
              title: piece.title || null,
              original_filename: piece.filename || 'referencia.png',
              storage_bucket: uploadResult.storageBucket,
              storage_path: uploadResult.storagePath,
              file_size_bytes: uploadResult.fileSizeBytes,
              mime_type: uploadResult.mimeType,
              width: piece.width || null,
              height: piece.height || null,
              aspect_ratio: piece.aspectRatio || detected.aspectRatio,
              format_type: formatType,
              piece_type: pieceType,
              analysis_status: 'pending',
              created_by: session.userId,
            });
            savedPiecesCount++;
          } catch (pieceTableErr: any) {
            console.warn('[POST /api/clients] Erro ao salvar em client_pieces:', pieceTableErr.message);
          }
        } catch (pieceErr: any) {
          console.error('[POST /api/clients] Erro no upload da peça:', pieceErr);
        }
      }
    }

    return NextResponse.json({
      client: {
        ...newClient,
        visual_memory_status: initialVisualStatus,
        initialPiecesCount: savedPiecesCount,
        logoPrimaryUrl: logoSignedUrl,
      },
    });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
