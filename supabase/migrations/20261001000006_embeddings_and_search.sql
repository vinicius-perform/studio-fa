-- Migration: 20261001000006_embeddings_and_search.sql
-- Description: pgvector reference embeddings and multi-tenant isolated similarity search RPC

CREATE TABLE IF NOT EXISTS public.reference_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    client_id UUID NOT NULL REFERENCES public.clients(id),
    reference_id UUID NOT NULL REFERENCES public.brand_references(id) ON DELETE CASCADE,
    embedding vector(1536) NOT NULL,
    embedding_model TEXT NOT NULL,
    source_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ref_embeddings_org ON public.reference_embeddings(organization_id);
CREATE INDEX IF NOT EXISTS idx_ref_embeddings_client ON public.reference_embeddings(client_id);
CREATE INDEX IF NOT EXISTS idx_ref_embeddings_ref ON public.reference_embeddings(reference_id);

-- HNSW index for fast vector cosine similarity search
CREATE INDEX IF NOT EXISTS idx_ref_embeddings_vector_hnsw 
    ON public.reference_embeddings 
    USING hnsw (embedding vector_cosine_ops);

-- RLS: Reference Embeddings
ALTER TABLE public.reference_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view reference embeddings in their organization"
    ON public.reference_embeddings
    FOR SELECT
    TO authenticated
    USING (public.is_organization_member(organization_id, auth.uid()));

CREATE POLICY "Authorized roles can insert reference embeddings"
    ON public.reference_embeddings
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    );

CREATE POLICY "Owners, Admins, Managers can delete reference embeddings"
    ON public.reference_embeddings
    FOR DELETE
    TO authenticated
    USING (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager']::public.app_role[],
            auth.uid()
        )
    );

-- Secure Vector Search RPC
-- Strictly respects organization_id AND client_id boundaries
CREATE OR REPLACE FUNCTION public.match_brand_references(
    p_organization_id UUID,
    p_client_id UUID,
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    reference_id UUID,
    similarity FLOAT,
    source_text TEXT,
    title TEXT,
    reference_type public.reference_type,
    tags TEXT[],
    visual_features JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Verify organization membership
    IF NOT public.is_organization_member(p_organization_id, auth.uid()) THEN
        RAISE EXCEPTION 'Access denied to organization' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        re.id,
        re.reference_id,
        1 - (re.embedding <=> query_embedding) AS similarity,
        re.source_text,
        br.title,
        br.reference_type,
        br.tags,
        br.visual_features
    FROM public.reference_embeddings re
    JOIN public.brand_references br ON br.id = re.reference_id
    WHERE re.organization_id = p_organization_id
      AND re.client_id = p_client_id
      AND br.is_approved = true
      AND (1 - (re.embedding <=> query_embedding)) >= match_threshold
    ORDER BY re.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
