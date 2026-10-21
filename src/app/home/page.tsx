// src/app/home/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/layout/AppSidebar';
import {
  Bot,
  Building2,
  FolderKanban,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
  Plus,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface ClientItem {
  id: string;
  name: string;
  slug?: string;
  niche?: string;
  brand_status?: string;
  visual_memory_status?: string;
  pieces_count?: number;
}

interface HomeStats {
  totalClients: number;
  activeDnaClients: number;
  collectingClients: number;
  totalProductions: number;
  userRole: string;
  userName: string;
}

export default function HomeDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<HomeStats>({
    totalClients: 0,
    activeDnaClients: 0,
    collectingClients: 0,
    totalProductions: 0,
    userRole: 'designer',
    userName: '',
  });
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadHomeData() {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        let role = 'designer';
        let name = '';

        if (session?.user) {
          const [{ data: member }, { data: profile }] = await Promise.all([
            (supabase as any)
              .from('organization_members')
              .select('role')
              .eq('user_id', session.user.id)
              .order('created_at', { ascending: true })
              .limit(1)
              .maybeSingle(),
            (supabase as any)
              .from('profiles')
              .select('full_name')
              .eq('id', session.user.id)
              .maybeSingle(),
          ]);

          role = member?.role || 'designer';
          name = profile?.full_name || session.user.email?.split('@')[0] || '';
        }

        // Busca clientes e projetos acessíveis a esse usuário
        const [clientsRes, projectsRes] = await Promise.all([
          fetch('/api/clients').then((r) => (r.ok ? r.json() : { clients: [] })),
          fetch('/api/projects').then((r) => (r.ok ? r.json() : { projects: [] })),
        ]);

        const clientList: ClientItem[] = clientsRes?.clients || [];
        const projectList: any[] = projectsRes?.projects || [];

        const activeDna = clientList.filter(
          (c) => c.brand_status === 'ready' || c.visual_memory_status === 'ready'
        ).length;
        const collecting = clientList.length - activeDna;

        if (isMounted) {
          setClients(clientList);
          setStats({
            totalClients: clientList.length,
            activeDnaClients: activeDna,
            collectingClients: collecting,
            totalProductions: projectList.length,
            userRole: role,
            userName: name,
          });
        }
      } catch (err) {
        console.error('Falha ao carregar dados da Home:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadHomeData();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="flex h-screen w-full bg-[#090B0E] text-white font-sans overflow-hidden">
      <AppSidebar />

      <main className="flex-1 flex flex-col h-screen overflow-y-auto p-6 md:p-12 items-center">
        <div className="max-w-4xl w-full text-center space-y-6 pt-4 md:pt-8">
          {/* Badge Superior */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#161B22] border border-zinc-800 text-xs font-semibold text-[#CEF52A] shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-[#CEF52A]" />
            Studio FA • Criação Visual Conversacional
          </div>

          {/* Título Principal */}
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            Crie peças visuais <br className="hidden md:block" />
            conversando com a IA.
          </h1>

          {/* Descrição */}
          <p className="text-zinc-400 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
            Selecione seu cliente, anexe referências e peça artes em linguagem natural. A IA analisa o Brand DNA e gera peças completas com tipografia, composição e fotografia integradas.
          </p>

          {/* CTAs Principais */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/creative-chat"
              className="w-full sm:w-auto px-6 py-3.5 bg-[#CEF52A] hover:bg-[#b8dd24] text-black rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition shadow-lg hover:shadow-[#CEF52A]/20"
            >
              <Bot className="w-5 h-5" />
              <span>ABRIR CHAT CRIATIVO</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>

            <Link
              href="/projects"
              className="w-full sm:w-auto px-6 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-semibold text-sm border border-zinc-700/80 transition flex items-center justify-center gap-2"
            >
              <FolderKanban className="w-4 h-4 text-zinc-400" />
              <span>Produções</span>
            </Link>

            <Link
              href="/clients"
              className="w-full sm:w-auto px-6 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-semibold text-sm border border-zinc-700/80 transition flex items-center justify-center gap-2"
            >
              <Building2 className="w-4 h-4 text-zinc-400" />
              <span>Clientes</span>
            </Link>
          </div>

          {/* Cards de Métricas Reais do Usuário */}
          <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            {/* Card Clientes */}
            <div className="bg-[#12151B] border border-zinc-800/80 p-5 rounded-2xl hover:border-zinc-700 transition relative overflow-hidden group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                  {stats.userRole === 'designer' ? 'Seus Clientes' : 'Clientes'}
                </span>
                <Building2 className="w-4 h-4 text-zinc-500 group-hover:text-[#CEF52A] transition" />
              </div>

              {loading ? (
                <div className="h-8 w-16 bg-zinc-800 rounded animate-pulse my-1" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white">{stats.totalClients}</span>
                  <span className="text-xs text-zinc-400">
                    {stats.totalClients === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}
                  </span>
                </div>
              )}

              <div className="mt-2 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400">
                <span className="flex items-center gap-1 text-[#CEF52A]">
                  <CheckCircle2 className="w-3 h-3" />
                  {stats.activeDnaClients} com Brand DNA ativo
                </span>
              </div>
            </div>

            {/* Card Produções */}
            <div className="bg-[#12151B] border border-zinc-800/80 p-5 rounded-2xl hover:border-zinc-700 transition relative overflow-hidden group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                  Produções
                </span>
                <FolderKanban className="w-4 h-4 text-zinc-500 group-hover:text-[#CEF52A] transition" />
              </div>

              {loading ? (
                <div className="h-8 w-16 bg-zinc-800 rounded animate-pulse my-1" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white">{stats.totalProductions}</span>
                  <span className="text-xs text-zinc-400">
                    {stats.totalProductions === 1 ? 'arte salva' : 'artes salvas'}
                  </span>
                </div>
              )}

              <div className="mt-2 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400">
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3 text-zinc-500" />
                  Galeria de alta resolução
                </span>
              </div>
            </div>

            {/* Card Motor IA */}
            <div className="bg-[#12151B] border border-zinc-800/80 p-5 rounded-2xl hover:border-zinc-700 transition relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                    Motor IA
                  </span>
                  <Sparkles className="w-4 h-4 text-[#CEF52A]" />
                </div>
                <span className="text-sm font-bold text-[#CEF52A] flex items-center gap-1.5 mt-1">
                  <CheckCircle2 className="w-4 h-4" />
                  GPT Image 2.5
                </span>
              </div>

              <div className="mt-2 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400">
                <span>Responses API Multimodal</span>
                <span className="text-[#CEF52A] font-mono text-[10px] bg-[#CEF52A]/10 px-1.5 py-0.5 rounded">
                  Ativo
                </span>
              </div>
            </div>
          </div>

          {/* Atalho Rápido para os Clientes do Usuário */}
          {clients.length > 0 && (
            <div className="pt-8 text-left space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-400">
                    {stats.userRole === 'designer' ? 'Seus Clientes Atribuídos' : 'Clientes Disponíveis'}
                  </h2>
                  <span className="text-[11px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono">
                    {clients.length}
                  </span>
                </div>
                <Link
                  href="/clients"
                  className="text-xs text-zinc-400 hover:text-white transition flex items-center gap-1"
                >
                  <span>Ver todos</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {clients.slice(0, 6).map((client) => {
                  const hasDna = client.brand_status === 'ready' || client.visual_memory_status === 'ready';
                  return (
                    <div
                      key={client.id}
                      className="bg-[#12151B] border border-zinc-800/80 hover:border-[#CEF52A]/40 rounded-xl p-3.5 transition group flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-white truncate group-hover:text-[#CEF52A] transition">
                            {client.name}
                          </h3>
                          <p className="text-[11px] text-zinc-400 truncate">
                            {client.niche || 'Geral'}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${
                            hasDna ? 'bg-[#CEF52A]' : 'bg-amber-400'
                          }`}
                          title={hasDna ? 'Brand DNA Ativo' : 'Em coleta'}
                        />
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-zinc-800/60 flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {hasDna ? 'DNA Ativo' : 'Em coleta'}
                        </span>
                        <Link
                          href={`/creative-chat?client=${client.id}`}
                          className="px-2.5 py-1 bg-zinc-800 hover:bg-[#CEF52A] text-zinc-200 hover:text-black font-semibold text-[11px] rounded-lg transition flex items-center gap-1"
                        >
                          <Bot className="w-3 h-3" />
                          <span>Criar no Chat</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
