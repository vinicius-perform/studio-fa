-- Migration: 20261020000002_creative_chat_active_references.sql
-- Adiciona active_reference_piece_ids à tabela creative_conversations

ALTER TABLE IF EXISTS public.creative_conversations 
ADD COLUMN IF NOT EXISTS active_reference_piece_ids JSONB DEFAULT '[]'::jsonb;
