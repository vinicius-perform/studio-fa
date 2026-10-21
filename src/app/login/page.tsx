// src/app/login/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { getDefaultRouteForRole } from '@/lib/auth/permissions';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next');
  const errorParam = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (errorParam === 'connection') {
      setError('Não foi possível conectar ao Studio FA. Tente novamente mais tarde.');
    } else if (errorParam === 'unconfigured') {
      setError('Configuração do Supabase ausente ou incorreta.');
    }
  }, [errorParam]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = getSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/creative-chat`;
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      });
      if (oauthErr) {
        setError(oauthErr.message || 'Falha ao autenticar com o Google.');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao inicializar login com Google.');
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authErr) {
        if (
          authErr.message.includes('Invalid login credentials') ||
          authErr.message.includes('invalid_grant')
        ) {
          setError('E-mail ou senha incorretos. Verifique suas credenciais.');
        } else if (authErr.message.includes('Email not confirmed')) {
          setError('Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.');
        } else {
          setError(authErr.message || 'Falha ao autenticar.');
        }
        setLoading(false);
        return;
      }

      const user = authData?.user;
      if (!user) {
        setError('Falha ao obter dados do usuário autenticado.');
        setLoading(false);
        return;
      }

      // Validação de Membership na Organização
      const { data: memberData, error: memberErr } = await (supabase as any)
        .from('organization_members')
        .select('role, organization_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      const member = memberData as any;

      if (memberErr || !member) {
        // Usuário autenticado mas sem membership -> Bloquear e fazer signOut imediato
        await supabase.auth.signOut();
        setError('Seu usuário ainda não possui acesso ao Studio FA. Solicite um convite a um administrador.');
        setLoading(false);
        return;
      }

      // Redirecionamento por Role
      const targetRoute = nextParam || getDefaultRouteForRole(member.role);
      router.push(targetRoute);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || 'Ocorreu um erro inesperado ao conectar ao Studio FA.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-canvas-bg p-4">
      <div className="w-full max-w-md bg-canvas-card border border-canvas-border rounded-2xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="w-10 h-10 rounded-lg bg-fa-green flex items-center justify-center font-bold text-black text-base shadow-sm">
            FA
          </div>
          <div>
            <h1 className="font-bold text-xl text-gray-900 tracking-tight">Studio FA</h1>
            <p className="text-xs text-gray-500">Acesso Restrito — Equipe e Convidados</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5 leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">E-mail corporativo</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.nome@agenciafa.com.br"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-canvas-border rounded-lg focus:outline-none focus:ring-2 focus:ring-fa-green/50 text-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Senha</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-canvas-border rounded-lg focus:outline-none focus:ring-2 focus:ring-fa-green/50 text-gray-900"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-fa-dark hover:bg-black text-white font-semibold rounded-lg text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Autenticando...</span>
              </>
            ) : (
              'Entrar no Studio FA'
            )}
          </button>
        </form>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-canvas-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-canvas-card px-2 text-gray-500">ou</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-2.5 px-4 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-sm border border-canvas-border transition-colors shadow-2xs disabled:opacity-50 flex items-center justify-center gap-2.5"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continuar com o Google</span>
        </button>

        <p className="text-[11px] text-gray-400 text-center mt-6">
          Studio FA — Sistema de produção criativa com governança multi-organização.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-canvas-bg">
          <Loader2 className="w-8 h-8 animate-spin text-fa-green" />
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
