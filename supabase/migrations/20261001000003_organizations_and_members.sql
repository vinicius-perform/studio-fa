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
