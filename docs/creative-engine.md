# Motor Criativo & Engenharia de Prompts — Studio FA

## Visão Geral

O **Motor Criativo do Studio FA** é o núcleo de inteligência responsável por transformar diretrizes brutas de clientes, briefs de campanhas e perfis de DNA visual em peças de design estruturadas, editáveis e de altíssima conversão.

Ao contrário de geradores genéricos de imagens que "achatam" todo o design (texto, logos, fundos) em uma imagem estática e ilegível com caracteres corrompidos, o Studio FA adota o **Princípio da Composição Híbrida**:

$$\text{Peça Final} = \text{Fundo Fotográfico IA} + \text{Overlays Vetoriais} + \text{Tipografia Editável} + \text{Logos Oficiais}$$

---

## 1. Princípio de Não-Achatação (Anti-Text Baking)

O maior erro de ferramentas de IA para design é instruir o modelo a desenhar letras e marcas. No Studio FA:

1. **A IA visual é estritamente proibida de renderizar texto**: A seção `[STRICT DO NOT]` de todos os prompts proíbe formalmente letras, slogans, números, marcas d'água e elementos de interface.
2. **Espaço Negativo Intencional**: O `PromptCompiler` analisa as coordenadas $(x, y, w, h)$ onde a tipografia será posicionada (por exemplo, metade esquerda da tela) e instrui a IA a concentrar elementos cênicos e pontos focais no lado oposto (metade direita), preservando uma área limpa e de alto contraste para o texto.
3. **Preservação de Copy**: Quando o designer digita um título ("Como Escalar seu Design System"), o motor criativo retém essa cópia verbatim, sem resumos ou alterações arbitrárias.
4. **Logos Oficiais Vetoriais/PNG**: O logo institucional do cliente é carregado diretamente do Supabase Storage e renderizado em camada isolada, garantindo 100% de precisão de proporção e clareza.

---

## 2. Compilador de Prompts (`PromptCompiler`)

Cada chamada ao modelo visual é construída a partir de 10 seções modulares:

| Seção | Objetivo |
| :--- | :--- |
| `[OBJECTIVE]` | Contexto da publicação (Feed 4:5, Story ou Quadrado), tema da lâmina e objetivo comercial. |
| `[BRAND DIRECTION]` | Resumo estético, moodboard da marca, nível de sofisticação e contraste cromático. |
| `[SCENE]` | Cenário visual, conceito da lâmina, override de variação e diretivas específicas do designer. |
| `[COMPOSITION & NEGATIVE SPACE]` | Proporção geométrica estrita, cálculo dinâmico de espaço negativo e regras de hierarquia. |
| `[PHOTOGRAPHY & LIGHTING]` | Iluminação (natural, direcional, neon sutil), tratamento de textura e acabamento fotográfico. |
| `[COLOR PALETTE]` | Cores primárias, de fundo e de acento ($#CEF52A$ etc.), evitando saturação excessiva. |
| `[GRAPHIC STYLE]` | Padrões gráficos sutis aprovados no manual do cliente (grids, cantos arredondados, etc.). |
| `[REFERENCE GUIDANCE]` | Descrição textual das referências aprovadas fixadas na memória visual do cliente. |
| `[CONSTRAINTS]` | Enquadramento seguro com margens protegidas contra cortes de feed e interfaces nativas. |
| `[STRICT DO NOT]` | Proibição absoluta de tipografia, letras, logotipos desenhados e poluição visual. |

---

## 3. Matemática de Dimensões e Múltiplos de 16

Modelos de difusão de imagens contemporâneos (como o motor OpenAI GPT Image) exigem que as dimensões de entrada sejam estritamente divisíveis por 16. O Studio FA resolve isso com mapeamento nativo:

| Formato | Geração IA (múltiplo de 16) | Exportação Final Instagram | Proporção | Tratamento de Borda |
| :--- | :--- | :--- | :--- | :--- |
| **Feed 4:5** (Padrão) | $1088 \times 1360 \text{ px}$ | $1080 \times 1350 \text{ px}$ | 4:5 | Renderizado em $1080 \times 1350$ com proporção 0.8 exata. |
| **Quadrado 1:1** | $1088 \times 1088 \text{ px}$ | $1080 \times 1080 \text{ px}$ | 1:1 | Proporção 1.0 exata. |
| **Story / Reels 9:16** | $1088 \times 1920 \text{ px}$ | $1080 \times 1920 \text{ px}$ | 9:16 | Corte horizontal de 8 px (4 px à esquerda e 4 px à direita). |

### Margens de Segurança (Safe Areas)

- **Instagram Feed**: Margem superior de 60 px, inferior de 80 px e laterais de 60 px.
- **Instagram Story**: Margem superior de 220 px (protege foto de perfil e header do Instagram) e margem inferior de 220 px (protege caixa de resposta e botões de compartilhamento).

---

## 4. Presets Operacionais de Geração

O Studio FA oferece 3 presets parametrizados via `src/config/presets.ts`:

1. **Rápido (`fast`)**: Latência ultrabaixa (~15s) para exploração de ideias e rascunhos ágeis. Modelo `gpt-image-2.5-flare`.
2. **Produção (`production`)**: Padrão de equilíbrio ideal entre qualidade, custo e tempo (~25s). Modelo `gpt-image-2.5-flare`.
3. **Premium (`premium`)**: Máxima definição, texturas e fidelidade fotográfica (~40s). Modelo `gpt-image-2.5-sunburst`.
