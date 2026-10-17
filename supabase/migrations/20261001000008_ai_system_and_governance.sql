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
