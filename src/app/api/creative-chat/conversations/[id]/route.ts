// src/app/api/creative-chat/conversations/[id]/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireSessionContext, requireClientAccess } from '@/lib/auth/server-guards';
import { isDevStoreAllowed } from '@/config/env';
import { devStore } from '@/lib/dev-store';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const conversationId = params.id;

    if (isDevStoreAllowed()) {
      const conv = devStore.getCreativeConversation(conversationId);
      if (!conv) {
        return NextResponse.json({ error: { message: 'Conversa não encontrada.' } }, { status: 404 });
      }
      const messages = devStore.listCreativeMessages(conversationId);
      return NextResponse.json({ conversation: conv, messages });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    const { data: conversation, error: convErr } = await (supabase as any)
      .from('creative_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('organization_id', session.organizationId)
      .single();

    if (convErr || !conversation) {
      return NextResponse.json({ error: { message: 'Conversa não encontrada.' } }, { status: 404 });
    }

    await requireClientAccess(supabase, session, conversation.client_id);

    const { data: messages, error: msgErr } = await (supabase as any)
      .from('creative_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      conversation,
      messages: messages || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: { message: err?.message || 'Erro ao carregar mensagens.' } }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const conversationId = params.id;
    const body = await req.json();
    const { title, active_reference_piece_ids, last_response_id } = body;

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof title === 'string') updates.title = title;
    if (Array.isArray(active_reference_piece_ids)) updates.active_reference_piece_ids = active_reference_piece_ids;
    if (typeof last_response_id === 'string') updates.last_response_id = last_response_id;

    if (isDevStoreAllowed()) {
      const conv = devStore.getCreativeConversation(conversationId);
      if (!conv) {
        return NextResponse.json({ error: { message: 'Conversa não encontrada.' } }, { status: 404 });
      }
      const updated = devStore.saveCreativeConversation({
        ...conv,
        ...updates,
      });
      return NextResponse.json({ success: true, conversation: updated });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    const { data: conv, error: fetchErr } = await (supabase as any)
      .from('creative_conversations')
      .select('client_id, organization_id')
      .eq('id', conversationId)
      .eq('organization_id', session.organizationId)
      .single();

    if (fetchErr || !conv) {
      return NextResponse.json({ error: { message: 'Conversa não encontrada.' } }, { status: 404 });
    }

    await requireClientAccess(supabase, session, conv.client_id);

    const { data: updated, error: updateErr } = await (supabase as any)
      .from('creative_conversations')
      .update(updates)
      .eq('id', conversationId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, conversation: updated });
  } catch (err: any) {
    return NextResponse.json({ error: { message: err?.message || 'Erro ao atualizar conversa.' } }, { status: 500 });
  }
}
