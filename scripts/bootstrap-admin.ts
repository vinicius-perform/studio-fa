// scripts/bootstrap-admin.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database';
import fs from 'fs';
import path from 'path';

// Carrega .env.local se existir
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const idx = line.indexOf('=');
    if (idx !== -1) {
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (k && !k.startsWith('#') && !process.env[k]) {
        process.env[k] = v;
      }
    }
  });
}

const adminEmail = process.env.STUDIO_FA_BOOTSTRAP_ADMIN_EMAIL || process.argv[2];

if (!adminEmail) {
  console.error('\n[ERRO] É necessário definir a variável STUDIO_FA_BOOTSTRAP_ADMIN_EMAIL ou passar o e-mail como argumento.');
  console.error('Exemplo: npm run bootstrap:admin -- admin@studiofa.com.br\n');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('[ERRO] SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para executar o bootstrap.');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function bootstrap() {
  console.log(`\n======================================================`);
  console.log(` STUDIO FA — BOOTSTRAP DO PRIMEIRO OWNER`);
  console.log(` E-mail alvo: ${adminEmail}`);
  console.log(`======================================================\n`);

  // 1. Localiza usuário no Supabase Auth Admin
  const { data: usersData, error: userError } = await supabase.auth.admin.listUsers();
  if (userError) {
    console.error(`Falha ao listar usuários do Auth: ${userError.message}`);
    process.exit(1);
  }

  let targetUser = usersData.users.find(
    (u) => u.email?.toLowerCase() === adminEmail.toLowerCase()
  );

  if (!targetUser) {
    const tempPassword = process.env.STUDIO_FA_BOOTSTRAP_PASSWORD || process.argv[3] || 'StudioFA@2026';
    console.log(`Usuário não encontrado no Supabase Auth. Criando usuário automaticamente com e-mail confirmado...`);
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: adminEmail.split('@')[0],
      },
    });

    if (createError || !createData.user) {
      console.error(`Falha ao criar usuário no Supabase Auth: ${createError?.message}`);
      process.exit(1);
    }

    targetUser = createData.user;
    console.log(`[OK] Usuário provisionado no Supabase Auth com sucesso!`);
    console.log(`  E-mail: ${adminEmail}`);
    console.log(`  Senha provisória: ${tempPassword}`);
  } else {
    console.log(`[OK] Usuário Auth existente identificado: ID ${targetUser.id}`);
  }

  // 2. Garante o Profile correspondente
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', targetUser.id)
    .maybeSingle();

  if (!profile) {
    console.log(`Criando perfil em profiles para o usuário...`);
    const { error: profErr } = await supabase.from('profiles').insert({
      id: targetUser.id,
      full_name: (targetUser.user_metadata as any)?.full_name || targetUser.email?.split('@')[0] || 'Administrador',
      updated_at: new Date().toISOString(),
    });
    if (profErr) {
      console.error(`Falha ao criar perfil: ${profErr.message}`);
      process.exit(1);
    }
  }

  // 3. Localiza ou cria a organização principal (Studio FA)
  let { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!org) {
    console.log(`Organização não encontrada. Criando organização padrão 'Studio FA'...`);
    const { data: newOrg, error: orgErr } = await supabase
      .from('organizations')
      .insert({
        name: 'Studio FA',
        slug: 'studio-fa',
        settings: {},
      })
      .select('id, name')
      .single();

    if (orgErr || !newOrg) {
      console.error(`Falha ao criar organização: ${orgErr?.message}`);
      process.exit(1);
    }
    org = newOrg;
  }

  console.log(`[OK] Organização identificada: "${org.name}" (ID: ${org.id})`);

  // 4. Cria ou atualiza membership com role 'owner'
  const { data: existingMember } = await supabase
    .from('organization_members')
    .select('id, role')
    .eq('organization_id', org.id)
    .eq('user_id', targetUser.id)
    .maybeSingle();

  if (existingMember) {
    if (existingMember.role === 'owner') {
      console.log(`\n[SUCESSO] O usuário já é Owner desta organização. Nenhuma alteração necessária.\n`);
      return;
    }

    console.log(`Atualizando papel existente (${existingMember.role}) para 'owner'...`);
    const { error: updErr } = await supabase
      .from('organization_members')
      .update({ role: 'owner' })
      .eq('id', existingMember.id);

    if (updErr) {
      console.error(`Falha ao atualizar membership: ${updErr.message}`);
      process.exit(1);
    }
  } else {
    console.log(`Criando associação organization_members como 'owner'...`);
    const { error: insErr } = await supabase.from('organization_members').insert({
      organization_id: org.id,
      user_id: targetUser.id,
      role: 'owner',
    });

    if (insErr) {
      console.error(`Falha ao criar membership: ${insErr.message}`);
      process.exit(1);
    }
  }

  console.log(`\n======================================================`);
  console.log(` [SUCESSO] Bootstrap concluído com sucesso!`);
  console.log(` Usuário: ${adminEmail}`);
  console.log(` Cargo: OWNER`);
  console.log(` Organização: ${org.name}`);
  console.log(`======================================================\n`);
}

bootstrap().catch((err) => {
  console.error('[ERRO FATAL]', err);
  process.exit(1);
});
