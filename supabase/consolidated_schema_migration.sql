-- ==============================================================================
-- STUDIO FA — SINCRONIZACAO COMPLETA DO BANCO DE DADOS (SCHEMA BASE + FASE A)
-- Ordem sequencial das migrations 01 a 12
-- Projeto: rfdossffdlayntmyqpnl (https://rfdossffdlayntmyqpnl.supabase.co)
-- ==============================================================================

BEGIN;


-- ==============================================================================
-- INICIO MIGRATION: 20261001000001_extensions_and_helpers.sql
-- ==============================================================================

-- Migration: 20261001000001_extensions_and_helpers.sql
-- Description: Initialize core extensions and generic utility functions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;



-- ==============================================================================
-- INICIO MIGRATION: 20261001000002_profiles_and_auth.sql
-- ==============================================================================

-- Migration: 20261001000002_profiles_and_auth.sql
-- Description: Profiles table, automatic user profile trigger, and RLS

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Trigger updated_at on profiles
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Trigger to create profile when auth.users is created
-- Note: Does NOT grant any organization access
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies:
-- 1. Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- 2. Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);



-- ==============================================================================
-- INICIO MIGRATION: 20261001000003_organizations_and_members.sql
-- ==============================================================================

-- Migration: 20261001000003_organizations_and_members.sql
-- Description: Multi-organization model, organization_members, app_role enum, reusable SQL helpers, and RLS

-- Role Enum
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'manager', 'designer', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Organizations Table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_path TEXT,
    settings JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Organization Members Table
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role public.app_role NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_organization_member UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);

