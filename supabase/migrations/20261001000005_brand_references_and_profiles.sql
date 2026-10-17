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
