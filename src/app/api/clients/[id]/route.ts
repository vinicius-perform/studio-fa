// src/app/api/clients/[id]/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { ClientService } from '@/services/clients/client.service';
import { formatError } from '@/lib/errors';
import { devStore } from '@/lib/dev-store';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = params.id;
    const supabase = getSupabaseServerClient();

    try {
      const client = devStore.getClientById(clientId);
      if (client) {
        return NextResponse.json({ client });
      }

      const clientService = new ClientService(supabase);
      const orgId = devStore.getOrganizationId();
      const sbClient = await clientService.getById(clientId, orgId);
      return NextResponse.json({ client: sbClient });
    } catch (e) {
      console.warn('GET /api/clients/[id] error:', e);
    }

    const fallback = devStore.getClientById(clientId);
    if (!fallback) {
      return NextResponse.json({ error: { message: 'Cliente não encontrado' } }, { status: 404 });
    }
    return NextResponse.json({ client: fallback });
  } catch (err) {
    return NextResponse.json(formatError(err), { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = params.id;
    if (!clientId) {
      return NextResponse.json(
        { error: { message: 'ID do cliente é obrigatório.' } },
        { status: 400 }
      );
    }

    // 1. Remove from devStore immediately
    devStore.deleteClient(clientId);

    // 2. Also attempt Supabase delete if available
    try {
      const supabase = getSupabaseServerClient();
      const orgId = devStore.getOrganizationId();
      const clientService = new ClientService(supabase);
      await clientService.delete(clientId, orgId);
    } catch (sbErr) {
      console.warn('Supabase delete client failed:', sbErr);
    }

    return NextResponse.json({ success: true, message: 'Cliente excluído com sucesso.' });
  } catch (err) {
    console.error('DELETE /api/clients/[id] error:', err);
    return NextResponse.json(formatError(err), { status: 500 });
  }
}