CREATE TRIGGER trg_organization_members_updated_at
    BEFORE UPDATE ON public.organization_members
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Reusable SQL Functions for RLS
CREATE OR REPLACE FUNCTION public.is_organization_member(
    p_org_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.organization_members
        WHERE organization_id = p_org_id
          AND user_id = p_user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.has_organization_role(
    p_org_id UUID,
    p_roles public.app_role[],
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.organization_members
        WHERE organization_id = p_org_id
          AND user_id = p_user_id
          AND role = ANY(p_roles)
    );
$$;

CREATE OR REPLACE FUNCTION public.get_user_organization_role(
    p_org_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT role
    FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id = p_user_id
    LIMIT 1;
$$;

-- Allow members to view profiles of teammates in the same organization
CREATE POLICY "Users can view members of their organizations"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid() OR
        EXISTS (
            SELECT 1
            FROM public.organization_members m1
            JOIN public.organization_members m2 ON m1.organization_id = m2.organization_id
            WHERE m1.user_id = auth.uid()
              AND m2.user_id = public.profiles.id
        )
    );

-- Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their organizations"
    ON public.organizations
    FOR SELECT
    TO authenticated
    USING (public.is_organization_member(id, auth.uid()));

CREATE POLICY "Owners and Admins can update their organizations"
    ON public.organizations
    FOR UPDATE
    TO authenticated
    USING (public.has_organization_role(id, ARRAY['owner', 'admin']::public.app_role[], auth.uid()))
    WITH CHECK (public.has_organization_role(id, ARRAY['owner', 'admin']::public.app_role[], auth.uid()));

-- Enable RLS on organization_members
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view organization member lists"
    ON public.organization_members
    FOR SELECT
    TO authenticated
    USING (public.is_organization_member(organization_id, auth.uid()));

CREATE POLICY "Owners and Admins can insert organization members"
    ON public.organization_members
    FOR INSERT
    TO authenticated
    WITH CHECK (public.has_organization_role(organization_id, ARRAY['owner', 'admin']::public.app_role[], auth.uid()));

CREATE POLICY "Owners and Admins can update organization members"
    ON public.organization_members
    FOR UPDATE
    TO authenticated
    USING (public.has_organization_role(organization_id, ARRAY['owner', 'admin']::public.app_role[], auth.uid()))
    WITH CHECK (public.has_organization_role(organization_id, ARRAY['owner', 'admin']::public.app_role[], auth.uid()));

CREATE POLICY "Owners and Admins can delete organization members"
    ON public.organization_members
    FOR DELETE
    TO authenticated
    USING (public.has_organization_role(organization_id, ARRAY['owner', 'admin']::public.app_role[], auth.uid()));



-- ==============================================================================
-- INICIO MIGRATION: 20261001000004_clients_and_assets.sql
-- ==============================================================================

-- Migration: 20261001000004_clients_and_assets.sql
-- Description: Clients and Client Assets tables, enums, triggers, and RLS

DO $$ BEGIN
    CREATE TYPE public.client_status AS ENUM ('active', 'paused', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.brand_status AS ENUM ('empty', 'collecting', 'analyzing', 'ready', 'needs_review');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.asset_type AS ENUM (
        'logo_primary',
        'logo_secondary',
        'logo_monochrome',
        'font',
        'brand_manual',
        'icon',
        'graphic_element',
        'reference_art',
        'client_photo',
        'base_image',
        'generated_image',
        'export',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Clients Table
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    legal_name TEXT,
    niche TEXT,
    instagram_handle TEXT,
    website TEXT,
    city TEXT,
    state TEXT,
    country TEXT DEFAULT 'BR' NOT NULL,
    notes TEXT,
    status public.client_status DEFAULT 'active' NOT NULL,
    brand_status public.brand_status DEFAULT 'empty' NOT NULL,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    archived_at TIMESTAMPTZ,
    CONSTRAINT uq_client_org_slug UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_clients_org ON public.clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_brand_status ON public.clients(brand_status);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(name);

CREATE TRIGGER trg_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Client Assets Table
CREATE TABLE IF NOT EXISTS public.client_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    client_id UUID NOT NULL REFERENCES public.clients(id),
    asset_type public.asset_type NOT NULL,
    label TEXT,
    storage_bucket TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    width INT,
    height INT,
    has_alpha BOOLEAN,
    checksum TEXT,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    uploaded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_client_assets_client_id ON public.client_assets(client_id);
CREATE INDEX IF NOT EXISTS idx_client_assets_org_id ON public.client_assets(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_assets_type ON public.client_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_client_assets_bucket ON public.client_assets(storage_bucket);

CREATE TRIGGER trg_client_assets_updated_at
    BEFORE UPDATE ON public.client_assets
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- RLS: Clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view clients in their organization"
    ON public.clients
    FOR SELECT
    TO authenticated
    USING (public.is_organization_member(organization_id, auth.uid()));

CREATE POLICY "Owners, Admins, Managers can insert clients"
    ON public.clients
    FOR INSERT
    TO authenticated
    WITH CHECK (public.has_organization_role(organization_id, ARRAY['owner', 'admin', 'manager']::public.app_role[], auth.uid()));

CREATE POLICY "Owners, Admins, Managers can update clients"
    ON public.clients
    FOR UPDATE
    TO authenticated
    USING (public.has_organization_role(organization_id, ARRAY['owner', 'admin', 'manager']::public.app_role[], auth.uid()))
    WITH CHECK (public.has_organization_role(organization_id, ARRAY['owner', 'admin', 'manager']::public.app_role[], auth.uid()));

-- RLS: Client Assets
ALTER TABLE public.client_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view client assets in their organization"
    ON public.client_assets
    FOR SELECT
    TO authenticated
    USING (public.is_organization_member(organization_id, auth.uid()));

CREATE POLICY "Authorized roles can insert client assets"
    ON public.client_assets
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    );

CREATE POLICY "Authorized roles can update client assets"
    ON public.client_assets
    FOR UPDATE
    TO authenticated
    USING (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    )
    WITH CHECK (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    );

CREATE POLICY "Owners, Admins, Managers can delete client assets"
    ON public.client_assets
    FOR DELETE
    TO authenticated
    USING (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager']::public.app_role[],
            auth.uid()
        )
    );



-- ==============================================================================
-- INICIO MIGRATION: 20261001000005_brand_references_and_profiles.sql
-- ==============================================================================

-- Migration: 20261001000005_brand_references_and_profiles.sql
-- Description: Brand References and Brand Profiles tables, single approved profile constraint, and atomic approval RPC

DO $$ BEGIN
    CREATE TYPE public.reference_type AS ENUM (
        'instagram_post',
        'carousel',
        'story',
        'advertisement',
        'cover',
        'branding',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.brand_profile_status AS ENUM (
        'draft',
        'analyzing',
        'needs_review',
        'approved',
        'superseded',
        'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.brand_profile_source AS ENUM ('ai', 'manual', 'hybrid');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Brand References Table
CREATE TABLE IF NOT EXISTS public.brand_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    client_id UUID NOT NULL REFERENCES public.clients(id),
    asset_id UUID REFERENCES public.client_assets(id),
    title TEXT,
    description TEXT,
    reference_type public.reference_type DEFAULT 'other' NOT NULL,
    tags TEXT[] DEFAULT '{}'::text[] NOT NULL,
    ai_description TEXT,
    visual_features JSONB DEFAULT '{}'::jsonb NOT NULL,
    quality_score NUMERIC,
    is_approved BOOLEAN DEFAULT true NOT NULL,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_brand_refs_client ON public.brand_references(client_id);
CREATE INDEX IF NOT EXISTS idx_brand_refs_org ON public.brand_references(organization_id);
CREATE INDEX IF NOT EXISTS idx_brand_refs_asset ON public.brand_references(asset_id);

CREATE TRIGGER trg_brand_references_updated_at
    BEFORE UPDATE ON public.brand_references
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Brand Profiles Table (Structured visual memory)
CREATE TABLE IF NOT EXISTS public.brand_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    client_id UUID NOT NULL REFERENCES public.clients(id),
    version INT NOT NULL,
    status public.brand_profile_status DEFAULT 'draft' NOT NULL,
    source public.brand_profile_source DEFAULT 'ai' NOT NULL,
    summary TEXT NOT NULL,
    colors JSONB NOT NULL,
    typography JSONB NOT NULL,
    composition JSONB NOT NULL,
    photography JSONB NOT NULL,
    logo_usage JSONB NOT NULL,
    graphical_elements JSONB NOT NULL,
    visual_style JSONB NOT NULL,
    content_style JSONB NOT NULL,
    spacing_rules JSONB NOT NULL,
    dos JSONB NOT NULL,
    donts JSONB NOT NULL,
    raw_analysis JSONB DEFAULT '{}'::jsonb NOT NULL,
    confidence_score NUMERIC,
    created_by UUID REFERENCES public.profiles(id),
    approved_by UUID REFERENCES public.profiles(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_brand_profiles_client_version UNIQUE (client_id, version)
);

CREATE INDEX IF NOT EXISTS idx_brand_profiles_client ON public.brand_profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_brand_profiles_org ON public.brand_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_brand_profiles_status ON public.brand_profiles(status);

-- Partial index: strictly at most ONE approved profile per client
CREATE UNIQUE INDEX IF NOT EXISTS uq_brand_profiles_single_approved 
    ON public.brand_profiles(client_id) 
    WHERE (status = 'approved');

CREATE TRIGGER trg_brand_profiles_updated_at
    BEFORE UPDATE ON public.brand_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- RLS: Brand References
ALTER TABLE public.brand_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view brand references in their organization"
    ON public.brand_references
    FOR SELECT
    TO authenticated
    USING (public.is_organization_member(organization_id, auth.uid()));

CREATE POLICY "Authorized roles can insert brand references"
    ON public.brand_references
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    );

CREATE POLICY "Authorized roles can update brand references"
    ON public.brand_references
    FOR UPDATE
    TO authenticated
    USING (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    )
    WITH CHECK (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    );

CREATE POLICY "Owners, Admins, Managers can delete brand references"
    ON public.brand_references
    FOR DELETE
    TO authenticated
    USING (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager']::public.app_role[],
            auth.uid()
        )
    );

-- RLS: Brand Profiles
ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view brand profiles in their organization"
    ON public.brand_profiles
    FOR SELECT
    TO authenticated
    USING (public.is_organization_member(organization_id, auth.uid()));

CREATE POLICY "Owners, Admins, Managers can insert brand profiles"
    ON public.brand_profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager']::public.app_role[],
            auth.uid()
        )
    );

