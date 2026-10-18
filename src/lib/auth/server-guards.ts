// src/lib/auth/server-guards.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { isAdmin, type UserRole, type UserSessionContext } from './permissions';

export class AuthError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 401, code = 'UNAUTHENTICATED') {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
  }
}

export class ForbiddenError extends Error {
  status: number;
  code: string;

  constructor(message = 'Acesso não autorizado.', status = 403, code = 'FORBIDDEN') {
    super(message);
    this.name = 'ForbiddenError';
    this.status = status;
    this.code = code;
  }
}

export class NotFoundError extends Error {
  status: number;
  code: string;

  constructor(message = 'Recurso não encontrado.', status = 404, code = 'NOT_FOUND') {
    super(message);
    this.name = 'NotFoundError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Exige que a requisição possua um usuário autenticado no Supabase Auth.
 */
export async function requireUser(supabase: any) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthError('Sessão inválida ou expirada. Faça login para continuar.', 401, 'UNAUTHENTICATED');
  }

  return user;
}

/**
 * Exige que o usuário pertença a uma organização ativa com role definida.
 */
export async function requireMembership(
  supabase: any,
  userId: string
): Promise<{
  organizationId: string;
  organizationName: string;
  role: UserRole;
  profile: { full_name: string | null; avatar_url: string | null };
}> {
  const { data: member, error: memberErr } = await supabase
    .from('organization_members')
    .select(`
      organization_id,
      role,
      organizations (
        id,
        name
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (memberErr || !member || !member.organization_id) {
    throw new ForbiddenError(
      'Seu usuário ainda não possui acesso ao Studio FA. Solicite um convite a um administrador.',
      403,
      'NO_MEMBERSHIP'
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', userId)
    .maybeSingle();

  const org = member.organizations as any;
  const orgName = org?.name || 'Studio FA';

  return {
    organizationId: member.organization_id,
    organizationName: orgName,
    role: member.role as UserRole,
    profile: {
      full_name: profile?.full_name || null,
      avatar_url: profile?.avatar_url || null,
    },
  };
}

/**
 * Constrói o contexto completo da sessão do usuário autenticado.
 */
export async function requireSessionContext(supabase: any): Promise<UserSessionContext> {
  const user = await requireUser(supabase);
  const membership = await requireMembership(supabase, user.id);

  let assignedClientIds: string[] = [];
  if (!isAdmin(membership.role)) {
    const { data: assignments } = await supabase
      .from('client_assignments')
      .select('client_id')
      .eq('organization_id', membership.organizationId)
      .eq('user_id', user.id);

    assignedClientIds = (assignments || []).map((a: any) => a.client_id);
  }

  return {
    userId: user.id,
    email: user.email || '',
    fullName: membership.profile.full_name || user.email?.split('@')[0] || 'Usuário',
    avatarUrl: membership.profile.avatar_url,
    organizationId: membership.organizationId,
    organizationName: membership.organizationName,
    role: membership.role,
    assignedClientIds,
  };
}

/**
 * Exige papel administrativo (owner ou admin).
 */
export async function requireAdmin(supabase: any): Promise<UserSessionContext> {
  const session = await requireSessionContext(supabase);
  if (!isAdmin(session.role)) {
    throw new ForbiddenError('Apenas administradores podem executar esta ação.', 403, 'ADMIN_REQUIRED');
  }
  return session;
}

/**
 * Verifica se o usuário autenticado tem permissão para acessar o cliente especificado.
 */
export async function hasClientAccess(
  supabase: any,
  session: UserSessionContext,
  clientId: string
): Promise<boolean> {
  if (isAdmin(session.role)) return true;

  // Designer e Viewer dependem de atribuição
  if (session.assignedClientIds.includes(clientId)) {
    return true;
  }

  // Consulta no banco caso não esteja no cache da sessão
  const { data } = await supabase
    .from('client_assignments')
    .select('id')
    .eq('organization_id', session.organizationId)
    .eq('client_id', clientId)
    .eq('user_id', session.userId)
    .maybeSingle();

  return Boolean(data);
}

/**
 * Exige acesso explícito ao cliente.
 */
export async function requireClientAccess(
  supabase: any,
  session: UserSessionContext,
  clientId: string
): Promise<void> {
  const hasAccess = await hasClientAccess(supabase, session, clientId);
  if (!hasAccess) {
    throw new ForbiddenError('Você não tem permissão para acessar este cliente.', 403, 'CLIENT_FORBIDDEN');
  }
}

/**
 * Exige acesso ao projeto (validando acesso ao cliente do projeto).
 */
export async function requireProjectAccess(
  supabase: any,
  session: UserSessionContext,
  projectId: string
): Promise<{ clientId: string }> {
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, client_id, organization_id')
    .eq('id', projectId)
    .maybeSingle();

  if (error || !project) {
    throw new NotFoundError('Projeto não encontrado.', 404, 'PROJECT_NOT_FOUND');
  }

  if (project.organization_id !== session.organizationId) {
    throw new ForbiddenError('Acesso não autorizado a este projeto.', 403, 'CROSS_ORG_FORBIDDEN');
  }

  await requireClientAccess(supabase, session, project.client_id);
  return { clientId: project.client_id };
}
