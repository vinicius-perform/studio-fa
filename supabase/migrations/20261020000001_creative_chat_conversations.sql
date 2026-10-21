-- Migration: 20261020000001_creative_chat_conversations.sql
-- Adiciona suporte a conversas, mensagens e anexos do Chat Criativo no Studio FA.

CREATE TABLE IF NOT EXISTS public.creative_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Nova Conversa Criativa',
    active_reference_piece_ids JSONB DEFAULT '[]'::jsonb,
    last_response_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.creative_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.creative_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL DEFAULT '',
    response_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.creative_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.creative_conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES public.creative_messages(id) ON DELETE CASCADE,
    attachment_type TEXT NOT NULL CHECK (attachment_type IN ('reference', 'uploaded_image', 'generated_image', 'print')),
    storage_bucket TEXT NOT NULL DEFAULT 'client-pieces',
    storage_path TEXT NOT NULL,
    preview_url TEXT,
    mime_type TEXT,
    file_size_bytes BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes para alta performance
CREATE INDEX IF NOT EXISTS idx_creative_conversations_org_client 
    ON public.creative_conversations (organization_id, client_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_creative_messages_conversation 
    ON public.creative_messages (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_creative_attachments_conversation 
    ON public.creative_attachments (conversation_id);

-- Habilita RLS
ALTER TABLE public.creative_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_attachments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS:
-- 1. creative_conversations: membros da mesma organização têm acesso; designers respeitam client_assignments
CREATE POLICY "creative_conversations_org_isolation" ON public.creative_conversations
    FOR ALL
    USING (
        organization_id = (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() LIMIT 1)
    )
    WITH CHECK (
        organization_id = (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() LIMIT 1)
    );

-- 2. creative_messages: membros da mesma organização da conversa
CREATE POLICY "creative_messages_org_isolation" ON public.creative_messages
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.creative_conversations c
            JOIN public.organization_members m ON m.organization_id = c.organization_id
            WHERE c.id = creative_messages.conversation_id AND m.user_id = auth.uid()
        )
    );

-- 3. creative_attachments: membros da mesma organização da conversa
CREATE POLICY "creative_attachments_org_isolation" ON public.creative_attachments
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.creative_conversations c
            JOIN public.organization_members m ON m.organization_id = c.organization_id
            WHERE c.id = creative_attachments.conversation_id AND m.user_id = auth.uid()
        )
    );
