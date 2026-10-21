// src/app/api/creative-chat/conversations/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireSessionContext, requireClientAccess } from '@/lib/auth/server-guards';
import { canCreateProjects } from '@/lib/auth/permissions';
import { isDevStoreAllowed } from '@/config/env';
import { devStore } from '@/lib/dev-store';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get('clientId');

    if (isDevStoreAllowed()) {
      const orgId = devStore.getOrganizationId();
      const conversations = devStore.listCreativeConversations(orgId, clientId || undefined);
      return NextResponse.json({ conversations });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    let query = (supabase as any)
      .from('creative_conversations')
      .select('id, organization_id, client_id, user_id, title, active_reference_piece_ids, last_response_id, created_at, updated_at')
      .eq('organization_id', session.organizationId)
      .order('updated_at', { ascending: false });

    if (clientId) {
      await requireClientAccess(supabase, session, clientId);
      query = query.eq('client_id', clientId);
    }

    const { data: conversations, error } = await query.limit(50);

    if (error) {
      console.warn('[CreativeConversations GET] Fallback para array vazio:', error.message);
      return NextResponse.json({ conversations: [] });
    }

    return NextResponse.json({ conversations: conversations || [] });
  } catch (err: any) {
    return NextResponse.json({ error: { message: err?.message || 'Erro ao carregar conversas.' } }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { clientId, title, active_reference_piece_ids } = body;

    if (!clientId) {
      return NextResponse.json({ error: { message: 'clientId é obrigatório.' } }, { status: 400 });
    }

    if (isDevStoreAllowed()) {
      const orgId = devStore.getOrganizationId();
      const newConv = devStore.saveCreativeConversation({
        organization_id: orgId,
        client_id: clientId,
        user_id: 'dev-user-123',
        title: title || 'Nova Conversa Criativa',
        active_reference_piece_ids: Array.isArray(active_reference_piece_ids) ? active_reference_piece_ids : [],
      });
      return NextResponse.json({ conversation: newConv });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireSessionContext(supabase);

    if (!canCreateProjects(session.role)) {
      return NextResponse.json(
        { error: { message: 'Visualizadores possuem acesso somente leitura e não podem iniciar conversas.' } },
        { status: 403 }
      );
    }

    await requireClientAccess(supabase, session, clientId);

    const { data: conversation, error } = await (supabase as any)
      .from('creative_conversations')
      .insert({
        organization_id: session.organizationId,
        client_id: clientId,
        user_id: session.userId,
        title: title || 'Nova Conversa Criativa',
        active_reference_piece_ids: Array.isArray(active_reference_piece_ids) ? active_reference_piece_ids : [],
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ conversation });
  } catch (err: any) {
    return NextResponse.json({ error: { message: err?.message || 'Erro ao criar conversa.' } }, { status: 500 });
  }
}
