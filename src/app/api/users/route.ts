// src/app/api/users/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, AuthError, ForbiddenError } from '@/lib/auth/server-guards';
import { isOwner } from '@/lib/auth/permissions';
import { formatError } from '@/lib/errors';
import { isDevStoreAllowed } from '@/config/env';
import { devStore } from '@/lib/dev-store';

export async function GET(req: Request) {
  try {
    // Modo devStore explícito
    if (isDevStoreAllowed()) {
      const orgId = devStore.getOrganizationId();
      return NextResponse.json({
        users: [
          {
            id: 'dev-user-owner',
            memberId: 'dev-member-1',
            email: 'admin@studiofa.com.br',
            fullName: 'Administrador FA',
            role: 'owner',
            status: 'active',
            lastSignIn: new Date().toISOString(),
            assignedClients: [],
          },
        ],
      });
    }

    const supabase = getSupabaseServerClient();
    const session = await requireAdmin(supabase);

    // Consulta membros da organização com perfil
    const { data: members, error: membersErr } = await supabase
      .from('organization_members')
      .select(`
        id,
        user_id,
        role,
        created_at,
        profiles (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('organization_id', session.organizationId)
      .order('created_at', { ascending: true });

    if (membersErr) {
      throw membersErr;
    }

    // Busca emails e último login via Admin API
    const adminSupabase = getSupabaseAdminClient();
    let authUsers: any[] = [];
    try {
      const { data: usersData } = await adminSupabase.auth.admin.listUsers();
      authUsers = usersData?.users || [];
    } catch (e) {
      console.warn('Falha ao listar auth users no endpoint /api/users:', e);
    }

    // Busca atribuições de clientes
    const { data: assignments } = await supabase
      .from('client_assignments')
      .select('client_id, user_id, clients(id, name, slug)')
      .eq('organization_id', session.organizationId);

    const userList = (members || []).map((m: any) => {
      const authUser = authUsers.find((u) => u.id === m.user_id);
      const profile = m.profiles as any;

      const userAssignments = (assignments || [])
        .filter((a: any) => a.user_id === m.user_id)
        .map((a: any) => ({
          id: a.client_id,
          name: a.clients?.name || 'Cliente',
        }));

      return {
        id: m.user_id,
        memberId: m.id,
        email: authUser?.email || '',
        fullName: profile?.full_name || authUser?.email?.split('@')[0] || 'Usuário',
        avatarUrl: profile?.avatar_url,
        role: m.role,
        status: authUser?.confirmed_at ? 'active' : 'invited',
        lastSignIn: authUser?.last_sign_in_at || null,
        assignedClients: userAssignments,
      };
    });

    return NextResponse.json({ users: userList });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServerClient();
    const session = await requireAdmin(supabase);

    const body = await req.json();
    const { email, fullName, role, clientIds } = body;

    if (!email || !role) {
      return NextResponse.json(
        { error: { message: 'E-mail e Cargo são campos obrigatórios.' } },
        { status: 400 }
      );
    }

    // Apenas Owner pode promover outro membro a Owner
    if (role === 'owner' && !isOwner(session.role)) {
      return NextResponse.json(
        { error: { message: 'Apenas o Owner pode promover outro usuário para Owner.' } },
        { status: 403 }
      );
    }

    const adminSupabase = getSupabaseAdminClient();

    // 1. Envia convite ou recupera usuário existente via Auth Admin API
    let targetUserId: string;
    const { data: inviteData, error: inviteErr } = await adminSupabase.auth.admin.inviteUserByEmail(
      email.trim(),
      { data: { full_name: fullName?.trim() } }
    );

    if (inviteErr) {
      // Se já existe, localiza o usuário existente
      if (inviteErr.message.includes('already exists') || inviteErr.message.includes('registered')) {
        const { data: usersData } = await adminSupabase.auth.admin.listUsers();
        const found = usersData.users.find(
          (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
        );
        if (!found) {
          throw new Error('Usuário já existe mas não pôde ser recuperado.');
        }
        targetUserId = found.id;
      } else {
        throw inviteErr;
      }
    } else {
      targetUserId = inviteData.user.id;
    }

    // 2. Garante perfil em profiles
    await adminSupabase.from('profiles').upsert({
      id: targetUserId,
      full_name: fullName?.trim() || email.split('@')[0],
      updated_at: new Date().toISOString(),
    });

    // 3. Insere ou atualiza membership na organização
    const { data: member, error: memberErr } = await adminSupabase
      .from('organization_members')
      .upsert(
        {
          organization_id: session.organizationId,
          user_id: targetUserId,
          role,
        },
        { onConflict: 'organization_id,user_id' }
      )
      .select('id')
      .single();

    if (memberErr) throw memberErr;

    // 4. Insere atribuições de clientes se fornecidas
    if (Array.isArray(clientIds) && clientIds.length > 0 && role !== 'owner' && role !== 'admin') {
      const assignmentInserts = clientIds.map((cid: string) => ({
        organization_id: session.organizationId,
        client_id: cid,
        user_id: targetUserId,
        assigned_by: session.userId,
      }));

      await adminSupabase
        .from('client_assignments')
        .upsert(assignmentInserts, { onConflict: 'client_id,user_id' });
    }

    return NextResponse.json({ success: true, userId: targetUserId, memberId: member?.id });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = getSupabaseServerClient();
    const session = await requireAdmin(supabase);

    const body = await req.json();
    const { memberId, targetUserId, role, fullName, clientIds } = body;

    if (!memberId || !targetUserId) {
      return NextResponse.json(
        { error: { message: 'ID do membro e ID do usuário são obrigatórios.' } },
        { status: 400 }
      );
    }

    const adminSupabase = getSupabaseAdminClient();

    // 1. Validação de proteção do último owner
    const { data: targetMember } = await adminSupabase
      .from('organization_members')
      .select('role, organization_id')
      .eq('id', memberId)
      .single();

    if (!targetMember) {
      return NextResponse.json({ error: { message: 'Membro não encontrado.' } }, { status: 404 });
    }

    if (targetMember.role === 'owner' && role && role !== 'owner') {
      // Contar quantos owners existem
      const { count } = await adminSupabase
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', session.organizationId)
        .eq('role', 'owner');

      if ((count || 0) <= 1) {
        return NextResponse.json(
          { error: { message: 'Operação proibida: a organização não pode ficar sem nenhum Owner.' } },
          { status: 400 }
        );
      }
    }

    // Apenas owner pode promover a owner
    if (role === 'owner' && !isOwner(session.role)) {
      return NextResponse.json(
        { error: { message: 'Apenas o Owner pode promover outro usuário a Owner.' } },
        { status: 403 }
      );
    }

    // 2. Atualiza role se fornecida
    if (role) {
      await adminSupabase
        .from('organization_members')
        .update({ role })
        .eq('id', memberId);
    }

    // 3. Atualiza nome se fornecido
    if (fullName) {
      await adminSupabase
        .from('profiles')
        .update({ full_name: fullName.trim(), updated_at: new Date().toISOString() })
        .eq('id', targetUserId);
    }

    // 4. Sincroniza atribuições de clientes
    if (Array.isArray(clientIds)) {
      // Remove atribuições antigas
      await adminSupabase
        .from('client_assignments')
        .delete()
        .eq('organization_id', session.organizationId)
        .eq('user_id', targetUserId);

      // Insere novas atribuições se não for admin
      if (clientIds.length > 0 && role !== 'owner' && role !== 'admin') {
        const inserts = clientIds.map((cid: string) => ({
          organization_id: session.organizationId,
          client_id: cid,
          user_id: targetUserId,
          assigned_by: session.userId,
        }));
        await adminSupabase.from('client_assignments').insert(inserts);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = getSupabaseServerClient();
    const session = await requireAdmin(supabase);

    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return NextResponse.json({ error: { message: 'memberId é obrigatório.' } }, { status: 400 });
    }

    const adminSupabase = getSupabaseAdminClient();

    // 1. Verifica se o membro é o último owner
    const { data: member } = await adminSupabase
      .from('organization_members')
      .select('role, user_id, organization_id')
      .eq('id', memberId)
      .single();

    if (!member) {
      return NextResponse.json({ error: { message: 'Membro não encontrado.' } }, { status: 404 });
    }

    if (member.role === 'owner') {
      const { count } = await adminSupabase
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', session.organizationId)
        .eq('role', 'owner');

      if ((count || 0) <= 1) {
        return NextResponse.json(
          { error: { message: 'Operação proibida: Não é permitido remover o último Owner da organização.' } },
          { status: 400 }
        );
      }
    }

    // 2. Remove client_assignments do usuário
    await adminSupabase
      .from('client_assignments')
      .delete()
      .eq('organization_id', session.organizationId)
      .eq('user_id', member.user_id);

    // 3. Remove o membership na organização (preservando projetos e histórico)
    const { error: delErr } = await adminSupabase
      .from('organization_members')
      .delete()
      .eq('id', memberId);

    if (delErr) throw delErr;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err instanceof AuthError) return NextResponse.json({ error: { message: err.message } }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: { message: err.message } }, { status: 403 });
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
