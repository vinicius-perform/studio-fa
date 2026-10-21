# Studio FA — Remoção do Editor/Studio e Adoção do Chat Criativo como Núcleo Único

## 1. Contexto e Motivação
A arquitetura do Studio FA foi simplificada radicalmente no MVP 2.1. O antigo fluxo baseado em editor visual, canvas Konva, montagem manual de camadas, snapping, composition builder e divisão entre "fundo IA + texto Konva" foi completamente abandonado.

O novo núcleo de criação é exclusivamente conversacional:
**CLIENTE → REFERÊNCIAS → CHAT CRIATIVO → GERAÇÃO/EDIÇÃO CONVERSACIONAL → PRODUÇÕES → DOWNLOAD**.

---

## 2. Componentes e Códigos Removidos (`removed`)
- **Dependências npm**:
  - `konva` (^10.7.0)
  - `react-konva` (18.2.10)
- **Componentes do Editor**:
  - `src/components/editor/StudioCanvas.tsx`
  - `src/components/editor/EditorHeader.tsx`
  - `src/components/editor/InspectorPanel.tsx`
  - `src/components/editor/SlidesPanel.tsx`
  - `src/lib/canvas-snapping.ts`
  - `src/lib/font-loader.ts`
- **Rotas de API Legadas de Editor**:
  - `src/app/api/compositions/route.ts`
  - `src/app/api/compositions/regenerate/route.ts`
  - `src/app/api/assets/raw/route.ts`
  - `src/app/api/creative-plan/route.ts`
- **Renderização de Canvas no Export**:
  - Remoção de `renderDocumentToCanvas` em `ExportService`. O download agora é direto do asset original (`triggerBrowserDownload` e `exportCarouselZip`).

---

## 3. Rotas Redirecionadas ou Transformadas (`redirected`)
- `/create` → Redireciona via 307 / client replacement para `/creative-chat`.
- `/create/chat` → Redireciona para `/creative-chat`.
- `/projects/[id]` → Transformada de Editor Konva para **Detalhe da Produção**:
  - Exibição da imagem final em alta resolução.
  - Metadados do cliente, formato, contagem de lâminas e data.
  - Download direto do arquivo PNG/JPEG da imagem.
  - Ação **"Continuar no Chat"** para refinar ou criar novas lâminas.
  - Arquivamento / desarquivamento.

---

## 4. Módulos e Ativos Preservados (`kept`)
- **Autenticação & Governança**: Supabase Auth, RBAC (Owner, Admin, Designer, Viewer), isolamento multi-tenant por organização.
- **Login**: Suporte a Email/Senha e OAuth Google (`Continuar com o Google`).
- **Clientes & Memória da Marca**:
  - Cadastro de clientes, Brand Kit, logos oficiais, custom fonts.
  - `client_pieces` (referências visuais enviadas e analisadas).
  - Brand DNA e `brand_dna_versions`.
- **Motor de IA Multimodal**:
  - Integração oficial OpenAI com credenciais criptografadas.
  - GPT Image 2.5 (`gpt-image-2.5-flare` e `gpt-image-2.5-sunburst`).
  - OpenAI Vision (`gpt-4o`) para leitura e análise visual de referências.
  - Proteção estrita contra modelos legados (`dall-e-2`, `dall-e-3`).
- **Armazenamento Seguro**: Buckets privados do Supabase Storage (`client-brand-assets`, `client-pieces`, `generated-assets`).
- **Produções**: Galeria de imagens salvas e detalhe de visualização.

---

## 5. Candidatos a Remoção Futura no Banco de Dados (`database legacy candidates`)
Nenhum comando DROP destrutivo foi executado nesta entrega para assegurar que dados históricos permaneçam íntegros. Em limpezas estruturais futuras, as seguintes tabelas poderão ser descontinuadas com segurança:
1. `public.slide_compositions` (layers e JSON de composições de canvas)
2. `public.creative_plans` (planos de design rígidos pré-Konva)
3. `public.ai_jobs` (antiga fila assíncrona de injeção de background no canvas)
