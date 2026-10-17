// src/types/domain/organization.ts
import { z } from 'zod';
import type { Database, AppRole } from '@/types/database';

export const OrganizationSettingsSchema = z.object({
  timezone: z.string().default('America/Sao_Paulo'),
  default_locale: z.string().default('pt-BR'),
  primary_brand_color: z.string().default('#CEF52A'),
  allowed_formats: z.array(z.string()).default([
    'instagram_feed_4_5',
    'instagram_square',
    'instagram_story',
    'custom',
  ]),
  export_defaults: z.record(z.unknown()).default({}),
  ai_preferences: z.record(z.unknown()).default({}),
});

export const CreateOrganizationSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  logo_path: z.string().optional(),
  settings: OrganizationSettingsSchema.default({}),
});

export const AddOrganizationMemberSchema = z.object({
  organization_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'manager', 'designer', 'viewer']),
});

export type OrganizationSettings = z.infer<typeof OrganizationSettingsSchema>;
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;
export type AddOrganizationMemberInput = z.infer<typeof AddOrganizationMemberSchema>;

export type OrganizationRow = Database['public']['Tables']['organizations']['Row'];
export type OrganizationMemberRow = Database['public']['Tables']['organization_members']['Row'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type { AppRole };
