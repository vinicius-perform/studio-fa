# Fila Assíncrona de IA & Rastreabilidade de Custos — Studio FA

## Visão Geral

A geração de imagens e direção criativa por IA no Studio FA é executada através de uma **fila assíncrona durável** no PostgreSQL (`ai_jobs`). Isso isola a interface do usuário da latência dos modelos generativos (15 a 45 segundos) e garante tolerância a falhas, concorrência controlada e rastreabilidade total de custos operacionais.

---

## 1. Ciclo de Vida do Job

```
[ POST /api/jobs ]
       │
       ▼
  Status: queued ──(concorrência máx: 3)──► Status: processing
                                                  │
                                                  ├─► Sucesso: completed ──► Injeta camada no Canvas
                                                  │
                                                  └─► Falha: attempts < 3 ? queued : failed
```

1. **`queued`**: O job é registrado com prioridade (padrão 10) e chave de idempotência exclusiva.
2. **`processing`**: O worker assume o job, registra timestamp de início e executa a compilação e chamada ao modelo.
3. **`completed`**: O fundo gerado é salvo no Supabase Storage (`generated-assets`), registrado em `client_assets` e injetado na composição da lâmina sem alterar o texto.
4. **`failed`**: Em caso de erro de rede ou do provedor, o contador `attempts` é incrementado. Até 3 tentativas são permitidas antes da marcação definitiva como falha.

---

## 2. Pipeline de Processamento (`QueueService.processJob`)

Cada job executa uma sequência de 12 etapas transacionais:

1. **Lock e Verificação**: Bloqueia o job e impede execuções concorrentes duplicadas.
2. **Carregamento do DNA Visual**: Recupera o `BrandProfile` aprovado do cliente.
3. **Recuperação da Lâmina & Plano**: Carrega os textos e a intenção visual definida no plano.
4. **Compilação de Prompt**: Invoca o `PromptCompiler` com cálculo de espaço negativo e proibições de texto.
5. **Registro de Requisição (`generation_requests`)**: Grava snapshot imutável do prompt compilado para auditoria e reproduzibilidade.
6. **Execução no Provedor (`OpenAIProvider`)**: Executa a geração via API oficial ou fallback determinístico Zero-Cost.
7. **Persistência de Asset (`client_assets`)**: Registra a nova imagem na categoria `generated_image` no bucket `generated-assets`.
8. **Vínculo de Saída (`generation_outputs`)**: Associa a saída gerada ao request original.
9. **Telemetria de Custos (`ai_usage_events`)**: Grava tokens consumidos e custo financeiro estimado/real (ex: $0.04 USD por imagem).
10. **Injeção Não-Destrutiva no Canvas**: Atualiza `slide_compositions`, adicionando ou substituindo a camada de fundo (`layer-bg`) sem alterar as camadas de texto (`TextLayer`) ou logo (`LogoLayer`).
11. **Histórico de Imagens (`imageHistory`)**: Adiciona a nova imagem ao histórico da lâmina, permitindo ao designer alternar entre versões a qualquer momento.
12. **Finalização**: Marca a lâmina como `ready` e o job como `completed`.

---

## 3. Garantia Zero-Cost (Zero-Cost Guarantee)

Para testes, desenvolvimento e ambientes sem chave de API configurada:
- Quando a variável de ambiente `OPENAI_API_KEY` estiver ausente, o sistema ativa automaticamente um gerador de SVG determinístico vetorial de alta definição com as cores exatas do cliente.
- A requisição registra custo de **$0.00 USD**, assegurando que nenhuma chamada paga não autorizada seja executada acidentalmente.

---

## 4. Concorrência e Idempotência

- **Limite de Concorrência**: `AI_MAX_CONCURRENCY = 3` controla a quantidade máxima de chamadas paralelas de difusão de imagens por organização.
- **Chave de Idempotência**: `gen_{projectId}_{slideId}_{timestamp}_{random}` impede que cliques múltiplos do usuário gerem jobs duplicados no banco de dados.
