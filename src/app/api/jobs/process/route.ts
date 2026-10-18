// src/app/api/jobs/process/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { QueueService } from '@/services/ai/queue.service';
import { formatError } from '@/lib/errors';
import { requireSessionContext, AuthError, ForbiddenError } from '@/lib/auth/server-guards';

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    if (session.role === 'viewer') {
      return NextResponse.json(
        { error: { message: 'Visualizadores possuem acesso somente leitura.' } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json({ error: { message: 'jobId é obrigatório' } }, { status: 400 });
    }

    const queueService = new QueueService(supabase);
    const updatedJob = await queueService.processJob(jobId);

    return NextResponse.json({ job: updatedJob });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