CREATE POLICY "Owners, Admins, Managers can update brand profiles"
    ON public.brand_profiles
    FOR UPDATE
    TO authenticated
    USING (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager']::public.app_role[],
            auth.uid()
        )
    )
    WITH CHECK (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager']::public.app_role[],
            auth.uid()
        )
    );

-- Atomic Brand Profile Approval Function
CREATE OR REPLACE FUNCTION public.approve_brand_profile(p_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_profile RECORD;
    v_caller_id UUID;
    v_has_permission BOOLEAN;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;

    -- Fetch target profile
    SELECT * INTO v_profile
    FROM public.brand_profiles
    WHERE id = p_profile_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Brand profile not found' USING ERRCODE = 'P0002';
    END IF;

    -- Validate permission (owner, admin, manager)
    v_has_permission := public.has_organization_role(
        v_profile.organization_id,
        ARRAY['owner', 'admin', 'manager']::public.app_role[],
        v_caller_id
    );

    IF NOT v_has_permission THEN
        RAISE EXCEPTION 'Insufficient permissions to approve brand profile' USING ERRCODE = '42501';
    END IF;

    -- Atomic transition:
    -- 1. Mark existing approved profile as superseded
    UPDATE public.brand_profiles
    SET status = 'superseded',
        updated_at = now()
    WHERE client_id = v_profile.client_id
      AND status = 'approved'
      AND id != p_profile_id;

    -- 2. Approve new profile
    UPDATE public.brand_profiles
    SET status = 'approved',
        approved_by = v_caller_id,
        approved_at = now(),
        updated_at = now()
    WHERE id = p_profile_id;

    -- 3. Update client brand_status to 'ready'
    UPDATE public.clients
    SET brand_status = 'ready',
        updated_at = now()
    WHERE id = v_profile.client_id;

    -- Return outcome
    RETURN jsonb_build_object(
        'success', true,
        'profile_id', p_profile_id,
        'client_id', v_profile.client_id,
        'version', v_profile.version,
        'status', 'approved'
    );
END;
$$;



-- ==============================================================================
-- INICIO MIGRATION: 20261001000006_embeddings_and_search.sql
-- ==============================================================================

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



-- ==============================================================================
-- INICIO MIGRATION: 20261001000007_projects_and_slides.sql
-- ==============================================================================

-- Migration: 20261001000007_projects_and_slides.sql
-- Description: Projects, Project Slides, Project Versions tables, enums, triggers, and RLS

DO $$ BEGIN
    CREATE TYPE public.project_type AS ENUM ('single_post', 'carousel');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.project_status AS ENUM (
        'draft',
        'ready',
        'queued',
        'generating',
        'review',
        'changes_requested',
        'approved',
        'exporting',
        'exported',
        'failed',
        'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.project_format AS ENUM (
        'instagram_feed_4_5',
        'instagram_square',
        'instagram_story',
        'custom'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.slide_status AS ENUM (
        'draft',
        'ready',
        'generating',
        'review',
        'approved',
        'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    client_id UUID NOT NULL REFERENCES public.clients(id),
    title TEXT,
    project_type public.project_type DEFAULT 'single_post' NOT NULL,
    status public.project_status DEFAULT 'draft' NOT NULL,
    format public.project_format DEFAULT 'instagram_feed_4_5' NOT NULL,
    width INT,
    height INT,
    generation_mode TEXT,
    brief TEXT,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_by UUID REFERENCES public.profiles(id),
    assigned_to UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    approved_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_projects_org ON public.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_client ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_assigned ON public.projects(assigned_to);

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Project Slides Table
CREATE TABLE IF NOT EXISTS public.project_slides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    slide_index INT NOT NULL,
    slide_type TEXT,
    title TEXT,
    subtitle TEXT,
    body TEXT,
    cta TEXT,
    instructions TEXT,
    base_asset_id UUID REFERENCES public.client_assets(id),
    status public.slide_status DEFAULT 'draft' NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_project_slide_index UNIQUE (project_id, slide_index)
);

CREATE INDEX IF NOT EXISTS idx_project_slides_project ON public.project_slides(project_id);
CREATE INDEX IF NOT EXISTS idx_project_slides_org ON public.project_slides(organization_id);

CREATE TRIGGER trg_project_slides_updated_at
    BEFORE UPDATE ON public.project_slides
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Project Versions Table (Snapshots of important milestones)
CREATE TABLE IF NOT EXISTS public.project_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    project_id UUID NOT NULL REFERENCES public.projects(id),
    version_number INT NOT NULL,
    snapshot JSONB NOT NULL,
    label TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_project_version_number UNIQUE (project_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_project_versions_project ON public.project_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_versions_org ON public.project_versions(organization_id);

-- RLS: Projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view projects in their organization"
    ON public.projects
    FOR SELECT
    TO authenticated
    USING (public.is_organization_member(organization_id, auth.uid()));

CREATE POLICY "Authorized roles can insert projects"
    ON public.projects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    );

CREATE POLICY "Authorized roles can update projects"
    ON public.projects
    FOR UPDATE
    TO authenticated
    USING (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    )
    WITH CHECK (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    );

-- RLS: Project Slides
ALTER TABLE public.project_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view slides in their organization"
    ON public.project_slides
    FOR SELECT
    TO authenticated
    USING (public.is_organization_member(organization_id, auth.uid()));

CREATE POLICY "Authorized roles can insert slides"
    ON public.project_slides
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    );

CREATE POLICY "Authorized roles can update slides"
    ON public.project_slides
    FOR UPDATE
    TO authenticated
    USING (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    )
    WITH CHECK (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    );

CREATE POLICY "Authorized roles can delete slides"
    ON public.project_slides
    FOR DELETE
    TO authenticated
    USING (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    );

-- RLS: Project Versions
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view project versions in their organization"
    ON public.project_versions
    FOR SELECT
    TO authenticated
    USING (public.is_organization_member(organization_id, auth.uid()));

CREATE POLICY "Authorized roles can insert project versions"
    ON public.project_versions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    );



