// tests/async-queue.test.ts
import { describe, expect, it } from 'bun:test';
import { QueueService } from '@/services/ai/queue.service';
import { AI_MAX_CONCURRENCY } from '@/config/presets';
import type { SlideDocument, TextLayer, ImageLayer } from '@/types/domain/composition';

describe('Phase 3 — Async Job Queue & Non-Destructive Background Injection', () => {
  it('enforces maximum concurrency configuration limit of 3', () => {
    expect(AI_MAX_CONCURRENCY).toBe(3);
  });

  it('enqueues a generation job with idempotency key and proper payload', async () => {
    let insertedJob: any = null;

    const mockSupabase: any = {
      from: (table: string) => ({
        insert: (record: any) => {
          insertedJob = { id: 'job-123', status: 'queued', attempts: 0, ...record };
          return {
            select: () => ({
              single: () => Promise.resolve({ data: insertedJob, error: null }),
            }),
          };
        },
      }),
    };

    const queueService = new QueueService(mockSupabase);

    const job = await queueService.enqueueSlideJob({
      organizationId: '00000000-0000-0000-0000-000000000001',
      clientId: '00000000-0000-0000-0000-000000000002',
      projectId: '00000000-0000-0000-0000-000000000003',
      slideId: '00000000-0000-0000-0000-000000000004',
      slideIndex: 0,
      format: 'instagram_feed_4_5',
      presetId: 'production',
      userId: 'designer-vinicius',
    });

    expect(job).toBeDefined();
    expect(job.status).toBe('queued');
    expect(job.priority).toBe(10);
    expect(job.idempotency_key).toContain('gen_00000000-0000-0000-0000-000000000003');
    expect((job.payload as any).format).toBe('instagram_feed_4_5');
  });

  it('preserves editable typography and appends to imageHistory during background injection', async () => {
    // Initial document with existing designer copy
    const initialDoc: SlideDocument = {
      version: 1,
      canvas: { width: 1080, height: 1350, format: 'instagram_feed_4_5', backgroundColor: '#0B0F17' },
      layers: [
        {
          id: 'layer-title',
          name: 'Título Principal',
          type: 'text',
          text: 'Meu Título Criado Pelo Designer',
          fontFamily: 'Inter',
          fontSize: 60,
          color: '#FFFFFF',
          x: 80,
          y: 300,
          width: 800,
          height: 120,
          zIndex: 20,
          visible: true,
        } as TextLayer,
        {
          id: 'layer-bg',
          name: 'Background Inicial',
          type: 'image',
          imageUrl: 'data:image/svg+xml;initial',
          x: 0,
          y: 0,
          width: 1080,
          height: 1350,
          zIndex: 0,
          visible: true,
          imageHistory: [
            {
              id: 'hist-1',
              label: 'Versão 1',
              imageUrl: 'data:image/svg+xml;initial',
              createdAt: '2026-10-01T12:00:00Z',
            },
          ],
        } as ImageLayer,
      ],
    };

    let savedDocument: SlideDocument | null = null;

    const mockSupabase: any = {
      from: (table: string) => {
        if (table === 'ai_jobs') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'job-999',
                      organization_id: 'org-1',
                      client_id: 'client-1',
                      project_id: 'proj-1',
                      slide_id: 'slide-1',
                      job_type: 'generate_variation',
                      status: 'queued',
                      payload: {
                        slideIndex: 0,
                        format: 'instagram_feed_4_5',
                        presetId: 'production',
                        isVariation: true,
                      },
                      requested_by: 'designer-1',
                    },
                    error: null,
                  }),
              }),
            }),
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: () => Promise.resolve({ data: { id: 'job-999', status: 'completed' }, error: null }),
                }),
              }),
            }),
          };
        }

        if (table === 'slide_compositions') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: {
                        slide_id: 'slide-1',
                        document: initialDoc,
                        revision: 1,
                      },
                      error: null,
                    }),
                }),
              }),
            }),
            update: (params: any) => {
              savedDocument = params.document;
              return {
                eq: () => ({
                  eq: () => ({
                    select: () => ({
                      single: () => Promise.resolve({ data: { document: savedDocument, revision: 2 }, error: null }),
                    }),
                  }),
                }),
              };
            },
          };
        }

        // Return empty/success responses for auxiliary audit/asset tables
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
                limit: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
              single: () => Promise.resolve({ data: { id: 'slide-1', title: 'Meu Título' }, error: null }),
              order: () => ({
                limit: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'new-row-1' }, error: null }),
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      },
    };

    const queueService = new QueueService(mockSupabase);
    const processedJob = await queueService.processJob('job-999');

    expect(processedJob).toBeDefined();
    expect(savedDocument).not.toBeNull();

    // 1. TextLayer must remain intact (NOT deleted, NOT flattened)
    const titleLayer = savedDocument!.layers.find((l) => l.id === 'layer-title') as TextLayer;
    expect(titleLayer).toBeDefined();
    expect(titleLayer.text).toBe('Meu Título Criado Pelo Designer');
    expect(titleLayer.fontSize).toBe(60);

    // 2. ImageLayer history must contain both old version and newly generated version
    const bgLayer = savedDocument!.layers.find((l) => l.id === 'layer-bg') as ImageLayer;
    expect(bgLayer).toBeDefined();
    expect(bgLayer.imageHistory?.length).toBe(2);
    expect(bgLayer.imageHistory?.[0].label).toContain('Variação');
  });
});
