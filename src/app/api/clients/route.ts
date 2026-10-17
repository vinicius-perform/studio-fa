// src/app/api/clients/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { ClientService } from '@/services/clients/client.service';
import { formatError } from '@/lib/errors';
import { devStore } from '@/lib/dev-store';

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseServerClient();
    const { searchParams } = new URL(req.url);

    // Default to the first organization if not specified
    let orgId = searchParams.get('organizationId');
    if (!orgId) {
      try {
        const { data: org } = await supabase.from('organizations').select('id').limit(1).single();
        orgId = (org as any)?.id || null;
      } catch {
        orgId = null;
      }
    }

    // 1. Always load local clients (guaranteed permanent local persistence)
    const localClients = devStore.listClients();

    // 2. Also query Supabase if available
    let remoteClients: any[] = [];
    if (orgId) {
      try {
        const clientService = new ClientService(supabase);
        const clients = await clientService.list(orgId);

        if (clients && clients.length > 0) {
          remoteClients = await Promise.all(
            clients.map(async (c) => {
              const { data: profile } = await supabase
                .from('brand_profiles')
                .select('id, version, summary, colors, typography, graphical_elements')
                .eq('client_id', c.id)
                .eq('status', 'approved')
                .maybeSingle();

              const { data: logoAsset } = await supabase
                .from('client_assets')
                .select('id, storage_path, original_filename')
                .eq('client_id', c.id)
                .in('asset_type', ['logo_primary', 'logo_monochrome'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              const { count: refCount } = await supabase
                .from('brand_references')
                .select('id', { count: 'exact', head: true })
                .eq('client_id', c.id);

              return {
                ...c,
                brandProfile: profile,
                logoAsset,
                referenceCount: refCount || 0,
              };
            })
          );
        }
      } catch (dbErr) {
        console.warn('Supabase query failed, using devStore:', dbErr);
      }
    }

    // 3. Filter out any remote clients that were explicitly deleted locally
    const filteredRemote = remoteClients.filter(
      (rc) => !devStore.isClientDeleted(rc.id) && !devStore.isClientDeleted(rc.slug)
    );

    // 4. Merge: localClients ALWAYS take precedence and are NEVER lost!
    const merged = [...localClients];
    for (const rc of filteredRemote) {
      const exists = merged.some((c) => c.id === rc.id || c.slug === rc.slug);
      if (!exists) {
        merged.push(rc);
      }
    }

    return NextResponse.json({ clients: merged });
  } catch (err) {
    console.error('GET /api/clients error:', err);
    return NextResponse.json({ clients: devStore.listClients() });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await req.json();
    let {
      organizationId,
      name,
      slug,
      legalName,
      niche,
      instagramHandle,
      website,
      city,
      state,
      notes,
      summary,
      primaryColors,
      accentColors,
      textColors,
      fontFamily,
      customColors,
      primaryLogo,
      secondaryLogo,
      monochromeLogo,
      fontFiles,
    } = body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { error: { message: 'Nome do cliente é obrigatório (mínimo 2 caracteres).' } },
        { status: 400 }
      );
    }

    // Auto-generate or sanitize slug
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

    // Process custom color palette
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
        : colorsList[1]
        ? [colorsList[1]]
        : ['#CEF52A'];

    const computedText = hasCustomColors
      ? customColors
          .filter((c: any) => {
            const l = (c.label || '').toLowerCase();
            return l.includes('texto') || l.includes('fonte');
          })
          .map((c: any) => c.color)
      : textColors;
    const textFinal: string[] =
      computedText && computedText.length > 0
        ? computedText
        : colorsList[2]
        ? [colorsList[2]]
        : ['#FFFFFF'];

    // Process uploaded fonts
    const uploadedFontNames: string[] = Array.isArray(fontFiles)
      ? fontFiles
          .map((f: any) => f.fontName || f.filename?.replace(/\.[^/.]+$/, '') || 'Custom Font')
          .filter(Boolean)
      : [];
    const allDetectedFonts = Array.from(
      new Set([...uploadedFontNames, fontFamily || 'Inter, sans-serif'])
    ).filter(Boolean);
    const primaryFontFinal = uploadedFontNames[0] || fontFamily || 'Inter, sans-serif';

    const hasVisualMemory = Boolean(
      summary ||
        hasCustomColors ||
        (primaryColors && primaryColors.length > 0) ||
        fontFamily ||
        uploadedFontNames.length > 0 ||
        primaryLogo
    );
    const initialBrandStatus: 'ready' | 'empty' = hasVisualMemory ? 'ready' : 'empty';

    // Format instagram handle
    let formattedInsta: string | undefined = undefined;
    if (instagramHandle && typeof instagramHandle === 'string') {
      const clean = instagramHandle.trim().replace(/^@+/, '');
      if (clean) formattedInsta = `@${clean}`;
    }

    const effectiveOrgId = organizationId || devStore.getOrganizationId();

    // 1. Always persist to devStore so client is immediately live in the UI
    const devCreated = devStore.addClient(
      {
        organization_id: effectiveOrgId,
        name: name.trim(),
        slug,
        legal_name: legalName?.trim() || null,
        niche: niche?.trim() || null,
        instagram_handle: formattedInsta || null,
        website: website?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        country: 'BR',
        notes: notes?.trim() || null,
        status: 'active',
        brand_status: initialBrandStatus,
      },
      hasVisualMemory
        ? {
            organization_id: effectiveOrgId,
            version: 1,
            status: 'approved',
            source: 'manual',
            summary:
              summary?.trim() ||
              `Identidade visual da marca ${name.trim()}. Estilo moderno e consistente.`,
            colors: {
              primary: primaryFinal,
              secondary: ['#22262B'],
              accent: accentFinal,
              background: ['#0B0F17', '#F6F7F8'],
              text: textFinal,
              all: colorsList.length > 0 ? colorsList : undefined,
              customPalette: hasCustomColors ? customColors : undefined,
            },
            typography: {
              detectedFonts: allDetectedFonts,
              primaryFont: primaryFontFinal,
            },
          }
        : undefined
    );

    // Save uploaded logos & font assets into devStore
    if (primaryLogo && primaryLogo.dataUrl) {
      devStore.addAsset({
        organization_id: effectiveOrgId,
        client_id: devCreated.id,
        asset_type: 'logo_primary',
        label: 'Logo Principal',
        storage_path: primaryLogo.dataUrl,
        original_filename: primaryLogo.filename || 'logo-principal.png',
        mime_type: primaryLogo.mimeType || 'image/png',
        file_size_bytes: primaryLogo.size || 0,
      });
    }

    if (secondaryLogo && secondaryLogo.dataUrl) {
      devStore.addAsset({
        organization_id: effectiveOrgId,
        client_id: devCreated.id,
        asset_type: 'logo_secondary',
        label: 'Logo Secundário',
        storage_path: secondaryLogo.dataUrl,
        original_filename: secondaryLogo.filename || 'logo-secundario.png',
        mime_type: secondaryLogo.mimeType || 'image/png',
        file_size_bytes: secondaryLogo.size || 0,
      });
    }

    if (monochromeLogo && monochromeLogo.dataUrl) {
      devStore.addAsset({
        organization_id: effectiveOrgId,
        client_id: devCreated.id,
        asset_type: 'logo_monochrome',
        label: 'Logo Monocromático',
        storage_path: monochromeLogo.dataUrl,
        original_filename: monochromeLogo.filename || 'logo-monocromatico.png',
        mime_type: monochromeLogo.mimeType || 'image/png',
        file_size_bytes: monochromeLogo.size || 0,
      });
    }

    if (Array.isArray(fontFiles)) {
      for (const font of fontFiles) {
        if (font && font.dataUrl) {
          devStore.addAsset({
            organization_id: effectiveOrgId,
            client_id: devCreated.id,
            asset_type: 'font',
            label: font.fontName || font.filename,
            storage_path: font.dataUrl,
            original_filename: font.filename || 'fonte.ttf',
            mime_type: font.mimeType || 'font/ttf',
            file_size_bytes: font.size || 0,
          });
        }
      }
    }

    const fullDevClient = devStore.getClientById(devCreated.id) || devCreated;

    // 2. Also attempt Supabase insert if available
    try {
      let creatorProfileId: string | null = null;
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();
        if (profile) creatorProfileId = (profile as any).id;
      }

      const clientService = new ClientService(supabase);
      const client = await clientService.create(
        {
          organization_id: effectiveOrgId,
          name: name.trim(),
          slug,
          legal_name: legalName?.trim() || undefined,
          niche: niche?.trim() || undefined,
          instagram_handle: formattedInsta,
          website: website?.trim() || '',
          city: city?.trim() || undefined,
          state: state?.trim() || undefined,
          country: 'BR',
          notes: notes?.trim() || undefined,
          status: 'active',
          brand_status: initialBrandStatus,
        },
        creatorProfileId
      );

      if (hasVisualMemory) {
        await (supabase.from('brand_profiles') as any).insert({
          organization_id: effectiveOrgId,
          client_id: client.id,
          version: 1,
          status: 'approved',
          source: 'manual',
          summary:
            summary?.trim() ||
            `Identidade visual da marca ${client.name}. Estilo moderno e consistente.`,
          colors: {
            primary: primaryFinal,
            secondary: ['#22262B'],
            accent: accentFinal,
            background: ['#0B0F17', '#F6F7F8'],
            text: textFinal,
          },
          typography: {
            detectedFonts: allDetectedFonts,
            primaryFont: primaryFontFinal,
            weights: ['normal', 'bold'],
            hierarchy: {
              headline: { minSize: 32, maxSize: 72 },
              body: { minSize: 14, maxSize: 24 },
            },
          },
          composition: { alignment: 'left', balance: 'asymmetrical', density: 'minimal' },
          photography: { style: 'editorial', lighting: 'natural' },
          logo_usage: { preferredPlacement: 'top-left', safeZone: 20 },
          graphical_elements: { badges: true, shapes: ['rounded_rect'] },
          visual_style: { aesthetic: niche || 'contemporâneo', mood: 'profissional' },
          content_style: { tone: 'direto', personality: 'moderno' },
          spacing_rules: { margin: 40, padding: 24 },
          dos: ['Manter tipografia legível e contraste alto', 'Preservar as cores da marca'],
          donts: ['Não achatar texto na imagem', 'Não distorcer logotipo'],
          raw_analysis: {},
          created_by: creatorProfileId,
          approved_by: creatorProfileId,
          approved_at: new Date().toISOString(),
        });
      }

      return NextResponse.json({ client: fullDevClient }, { status: 201 });
    } catch (sbErr) {
      console.warn('Supabase insert failed, returning devCreated client:', sbErr);
      return NextResponse.json({ client: fullDevClient }, { status: 201 });
    }
  } catch (err) {
    console.error('POST /api/clients error:', err);
    return NextResponse.json(formatError(err), { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let clientId = searchParams.get('id');

    if (!clientId) {
      try {
        const body = await req.json();
        clientId = body.id || body.clientId;
      } catch {
        // Ignored
      }
    }

    if (!clientId) {
      return NextResponse.json(
        { error: { message: 'ID do cliente é obrigatório para exclusão.' } },
        { status: 400 }
      );
    }

    // 1. Remove from devStore
    devStore.deleteClient(clientId);

    // 2. Also attempt Supabase delete if available
    try {
      const supabase = getSupabaseServerClient();
      const orgId = devStore.getOrganizationId();
      const clientService = new ClientService(supabase);
      await clientService.delete(clientId, orgId);
    } catch (sbErr) {
      console.warn('Supabase delete client failed:', sbErr);
    }

    return NextResponse.json({ success: true, message: 'Cliente excluído com sucesso.' });
  } catch (err) {
    console.error('DELETE /api/clients error:', err);
    return NextResponse.json(formatError(err), { status: 500 });
  }
}

