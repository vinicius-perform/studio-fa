-- supabase/migrations/20261001000014_brand_dna_versions.sql
-- FASE B: Histórico e Versionamento do Brand DNA com Rastreabilidade de Peças Fonte

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

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_brand_dna_versions_org ON public.brand_dna_versions(organization_id);
CREATE INDEX IF NOT EXISTS idx_brand_dna_versions_client ON public.brand_dna_versions(client_id);
CREATE INDEX IF NOT EXISTS idx_brand_dna_versions_version ON public.brand_dna_versions(client_id, version DESC);

-- Habilitar RLS
ALTER TABLE public.brand_dna_versions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
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