-- ==============================================================================
-- INICIO MIGRATION: 20261001000008_ai_system_and_governance.sql
-- ==============================================================================

-- Migration: 20261001000008_ai_system_and_governance.sql
-- Description: AI generation requests, outputs, usage events, jobs, approvals, and audit logs

DO $$ BEGIN
    CREATE TYPE public.generation_operation_type AS ENUM (
        'brand_analysis',
        'reference_analysis',
        'embedding',
        'image_generate',
        'image_edit',
        'variation',
        'background_generate',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.generation_request_status AS ENUM (
        'queued',
        'processing',
        'completed',
        'failed',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.generation_output_type AS ENUM (
        'preview',
        'background',
        'edited_image',
        'composite',
        'final',
        'auxiliary'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.ai_job_type AS ENUM (
        'analyze_brand',
        'analyze_reference',
        'create_embedding',
        'generate_image',
        'edit_image',
        'generate_variation'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.ai_job_status AS ENUM (
        'queued',
        'processing',
        'completed',
        'failed',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.approval_status AS ENUM (
        'pending',
        'approved',
        'changes_requested',
        'rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Generation Requests Table (Auditability and Input Snapshots)
CREATE TABLE IF NOT EXISTS public.generation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    client_id UUID NOT NULL REFERENCES public.clients(id),
    project_id UUID REFERENCES public.projects(id),
    slide_id UUID REFERENCES public.project_slides(id),
    requested_by UUID REFERENCES public.profiles(id),
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    operation_type public.generation_operation_type NOT NULL,
    status public.generation_request_status DEFAULT 'queued' NOT NULL,
    prompt TEXT NOT NULL,
    system_context TEXT,
    input_snapshot JSONB NOT NULL,
    parameters JSONB DEFAULT '{}'::jsonb NOT NULL,
    provider_request_id TEXT,
    idempotency_key TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_code TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gen_req_org ON public.generation_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_gen_req_client ON public.generation_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_gen_req_project ON public.generation_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_gen_req_slide ON public.generation_requests(slide_id);
CREATE INDEX IF NOT EXISTS idx_gen_req_status ON public.generation_requests(status);
CREATE INDEX IF NOT EXISTS idx_gen_req_idempotency ON public.generation_requests(idempotency_key);

-- Generation Outputs Table
CREATE TABLE IF NOT EXISTS public.generation_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    generation_request_id UUID NOT NULL REFERENCES public.generation_requests(id),
    asset_id UUID NOT NULL REFERENCES public.client_assets(id),
    output_type public.generation_output_type NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gen_out_request ON public.generation_outputs(generation_request_id);
CREATE INDEX IF NOT EXISTS idx_gen_out_asset ON public.generation_outputs(asset_id);
CREATE INDEX IF NOT EXISTS idx_gen_out_org ON public.generation_outputs(organization_id);

-- Approvals Table
CREATE TABLE IF NOT EXISTS public.approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    status public.approval_status DEFAULT 'pending' NOT NULL,
    requested_by UUID REFERENCES public.profiles(id),
    reviewed_by UUID REFERENCES public.profiles(id),
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_approvals_org ON public.approvals(organization_id);
CREATE INDEX IF NOT EXISTS idx_approvals_entity ON public.approvals(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON public.approvals(status);

-- AI Usage Events Table (Token metrics & Cost governance)
CREATE TABLE IF NOT EXISTS public.ai_usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    client_id UUID REFERENCES public.clients(id),
    user_id UUID REFERENCES public.profiles(id),
    project_id UUID REFERENCES public.projects(id),
    slide_id UUID REFERENCES public.project_slides(id),
    generation_request_id UUID REFERENCES public.generation_requests(id),
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    input_text_tokens INT,
    input_image_tokens INT,
    output_text_tokens INT,
    output_image_tokens INT,
    total_tokens INT,
    estimated_cost_usd NUMERIC(10, 6) DEFAULT 0 NOT NULL,
    actual_cost_usd NUMERIC(10, 6),
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_org ON public.ai_usage_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_client ON public.ai_usage_events(client_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON public.ai_usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_project ON public.ai_usage_events(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON public.ai_usage_events(created_at);

-- AI Jobs Table (Queue and Idempotency Infrastructure)
CREATE TABLE IF NOT EXISTS public.ai_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    client_id UUID REFERENCES public.clients(id),
    project_id UUID REFERENCES public.projects(id),
    slide_id UUID REFERENCES public.project_slides(id),
    job_type public.ai_job_type NOT NULL,
    status public.ai_job_status DEFAULT 'queued' NOT NULL,
    priority INT DEFAULT 0 NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb NOT NULL,
    attempts INT DEFAULT 0 NOT NULL,
    max_attempts INT DEFAULT 3 NOT NULL,
    last_error TEXT,
    requested_by UUID REFERENCES public.profiles(id),
    idempotency_key TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON public.ai_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_org ON public.ai_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_priority ON public.ai_jobs(priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_idempotency ON public.ai_jobs(idempotency_key);

-- Audit Logs Table (Strict security: never store passwords, secrets, or raw keys)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_org ON public.audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at DESC);

-- Audit log helper
CREATE OR REPLACE FUNCTION public.create_audit_log(
    p_org_id UUID,
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID DEFAULT NULL,
    p_old_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.audit_logs (
        organization_id,
        user_id,
        action,
        entity_type,
        entity_id,
        old_data,
        new_data,
        metadata
    ) VALUES (
        p_org_id,
        auth.uid(),
        p_action,
        p_entity_type,
        p_entity_id,
        p_old_data,
        p_new_data,
        p_metadata
    ) RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

-- RLS: Generation Requests
ALTER TABLE public.generation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view generation requests in their organization"
    ON public.generation_requests
    FOR SELECT
    TO authenticated
    USING (public.is_organization_member(organization_id, auth.uid()));

CREATE POLICY "Authorized roles can insert generation requests"
    ON public.generation_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    );

-- RLS: Generation Outputs
ALTER TABLE public.generation_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view generation outputs in their organization"
    ON public.generation_outputs
    FOR SELECT
    TO authenticated
    USING (public.is_organization_member(organization_id, auth.uid()));

CREATE POLICY "Authorized roles can insert generation outputs"
    ON public.generation_outputs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    );

-- RLS: Approvals
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view approvals in their organization"
    ON public.approvals
    FOR SELECT
    TO authenticated
    USING (public.is_organization_member(organization_id, auth.uid()));

CREATE POLICY "Authorized roles can insert approval requests"
    ON public.approvals
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    );

CREATE POLICY "Managers and Admins can update approvals"
    ON public.approvals
    FOR UPDATE
    TO authenticated
    USING (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager']::public.app_role[],
            auth.uid()
        )
    )
    WITH CHECK (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager']::public.app_role[],
            auth.uid()
        )
    );

-- RLS: AI Usage Events
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view AI usage events in their organization"
    ON public.ai_usage_events
    FOR SELECT
    TO authenticated
    USING (public.is_organization_member(organization_id, auth.uid()));

CREATE POLICY "Authorized roles can record AI usage events"
    ON public.ai_usage_events
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    );

-- RLS: AI Jobs
ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view AI jobs in their organization"
    ON public.ai_jobs
    FOR SELECT
    TO authenticated
    USING (public.is_organization_member(organization_id, auth.uid()));

CREATE POLICY "Authorized roles can insert AI jobs"
    ON public.ai_jobs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    );

-- RLS: Audit Logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and Admins can view audit logs"
    ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin']::public.app_role[],
            auth.uid()
        )
    );



-- ==============================================================================
-- INICIO MIGRATION: 20261001000009_storage_and_storage_policies.sql
-- ==============================================================================

-- Migration: 20261001000009_storage_and_storage_policies.sql
-- Description: 5 Private storage buckets, path validation, and multi-tenant Storage RLS policies

-- Insert the 5 private buckets into storage.buckets if they do not exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    (
        'client-brand-assets',
        'client-brand-assets',
        false,
        52428800, -- 50MB
        ARRAY[
            'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml',
            'application/pdf',
            'font/ttf', 'font/otf', 'font/woff', 'font/woff2', 'application/x-font-ttf', 'application/x-font-otf'
        ]
    ),
    (
        'brand-references',
        'brand-references',
        false,
        52428800, -- 50MB
        ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
    ),
    (
        'client-inputs',
        'client-inputs',
        false,
        52428800, -- 50MB
        ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
    ),
    (
        'generated-assets',
        'generated-assets',
        false,
        52428800, -- 50MB
        ARRAY['image/png', 'image/jpeg', 'image/webp']
    ),
    (
        'exports',
        'exports',
        false,
        104857600, -- 100MB
        ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'application/zip']
    )
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Helper function to validate path structure and tenant isolation
-- Path format required: {organization_id}/{client_id}/{category}/{filename}
CREATE OR REPLACE FUNCTION public.get_storage_path_org_id(p_path TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_first_part TEXT;
BEGIN
    v_first_part := split_part(p_path, '/', 1);
    IF v_first_part ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN v_first_part::UUID;
    END IF;
    RETURN NULL;
END;
$$;

-- Insercao dos buckets e helper function (executados com sucesso)
-- As policies diretas em storage.objects sao opcionais no SQL Editor caso o usuario postgres
-- nao seja superuser/owner da tabela storage.objects no cluster Supabase gerenciado.
DO $$
BEGIN
    -- Tentativa segura de aplicar RLS e policies em storage.objects (se permitido pelo cluster)
    BEGIN
        ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Studio FA: Org members can read authorized buckets" ON storage.objects;
        CREATE POLICY "Studio FA: Org members can read authorized buckets"
            ON storage.objects FOR SELECT TO authenticated
            USING (
                bucket_id IN ('client-brand-assets', 'brand-references', 'client-inputs', 'generated-assets', 'exports')
                AND public.is_organization_member(public.get_storage_path_org_id(name), auth.uid())
            );

        DROP POLICY IF EXISTS "Studio FA: Authorized upload by role" ON storage.objects;
        CREATE POLICY "Studio FA: Authorized upload by role"
            ON storage.objects FOR INSERT TO authenticated
            WITH CHECK (
                bucket_id IN ('client-brand-assets', 'brand-references', 'client-inputs', 'generated-assets', 'exports')
                AND public.get_storage_path_org_id(name) IS NOT NULL
                AND (
                    public.has_organization_role(
                        public.get_storage_path_org_id(name),
                        ARRAY['owner', 'admin', 'manager']::public.app_role[],
                        auth.uid()
                    )
                    OR (
                        public.has_organization_role(
                            public.get_storage_path_org_id(name),
                            ARRAY['designer']::public.app_role[],
                            auth.uid()
                        )
                        AND bucket_id IN ('client-inputs', 'generated-assets', 'brand-references')
                    )
                )
            );

        DROP POLICY IF EXISTS "Studio FA: Authorized update by role" ON storage.objects;
        CREATE POLICY "Studio FA: Authorized update by role"
            ON storage.objects FOR UPDATE TO authenticated
            USING (
                bucket_id IN ('client-brand-assets', 'brand-references', 'client-inputs', 'generated-assets', 'exports')
                AND public.has_organization_role(
                    public.get_storage_path_org_id(name),
                    ARRAY['owner', 'admin', 'manager']::public.app_role[],
                    auth.uid()
                )
            )
            WITH CHECK (
                bucket_id IN ('client-brand-assets', 'brand-references', 'client-inputs', 'generated-assets', 'exports')
                AND public.has_organization_role(
                    public.get_storage_path_org_id(name),
                    ARRAY['owner', 'admin', 'manager']::public.app_role[],
                    auth.uid()
                )
            );

        DROP POLICY IF EXISTS "Studio FA: Authorized delete by role" ON storage.objects;
        CREATE POLICY "Studio FA: Authorized delete by role"
            ON storage.objects FOR DELETE TO authenticated
            USING (
                bucket_id IN ('client-brand-assets', 'brand-references', 'client-inputs', 'generated-assets', 'exports')
                AND public.has_organization_role(
                    public.get_storage_path_org_id(name),
                    ARRAY['owner', 'admin', 'manager']::public.app_role[],
                    auth.uid()
                )
            );
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE 'Aviso: Permissao insuficiente para alterar storage.objects diretamente (gerenciado por supabase_storage_admin). Policies de storage podem ser gerenciadas pelo Storage Dashboard.';
    END;
END $$;




-- ==============================================================================
-- INICIO MIGRATION: 20261001000010_initial_seed_fa.sql
-- ==============================================================================

-- Migration: 20261001000010_initial_seed_fa.sql
-- Description: Initial seed for default organization 'FA' (idempotent, does not bind unauthorized users)

INSERT INTO public.organizations (name, slug, settings)
VALUES (
    'FA',
    'fa',
    jsonb_build_object(
        'timezone', 'America/Sao_Paulo',
        'default_locale', 'pt-BR',
        'primary_brand_color', '#CEF52A',
        'allowed_formats', jsonb_build_array('instagram_feed_4_5', 'instagram_square', 'instagram_story', 'custom'),
        'ai_preferences', jsonb_build_object(
            'default_provider', 'openai',
            'quality_threshold', 0.75
        )
    )
)
ON CONFLICT (slug) DO NOTHING;



-- ==============================================================================
-- INICIO MIGRATION: 20261001000011_phase3_studio_editor.sql
-- ==============================================================================

-- Migration: 20261001000011_phase3_studio_editor.sql
-- Description: Phase 3 Studio Editor tables: project_creative_plans, slide_compositions, design_templates, triggers and RLS

-- 1. Project Creative Plans Table
CREATE TABLE IF NOT EXISTS public.project_creative_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    version INT DEFAULT 1 NOT NULL,
    brand_profile_id UUID REFERENCES public.brand_profiles(id),
    status TEXT DEFAULT 'draft' NOT NULL,
    global_direction JSONB DEFAULT '{}'::jsonb NOT NULL,
    slide_plans JSONB DEFAULT '[]'::jsonb NOT NULL,
    selected_reference_ids JSONB DEFAULT '[]'::jsonb NOT NULL,
    provider TEXT,
    model TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_creative_plans_project ON public.project_creative_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_creative_plans_org ON public.project_creative_plans(organization_id);

CREATE TRIGGER trg_creative_plans_updated_at
    BEFORE UPDATE ON public.project_creative_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 2. Slide Compositions Table (Editable Konva / layer document)
CREATE TABLE IF NOT EXISTS public.slide_compositions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    slide_id UUID NOT NULL REFERENCES public.project_slides(id) ON DELETE CASCADE,
    document JSONB DEFAULT '{}'::jsonb NOT NULL,
    revision INT DEFAULT 1 NOT NULL,
    preview_asset_id UUID REFERENCES public.client_assets(id),
    created_by UUID REFERENCES public.profiles(id),
    updated_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_slide_composition_slide UNIQUE (slide_id)
);

