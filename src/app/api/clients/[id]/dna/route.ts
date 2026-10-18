// src/app/api/clients/[id]/dna/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient, getServiceRoleClient } from '@/lib/supabase/server';
import {
  requireSessionContext,
  requireClientAccess,
  AuthError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/auth/server-guards';
import { formatError } from '@/lib/errors';
import { BrandDNAService } from '@/services/ai/brand-dna.service';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const clientId = params.id;
    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    await requireClientAccess(supabase, session, clientId);

    const { data: client, error: clientErr } = await (supabase as any)
      .from('clients')
      .select('id, name, niche, manual_guidelines, dna, visual_memory_status')
      .eq('id', clientId)
      .eq('organization_id', session.organizationId)
      .single();

    if (clientErr || !client) {
      return NextResponse.json({ error: { message: 'Cliente não encontrado.' } }, { status: 404 });
    }

    return NextResponse.json({
      dna: client.dna || null,
      manual_guidelines: client.manual_guidelines || null,
      visual_memory_status: client.visual_memory_status || 'awaiting_references',
    });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const clientId = params.id;
    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    if (session.role === 'viewer') {
      return NextResponse.json(
        { error: { message: 'Visualizadores não possuem permissão para reconsolidar o DNA da marca.' } },
        { status: 403 }
      );
    }

    await requireClientAccess(supabase, session, clientId);

    // Busca cliente
    const { data: client, error: clientErr } = await (supabase as any)
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientErr || !client) {
      return NextResponse.json({ error: { message: 'Cliente não encontrado.' } }, { status: 404 });
    }

    // Busca perfil da marca
    const { data: profile } = await (supabase as any)
      .from('brand_profiles')
      .select('*')
      .eq('client_id', clientId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Busca peças analisadas com sucesso
    const { data: completedPieces } = await (supabase as any)
      .from('client_pieces')
      .select('*')
      .eq('client_id', clientId)
      .eq('analysis_status', 'completed');

    const piecesList = (completedPieces || []) as any[];

    if (piecesList.length === 0 && !client.manual_guidelines && !profile?.colors?.primary?.[0]) {
      return NextResponse.json(
        { error: { message: 'É necessário ter ao menos uma peça analisada ou diretrizes manuais para consolidar o DNA.' } },
        { status: 400 }
      );
    }

    const consolidatedDNA = await BrandDNAService.consolidateDNA({
      organizationId: session.organizationId,
      clientId,
      clientName: client.name,
      clientNiche: client.niche,
      manualGuidelines: client.manual_guidelines,
      brandIdentity: {
        primaryColor: profile?.colors?.primary?.[0],
        secondaryColor: profile?.colors?.secondary?.[0],
        accentColor: profile?.colors?.accent?.[0],
        primaryFont: profile?.typography?.primaryFont,
        secondaryFont: profile?.typography?.secondaryFont,
      },
      piecesAnalyses: piecesList.map((p) => ({
        pieceId: p.id,
        pieceType: p.piece_type,
        formatType: p.format_type,
        analysis: p.analysis_json,
      })),
    });

    await BrandDNAService.saveConsolidatedDNA(clientId, session.organizationId, consolidatedDNA);

    return NextResponse.json({
      success: true,
      dna: consolidatedDNA,
    });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
