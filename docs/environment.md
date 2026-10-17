# Studio FA — Configuração de Ambiente e Variáveis

## 1. Visão Geral

O **Studio FA** adota separação rigorosa entre configurações públicas do frontend e credenciais privilegiadas de backend.

> [!CAUTION]
> Chaves com privilégios de serviço (`service_role`) e API Keys de fornecedores de inteligência artificial (`OPENAI_API_KEY`) **JAMAIS** devem ser prefixadas com `NEXT_PUBLIC_` ou importadas no código cliente do navegador.

---

## 2. Dicionário de Variáveis de Ambiente

| Variável | Contexto | Obrigatória | Descrição |
| :--- | :--- | :---: | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Público (Browser & Server) | Sim | URL do projeto Supabase (`https://rfdossffdlayntmyqpnl.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Público (Browser & Server) | Sim | Chave anônima (JWT) do Supabase com restrições por RLS |
| `NEXT_PUBLIC_APP_URL` | Público (Browser & Server) | Não | URL base da aplicação web (`http://localhost:3000` em desenvolvimento) |
| `SUPABASE_URL` | Privado (Server-Side) | Sim | URL interna para o cliente Supabase server-side |
| `SUPABASE_SERVICE_ROLE_KEY` | Privado (Server-Side) | Opcional (Dev) / Sim (Admin) | Chave com privilégios administrativos do Supabase (ignora RLS, uso restrito a tarefas de sistema) |
| `OPENAI_API_KEY` | Privado (Server-Side) | Opcional (Zero-Cost local fallback) | Chave de API da OpenAI para geração e análise |
| `OPENAI_VISION_MODEL` | Privado (Server-Side) | Não (Default: `gpt-4o`) | Identificador do modelo de visão computacional |
| `OPENAI_IMAGE_MODEL` | Privado (Server-Side) | Não (Default: `gpt-image-2.5-flare`) | Modelo para preset de Produção |
| `OPENAI_IMAGE_FAST_MODEL` | Privado (Server-Side) | Não (Default: `gpt-image-2.5-flare`) | Modelo para preset Rápido |
| `OPENAI_IMAGE_PREMIUM_MODEL` | Privado (Server-Side) | Não (Default: `gpt-image-2.5-sunburst`) | Modelo para preset Premium |
| `OPENAI_EMBEDDING_MODEL` | Privado (Server-Side) | Não (Default: `text-embedding-3-small`) | Identificador do modelo de embeddings vetoriais |
| `AI_MAX_CONCURRENCY` | Privado (Server-Side) | Não (Default: `3`) | Limite máximo de concorrência simultânea para a fila de IA |
| `NODE_ENV` | Sistema | Não | Ambiente (`development`, `production`, `test`) |

---

## 3. Arquivos de Configuração

### `.env.example`
Arquivo versionado no Git contendo todos os nomes de variáveis necessários, com valores em branco ou de template. Não contém secrets reais.

### `.env.local`
Arquivo de desenvolvimento local ignorado pelo Git (`.gitignore`). Contém a URL do Supabase e a chave pública `anon`.

---

## 4. Executando Migrações no Supabase

As migrações SQL ficam versionadas no diretório `supabase/migrations/`.

Para aplicar via Supabase CLI:
```bash
# Linkar projeto (necessita de token de acesso ou senha do banco)
bunx supabase link --project-ref rfdossffdlayntmyqpnl

# Aplicar migrações
bunx supabase db push
```

Alternativamente, os arquivos em `supabase/migrations/` podem ser executados no **SQL Editor** do Supabase Dashboard na ordem numérica indicada.