CREATE INDEX IF NOT EXISTS idx_compositions_slide ON public.slide_compositions(slide_id);
CREATE INDEX IF NOT EXISTS idx_compositions_project ON public.slide_compositions(project_id);
CREATE INDEX IF NOT EXISTS idx_compositions_org ON public.slide_compositions(organization_id);

CREATE TRIGGER trg_compositions_updated_at
    BEFORE UPDATE ON public.slide_compositions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 3. Design Templates Table (Internal reusable templates)
CREATE TABLE IF NOT EXISTS public.design_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    client_id UUID REFERENCES public.clients(id),
    name TEXT NOT NULL,
    format public.project_format NOT NULL,
    document JSONB NOT NULL,
    preview_asset_id UUID REFERENCES public.client_assets(id),
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_templates_org ON public.design_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_templates_client ON public.design_templates(client_id);

-- RLS: Project Creative Plans
ALTER TABLE public.project_creative_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view creative plans in their organization"
    ON public.project_creative_plans
    FOR SELECT
    TO authenticated
    USING (public.is_organization_member(organization_id, auth.uid()));

CREATE POLICY "Authorized roles can insert creative plans"
    ON public.project_creative_plans
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    );

CREATE POLICY "Authorized roles can update creative plans"
    ON public.project_creative_plans
    FOR UPDATE
    TO authenticated
    USING (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    )
    WITH CHECK (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    );

