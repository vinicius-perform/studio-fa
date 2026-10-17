// src/app/api/creative-plan/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { CreativePlannerService } from '@/services/ai/creative-planner.service';
import { getFormatDefinition } from '@/config/formats';
import { formatError } from '@/lib/errors';

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await req.json();
    const {
      organizationId,
      projectId,
      clientId,
      brandProfile,
      format,
      projectType,
      globalCreativeDirective,
      slides,
    } = body;

    const planner = new CreativePlannerService(supabase);
    const formatDef = getFormatDefinition(format);

    const result = await planner.generatePlan({
      organizationId,
      projectId,
      clientId,
      brandProfile,
      format: formatDef,
      projectType: projectType || 'single_post',
      globalCreativeDirective,
      slides: slides || [],
      userId: user?.id || 'anonymous-designer',
    });

    return NextResponse.json(result);
  } catch (err) {
    const formatted = formatError(err);
    return NextResponse.json(formatted, { status: 400 });
  }
}
