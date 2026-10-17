# Studio FA — Handoff para FASE 2: Cadastro de Clientes e Memória Visual

## 1. Visão do Handoff

A **FASE 1 (Backend, Supabase, Banco de Dados, Autenticação, Storage e Fundação da IA)** está 100% implementada e verificada.
A infraestrutura está pronta para receber a construção da interface e funcionalidades da **FASE 2**, sem qualquer necessidade de refazer o banco ou alterar modelos fundamentais.

---

## 2. O que Está Disponível para a FASE 2

### 2.1 Modelagem e Banco de Dados (Supabase PostgreSQL + pgvector)
- **Organizações e Membros**: A organização padrão **FA** (`slug: fa`) já está provisionada. Suporte total a múltiplos papéis (`owner`, `admin`, `manager`, `designer`, `viewer`).
- **Tabela `clients`**:
  - Campos completos: `name`, `slug`, `legal_name`, `niche`, `instagram_handle`, `website`, `city`, `state`, `country`, `notes`, `status`, `brand_status`.
  - Estados de marca: `empty`, `collecting`, `analyzing`, `ready`, `needs_review`.
- **Tabela `client_assets`**:
  - Metadados preparados para logos primários, secundários, monocromáticos, fontes (TTF/OTF/WOFF/WOFF2), manuais (PDF), ícones, client photos e base images.
- **Tabela `brand_references`**:
  - Pronta para referências visuais com tags, scores de qualidade e features detectadas.
- **Tabela `brand_profiles`**:
  - Versionamento completo (`client_id + version`).
  - Constraint garantindo estritamente **no máximo 1 perfil aprovado** por cliente.
  - RPC atômico `approve_brand_profile(p_profile_id UUID)`.
- **Busca Semântica (`pgvector`)**:
  - Tabela `reference_embeddings` com 1536 dimensões e índice HNSW.
  - RPC `match_brand_references` isolado por cliente e organização.

### 2.2 Storage Privado
- 5 Buckets operacionais com RLS:
  1. `client-brand-assets`
  2. `brand-references`
  3. `client-inputs`
  4. `generated-assets`
  5. `exports`
- Helper `buildStoragePath({ organizationId, clientId, category, filename })` gerando caminhos normalizados:
  `{org_id}/{client_id}/{category}/{uuid}.{ext}`.

### 2.3 Camada de Serviços Pronta para Consumo
- `OrganizationService` (`src/services/organizations/organization.service.ts`)
- `ClientService` (`src/services/clients/client.service.ts`)
- `BrandService` (`src/services/brands/brand.service.ts`)
- `AssetService` (`src/services/assets/asset.service.ts`)
- `AuthService` (`src/services/auth/auth.service.ts`)
- `AIService` (`src/services/ai/ai.service.ts`)

### 2.4 Validação e Schemas
- `BrandProfileSchema` e tipos estritos prontos em `src/types/domain/brand.ts`.
- `CreateClientSchema`, `UpdateClientSchema` em `src/types/domain/client.ts`.
- `CreateClientAssetSchema` em `src/types/domain/asset.ts`.

---

## 3. Diretrizes para o Início da FASE 2

Ao iniciar a Fase 2:
1. **Páginas a construir**:
   - `/clients`: Listagem dos clientes com status de marca e filtros.
   - `/clients/new`: Formulário de criação de clientes.
   - `/clients/[id]`: Visão geral do cliente.
   - `/clients/[id]/brand`: Gestão de ativos visuais, upload de logos, fontes, manuais e histórico de versões do Brand Profile.
2. **Consumo Direto**:
   - Utilizar diretamente os métodos de `ClientService` e `BrandService`.
   - Utilizar `AssetService` para upload seguro no Supabase Storage.
   - Utilizar a RPC `approve_brand_profile` para aprovar identidades visuais de clientes.
