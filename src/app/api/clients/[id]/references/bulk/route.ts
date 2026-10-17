// src/app/api/clients/[id]/references/bulk/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { formatError } from '@/lib/errors';
import { devStore } from '@/lib/dev-store';
import { visualAnalyzer } from '@/services/ai/visual-analyzer.service';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = params.id;
    const body = await req.json();
    const { pieces, organizationId } = body;

    if (!Array.isArray(pieces) || pieces.length === 0) {
      return NextResponse.json(
        { error: { message: 'Envie uma lista de peças com imagens para análise em massa.' } },
        { status: 400 }
      );
    }

    const effectiveOrgId = organizationId || devStore.getOrganizationId();

    // Get client details for AI context
    const localClient = devStore.getClientById(clientId);
    const supabase = getSupabaseServerClient();
    let remoteClient: any = null;
    let clientProfile: any = localClient?.brandProfile || null;

    try {
      const { data: dbClient } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .maybeSingle();
      if (dbClient) remoteClient = dbClient;

      if (!clientProfile) {
        const { data: profile } = await supabase
          .from('brand_profiles')
          .select('*')
          .eq('client_id', clientId)
          .eq('status', 'approved')
          .maybeSingle();
        if (profile) clientProfile = profile;
      }
    } catch {
      // Fallback to local
    }

    const clientName = localClient?.name || remoteClient?.name || 'Cliente';
    const clientNiche = localClient?.niche || remoteClient?.niche || 'Design & Comunicação';

    const processedReferences = [];

    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      if (!piece.imageUrl) continue;

      // 1. Run AI Visual Analysis
      const analysis = await visualAnalyzer.analyzePiece({
        imageUrl: piece.imageUrl,
        filename: piece.filename,
        width: piece.width,
        height: piece.height,
        clientInfo: {
          name: clientName,
          niche: clientNiche,
          brandProfile: clientProfile,
        },
      });

      // 2. Persist to local devStore
      const devRef = devStore.addBrandReference({
        organization_id: effectiveOrgId,
        client_id: clientId,
        title: analysis.title,
        description: analysis.aiDescription,
        reference_type: analysis.referenceType,
        tags: analysis.tags,
        image_url: piece.imageUrl,
        ai_description: analysis.aiDescription,
        visual_features: analysis.visualFeatures,
      });

      // 3. Attempt parallel insert into Supabase
      try {
        await (supabase.from('brand_references') as any).insert({
          organization_id: effectiveOrgId,
          client_id: clientId,
          title: analysis.title,
          description: analysis.aiDescription,
          reference_type: analysis.referenceType,
          tags: analysis.tags,
          is_approved: true,
          ai_description: analysis.aiDescription,
          visual_features: analysis.visualFeatures,
          quality_score: analysis.qualityScore,
        });
      } catch (sbErr) {
        console.warn('Supabase brand_reference insert failed:', sbErr);
      }

      processedReferences.push(devRef);
    }

    return NextResponse.json(
      {
        success: true,
        count: processedReferences.length,
        references: processedReferences,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST /api/clients/[id]/references/bulk error:', err);
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
