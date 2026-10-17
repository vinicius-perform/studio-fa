'use client';

import React, { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Lock, Mail, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authErr) {
      setError(authErr.message);
      setLoading(false);
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-canvas-bg p-4">
      <div className="w-full max-w-md bg-canvas-card border border-canvas-border rounded-2xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="w-10 h-10 rounded-lg bg-fa-green flex items-center justify-center font-bold text-black text-base">
            FA
          </div>
          <div>
            <h1 className="font-bold text-xl text-gray-900 tracking-tight">Studio FA</h1>
            <p className="text-xs text-gray-500">Acesso Restrito — Equipe Interna</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
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
            className="w-full py-2.5 px-4 bg-fa-dark hover:bg-black text-white font-semibold rounded-lg text-sm transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? 'Autenticando...' : 'Entrar no Studio FA'}
          </button>
        </form>

        <p className="text-[11px] text-gray-400 text-center mt-6">
          Studio FA — Sistema de produção criativa com governança multi-organização.
        </p>
      </div>
    </div>
  );
}
