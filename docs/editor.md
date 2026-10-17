# Estúdio Visual & Editor de Composições — Studio FA

## Visão Geral

O **Estúdio Visual do Studio FA** (`/projects/[id]`) é a ferramenta de produção primária dos designers da agência FA. Projetado como uma aplicação desktop-first com tema escuro institucional (`#0B0F17` / `#0F1113`), ele une o poder da IA generativa com a precisão de um software gráfico profissional.

---

## 1. Arquitetura de 3 Colunas

```
┌────────────────────────────────────────────────────────────────────────┐
│  EditorHeader: Título • Status • Autosave • Undo/Redo • Zoom • Export   │
├──────────────┬──────────────────────────────────────────┬──────────────┤
│              │                                          │              │
│ SlidesPanel  │             StudioCanvas                 │InspectorPanel│
│              │          (Konva.js interativo)           │              │
│ - Miniaturas │                                          │ - Conteúdo   │
│ - Reordenar  │ - Arrastar & Redimensionar               │ - Estilo     │
│ - Duplicar   │ - Guias de Margem Segura                 │ - Camadas    │
│ - Adicionar  │ - Fundo IA + Texto + Logo Vetorial       │ - IA & Vars  │
│              │                                          │ - Referências│
└──────────────┴──────────────────────────────────────────┴──────────────┘
```

### 1.1 Painel Esquerdo (`SlidesPanel`)
- Lista de miniaturas ordenadas por `slide_index`.
- Indicador numérico e tipo de lâmina (`cover`, `content`, `cta`, `problem`, `solution`).
- Botões de mover para cima/baixo, duplicar lâmina e excluir lâmina.
- Botão "Adicionar Lâmina" para expansão contínua da narrativa.

### 1.2 Centro do Estúdio (`StudioCanvas`)
- Implementado em **HTML5 Canvas via Konva.js** (`react-konva` com import dinâmico `ssr: false`).
- Renderização hierárquica por `zIndex`.
- Manipulação visual interativa: seleção de camada, arrastar (`draggable`), redimensionar via `Transformer` com cantos de apoio.
- Guias de Margem Segura ativáveis/desativáveis com traço tracejado em verde FA (`#CEF52A`).

### 1.3 Painel Direito (`InspectorPanel`)
Organizado em 5 abas de alto desempenho:
1. **Conteúdo**: Edição de textos, peso da fonte, alinhamento (esquerda, centro, direita), controle de opacidade e botão **Auto-Fit**.
2. **Estilo**: Paleta cromática oficial do cliente (cores primárias, de fundo, texto e acento), tipografias detectadas e intensidade do overlay de legibilidade.
3. **Camadas**: Pilha de camadas com ordenação em tempo real (subir/descer), visibilidade (👁️), trava (🔒) e exclusão. Ações de adicionar texto, formas ou logos oficiais.
4. **IA & Variações**: Seleção de preset (Rápido, Produção, Premium), botão "Gerar Fundo da Lâmina", gerador de variações criativas com prompt customizado e histórico de versões do fundo.
5. **Referências Usadas**: Exibição das referências visuais aprovadas vinculadas àquele cliente.

---

## 2. Modelo de Dados da Composição (`SlideDocument`)

Cada lâmina é representada no banco de dados na tabela `slide_compositions` como um documento JSONB puro (`document`):

```typescript
export interface SlideDocument {
  version: number;
  canvas: {
    width: number;
    height: number;
    format: string;
    backgroundColor: string;
  };
  layers: Layer[]; // ImageLayer | TextLayer | LogoLayer | ShapeLayer | OverlayLayer
  metadata?: {
    slideId?: string;
    projectId?: string;
    clientId?: string;
    pinnedReferenceIds?: string[];
  };
}
```

---

## 3. Algoritmo de Auto-Fit (`fitTextToBox`)

Para evitar que títulos longos ultrapassem os limites da lâmina, a função `fitTextToBox` calcula iterativamente a redução ideal do tamanho da fonte:

```typescript
export function fitTextToBox(params: {
  text: string;
  fontSize: number;
  boxWidth: number;
  boxHeight: number;
  minFontSize?: number;
  lineHeight?: number;
}): { fontSize: number; overflowWarning: boolean }
```

- Se o texto ultrapassar a altura da caixa, a fonte é reduzida progressivamente de 2 em 2 pixels até o `minFontSize` (padrão 16px).
- Se ainda ultrapassar no tamanho mínimo, o sistema emite um alerta `overflowWarning = true`.

---

## 4. Salvamento Automático & Concorrência Otimista

- **Debounce de 1000ms**: Mudanças no documento disparam um timer de autosave para não sobrecarregar a rede durante digitações ou arrasto de camadas.
- **Controle de Revisão**: Cada gravação valida o `expectedRevision`. Se outro usuário gravou alterações na mesma lâmina, a API retorna `409 ConflictError`, impedindo sobrescritas acidentais.

---

## 5. Verificação de Marca (Brand Check)

O botão **Brand Check** executa auditorias heurísticas antes da exportação:
- **Overlay de Legibilidade**: Confirma se há camada de overlay ativo com opacidade $\ge 25\%$.
- **Presença do Logo Oficial**: Verifica se a lâmina inclui o logo da marca visível.
- **Overflow de Texto**: Detecta se algum texto está excedendo suas caixas delimitadoras.
- **Cores Oficiais**: Valida a harmonia com o DNA visual aprovado.

---

## 6. Pipeline de Exportação

- **Renderização Offscreen**: Utiliza um elemento `<canvas>` invisível em resolução nativa ($1080 \times 1350$, $1080 \times 1080$, $1080 \times 1920$) desenhando camadas na ordem exata de `zIndex`.
- **Download Individual (PNG)**: Gera Blob PNG de alta qualidade para a lâmina ativa.
- **Exportação em Lote (ZIP)**: Utiliza `JSZip` para empacotar todas as lâminas numeradas e higienizadas com o padrão `{client_slug}_{date}_slide-{index}.png`.