-- RLS: Slide Compositions
ALTER TABLE public.slide_compositions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view slide compositions in their organization"
    ON public.slide_compositions
    FOR SELECT
    TO authenticated
    USING (public.is_organization_member(organization_id, auth.uid()));

CREATE POLICY "Authorized roles can insert slide compositions"
    ON public.slide_compositions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    );

CREATE POLICY "Authorized roles can update slide compositions"
    ON public.slide_compositions
    FOR UPDATE
    TO authenticated
    USING (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    )
    WITH CHECK (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    );

CREATE POLICY "Authorized roles can delete slide compositions"
    ON public.slide_compositions
    FOR DELETE
    TO authenticated
    USING (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    );

-- RLS: Design Templates
ALTER TABLE public.design_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view design templates in their organization"
    ON public.design_templates
    FOR SELECT
    TO authenticated
    USING (public.is_organization_member(organization_id, auth.uid()));

CREATE POLICY "Authorized roles can insert design templates"
    ON public.design_templates
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_organization_role(
            organization_id,
            ARRAY['owner', 'admin', 'manager', 'designer']::public.app_role[],
            auth.uid()
        )
    );



-- ==============================================================================
-- INICIO MIGRATION: 20261001000012_phase_a_foundation.sql
-- ==============================================================================

-- supabase/migrations/20261001000012_phase_a_foundation.sql
-- FASE A: Fundação Administrativa, Usuários, Permissões, Isolamento e Integrações

