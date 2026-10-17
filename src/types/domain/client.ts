// src/types/domain/client.ts
import { z } from 'zod';
import type { Database, ClientStatus, BrandStatus } from '@/types/database';

export const CreateClientSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(2, 'Nome é obrigatório'),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  legal_name: z.string().optional(),
  niche: z.string().optional(),
  instagram_handle: z.string().optional(),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default('BR'),
  notes: z.string().optional(),
  status: z.enum(['active', 'paused', 'archived']).default('active'),
  brand_status: z.enum(['empty', 'collecting', 'analyzing', 'ready', 'needs_review']).default('empty'),
});

export const UpdateClientSchema = CreateClientSchema.partial().omit({ organization_id: true });

export type CreateClientInput = z.infer<typeof CreateClientSchema>;
export type UpdateClientInput = z.infer<typeof UpdateClientSchema>;

export type ClientRow = Database['public']['Tables']['clients']['Row'];
export type { ClientStatus, BrandStatus };
