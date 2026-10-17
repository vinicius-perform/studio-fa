// src/app/api/compositions/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { CompositionService } from '@/services/compositions/composition.service';
import { formatError } from '@/lib/errors';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slideId = searchParams.get('slideId');
    const organizationId = searchParams.get('organizationId');

    if (!slideId || !organizationId) {
      return NextResponse.json({ error: { message: 'slideId e organizationId são obrigatórios' } }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const service = new CompositionService(supabase);
    const comp = await service.getBySlideId(slideId, organizationId);

    return NextResponse.json({ composition: comp });
  } catch (err) {
    return NextResponse.json(formatError(err), { status: 500 });
  }
}

import { devStore } from '@/lib/dev-store';

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await req.json();

    // Sync to devStore
    const devComp = devStore.updateComposition(
      body.slideId,
      body.document,
      body.expectedRevision ?? 1
    );

    try {
      const service = new CompositionService(supabase);
      const saved = await service.saveComposition({
        slideId: body.slideId,
        projectId: body.projectId,
        organizationId: body.organizationId || devStore.getOrganizationId(),
        document: body.document,
        expectedRevision: body.expectedRevision ?? 1,
        userId: user?.id || 'anonymous-designer',
      });

      return NextResponse.json({ composition: saved });
    } catch (sbErr) {
      console.warn('Supabase saveComposition failed, using devStore composition:', sbErr);
      return NextResponse.json({ composition: devComp });
    }
  } catch (err) {
    const formatted = formatError(err);
    const status = (err as any)?.status || 500;
    return NextResponse.json(formatted, { status });
  }
}
