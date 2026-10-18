// src/lib/auth/permissions.ts
import type { AppRole } from '@/types/database';

export type UserRole = 'owner' | 'admin' | 'designer' | 'viewer';

export interface UserSessionContext {
  userId: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  organizationId: string;
  organizationName: string;
  role: UserRole;
  assignedClientIds: string[];
}

/**
 * Verifica se o papel fornecido possui privilégios de administração (owner ou admin).
 */
export function isAdmin(role?: string | null): boolean {
  if (!role) return false;
  return role === 'owner' || role === 'admin';
}

/**
 * Verifica se o papel é o proprietário máximo da organização.
 */
export function isOwner(role?: string | null): boolean {
  return role === 'owner';
}

/**
 * Verifica se o usuário pode acessar o Painel Operacional (/), Gestão de Usuários (/users)
 * e Configurações de Integrações (/settings/integrations).
 */
export function canAccessAdminPanels(role?: string | null): boolean {
  return isAdmin(role);
}

/**
 * Verifica se o usuário tem permissão para criar novos projetos/produções (/create).
 * Owner, Admin e Designer têm permissão; Viewer é bloqueado.
 */
export function canCreateProjects(role?: string | null): boolean {
  if (!role) return false;
  return role === 'owner' || role === 'admin' || role === 'designer';
}

/**
 * Verifica se o usuário tem permissão de escrita em clientes e composições.
 */
export function canWriteData(role?: string | null): boolean {
  if (!role) return false;
  return role !== 'viewer';
}

/**
 * Retorna a rota padrão de redirecionamento pós-login com base na role.
 */
export function getDefaultRouteForRole(role?: string | null): string {
  if (isAdmin(role)) {
    return '/';
  }
  if (role === 'designer') {
    return '/create';
  }
  if (role === 'viewer') {
    return '/projects';
  }
  return '/login';
}

/**
 * Formata o nome amigável do papel para exibição na UI.
 */
export function formatRoleLabel(role?: string | null): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Administrador';
    case 'designer':
      return 'Designer';
    case 'viewer':
      return 'Visualizador';
    default:
      return 'Usuário';
  }
}
