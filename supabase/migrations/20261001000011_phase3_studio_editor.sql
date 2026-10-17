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
