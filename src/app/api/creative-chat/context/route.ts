// src/app/api/creative-chat/context/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireSessionContext, requireClientAccess, AuthError, ForbiddenError, NotFoundError } from '@/lib/auth/server-guards';
import { StorageService } from '@/services/storage/storage.service';
import { isDevStoreAllowed } from '@/config/env';
import { devStore } from '@/lib/dev-store';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: { message: 'clientId é obrigatório.' } }, { status: 400 });
    }

    if (isDevStoreAllowed()) {
      const client = devStore.getClientById(clientId);
      if (!client) {
        return NextResponse.json({ error: { message: 'Cliente não encontrado.' } }, { status: 404 });
      }

      return NextResponse.json({
        client: {
          id: client.id,
          name: client.name,
          niche: client.niche || 'Marketing & Tecnologia',
          brand_status: client.brand_status,
          dna: (client as any).dna || null,
        },
        pieces: (devStore.listBrandReferences?.(clientId) || []).map((p: any) => ({
          id: p.id,
          title: p.title || 'Peça de Referência',
          imageUrl: p.imageUrl || p.storage_path,
          pieceType: p.piece_type || 'own_brand',
        })),
        logos: [],
      });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);
    await requireClientAccess(supabase, session, clientId);

    // 1. Busca dados do cliente
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id, name, slug, niche, brand_status, visual_memory_status, dna, manual_guidelines')
      .eq('id', clientId)
      .eq('organization_id', session.organizationId)
      .single();

    if (clientErr || !client) {
      return NextResponse.json({ error: { message: 'Cliente não encontrado.' } }, { status: 404 });
    }

    // 2. Busca peças de referência do cliente
    const { data: piecesRaw } = await supabase
      .from('client_pieces')
      .select('id, title, storage_bucket, storage_path, format_type, piece_type, analysis_json, quality_score, created_at')
      .eq('client_id', clientId)
      .eq('organization_id', session.organizationId)
      .order('created_at', { ascending: false })
      .limit(30);

    // Gera signed URLs frescas para as peças
    const pieces = await Promise.all(
      (piecesRaw || []).map(async (p: any) => {
        let signedUrl = '';
        try {
          signedUrl = (await StorageService.createSignedUrl(p.storage_bucket || 'client-pieces', p.storage_path, 86400)) || '';
        } catch {
          signedUrl = `/api/assets/raw?path=${encodeURIComponent(p.storage_path)}`;
        }
        return {
          id: p.id,
          title: p.title || 'Peça de Referência',
          formatType: p.format_type,
          pieceType: p.piece_type,
          imageUrl: signedUrl || `/api/assets/raw?path=${encodeURIComponent(p.storage_path)}`,
          analysis: p.analysis_json,
          qualityScore: p.quality_score,
        };
      })
    );

    // 3. Busca logos do cliente
    const { data: logosRaw } = await supabase
      .from('client_assets')
      .select('id, asset_type, storage_bucket, storage_path, width, height')
      .eq('client_id', clientId)
      .eq('organization_id', session.organizationId)
      .in('asset_type', ['logo_primary', 'logo_secondary', 'logo_monochrome'])
      .order('created_at', { ascending: false });

    const logos = await Promise.all(
      (logosRaw || []).map(async (l: any) => {
        let signedUrl = '';
        try {
          signedUrl = (await StorageService.createSignedUrl(l.storage_bucket || 'client-brand-assets', l.storage_path, 86400)) || '';
        } catch {
          signedUrl = `/api/assets/raw?path=${encodeURIComponent(l.storage_path)}`;
        }
        return {
          id: l.id,
          type: l.asset_type,
          imageUrl: signedUrl || `/api/assets/raw?path=${encodeURIComponent(l.storage_path)}`,
        };
      })
    );

    return NextResponse.json({
      client,
      pieces,
      logos,
      totalPiecesCount: pieces.length,
    });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json({ error: { message: err?.message || 'Erro ao carregar contexto do cliente.' } }, { status: 500 });
  }
}
