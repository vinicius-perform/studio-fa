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
