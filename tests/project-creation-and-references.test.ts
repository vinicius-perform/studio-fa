import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ProjectService } from '../src/services/projects/project.service';

describe('Correções de Produção: Criação de Projetos e Referências de Clientes', () => {
  test('ProjectService.create não deve duplicar slide 0 e deve suportar addSlide com upsert', async () => {
    const mockSlides: any[] = [];
    const mockProjects: any[] = [];

    const mockSupabase: any = {
      from: (table: string) => {
        if (table === 'projects') {
          return {
            insert: (payload: any) => ({
              select: () => ({
                single: async () => {
                  const row = { id: '44444444-4444-4444-4444-444444444444', ...payload };
                  mockProjects.push(row);
                  return { data: row, error: null };
                },
              }),
            }),
          };
        }
        if (table === 'project_slides') {
          return {
            insert: async (payload: any) => {
              const row = { id: `slide-${mockSlides.length + 1}`, ...payload };
              mockSlides.push(row);
              return { data: row, error: null };
            },
            upsert: (payload: any, options: any) => ({
              select: () => ({
                single: async () => {
                  const existingIndex = mockSlides.findIndex(
                    (s) => s.project_id === payload.project_id && s.slide_index === payload.slide_index
                  );
                  if (existingIndex >= 0) {
                    mockSlides[existingIndex] = { ...mockSlides[existingIndex], ...payload };
                    return { data: mockSlides[existingIndex], error: null };
                  }
                  const row = { id: `slide-${mockSlides.length + 1}`, ...payload };
                  mockSlides.push(row);
                  return { data: row, error: null };
                },
              }),
            }),
          };
        }
        throw new Error(`Tabela desconhecida: ${table}`);
      },
    };

    const projectService = new ProjectService(mockSupabase);

    // 1. Criar projeto sem autoCreateSlide0 (padrão do fluxo de produções)
    const project = await projectService.create(
      {
        organization_id: '11111111-1111-1111-1111-111111111111',
        client_id: '22222222-2222-2222-2222-222222222222',
        title: 'Post de Teste',
        project_type: 'single_post',
        format: 'instagram_feed_4_5',
        status: 'draft',
      },
      '33333333-3333-3333-3333-333333333333'
    );

    assert.strictEqual(project.id, '44444444-4444-4444-4444-444444444444');
    // Não deve ter criado nenhum slide automaticamente
    assert.strictEqual(mockSlides.length, 0);

    // 2. Chamar addSlide para slide_index: 0
    const slide0 = await projectService.addSlide({
      organization_id: '11111111-1111-1111-1111-111111111111',
      project_id: project.id,
      slide_index: 0,
      title: 'Título Configurado pelo Usuário',
      body: 'Corpo do post',
      status: 'draft',
    });

    assert.strictEqual(slide0.slide_index, 0);
    assert.strictEqual(slide0.title, 'Título Configurado pelo Usuário');
    assert.strictEqual(mockSlides.length, 1);

    // 3. Chamar addSlide novamente para slide_index: 0 (simulando re-execução ou upsert idempotente)
    const slide0Updated = await projectService.addSlide({
      organization_id: '11111111-1111-1111-1111-111111111111',
      project_id: project.id,
      slide_index: 0,
      title: 'Título Atualizado com Sucesso',
      status: 'draft',
    });

    assert.strictEqual(slide0Updated.title, 'Título Atualizado com Sucesso');
    // Deve continuar existindo exatamente 1 slide (sem erro de chave duplicada)
    assert.strictEqual(mockSlides.length, 1);
  });

  test('Combinação de client_pieces e referências legadas evita duplicatas e mapeia campos corretamente', () => {
    const mockPieces = [
      {
        id: 'piece-1',
        organization_id: 'org-1',
        client_id: 'client-1',
        title: null,
        original_filename: 'referencia-01.png',
        storage_bucket: 'client-pieces',
        storage_path: 'path/piece-1.png',
        format_type: 'feed',
        piece_type: 'own_brand',
        analysis_json: { description: 'Foto de produto com fundo minimalista' },
        created_at: '2026-10-19T10:00:00Z',
      },
    ];

    const mockLegacy = [
      {
        id: 'legacy-1',
        organization_id: 'org-1',
        client_id: 'client-1',
        title: 'Referência Legada',
        description: 'Post antigo',
        reference_type: 'instagram_post',
        tags: ['legado'],
        image_url: 'https://example.com/legacy.png',
        ai_description: null,
        visual_features: {},
        created_at: '2026-10-18T10:00:00Z',
      },
      // Duplicata por ID (não deve ser incluída se já estiver em client_pieces)
      {
        id: 'piece-1',
        organization_id: 'org-1',
        client_id: 'client-1',
        title: 'Duplicata',
        reference_type: 'instagram_post',
        tags: [],
        image_url: 'https://example.com/duplicate.png',
        created_at: '2026-10-18T10:00:00Z',
      },
    ];

    const mappedPieces = mockPieces.map((p) => ({
      id: p.id,
      organization_id: p.organization_id,
      client_id: p.client_id,
      title: p.title || p.original_filename || 'Peça de Referência',
      description: p.original_filename || null,
      reference_type: p.piece_type || p.format_type || 'client_piece',
      tags: [p.format_type, p.piece_type].filter(Boolean),
      image_url: `https://signed.url/${p.id}`,
      ai_description: (p.analysis_json as any)?.description || null,
      visual_features: p.analysis_json || {},
      created_at: p.created_at,
    }));

    const mappedLegacy = mockLegacy.map((ref) => ({
      id: ref.id,
      organization_id: ref.organization_id,
      client_id: ref.client_id,
      title: ref.title,
      description: ref.description || null,
      reference_type: ref.reference_type || 'instagram_post',
      tags: ref.tags || [],
      image_url: ref.image_url,
      ai_description: ref.ai_description || null,
      visual_features: ref.visual_features || {},
      created_at: ref.created_at,
    }));

    const pieceIds = new Set(mappedPieces.map((p) => p.id));
    const combined = [...mappedPieces, ...mappedLegacy.filter((lr) => !pieceIds.has(lr.id))];

    assert.strictEqual(combined.length, 2);
    assert.strictEqual(combined[0].id, 'piece-1');
    assert.strictEqual(combined[0].title, 'referencia-01.png');
    assert.strictEqual(combined[0].image_url, 'https://signed.url/piece-1');
    assert.strictEqual(combined[1].id, 'legacy-1');
    assert.strictEqual(combined[1].title, 'Referência Legada');
  });
});