-- 1. Tabela: client_assignments (relação many-to-many entre clientes e usuários)
CREATE TABLE IF NOT EXISTS public.client_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_client_user_assignment UNIQUE(client_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_client_assignments_org ON public.client_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_assignments_client ON public.client_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_assignments_user ON public.client_assignments(user_id);

-- 2. Tabela: integration_credentials (segredos criptografados de integrações externas)
CREATE TABLE IF NOT EXISTS public.integration_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    encrypted_secret TEXT NOT NULL,
    secret_last_four TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unconfigured' CHECK (status IN ('connected', 'unconfigured', 'error')),
    configured_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_tested_at TIMESTAMPTZ,
    CONSTRAINT unique_org_provider UNIQUE(organization_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integration_credentials_org ON public.integration_credentials(organization_id);

-- 3. Tabela: integration_settings (configurações públicas/não-secretas de integrações)
CREATE TABLE IF NOT EXISTS public.integration_settings (
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, provider)
);

-- 4. Função auxiliar de autorização: has_client_access
CREATE OR REPLACE FUNCTION public.has_client_access(p_client_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_org_id UUID;
    v_role TEXT;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Obter organização do cliente
    SELECT organization_id INTO v_org_id
    FROM public.clients
    WHERE id = p_client_id;

    IF v_org_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Obter papel do usuário na organização
    SELECT role INTO v_role
    FROM public.organization_members
    WHERE organization_id = v_org_id AND user_id = p_user_id;

    -- Owner e Admin têm acesso irrestrito a todos os clientes da organização
    IF v_role IN ('owner', 'admin') THEN
        RETURN TRUE;
    END IF;

    -- Designer e Viewer dependem de atribuição explícita em client_assignments
    RETURN EXISTS (
        SELECT 1
        FROM public.client_assignments
        WHERE client_id = p_client_id AND user_id = p_user_id
    );
END;
$$;

-- 5. Função de proteção do último owner
CREATE OR REPLACE FUNCTION public.check_last_owner_protection()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_owner_count INT;
BEGIN
    IF (TG_OP = 'DELETE' AND OLD.role = 'owner') OR (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role <> 'owner') THEN
        SELECT COUNT(*) INTO v_owner_count
        FROM public.organization_members
        WHERE organization_id = OLD.organization_id AND role = 'owner';

        IF v_owner_count <= 1 THEN
            RAISE EXCEPTION 'Operação proibida: a organização não pode ficar sem nenhum Owner ativo.';
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_last_owner ON public.organization_members;
CREATE TRIGGER trg_protect_last_owner
BEFORE UPDATE OR DELETE ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.check_last_owner_protection();

-- 6. Habilitar RLS nas novas tabelas
ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies para client_assignments
DROP POLICY IF EXISTS "Org members view client_assignments" ON public.client_assignments;
CREATE POLICY "Org members view client_assignments"
ON public.client_assignments
FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ) AND (
        EXISTS (
            SELECT 1 FROM public.organization_members
            WHERE user_id = auth.uid() AND organization_id = client_assignments.organization_id AND role IN ('owner', 'admin')
        ) OR user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Admins manage client_assignments" ON public.client_assignments;
CREATE POLICY "Admins manage client_assignments"
ON public.client_assignments
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE user_id = auth.uid() AND organization_id = client_assignments.organization_id AND role IN ('owner', 'admin')
    )
);

