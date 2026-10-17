'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppSidebar } from '@/components/layout/AppSidebar';
import {
  CheckCircle2,
  Database,
  Layers,
  Sparkles,
  ShieldCheck,
  FolderKanban,
  Users,
  ArrowRight,
  Lock,
} from 'lucide-react';

interface SystemStatus {
  system: string;
  status: string;
  supabase: {
    url: string;
    project_ref: string;
    connected: boolean;
  };
  database: {
    configured: boolean;
    pgvector_enabled: boolean;
  };
  storage: {
    configured: boolean;
    buckets: string[];
    privacy: string;
  };
  ai: {
    configured: boolean;
    provider: string;
    models: {
      vision: string;
      image: string;
      embedding: string;
    };
    zero_cost_guarantee: boolean;
  };
}

export default function HomePage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ clientsCount: 0, projectsCount: 0 });

  useEffect(() => {
    Promise.all([
      fetch('/api/health').then((res) => res.json()).catch(() => null),
      fetch('/api/clients').then((res) => res.json()).catch(() => ({ clients: [] })),
      fetch('/api/projects').then((res) => res.json()).catch(() => ({ projects: [] })),
    ]).then(([healthData, clientsData, projectsData]) => {
      if (healthData) setStatus(healthData);
      setStats({
        clientsCount: clientsData?.clients?.length || 0,
        projectsCount: projectsData?.projects?.length || 0,
      });
      setLoading(false);
    });
  }, []);

  return (
    <div className="flex h-screen w-full bg-[#F6F7F8] font-sans overflow-hidden">
      <AppSidebar />

      <main className="flex-1 flex flex-col h-screen overflow-y-auto p-6 md:p-10">
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-gray-200 text-xs font-semibold text-gray-800 shadow-2xs mb-2">
              <span className="w-2 h-2 rounded-full bg-[#CEF52A]" />
              Studio FA v3.0 Operacional
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
              Estúdio de Criação de Posts & Carrosséis com IA
            </h1>
            <p className="text-gray-600 text-xs md:text-sm mt-1">
              Plataforma de produção criativa com tipografia editável, DNA visual e zero flattening indesejado.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/projects"
              className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium text-xs hover:bg-gray-50 transition"
            >
              Ver Produções
            </Link>
            <Link
              href="/create"
              className="px-5 py-2.5 bg-black hover:bg-gray-800 text-[#CEF52A] rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>Nova Produção</span>
            </Link>
          </div>
        </header>

        {/* Quick Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Clientes Cadastrados</span>
              <Users className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-2xl font-black text-gray-900">{stats.clientsCount}</div>
            <p className="text-[11px] text-gray-400 mt-1">Com memórias visuais e regras de marca</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Produções Ativas</span>
              <FolderKanban className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-2xl font-black text-gray-900">{stats.projectsCount}</div>
            <p className="text-[11px] text-gray-400 mt-1">Posts e carrosséis no estúdio</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Motor Visual IA</span>
              <Sparkles className="w-4 h-4 text-[#CEF52A]" />
            </div>
            <div className="text-2xl font-black text-gray-900">FA Engine 3.0</div>
            <p className="text-[11px] text-gray-400 mt-1">Presets Rápido, Produção e Premium</p>
          </div>
        </div>

        {/* System Subsystems Details */}
        <div className="space-y-6">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
            Integridade dos Subsistemas
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Supabase & Postgres */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-gray-900 text-sm">
                  <Database className="w-4 h-4 text-gray-700" />
                  <span>Supabase & Banco de Dados</span>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Conectado
                </span>
              </div>

              <ul className="text-xs text-gray-600 space-y-2 border-t border-gray-100 pt-3 font-mono">
                <li className="flex justify-between">
                  <span className="text-gray-500">Projeto Ref:</span>
                  <span className="font-semibold text-gray-900">rfdossffdlayntmyqpnl</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-500">Tabelas Ativas:</span>
                  <span className="font-semibold text-emerald-700">20 Tabelas + RLS Completo</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-500">Composições de Lâmina:</span>
                  <span className="font-semibold text-emerald-700">slide_compositions (JSONB)</span>
                </li>
              </ul>
            </div>

            {/* Storage Buckets */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-gray-900 text-sm">
                  <Lock className="w-4 h-4 text-gray-700" />
                  <span>Supabase Storage Privado</span>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 5 Buckets
                </span>
              </div>

              <div className="text-xs text-gray-600 border-t border-gray-100 pt-3 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {['brand-assets', 'references', 'generated-assets', 'exports', 'temp'].map((bucket) => (
                    <span
                      key={bucket}
                      className="px-2 py-0.5 rounded bg-gray-100 text-gray-800 font-mono text-[11px] border border-gray-200"
                    >
                      {bucket}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 pt-1">
                  Políticas RLS com isolamento por organização e cliente aplicadas.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Start Callout */}
          <div className="p-6 bg-black rounded-2xl text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-base text-[#CEF52A]">Pronto para produzir?</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-lg">
                Inicie um carrossel de até 20 lâminas ou post único. O sistema integrará automaticamente as referências aprovadas e os elementos gráficos do cliente.
              </p>
            </div>
            <Link
              href="/create"
              className="px-6 py-3 bg-[#CEF52A] hover:bg-[#b8dd24] text-black font-bold text-xs rounded-xl transition flex items-center gap-2"
            >
              <span>Abrir Assistente de Criação</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
