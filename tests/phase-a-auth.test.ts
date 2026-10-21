import { describe, expect, it, afterEach } from 'bun:test';
import {
  isAdmin,
  isOwner,
  canAccessAdminPanels,
  canCreateProjects,
  canWriteData,
  getDefaultRouteForRole,
  type UserSessionContext,
} from '@/lib/auth/permissions';
import {
  AuthError,
  ForbiddenError,
  NotFoundError,
  hasClientAccess,
} from '@/lib/auth/server-guards';
import { encryptSecret, decryptSecret, maskSecret } from '@/lib/crypto';
import { isDevStoreAllowed } from '@/config/env';

describe('Phase A — Foundation, Auth, Permissions, Isolation & Integrations', () => {
  describe('Role-Based Access Control (RBAC) & Route Dispatch', () => {
    it('correctly identifies admin roles (owner and admin)', () => {
      expect(isAdmin('owner')).toBe(true);
      expect(isAdmin('admin')).toBe(true);
      expect(isAdmin('designer')).toBe(false);
      expect(isAdmin('viewer')).toBe(false);
      expect(isAdmin(null)).toBe(false);
      expect(isAdmin(undefined)).toBe(false);
    });

    it('identifies owner authority strictly', () => {
      expect(isOwner('owner')).toBe(true);
      expect(isOwner('admin')).toBe(false);
      expect(isOwner('designer')).toBe(false);
      expect(isOwner('viewer')).toBe(false);
    });

    it('controls access to admin panels (/ , /users, /settings/integrations)', () => {
      expect(canAccessAdminPanels('owner')).toBe(true);
      expect(canAccessAdminPanels('admin')).toBe(true);
      expect(canAccessAdminPanels('designer')).toBe(false);
      expect(canAccessAdminPanels('viewer')).toBe(false);
    });

    it('enforces creation permission (owner, admin, designer allowed; viewer blocked)', () => {
      expect(canCreateProjects('owner')).toBe(true);
      expect(canCreateProjects('admin')).toBe(true);
      expect(canCreateProjects('designer')).toBe(true);
      expect(canCreateProjects('viewer')).toBe(false);
      expect(canCreateProjects(null)).toBe(false);
    });

    it('enforces write permissions (viewer is read-only)', () => {
      expect(canWriteData('owner')).toBe(true);
      expect(canWriteData('admin')).toBe(true);
      expect(canWriteData('designer')).toBe(true);
      expect(canWriteData('viewer')).toBe(false);
    });

    it('dispatches default redirect route according to user role', () => {
      expect(getDefaultRouteForRole('owner')).toBe('/creative-chat');
      expect(getDefaultRouteForRole('admin')).toBe('/creative-chat');
      expect(getDefaultRouteForRole('designer')).toBe('/creative-chat');
      expect(getDefaultRouteForRole('viewer')).toBe('/projects');
      expect(getDefaultRouteForRole(null)).toBe('/login');
      expect(getDefaultRouteForRole(undefined)).toBe('/login');
    });
  });

  describe('Client Assignment & Multi-User Isolation', () => {
    const orgId = '11111111-1111-1111-1111-111111111111';
    const clientA = 'client-aaa-111';
    const clientB = 'client-bbb-222';
    const clientC = 'client-ccc-333';

    const ownerSession: UserSessionContext = {
      userId: 'user-owner',
      email: 'owner@studiofa.com',
      fullName: 'Owner Global',
      organizationId: orgId,
      organizationName: 'Studio FA Master',
      role: 'owner',
      assignedClientIds: [],
    };

    const adminSession: UserSessionContext = {
      userId: 'user-admin',
      email: 'admin@studiofa.com',
      fullName: 'Admin User',
      organizationId: orgId,
      organizationName: 'Studio FA Master',
      role: 'admin',
      assignedClientIds: [],
    };

    const joaoDesignerSession: UserSessionContext = {
      userId: 'user-joao',
      email: 'joao@studiofa.com',
      fullName: 'João Designer',
      organizationId: orgId,
      organizationName: 'Studio FA Master',
      role: 'designer',
      assignedClientIds: [clientA, clientC],
    };

    const mariaDesignerSession: UserSessionContext = {
      userId: 'user-maria',
      email: 'maria@studiofa.com',
      fullName: 'Maria Designer',
      organizationId: orgId,
      organizationName: 'Studio FA Master',
      role: 'designer',
      assignedClientIds: [clientB, clientC],
    };

    const carlosViewerSession: UserSessionContext = {
      userId: 'user-carlos',
      email: 'carlos@studiofa.com',
      fullName: 'Carlos Viewer',
      organizationId: orgId,
      organizationName: 'Studio FA Master',
      role: 'viewer',
      assignedClientIds: [clientA],
    };

    // Mock client de consulta para checagem em banco se necessário
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    };

    it('Owner and Admin have unrestricted access to all clients without explicit assignment', async () => {
      expect(await hasClientAccess(mockSupabase, ownerSession, clientA)).toBe(true);
      expect(await hasClientAccess(mockSupabase, ownerSession, clientB)).toBe(true);
      expect(await hasClientAccess(mockSupabase, ownerSession, clientC)).toBe(true);

      expect(await hasClientAccess(mockSupabase, adminSession, clientA)).toBe(true);
      expect(await hasClientAccess(mockSupabase, adminSession, clientB)).toBe(true);
      expect(await hasClientAccess(mockSupabase, adminSession, clientC)).toBe(true);
    });

    it('Designer João CAN access assigned clients A and C, but CANNOT access client B', async () => {
      expect(await hasClientAccess(mockSupabase, joaoDesignerSession, clientA)).toBe(true);
      expect(await hasClientAccess(mockSupabase, joaoDesignerSession, clientC)).toBe(true);
      expect(await hasClientAccess(mockSupabase, joaoDesignerSession, clientB)).toBe(false);
    });

    it('Designer Maria CAN access assigned clients B and C, but CANNOT access client A', async () => {
      expect(await hasClientAccess(mockSupabase, mariaDesignerSession, clientB)).toBe(true);
      expect(await hasClientAccess(mockSupabase, mariaDesignerSession, clientC)).toBe(true);
      expect(await hasClientAccess(mockSupabase, mariaDesignerSession, clientA)).toBe(false);
    });

    it('Viewer Carlos CAN access assigned client A, but CANNOT access clients B or C', async () => {
      expect(await hasClientAccess(mockSupabase, carlosViewerSession, clientA)).toBe(true);
      expect(await hasClientAccess(mockSupabase, carlosViewerSession, clientB)).toBe(false);
      expect(await hasClientAccess(mockSupabase, carlosViewerSession, clientC)).toBe(false);
    });

    it('Direct UUID access to unassigned client is strictly blocked', async () => {
      const unassignedUuid = 'random-unassigned-client-uuid-999';
      expect(await hasClientAccess(mockSupabase, joaoDesignerSession, unassignedUuid)).toBe(false);
      expect(await hasClientAccess(mockSupabase, mariaDesignerSession, unassignedUuid)).toBe(false);
      expect(await hasClientAccess(mockSupabase, carlosViewerSession, unassignedUuid)).toBe(false);
    });
  });

  describe('Last Owner Protection Rule', () => {
    interface OrgMember {
      userId: string;
      role: 'owner' | 'admin' | 'designer' | 'viewer';
    }

    function evaluateCanDemoteOrDeleteMember(
      members: OrgMember[],
      targetUserId: string,
      newRole?: 'admin' | 'designer' | 'viewer'
    ): { allowed: boolean; reason?: string } {
      const target = members.find((m) => m.userId === targetUserId);
      if (!target) return { allowed: false, reason: 'Usuário não encontrado' };

      if (target.role === 'owner') {
        const ownerCount = members.filter((m) => m.role === 'owner').length;
        if (ownerCount <= 1) {
          return {
            allowed: false,
            reason: 'Não é permitido remover ou despromover o único Owner da organização.',
          };
        }
      }

      return { allowed: true };
    }

    it('blocks removing the sole owner of an organization', () => {
      const orgMembers: OrgMember[] = [
        { userId: 'sole-owner-1', role: 'owner' },
        { userId: 'admin-2', role: 'admin' },
        { userId: 'designer-3', role: 'designer' },
      ];

      const check = evaluateCanDemoteOrDeleteMember(orgMembers, 'sole-owner-1');
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('único Owner');
    });

    it('blocks demoting the sole owner of an organization', () => {
      const orgMembers: OrgMember[] = [
        { userId: 'sole-owner-1', role: 'owner' },
        { userId: 'designer-2', role: 'designer' },
      ];

      const check = evaluateCanDemoteOrDeleteMember(orgMembers, 'sole-owner-1', 'admin');
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('único Owner');
    });

    it('allows demoting or removing an owner if another owner remains', () => {
      const orgMembers: OrgMember[] = [
        { userId: 'owner-1', role: 'owner' },
        { userId: 'owner-2', role: 'owner' },
        { userId: 'admin-3', role: 'admin' },
      ];

      const check = evaluateCanDemoteOrDeleteMember(orgMembers, 'owner-1', 'admin');
      expect(check.allowed).toBe(true);
    });

    it('allows removing admins, designers and viewers freely', () => {
      const orgMembers: OrgMember[] = [
        { userId: 'owner-1', role: 'owner' },
        { userId: 'admin-1', role: 'admin' },
        { userId: 'designer-1', role: 'designer' },
      ];

      expect(evaluateCanDemoteOrDeleteMember(orgMembers, 'admin-1').allowed).toBe(true);
      expect(evaluateCanDemoteOrDeleteMember(orgMembers, 'designer-1').allowed).toBe(true);
    });
  });

  describe('Integration Credentials & AES-256-GCM Encryption', () => {
    const rawApiKey = 'sk-proj-testApiKeyForStudioFaUnitTesting1234567890abcdef8K2P';

    it('encrypts secret and returns valid 3-part GCM payload with last 4 characters', () => {
      const { encryptedSecret, lastFour } = encryptSecret(rawApiKey);

      expect(encryptedSecret).toBeTruthy();
      const parts = encryptedSecret.split(':');
      expect(parts.length).toBe(3); // iv : auth_tag : ciphertext
      expect(parts[0].length).toBe(24); // 12 bytes IV in hex
      expect(parts[1].length).toBe(32); // 16 bytes auth tag in hex
      expect(lastFour).toBe('8K2P');
    });

    it('successfully decrypts encrypted secret recovering exact plaintext', () => {
      const { encryptedSecret } = encryptSecret(rawApiKey);
      const decrypted = decryptSecret(encryptedSecret);
      expect(decrypted).toBe(rawApiKey);
    });

    it('rejects tampered ciphertext with GCM authentication tag validation failure', () => {
      const { encryptedSecret } = encryptSecret(rawApiKey);
      const parts = encryptedSecret.split(':');
      // Adulterar ciphertext
      const tamperedCiphertext = parts[2].slice(0, -2) + (parts[2].endsWith('a') ? 'b' : 'a');
      const tamperedPayload = `${parts[0]}:${parts[1]}:${tamperedCiphertext}`;

      expect(() => decryptSecret(tamperedPayload)).toThrow();
    });

    it('masks secret cleanly for UI presentation without revealing secret body', () => {
      const masked = maskSecret('8K2P');
      expect(masked).toBe('sk-proj-••••••••••8K2P');
      expect(masked.includes('testApiKey')).toBe(false);

      const defaultMask = maskSecret('');
      expect(defaultMask).toBe('sk-proj-••••••••••••••');
    });
  });

  describe('DevStore Enforcement & Single Source of Truth', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('strictly forbids devStore in production environment even if flag is set', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.STUDIO_FA_ENABLE_DEV_STORE = 'true';
      expect(isDevStoreAllowed()).toBe(false);
    });

    it('forbids devStore when flag is false or unset in development', () => {
      (process.env as any).NODE_ENV = 'development';
      process.env.STUDIO_FA_ENABLE_DEV_STORE = 'false';
      expect(isDevStoreAllowed()).toBe(false);

      delete process.env.STUDIO_FA_ENABLE_DEV_STORE;
      expect(isDevStoreAllowed()).toBe(false);
    });

    it('allows devStore ONLY when flag is explicitly true and not in production', () => {
      (process.env as any).NODE_ENV = 'development';
      process.env.STUDIO_FA_ENABLE_DEV_STORE = 'true';
      expect(isDevStoreAllowed()).toBe(true);
    });
  });
});
