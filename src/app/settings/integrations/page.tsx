// src/app/settings/integrations/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import {
  Settings,
  Sparkles,
  Database,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Lock,
  Trash2,
  ShieldCheck,
  Cpu,
  Key,
} from 'lucide-react';

interface IntegrationInfo {
  provider: string;
  configured: boolean;
  maskedSecret?: string;
  status: 'connected' | 'unconfigured' | 'error';
  lastTestedAt?: string | null;
  settings?: {
    textModel?: string;
    visionModel?: string;
    imageModel?: string;
  };
}

interface SupabaseHealth {
  status: 'healthy' | 'degraded' | 'unreachable';
  projectRef: string;
  database: boolean;
  auth: boolean;
  storage: boolean;
  checkedAt: string;
  error?: string;
}

export default function IntegrationsPage() {
  const [openaiInfo, setOpenaiInfo] = useState<IntegrationInfo | null>(null);
  const [supabaseHealth, setSupabaseHealth] = useState<SupabaseHealth | null>(null);
  const [loading, setLoading] = useState(true);

  // OpenAI Form State
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [textModel, setTextModel] = useState('gpt-4o');
  const [visionModel, setVisionModel] = useState('gpt-4o');
  const [imageModel, setImageModel] = useState('dall-e-3');

  const [savingOpenAI, setSavingOpenAI] = useState(false);
  const [testingOpenAI, setTestingOpenAI] = useState(false);
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchIntegrations = async () => {
    try {
      const res = await fetch('/api/settings/integrations');
      if (res.ok) {
        const data = await res.json();
        if (data.openai) {
          setOpenaiInfo(data.openai);
          setTextModel(data.openai.settings?.textModel || 'gpt-4o');
          setVisionModel(data.openai.settings?.visionModel || 'gpt-4o');
          setImageModel(data.openai.settings?.imageModel || 'dall-e-3');
        }
      }
    } catch (e) {
      console.error('Falha ao carregar integrações:', e);
    } finally {
      setLoading(false);
    }
  };

  const checkSupabaseHealth = async () => {
    setTestingSupabase(true);
    try {
      const res = await fetch('/api/settings/integrations/supabase-health');
      if (res.ok) {
        const data = await res.json();
        setSupabaseHealth(data);
      }
    } catch (e) {
      console.error('Falha ao verificar saúde do Supabase:', e);
    } finally {
      setTestingSupabase(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
    checkSupabaseHealth();
  }, []);

  const handleSaveOpenAI = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOpenAI(true);
    setFeedback(null);

    try {
      const payload: any = {
        provider: 'openai',
        settings: { textModel, visionModel, imageModel },
      };

      if (apiKeyInput.trim()) {
        payload.apiKey = apiKeyInput.trim();
      }

      const res = await fetch('/api/settings/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Falha ao salvar integração.');
      }

      setFeedback({ type: 'success', message: 'Configurações da OpenAI salvas com sucesso!' });
      setApiKeyInput('');
      fetchIntegrations();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erro ao salvar credenciais.' });
    } finally {
      setSavingOpenAI(false);
    }
  };

  const handleTestOpenAI = async () => {
    setTestingOpenAI(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/settings/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKeyInput.trim() || undefined }),
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({ type: 'success', message: data.message });
      } else {
        setFeedback({ type: 'error', message: data.message });
      }
      fetchIntegrations();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erro ao testar conexão.' });
    } finally {
      setTestingOpenAI(false);
    }
  };

  const handleRemoveOpenAI = async () => {
    if (!confirm('Deseja realmente desvincular a integração com a OpenAI desta organização?')) return;
    setSavingOpenAI(true);
    try {
      const res = await fetch('/api/settings/integrations?provider=openai', {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message);
      setFeedback({ type: 'success', message: 'Integração OpenAI removida com sucesso.' });
      setApiKeyInput('');
      fetchIntegrations();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erro ao remover integração.' });
    } finally {
      setSavingOpenAI(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-canvas-bg font-sans">
      <AppSidebar />

      <main className="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-1">
            <Settings className="w-6 h-6 text-fa-green" />
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Integrações</h1>
          </div>
          <p className="text-sm text-gray-500">
            Gerencie os provedores de inteligência artificial e serviços de infraestrutura do Studio FA.
          </p>
        </div>

        {feedback && (
          <div
            className={`mb-6 p-4 rounded-xl text-sm flex items-center gap-3 ${
              feedback.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card: OpenAI */}
          <div className="bg-canvas-card border border-canvas-border rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-canvas-border mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center font-bold">
                    <Sparkles className="w-5 h-5 text-fa-green" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-gray-900">OpenAI</h2>
                    <p className="text-xs text-gray-500">LLM, Visão Computacional e Difusão de Imagem</p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    openaiInfo?.status === 'connected'
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : openaiInfo?.status === 'error'
                      ? 'bg-red-100 text-red-800 border border-red-200'
                      : 'bg-gray-100 text-gray-700 border border-gray-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      openaiInfo?.status === 'connected'
                        ? 'bg-green-500'
                        : openaiInfo?.status === 'error'
                        ? 'bg-red-500'
                        : 'bg-gray-400'
                    }`}
                  />
                  {openaiInfo?.status === 'connected'
                    ? 'Conectado'
                    : openaiInfo?.status === 'error'
                    ? 'Erro na Conexão'
                    : 'Não Configurado'}
                </span>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed mb-5">
                Utilizado para o motor de análise visual de identidade, extração de diretrizes de marca,
                redação de copys editoriais e geração de artes fotográficas via DALL-E-3.
              </p>

              {openaiInfo?.configured && (
                <div className="mb-5 p-3.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Lock className="w-4 h-4 text-gray-500 shrink-0" />
                    <div>
                      <p className="text-[11px] text-gray-500 font-medium">Chave Ativa Protegida</p>
                      <p className="font-mono text-xs font-bold text-gray-800">{openaiInfo.maskedSecret}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-green-700 bg-green-100 px-2 py-0.5 rounded font-semibold">
                    AES-256-GCM
                  </span>
                </div>
              )}

              <form onSubmit={handleSaveOpenAI} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {openaiInfo?.configured ? 'Atualizar Chave (API Key)' : 'Chave de API (OPENAI_API_KEY)'}
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder={openaiInfo?.configured ? 'Deixe em branco para manter a atual' : 'sk-proj-...'}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-fa-green/50 text-gray-900 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Modelo de Texto</label>
                    <select
                      value={textModel}
                      onChange={(e) => setTextModel(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-800"
                    >
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="gpt-4o-mini">gpt-4o-mini</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Modelo Visual</label>
                    <select
                      value={visionModel}
                      onChange={(e) => setVisionModel(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-800"
                    >
                      <option value="gpt-4o">gpt-4o</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Modelo Imagem</label>
                    <select
                      value={imageModel}
                      onChange={(e) => setImageModel(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-800"
                    >
                      <option value="dall-e-3">dall-e-3</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={savingOpenAI}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-fa-dark hover:bg-black rounded-xl transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {savingOpenAI && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Salvar Configuração</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleTestOpenAI}
                      disabled={testingOpenAI || (!openaiInfo?.configured && !apiKeyInput)}
                      className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {testingOpenAI && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Testar Conexão</span>
                    </button>
                  </div>

                  {openaiInfo?.configured && (
                    <button
                      type="button"
                      onClick={handleRemoveOpenAI}
                      disabled={savingOpenAI}
                      title="Remover chave"
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Card: Supabase */}
          <div className="bg-canvas-card border border-canvas-border rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-canvas-border mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-950 text-white flex items-center justify-center font-bold">
                    <Database className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-gray-900">Supabase (PostgreSQL & BaaS)</h2>
                    <p className="text-xs text-gray-500 font-mono">Ref: {supabaseHealth?.projectRef || 'rfdossffdlayntmyqpnl'}</p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    supabaseHealth?.status === 'healthy'
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : supabaseHealth?.status === 'degraded'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-red-100 text-red-800 border border-red-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      supabaseHealth?.status === 'healthy'
                        ? 'bg-green-500'
                        : supabaseHealth?.status === 'degraded'
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                  />
                  {supabaseHealth?.status === 'healthy'
                    ? 'Operacional'
                    : supabaseHealth?.status === 'degraded'
                    ? 'Parcial'
                    : 'Inacessível'}
                </span>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed mb-5">
                Infraestrutura central de persistência: banco de dados PostgreSQL com Row Level Security (RLS),
                autenticação GoTrue e buckets para armazenamento seguro de assets e composições.
              </p>

              <div className="space-y-2.5 mb-6">
                <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-xs font-semibold text-gray-700">Banco de Dados (PostgreSQL)</span>
                  <span
                    className={`text-xs font-bold ${
                      supabaseHealth?.database ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {supabaseHealth?.database ? 'Conectado' : 'Indisponível'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-xs font-semibold text-gray-700">Serviço de Autenticação (Auth)</span>
                  <span
                    className={`text-xs font-bold ${
                      supabaseHealth?.auth ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {supabaseHealth?.auth ? 'Ativo' : 'Indisponível'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-xs font-semibold text-gray-700">Armazenamento de Arquivos (Storage)</span>
                  <span
                    className={`text-xs font-bold ${
                      supabaseHealth?.storage ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {supabaseHealth?.storage ? 'Ativo' : 'Indisponível'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2 mb-6">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Por diretriz estrita de segurança, as chaves Service Role do Supabase não são editáveis pelo navegador
                  e residem exclusivamente no servidor.
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-canvas-border flex items-center justify-between">
              <span className="text-[11px] text-gray-400">
                Última checagem:{' '}
                {supabaseHealth?.checkedAt
                  ? new Date(supabaseHealth.checkedAt).toLocaleTimeString('pt-BR')
                  : 'N/A'}
              </span>

              <button
                type="button"
                onClick={checkSupabaseHealth}
                disabled={testingSupabase}
                className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingSupabase ? 'animate-spin' : ''}`} />
                <span>Verificar Conexão</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
