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
