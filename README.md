# Studio FA

> Sistema Operacional de Produção Criativa e Gestão Visual da Agência FA

O **Studio FA** é uma aplicação interna projetada para acelerar, padronizar e organizar a produção de peças de design para aproximadamente 60 clientes da FA, com arquitetura preparada para escala multi-organização.

---

## 📌 Status do Projeto

- [x] **FASE 1 — Backend, Supabase, Banco de Dados, Autenticação, Storage e Fundação da IA** (Concluída)
- [x] **FASE 2 — Cadastro de clientes e memória visual** (Concluída)
- [x] **FASE 3 — Estúdio de criação de posts e carrosséis com IA** (Concluída)

---

## 🎨 O que foi construído na FASE 3

1. **Assistente de Criação (`/create`)**:
   - Seletor inteligente de clientes com verificação do status de DNA visual.
   - Escolha entre **Post Único** e **Carrossel Narrativo** (2 a 20 lâminas).
   - Suporte aos formatos nativos do Instagram: **Feed 4:5** ($1080 \times 1350$), **Quadrado 1:1** ($1080 \times 1080$) e **Story 9:16** ($1080 \times 1920$).
   - Coleta estruturada de títulos, subtítulos, corpo, CTAs e instruções visuais específicas por lâmina.

2. **Estúdio Visual Completo (`/projects/[id]`)**:
   - Layout desktop em 3 colunas:
     - **Painel de Lâminas (Esquerda)**: Miniaturas, ordenação, adição, duplicação e exclusão.
     - **Canvas Interativo (Centro)**: Desenvolvido com Konva.js (`react-konva`), suportando seleção, arrasto, transformação livre, zoom e guias de margem segura.
     - **Inspetor Lateral (Direita)**: 5 abas (`Conteúdo`, `Estilo`, `Camadas`, `IA & Variações`, `Referências`).
   - Algoritmo de **Auto-Fit** (`fitTextToBox`) com escala progressiva e detecção de overflow.
   - **Autosave com Concorrência Otimista**: Controle de revisão (`expectedRevision`) com prevenção de conflitos (`409 ConflictError`).
   - **Brand Check**: Validação heurística de contraste, presença do logo oficial e áreas de respiro.
   - **Exportação em Alta Resolução**: Renderização offscreen pixel-perfect em PNG e geração de pacotes ZIP completos via `JSZip`.
   - **Aprovação de Produção**: Integração imediata das peças aprovadas ao pool de referências visuais do cliente.

3. **Motor Criativo & Fila Assíncrona de IA**:
   - **Princípio Anti-Text Baking**: Fundo fotográfico gerado por IA + tipografia vetorial editável em camadas separadas + logos oficiais não distorcidos.
   - **Compilador Modular de Prompts (`PromptCompiler`)**: 10 seções estruturadas com cálculo dinâmico de espaço negativo e proibição explícita de tipografia dentro da imagem.
   - **Fila Assíncrona Durável (`ai_jobs`)**: Processamento com rastreabilidade total de custos (`ai_usage_events`), snapshots imutáveis (`generation_requests`) e injeção não-destrutiva de fundos com histórico (`imageHistory`).
   - **Garantia Zero-Cost**: Fallback determinístico vetorial (SVG) quando a chave de API não estiver configurada.

---

## 🛠️ Stack Tecnológica

- **Framework Web**: Next.js 14 (App Router) + React 18
- **Linguagem**: TypeScript (Strict Mode)
- **Estilização**: Tailwind CSS (Design System da FA: `#0B0F17`, canvas claro, destaque `#CEF52A`)
- **Backend & Banco de Dados**: Supabase (PostgreSQL 15+ & extensão `vector`)
- **Autenticação**: Supabase Auth (Trigger de perfil automático e isolamento por papéis)
- **Armazenamento**: Supabase Storage (5 Buckets 100% privados com RLS de tenancy)
- **Serverless**: Supabase Edge Functions (Deno runtime)
- **Validação de Dados**: Zod
- **Testes & Runtime**: Bun Test

---

## 🚀 Instalação e Execução

