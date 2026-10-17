// src/app/api/jobs/process/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { QueueService } from '@/services/ai/queue.service';
import { formatError } from '@/lib/errors';

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServerClient();
    const body = await req.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json({ error: { message: 'jobId é obrigatório' } }, { status: 400 });
    }

    const queueService = new QueueService(supabase);
    const updatedJob = await queueService.processJob(jobId);

    return NextResponse.json({ job: updatedJob });
  } catch (err) {
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