-- 8. RLS Policies para integrações
DROP POLICY IF EXISTS "Admins manage integration_credentials" ON public.integration_credentials;
CREATE POLICY "Admins manage integration_credentials"
ON public.integration_credentials
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE user_id = auth.uid() AND organization_id = integration_credentials.organization_id AND role IN ('owner', 'admin')
    )
);

DROP POLICY IF EXISTS "Admins manage integration_settings" ON public.integration_settings;
CREATE POLICY "Admins manage integration_settings"
ON public.integration_settings
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE user_id = auth.uid() AND organization_id = integration_settings.organization_id AND role IN ('owner', 'admin')
    )
);

DROP POLICY IF EXISTS "Members view integration_settings" ON public.integration_settings;
CREATE POLICY "Members view integration_settings"
ON public.integration_settings
FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
);

-- 9. Atualizar RLS de ai_jobs (remover USING true irrestrito)
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.ai_jobs;
DROP POLICY IF EXISTS "ai_jobs_isolation_policy" ON public.ai_jobs;
CREATE POLICY "ai_jobs_isolation_policy"
ON public.ai_jobs
FOR ALL
USING (
    organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ) AND (
        EXISTS (
            SELECT 1 FROM public.organization_members
            WHERE user_id = auth.uid() AND organization_id = ai_jobs.organization_id AND role IN ('owner', 'admin')
        ) OR (
            requested_by = auth.uid()
        )
    )
);


-- ==============================================================================
-- INICIO MIGRATION: 20261001000013_phase_b_visual_dna.sql
-- ==============================================================================

-- 1. Novas colunas na tabela public.clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS dna JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS manual_guidelines TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS visual_memory_status TEXT DEFAULT 'awaiting_references';

-- 2. Tabela public.client_pieces
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
    format_type TEXT NOT NULL DEFAULT 'feed',
    piece_type TEXT NOT NULL DEFAULT 'own_brand',
    analysis_status TEXT NOT NULL DEFAULT 'pending',
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


-- ==============================================================================
-- INICIO MIGRATION: 20261001000014_brand_dna_versions.sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.brand_dna_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'ready',
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
