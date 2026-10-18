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
