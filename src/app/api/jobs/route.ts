// src/app/api/jobs/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { QueueService } from '@/services/ai/queue.service';
import { formatError } from '@/lib/errors';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const organizationId = searchParams.get('organizationId');

    if (!projectId || !organizationId) {
      return NextResponse.json({ error: { message: 'Parâmetros ausentes' } }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const queueService = new QueueService(supabase);
    const jobs = await queueService.getProjectJobs(projectId, organizationId);

    return NextResponse.json({ jobs });
  } catch (err) {
    return NextResponse.json(formatError(err), { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await req.json();
    const queueService = new QueueService(supabase);

    const job = await queueService.enqueueSlideJob({
      organizationId: body.organizationId,
      clientId: body.clientId,
      projectId: body.projectId,
      slideId: body.slideId,
      slideIndex: body.slideIndex ?? 0,
      format: body.format || 'instagram_feed_4_5',
      presetId: body.presetId || 'production',
      promptOverride: body.promptOverride,
      customVariationInstruction: body.customVariationInstruction,
      isVariation: Boolean(body.isVariation),
      userId: user?.id || 'anonymous-designer',
    });

    return NextResponse.json({ job });
  } catch (err) {
    return NextResponse.json(formatError(err), { status: 400 });
  }
}
