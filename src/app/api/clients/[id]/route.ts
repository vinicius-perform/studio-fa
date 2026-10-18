// src/app/api/clients/[id]/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import {
  requireSessionContext,
  requireClientAccess,
  AuthError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/auth/server-guards';
import { formatError } from '@/lib/errors';
import { devStore } from '@/lib/dev-store';
import { isDevStoreAllowed } from '@/config/env';
import { StorageService } from '@/services/storage/storage.service';

function normalizeInstagramHandle(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let clean = raw.trim();
  clean = clean.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '');
  clean = clean.replace(/\/.*$/, '');
  clean = clean.replace(/^@+/, '');
  clean = clean.trim();
  return clean ? `@${clean}` : null;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const clientId = params.id;

    if (isDevStoreAllowed()) {
      const client = devStore.getClientById(clientId);
      if (client) {
        return NextResponse.json({ client });
      }
      return NextResponse.json({ error: { message: 'Cliente não encontrado.' } }, { status: 404 });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    await requireClientAccess(supabase, session, clientId);

    const { data: clientData, error: clientErr } = await (supabase as any)
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .eq('organization_id', session.organizationId)
      .maybeSingle();

    if (clientErr || !clientData) {
      return NextResponse.json({ error: { message: 'Cliente não encontrado.' } }, { status: 404 });
    }

    // Busca profile, assets e peças
    const [{ data: profileData }, { data: assetsData }] = await Promise.all([
      (supabase as any)
        .from('brand_profiles')
        .select('*')
        .eq('client_id', clientId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle(),
      (supabase as any)
        .from('client_assets')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
    ]);

    // Contagem de peças
    let piecesCount = 0;
    try {
      const { count } = await (supabase as any)
        .from('client_pieces')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientId);
      piecesCount = count || 0;
    } catch {
      piecesCount = 0;
    }

    const client = clientData as any;
    const profile = profileData as any;
    const assets = (assetsData || []) as any[];

    // Gera Signed URLs para assets de marca
    const signedAssets = await Promise.all(
      assets.map(async (asset: any) => {
        let signedUrl = null;
        if (asset.storage_path) {
          signedUrl = await StorageService.createSignedUrl(
            asset.storage_bucket || 'client-brand-assets',
            asset.storage_path
          );
        }
        return {
          ...asset,
          signedUrl,
        };
      })
    );

    const primaryLogo = signedAssets.find((a: any) => a.asset_type === 'logo_primary');

    // Monta DNA amigável para exibição legível
    let dnaOutput = client.dna;
    if (!dnaOutput && profile) {
      dnaOutput = {
        version: profile.version || 1,
        lastConsolidatedAt: profile.updated_at || profile.created_at,
        analyzedPiecesCount: piecesCount,
        summary: profile.summary || `Identidade visual de ${client.name}`,
        toneAndVoice: 'Profissional e consistente',
        colorSystem: {
          primary: profile.colors?.primary?.[0] || '#0F1113',
          secondary: profile.colors?.secondary?.[0] || '#1F2937',
          accent: profile.colors?.accent?.[0] || '#CEF52A',
          neutrals: profile.colors?.neutrals || ['#FFFFFF', '#F3F4F6'],
          distributionRules: profile.colors?.rules || '60% neutros/fundo, 30% primária/secundária, 10% destaque',
          allowedCombinations: ['Fundo escuro com texto branco e acento verde', 'Fundo claro com tipografia primária escura'],
          forbiddenCombinations: ['Baixo contraste entre texto e fundo'],
        },
        typography: {
          titleFont: profile.typography?.primaryFont || profile.typography?.title || 'Inter',
          bodyFont: profile.typography?.secondaryFont || profile.typography?.body || 'Inter',
          hierarchyGuidelines: profile.typography?.rules || 'Contraste evidente entre título bold e corpo regular',
          caseRules: 'Títulos em destaque',
        },
        composition: {
          dominantLayout: profile.composition_rules?.layout || 'Grid limpo com área focal definida',
          whiteSpaceRule: profile.composition_rules?.whiteSpace || 'Respiro generoso nas margens',
          visualDensity: profile.composition_rules?.density || 'medium',
          focalPointGuideline: 'Direcionar olhar através de manchete contrastante',
        },
        imagery: {
          photoStyle: profile.imagery_style?.photoStyle || 'Fotografia de alta definição com iluminação controlada',
          subjectTreatment: profile.imagery_style?.treatment || 'Recorte com acabamento suave',
          lightingPreference: profile.imagery_style?.lighting || 'Equilibrada e natural',
          mockupOrIllustrationUsage: 'Uso contextualizado',
        },
        graphicElements: {
          allowedElements: ['Linhas de separação elegantes', 'Badges de destaque'],
          bannedElements: ['Efeitos pesados ou sem alinhamento à identidade'],
          textureGuidelines: 'Superfícies limpas ou sutil granulação',
        },
        logoRules: {
          preferredPlacement: 'Canto superior ou rodapé com área de respiro',
          minClearance: 'Margem mínima de 16px ao redor do logo',
          colorVariantRules: 'Versão monocromática branca em fundos escuros',
        },
        do: profile.dos || ['Preservar a paleta institucional', 'Garantir legibilidade máxima dos textos'],
        dont: profile.donts || ['Não distorcer o logotipo', 'Não misturar mais de duas famílias tipográficas'],
        manualGuidelinesSummary: client.manual_guidelines || null,
        hasManualOverride: Boolean(client.manual_guidelines),
      };
    }

    const visualMemoryStatus =
      client.visual_memory_status || (piecesCount > 0 ? (dnaOutput ? 'ready' : 'awaiting_analysis') : 'awaiting_references');

    return NextResponse.json({
      client: {
        ...client,
        visual_memory_status: visualMemoryStatus,
        manual_guidelines: client.manual_guidelines || null,
        dna: dnaOutput,
        brandProfile: profile || null,
        assets: signedAssets,
        logoPrimaryUrl: primaryLogo?.signedUrl || null,
        pieces_count: piecesCount,
      },
    });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(
      { error: { message: 'Não foi possível buscar o cliente. Tente novamente.' } },
      { status: 503 }
    );
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const clientId = params.id;
    if (!clientId) {
      return NextResponse.json({ error: { message: 'ID do cliente é obrigatório.' } }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    if (session.role === 'viewer') {
      return NextResponse.json(
        { error: { message: 'Visualizadores não possuem permissão para editar clientes.' } },
        { status: 403 }
      );
    }

    await requireClientAccess(supabase, session, clientId);

    const body = await req.json();
    const {
      name,
      niche,
      instagram_handle,
      instagramHandle,
      website,
      city,
      state,
      notes,
      manual_guidelines,
      manualGuidelines,
      brandIdentity,
    } = body;

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof name === 'string' && name.trim().length >= 2) {
      updatePayload.name = name.trim();
    }
    if (niche !== undefined) updatePayload.niche = niche || null;
    if (instagram_handle !== undefined || instagramHandle !== undefined) {
      updatePayload.instagram_handle = normalizeInstagramHandle(instagram_handle || instagramHandle);
    }
    if (website !== undefined) updatePayload.website = website || null;
    if (city !== undefined) updatePayload.city = city || null;
    if (state !== undefined) updatePayload.state = state || null;
    if (notes !== undefined) updatePayload.notes = notes || null;
    if (manual_guidelines !== undefined || manualGuidelines !== undefined) {
      updatePayload.manual_guidelines = (manual_guidelines || manualGuidelines || '').trim() || null;
    }

    const { data: updatedClient, error: updateErr } = await (supabase as any)
      .from('clients')
      .update(updatePayload)
      .eq('id', clientId)
      .eq('organization_id', session.organizationId)
      .select('*')
      .single();

    if (updateErr) {
      return NextResponse.json({ error: { message: updateErr.message } }, { status: 500 });
    }

    // Se houver alteração de identidade ou cores, sincroniza no brand_profiles
    if (brandIdentity) {
      try {
        await (supabase as any)
          .from('brand_profiles')
          .update({
            colors: {
              primary: brandIdentity.primaryColor ? [brandIdentity.primaryColor] : undefined,
              secondary: brandIdentity.secondaryColor ? [brandIdentity.secondaryColor] : undefined,
              accent: brandIdentity.accentColor ? [brandIdentity.accentColor] : undefined,
            },
            typography: {
              primaryFont: brandIdentity.primaryFont,
              secondaryFont: brandIdentity.secondaryFont,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('client_id', clientId);
      } catch (e) {
        console.warn('Erro ao atualizar brand_profiles em PATCH:', e);
      }
    }

    return NextResponse.json({ client: updatedClient });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const clientId = params.id;
    if (!clientId) {
      return NextResponse.json({ error: { message: 'ID do cliente é obrigatório.' } }, { status: 400 });
    }

    if (isDevStoreAllowed()) {
      devStore.deleteClient(clientId);
      return NextResponse.json({ success: true, message: 'Cliente excluído com sucesso.' });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    if (session.role === 'viewer') {
      return NextResponse.json(
        { error: { message: 'Visualizadores não possuem permissão para excluir clientes.' } },
        { status: 403 }
      );
    }

    await requireClientAccess(supabase, session, clientId);

    // Marca como archived ou deleta
    const { error: deleteErr } = await (supabase as any)
      .from('clients')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId)
      .eq('organization_id', session.organizationId);

    if (deleteErr) {
      return NextResponse.json({ error: { message: deleteErr.message } }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Cliente arquivado com sucesso.' });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
