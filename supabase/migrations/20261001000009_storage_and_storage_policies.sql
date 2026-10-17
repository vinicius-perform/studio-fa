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

-- Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 1. Read Policy: Members can view files belonging strictly to their organization across all Studio FA buckets
DROP POLICY IF EXISTS "Studio FA: Org members can read authorized buckets" ON storage.objects;
CREATE POLICY "Studio FA: Org members can read authorized buckets"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id IN ('client-brand-assets', 'brand-references', 'client-inputs', 'generated-assets', 'exports')
        AND public.is_organization_member(public.get_storage_path_org_id(name), auth.uid())
    );

-- 2. Insert Policy:
-- Owner, Admin, Manager can upload to any bucket
-- Designer can upload to client-inputs, generated-assets, and brand-references
DROP POLICY IF EXISTS "Studio FA: Authorized upload by role" ON storage.objects;
CREATE POLICY "Studio FA: Authorized upload by role"
    ON storage.objects
    FOR INSERT
    TO authenticated
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

-- 3. Update Policy:
-- Owner, Admin, Manager can update
DROP POLICY IF EXISTS "Studio FA: Authorized update by role" ON storage.objects;
CREATE POLICY "Studio FA: Authorized update by role"
    ON storage.objects
    FOR UPDATE
    TO authenticated
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

-- 4. Delete Policy:
-- Owner, Admin, Manager can delete
-- Designer cannot delete core assets
DROP POLICY IF EXISTS "Studio FA: Authorized delete by role" ON storage.objects;
CREATE POLICY "Studio FA: Authorized delete by role"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id IN ('client-brand-assets', 'brand-references', 'client-inputs', 'generated-assets', 'exports')
        AND public.has_organization_role(
            public.get_storage_path_org_id(name),
            ARRAY['owner', 'admin', 'manager']::public.app_role[],
            auth.uid()
        )
    );