### Pré-requisitos
- [Bun](https://bun.sh) (v1.4+) ou [Node.js](https://nodejs.org) (v20+)
- Conta e acesso ao projeto Supabase `rfdossffdlayntmyqpnl`

### 1. Clonar e Instalar Dependências
```bash
git clone <repo-url> studio-fa
cd studio-fa
bun install
```

### 2. Configurar Variáveis de Ambiente
Copie o template de desenvolvimento:
```bash
cp .env.example .env.local
```
Preencha `.env.local` com as chaves do projeto Supabase (`rfdossffdlayntmyqpnl`):
```env
NEXT_PUBLIC_SUPABASE_URL=https://rfdossffdlayntmyqpnl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Migrações do Banco de Dados
Todas as migrações versionadas estão em `supabase/migrations/`:
1. `20261001000001_extensions_and_helpers.sql` (uuid-ossp, pgcrypto, vector, set_updated_at)
2. `20261001000002_profiles_and_auth.sql` (profiles, trigger de auto-criação)
3. `20261001000003_organizations_and_members.sql` (organizations, roles, helpers RLS)
4. `20261001000004_clients_and_assets.sql` (clients, client_assets e índices)
5. `20261001000005_brand_references_and_profiles.sql` (brand_profiles, single approved constraint, approve_brand_profile RPC)
6. `20261001000006_embeddings_and_search.sql` (reference_embeddings, HNSW index, match_brand_references RPC)
7. `20261001000007_projects_and_slides.sql` (projects, project_slides, project_versions)
8. `20261001000008_ai_system_and_governance.sql` (generation_requests, outputs, ai_jobs, usage, approvals, audit_logs)
9. `20261001000009_storage_and_storage_policies.sql` (5 buckets privados e Storage RLS)
10. `20261001000010_initial_seed_fa.sql` (Seed da organização FA)

Para aplicar:
```bash
bunx supabase db push
```

### 4. Executar em Desenvolvimento
```bash
bun run dev
```
Acesse [http://localhost:3000](http://localhost:3000).

---

## 🧪 Testes e Validação de Qualidade

Executar suíte de testes de isolamento RLS, Storage e IA:
```bash
bun test
```

Executar verificação estrita de tipagem TypeScript:
```bash
bun run typecheck
```

Executar linter:
```bash
bun run lint
```

Executar build de produção:
```bash
bun run build
```

---

## 📁 Estrutura do Projeto

```txt
studio-fa/
├── docs/                      # Documentação técnica e de arquitetura
│   ├── architecture.md        # Arquitetura geral e diagramas
│   ├── database.md            # Dicionário do banco, enums, RPCs e índices
│   ├── environment.md         # Gestão de variáveis e segurança
│   ├── creative-engine.md     # Motor criativo e engenharia de prompts
│   ├── editor.md              # Estúdio visual, Konva e concorrência otimista
│   └── ai-jobs.md             # Fila assíncrona durável de IA e telemetria
├── src/
│   ├── app/                   # Next.js App Router (layout, shell e APIs)
│   ├── config/                # Validador de variáveis de ambiente com Zod
│   ├── lib/                   # Supabase clients (browser, server, admin), logger, erros
│   ├── services/              # Camada de serviços de domínio
│   │   ├── ai/                # Abstração de IA (AIProvider, OpenAIProvider, AIService)
│   │   ├── assets/            # Gestão de assets e Storage
│   │   ├── auth/              # Autenticação e perfis
│   │   ├── brands/            # Brand Profile, aprovação atômica e referências
│   │   ├── clients/           # Gestão de clientes
│   │   ├── organizations/     # Multi-tenancy e membresias
│   │   └── projects/          # Projetos, slides e versionamento
│   └── types/                 # Tipos gerados do Supabase e schemas Zod
├── supabase/
│   ├── functions/             # Supabase Edge Functions (health, ai-status, storage-sign)
│   └── migrations/            # 10 migrações SQL versionadas e testadas
├── tests/                     # Testes automatizados (RLS, Storage, Brand Profile, IA)
├── tailwind.config.ts         # Configuração de design da FA (#CEF52A, #0B0F17)
└── README.md
```

---

## 🔒 Princípios de Segurança

1. **Multi-Tenancy**: Cada query respeita o `organization_id` do usuário autenticado.
2. **Zero Leaks de Secrets**: Chaves privadas (`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`) rodam estritamente server-side.
3. **Storage Protegido**: Arquivos são acessados apenas via URLs assinadas temporárias ou verificação RLS no bucket.
4. **Idempotência**: Requisições de IA e jobs suportam `idempotency_key` prevenindo custos duplicados.
