-- ==============================================================================
-- STUDIO FA — FASE B: DELTA MIGRATION (13 & 14)
-- Execute este script no SQL Editor do Supabase para atualizar o banco para a Fase B:
-- https://supabase.com/dashboard/project/rfdossffdlayntmyqpnl/sql/new
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Migration 13: Novas colunas na tabela public.clients
-- ------------------------------------------------------------------------------
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS dna JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS manual_guidelines TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS visual_memory_status TEXT DEFAULT 'awaiting_references';

-- ------------------------------------------------------------------------------
-- 2. Migration 13: Tabela public.client_pieces
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_pieces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    title TEXT,
    original_filename TEXT NOT NULL,
    storage_bucket TEXT NOT NULL DEFAULT 'client-pieces',
    storage_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL,
    width INT,
    height INT,
    aspect_ratio NUMERIC(6, 4),
    format_type TEXT NOT NULL DEFAULT 'feed', -- 'feed', 'story', 'square', 'cover', 'custom'
    piece_type TEXT NOT NULL DEFAULT 'own_brand', -- 'own_brand', 'external_reference', 'promotional'
    analysis_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'queued', 'analyzing', 'completed', 'failed'
    analysis_json JSONB,
    analysis_model TEXT,
    analysis_prompt_version TEXT,
    analysis_error TEXT,
    analyzed_at TIMESTAMPTZ,
    quality_score NUMERIC(4, 2),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_pieces_org ON public.client_pieces(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_pieces_client ON public.client_pieces(client_id);
CREATE INDEX IF NOT EXISTS idx_client_pieces_status ON public.client_pieces(analysis_status);
CREATE INDEX IF NOT EXISTS idx_client_pieces_type ON public.client_pieces(piece_type);
CREATE INDEX IF NOT EXISTS idx_client_pieces_format ON public.client_pieces(format_type);

ALTER TABLE public.client_pieces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read client_pieces for assigned clients" ON public.client_pieces;
CREATE POLICY "Users can read client_pieces for assigned clients"
ON public.client_pieces
FOR SELECT
TO authenticated
USING (
    organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ) AND public.has_client_access(client_id, auth.uid())
);

DROP POLICY IF EXISTS "Authorized users can insert client_pieces" ON public.client_pieces;
CREATE POLICY "Authorized users can insert client_pieces"
ON public.client_pieces
FOR INSERT
TO authenticated
WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ) 
    AND public.has_client_access(client_id, auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE user_id = auth.uid() 
          AND organization_id = client_pieces.organization_id 
          AND role IN ('owner', 'admin', 'designer')
    )
);

DROP POLICY IF EXISTS "Authorized users can update client_pieces" ON public.client_pieces;
CREATE POLICY "Authorized users can update client_pieces"
ON public.client_pieces
FOR UPDATE
TO authenticated
USING (
    organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ) 
    AND public.has_client_access(client_id, auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE user_id = auth.uid() 
          AND organization_id = client_pieces.organization_id 
          AND role IN ('owner', 'admin', 'designer')
    )
);

DROP POLICY IF EXISTS "Admins and designers can delete client_pieces" ON public.client_pieces;
CREATE POLICY "Admins and designers can delete client_pieces"
ON public.client_pieces
FOR DELETE
TO authenticated
USING (
    organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ) 
    AND public.has_client_access(client_id, auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE user_id = auth.uid() 
          AND organization_id = client_pieces.organization_id 
          AND role IN ('owner', 'admin', 'designer')
    )
);

-- ------------------------------------------------------------------------------
-- 3. Migration 13: Buckets no Storage
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    (
        'client-pieces',
        'client-pieces',
        false,
        52428800, -- 50MB
        ARRAY['image/png', 'image/jpeg', 'image/webp']
    ),
    (
        'client-brand-assets',
        'client-brand-assets',
        false,
        52428800,
        ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf']
    ),
    (
        'custom-fonts',
        'custom-fonts',
        false,
        20971520, -- 20MB
        ARRAY['font/ttf', 'font/otf', 'font/woff', 'font/woff2', 'application/x-font-ttf', 'application/x-font-otf', 'application/font-woff', 'application/font-woff2']
    )
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ------------------------------------------------------------------------------
-- 4. Migration 14: Tabela public.brand_dna_versions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brand_dna_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'ready', -- 'ready', 'needs_refresh', 'archived'
    profile_json JSONB NOT NULL,
    source_piece_ids UUID[] DEFAULT '{}',
    model TEXT,
    prompt_version TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_brand_dna_versions_org ON public.brand_dna_versions(organization_id);
CREATE INDEX IF NOT EXISTS idx_brand_dna_versions_client ON public.brand_dna_versions(client_id);
CREATE INDEX IF NOT EXISTS idx_brand_dna_versions_version ON public.brand_dna_versions(client_id, version DESC);

ALTER TABLE public.brand_dna_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read brand_dna_versions for assigned clients" ON public.brand_dna_versions;
CREATE POLICY "Users can read brand_dna_versions for assigned clients"
ON public.brand_dna_versions
FOR SELECT
TO authenticated
USING (
    organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ) AND public.has_client_access(client_id, auth.uid())
);

DROP POLICY IF EXISTS "Authorized users can insert brand_dna_versions" ON public.brand_dna_versions;
CREATE POLICY "Authorized users can insert brand_dna_versions"
ON public.brand_dna_versions
FOR INSERT
TO authenticated
WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ) 
    AND public.has_client_access(client_id, auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE user_id = auth.uid() 
          AND organization_id = brand_dna_versions.organization_id 
          AND role IN ('owner', 'admin', 'designer')
    )
);

COMMIT;
