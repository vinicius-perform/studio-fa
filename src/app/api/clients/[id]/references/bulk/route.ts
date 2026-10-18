// src/app/api/clients/[id]/references/bulk/route.ts
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
import { visualAnalyzer } from '@/services/ai/visual-analyzer.service';
import { isDevStoreAllowed } from '@/config/env';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const clientId = params.id;
    const body = await req.json();
    const { pieces } = body;

    if (!Array.isArray(pieces) || pieces.length === 0) {
      return NextResponse.json(
        { error: { message: 'Envie uma lista de peças com imagens para análise em massa.' } },
        { status: 400 }
      );
    }

    if (isDevStoreAllowed()) {
      const orgId = devStore.getOrganizationId();
      const localClient = devStore.getClientById(clientId);
      const clientName = localClient?.name || 'Cliente';
      const clientNiche = localClient?.niche || 'Design & Comunicação';

      const processedReferences = [];
      for (const piece of pieces) {
        if (!piece.imageUrl) continue;
        const analysis = await visualAnalyzer.analyzePiece({
          imageUrl: piece.imageUrl,
          filename: piece.filename,
          width: piece.width,
          height: piece.height,
          clientInfo: {
            name: clientName,
            niche: clientNiche,
            brandProfile: localClient?.brandProfile || null,
          },
        });

        const devRef = devStore.addBrandReference({
          organization_id: orgId,
          client_id: clientId,
          title: analysis.title,
          description: analysis.aiDescription,
          reference_type: analysis.referenceType,
          tags: analysis.tags,
          image_url: piece.imageUrl,
          ai_description: analysis.aiDescription,
          visual_features: analysis.visualFeatures,
        });
        processedReferences.push(devRef);
      }

      return NextResponse.json(
        { success: true, count: processedReferences.length, references: processedReferences },
        { status: 201 }
      );
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    if (session.role === 'viewer') {
      return NextResponse.json(
        { error: { message: 'Visualizadores não possuem permissão para enviar peças.' } },
        { status: 403 }
      );
    }

    await requireClientAccess(supabase, session, clientId);

    const { data: dbClientData } = await (supabase as any)
      .from('clients')
      .select('name, niche')
      .eq('id', clientId)
      .eq('organization_id', session.organizationId)
      .single();

    const { data: profileData } = await (supabase as any)
      .from('brand_profiles')
      .select('*')
      .eq('client_id', clientId)
      .eq('status', 'approved')
      .maybeSingle();

    const dbClient = dbClientData as any;
    const profile = profileData as any;

    const clientName = dbClient?.name || 'Cliente';
    const clientNiche = dbClient?.niche || 'Design & Comunicação';

    const processedReferences = [];

    for (const piece of pieces) {
      if (!piece.imageUrl) continue;

      const analysis = await visualAnalyzer.analyzePiece({
        imageUrl: piece.imageUrl,
        filename: piece.filename,
        width: piece.width,
        height: piece.height,
        clientInfo: {
          name: clientName,
          niche: clientNiche,
          brandProfile: profile,
        },
      });

      const { data: newRef, error: insertErr } = await (supabase.from('brand_references') as any)
        .insert({
          organization_id: session.organizationId,
          client_id: clientId,
          title: analysis.title,
          description: analysis.aiDescription,
          reference_type: analysis.referenceType,
          tags: analysis.tags,
          image_url: piece.imageUrl,
          is_approved: true,
          ai_description: analysis.aiDescription,
          visual_features: analysis.visualFeatures,
          quality_score: analysis.qualityScore,
        })
        .select('*')
        .single();

      if (!insertErr && newRef) {
        processedReferences.push(newRef);
      }
    }

    return NextResponse.json(
      { success: true, count: processedReferences.length, references: processedReferences },
      { status: 201 }
    );
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    if (err instanceof NotFoundError) return NextResponse.json({ error: { message: err.message } }, { status: 404 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
