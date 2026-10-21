-- supabase/migrations/20261019000001_phase_e_performance_indexes.sql
-- Description: Additive performance indexes for Studio FA V2 production galleries, client assets and archiving filters

-- 1. Accelerates /projects query ordering and organization isolation
CREATE INDEX IF NOT EXISTS idx_projects_org_updated ON public.projects(organization_id, updated_at DESC);

-- 2. Accelerates active vs archived projects filtering
CREATE INDEX IF NOT EXISTS idx_projects_org_archived ON public.projects(organization_id, archived_at);

-- 3. Accelerates logo and asset lookups per client (eliminates seq scans in client lists and editor)
CREATE INDEX IF NOT EXISTS idx_client_assets_client_type ON public.client_assets(client_id, asset_type);
