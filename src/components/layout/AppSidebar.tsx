// src/components/layout/AppSidebar.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Users,
  FolderKanban,
  Settings,
  ShieldCheck,
  Building2,
  LogOut,
  UserCheck,
  Bot,
  Home,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { isAdmin, formatRoleLabel, type UserRole } from '@/lib/auth/permissions';

interface UserNavState {
  fullName: string;
  email: string;
  role: UserRole;
  avatarUrl?: string | null;
  loading: boolean;
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [userNav, setUserNav] = useState<UserNavState>({
    fullName: 'Carregando...',
    email: '',
    role: 'designer',
    avatarUrl: null,
    loading: true,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          const isDevStore =
            process.env.NODE_ENV !== 'production' &&
            process.env.NEXT_PUBLIC_ENABLE_DEV_STORE === 'true';

          if (isDevStore && isMounted) {
            setUserNav({
              fullName: 'Designer Local (Dev)',
              email: 'dev@studiofa.com.br',
              role: 'owner',
              loading: false,
            });
          }
          return;
        }

        const [{ data: memberData }, { data: profileData }] = await Promise.all([
          (supabase as any)
            .from('organization_members')
            .select('role')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle(),
          (supabase as any).from('profiles').select('full_name, avatar_url').eq('id', user.id).maybeSingle(),
        ]);

        const member = memberData as any;
        const profile = profileData as any;

        if (isMounted) {
          const role = (member?.role as UserRole) || 'designer';
          const name = profile?.full_name || user.email?.split('@')[0] || 'Usuário';

          setUserNav({
            fullName: name,
            email: user.email || '',
            role,
            avatarUrl: profile?.avatar_url,
            loading: false,
          });
        }
      } catch (err) {
        console.error('Falha ao carregar sessão na Sidebar:', err);
        if (isMounted) {
          setUserNav((prev) => ({ ...prev, loading: false }));
        }
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Erro ao efetuar logout:', e);
    } finally {
      router.push('/login');
      router.refresh();
    }
  };

  const role = userNav.role;
  const isAdm = isAdmin(role);

  // Nova Navegação Principal:
  // 1. Início (/home)
  // 2. Chat Criativo (núcleo único)
  // 3. Produções
  // 4. Clientes
  // 5. Usuários (admin/owner)
  // 6. Integrações (admin/owner)
  const navItems = [
    { label: 'Início', href: '/home', icon: Home },
    ...(role !== 'viewer'
      ? [{ label: 'Chat Criativo', href: '/creative-chat', icon: Bot }]
      : []),
    { label: 'Produções', href: '/projects', icon: FolderKanban },
    { label: 'Clientes', href: '/clients', icon: Building2 },
    ...(isAdm
      ? [
          { label: 'Usuários', href: '/users', icon: UserCheck },
          { label: 'Integrações', href: '/settings/integrations', icon: Settings },
        ]
      : []),
  ];

  const initials = userNav.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('') || 'FA';

  return (
    <aside className="w-full md:w-64 bg-fa-dark text-white p-6 flex flex-col justify-between shrink-0 border-r border-fa-border min-h-screen">
      <div>
        {/* Brand Logo */}
        <Link href="/home" className="flex items-center gap-3 mb-8 group">
          <div className="w-8 h-8 rounded bg-fa-green flex items-center justify-center font-bold text-black text-sm tracking-tight transition-transform group-hover:scale-105 shadow-sm">
            FA
          </div>
          <div>
            <h1 className="font-bold tracking-tight text-white text-base">Studio FA</h1>
            <p className="text-xs text-gray-400">Criação Visual com IA</p>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/creative-chat'
                ? pathname === '/creative-chat' || pathname.startsWith('/creative-chat') || pathname === '/create'
                : pathname === item.href || pathname.startsWith(item.href + '/');

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  isActive
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-fa-green' : 'text-gray-400'
                  }`}
                />
                <span>{item.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-fa-green ml-auto" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Session & Logout Footer */}
      <div className="pt-5 border-t border-fa-border space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-fa-border text-white text-xs font-bold flex items-center justify-center shrink-0 border border-white/10">
              {initials}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-white truncate">{userNav.fullName}</p>
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-block text-[10px] font-medium px-1.5 py-0.2 rounded ${
                    isAdm
                      ? 'bg-fa-green/20 text-fa-green border border-fa-green/30'
                      : role === 'designer'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                  }`}
                >
                  {formatRoleLabel(userNav.role)}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Sair do Studio FA"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-white/5 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-500 font-mono">
          <span>Ref: rfdossffdlayntmyqpnl</span>
          <ShieldCheck className="w-3.5 h-3.5 text-fa-green" />
        </div>
      </div>
    </aside>
  );
}
