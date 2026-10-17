// supabase/functions/_shared/auth.ts
import { getSupabaseClient } from './client.ts';
import { AppHttpError } from './errors.ts';

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

export async function requireAuth(req: Request): Promise<{
  user: AuthenticatedUser;
  supabase: ReturnType<typeof getSupabaseClient>;
}> {
  const supabase = getSupabaseClient(req);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AppHttpError('UNAUTHORIZED', 401, 'Autenticação necessária.');
  }

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    supabase,
  };
}

export async function requireOrganizationMember(
  supabase: ReturnType<typeof getSupabaseClient>,
  organizationId: string,
  userId: string,
  allowedRoles?: string[]
): Promise<{ role: string }> {
  let query = supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .single();

  const { data, error } = await query;

  if (error || !data) {
    throw new AppHttpError('FORBIDDEN', 403, 'Você não é membro desta organização.');
  }

  if (allowedRoles && !allowedRoles.includes(data.role)) {
    throw new AppHttpError('FORBIDDEN', 403, 'Seu nível de permissão não permite esta operação.');
  }

  return { role: data.role };
}
