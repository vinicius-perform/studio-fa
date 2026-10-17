// supabase/functions/health/index.ts
import { handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse } from '../_shared/errors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { logEvent } from '../_shared/logger.ts';

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const { user, supabase } = await requireAuth(req);

    // Test database connection
    const { data: dbCheck, error: dbError } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(1);

    if (dbError) {
      throw new Error(`Database check failed: ${dbError.message}`);
    }

    // Check user membership and organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role, organizations(name, slug)')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    logEvent({
      requestId,
      userId: user.id,
      organizationId: membership?.organization_id ?? null,
      operation: 'health_check',
      durationMs: Date.now() - startTime,
      result: 'success',
    });

    return jsonResponse({
      status: 'ok',
      authenticated: true,
      database: true,
      user: {
        id: user.id,
        email: user.email,
      },
      organization: membership
        ? {
            id: membership.organization_id,
            role: membership.role,
            details: membership.organizations,
          }
        : null,
    });
  } catch (err) {
    logEvent({
      requestId,
      operation: 'health_check',
      durationMs: Date.now() - startTime,
      result: 'error',
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });

    return errorResponse(err);
  }
});
