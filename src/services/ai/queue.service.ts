// src/services/ai/queue.service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { OpenAIProvider } from './openai.provider';
import { PromptCompiler } from './prompt-compiler';
import { CompositionService } from '../compositions/composition.service';
import { getFormatDefinition, type FormatDefinition } from '@/config/formats';
import { AI_MAX_CONCURRENCY, getPresetDefinition, type AIPresetId } from '@/config/presets';
import type { AIJobRow } from '@/types/domain/ai';
import type { SlideDocument, ImageLayer } from '@/types/domain/composition';
import { Logger } from '@/lib/logger';
import { ValidationError } from '@/lib/errors';
import { devStore } from '@/lib/dev-store';

export interface EnqueueGenerationJobInput {
  organizationId: string;
  clientId: string;
  projectId: string;
  slideId: string;
  slideIndex: number;
  format: string;
  presetId?: AIPresetId;
  promptOverride?: string;
  customVariationInstruction?: string;
  referenceImageUrl?: string;
  referenceTitle?: string;
  userId: string;
  isVariation?: boolean;
}

export class QueueService {
  private readonly provider: OpenAIProvider;
  private readonly compositionService: CompositionService;

  constructor(private readonly supabase: SupabaseClient<any, any, any>) {
    this.provider = new OpenAIProvider();
    this.compositionService = new CompositionService(supabase);
  }

  /**
   * Enqueues an image generation job for a slide with idempotency key.
   */
  async enqueueSlideJob(input: EnqueueGenerationJobInput): Promise<AIJobRow> {
    const idempotencyKey = `gen_${input.projectId}_${input.slideId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const newJob: any = {
      id: `job-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      organization_id: input.organizationId,
      client_id: input.clientId,
      project_id: input.projectId,
      slide_id: input.slideId,
      job_type: input.isVariation ? 'generate_variation' : 'generate_image',
      status: 'queued',
      priority: 10,
      payload: {
        slideIndex: input.slideIndex,
        format: input.format,
        presetId: input.presetId || 'production',
        promptOverride: input.promptOverride,
        customVariationInstruction: input.customVariationInstruction,
        isVariation: Boolean(input.isVariation),
        referenceImageUrl: input.referenceImageUrl,
        referenceTitle: input.referenceTitle,
      },
      idempotency_key: idempotencyKey,
      requested_by: input.userId,
      attempts: 0,
      created_at: new Date().toISOString(),
    };

    try {
      const { data: job, error } = await this.supabase
        .from('ai_jobs')
        .insert(newJob)
        .select()
        .single();

      if (!error && job) {
        devStore.saveJob(job);
        return job;
      }
    } catch (e) {
      // Supabase insert failed, fallback to devStore
    }

    devStore.saveJob(newJob);
    Logger.info({
      operation: 'enqueue_slide_job',
      organizationId: input.organizationId,
      result: 'success',
      metadata: { jobId: newJob.id, slideId: input.slideId },
    });

    return newJob;
  }

  /**
   * Processes a single job (Worker Execution Pipeline)
   */
  async processJob(jobId: string): Promise<AIJobRow> {
    const startTime = Date.now();

    // 1. Fetch and lock job
    let job: any = null;
    try {
      const { data, error: fetchErr } = await this.supabase
        .from('ai_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      if (!fetchErr && data) {
        job = data;
      }
    } catch (e) {}

    if (!job) {
      job = devStore.getJob(jobId);
    }

    if (!job) {
      throw new Error(`Job não encontrado: ${jobId}`);
    }

    if (job.status === 'completed' || job.status === 'processing') {
      return job;
    }

    // Mark processing
    job.status = 'processing';
    job.started_at = new Date().toISOString();
    devStore.saveJob(job);
    try {
      await this.supabase
        .from('ai_jobs')
        .update({ status: 'processing', started_at: job.started_at })
        .eq('id', jobId);
    } catch (e) {}

    try {
      const payload = job.payload as Record<string, any>;
      const formatDef = getFormatDefinition(payload.format as any);
      const preset = getPresetDefinition(payload.presetId as AIPresetId);

      // 2. Fetch Client Brand Profile
      let brandProfileRow: any = null;
      try {
        const { data } = await this.supabase
          .from('brand_profiles')
          .select('*')
          .eq('client_id', job.client_id!)
          .eq('status', 'approved')
          .maybeSingle();
        brandProfileRow = data;
      } catch (e) {}

      if (!brandProfileRow) {
        const client = devStore.getClientById(job.client_id!);
        brandProfileRow = client?.brandProfile;
      }

      const brandProfile = (brandProfileRow ? {
        summary: brandProfileRow.summary,
        colors: brandProfileRow.colors as any,
        typography: brandProfileRow.typography as any,
        composition: brandProfileRow.composition as any,
        photography: brandProfileRow.photography as any,
        logoUsage: brandProfileRow.logo_usage as any,
        graphicalElements: brandProfileRow.graphical_elements as any,
        visualStyle: brandProfileRow.visual_style as any,
        contentStyle: brandProfileRow.content_style as any,
        spacingRules: brandProfileRow.spacing_rules as any,
        dos: brandProfileRow.dos as any,
        donts: brandProfileRow.donts as any,
      } : {
        summary: 'Identidade visual contemporânea da FA',
        colors: { primary: ['#0B0F17'], secondary: ['#1F2937'], accent: ['#CEF52A'], background: ['#FAFAFA'], text: ['#111827'] },
        typography: { detectedFonts: ['Inter'] },
        composition: {},
        photography: {},
        logoUsage: {},
        graphicalElements: {},
        visualStyle: {},
        contentStyle: {},
        dos: [],
        donts: [],
      }) as any;

      // 3. Fetch Slide Data
      let slide: any = null;
      try {
        const { data } = await this.supabase
          .from('project_slides')
          .select('*')
          .eq('id', job.slide_id!)
          .single();
        slide = data;
      } catch (e) {}

      if (!slide) {
        const proj = devStore.getProjectById(job.project_id!);
        slide = (proj?.slides || []).find((s: any) => s.id === job.slide_id);
      }

      // 4. Fetch Creative Plan for slide
      const { data: planRow } = await this.supabase
        .from('project_creative_plans')
        .select('*')
        .eq('project_id', job.project_id!)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      const slidePlans = (planRow?.slide_plans as any[]) || [];
      const currentSlidePlan = slidePlans.find((sp) => sp.slideIndex === payload.slideIndex) || {
        slideIndex: payload.slideIndex,
        slideType: payload.slideIndex === 0 ? 'cover' : 'content',
        visualConcept: slide?.instructions || slide?.title || 'Visual moderno e elegante',
        imageStrategy: 'generate_new_image',
        imagePrompt: slide?.title || 'Composição moderna e minimalista',
        layout: {
          title: { x: 0.08, y: 0.25, width: 0.75, align: 'left' },
        },
      };

      // 5. Compile Prompt
      const refTitle = payload.referenceTitle || slide?.reference_title;
      const refUrl = payload.referenceImageUrl || slide?.reference_image_url;
      const compiled = PromptCompiler.compile({
        brandProfile,
        format: formatDef,
        slidePlan: currentSlidePlan,
        content: {
          title: slide?.title || undefined,
          subtitle: slide?.subtitle || undefined,
          body: slide?.body || undefined,
          cta: slide?.cta || undefined,
          instructions: slide?.instructions || undefined,
        },
        referenceImageUrl: refUrl,
        referenceTitle: refTitle,
        pinnedReferencesDescriptions: refTitle ? [refTitle] : [],
        customVariationInstruction: payload.customVariationInstruction,
      });

      // 6. Record Generation Request (Traceability)
      const { data: genReq } = await this.supabase
        .from('generation_requests')
        .insert({
          organization_id: job.organization_id,
          client_id: job.client_id!,
          project_id: job.project_id,
          slide_id: job.slide_id,
          requested_by: job.requested_by,
          provider: 'openai',
          model: preset.model,
          operation_type: payload.isVariation ? 'variation' : 'image_generate',
          status: 'processing',
          prompt: compiled.prompt,
          system_context: compiled.negativeSpaceInstruction,
          input_snapshot: {
            brand_profile_id: brandProfileRow?.id,
            prompt: compiled.prompt,
            model: preset.model,
            parameters: { quality: preset.quality },
            created_at: new Date().toISOString(),
          },
          parameters: {
            preset: preset.id,
            dimensions: { width: formatDef.generationWidth, height: formatDef.generationHeight },
          },
          idempotency_key: job.idempotency_key,
        })
        .select()
        .single();

      // 7. Call Provider
      const genOutput = await this.provider.generateImage({
        prompt: compiled.prompt,
        brandProfile,
        dimensions: { width: formatDef.generationWidth, height: formatDef.generationHeight },
      });

      // 8. Register Generated Image in client_assets
      const storagePath = `${job.organization_id}/${job.client_id}/generated-assets/${crypto.randomUUID()}_bg.png`;
      const { data: asset } = await this.supabase
        .from('client_assets')
        .insert({
          organization_id: job.organization_id,
          client_id: job.client_id!,
          asset_type: 'generated_image',
          label: `Fundo IA: Lâmina ${payload.slideIndex + 1}`,
          storage_bucket: 'generated-assets',
          storage_path: storagePath,
          original_filename: `generated_${payload.slideIndex + 1}.png`,
          mime_type: 'image/png',
          file_size_bytes: 500000,
          width: formatDef.exportWidth,
          height: formatDef.exportHeight,
          uploaded_by: job.requested_by,
          metadata: {
            model: genOutput.model,
            promptVersion: compiled.version,
          },
        })
        .select()
        .single();

      // 9. Register in generation_outputs
      if (genReq && asset) {
        await this.supabase.from('generation_outputs').insert({
          organization_id: job.organization_id,
          generation_request_id: genReq.id,
          asset_id: asset.id,
          output_type: 'background',
          metadata: {
            imageUrl: genOutput.imageUrl,
          },
        });
      }

      // 10. Record AI Usage Event
      await this.supabase.from('ai_usage_events').insert({
        organization_id: job.organization_id,
        client_id: job.client_id,
        user_id: job.requested_by,
        project_id: job.project_id,
        slide_id: job.slide_id,
        generation_request_id: genReq?.id,
        provider: 'openai',
        model: preset.model,
        operation_type: 'image_generate',
        output_image_tokens: 1,
        total_tokens: 1,
        estimated_cost_usd: preset.estimatedCostPerImageUsd,
        actual_cost_usd: genOutput.costUsd ?? preset.estimatedCostPerImageUsd,
      });

      // 11. Update Slide Composition (Convert background to layer without destroying typography or logo)
      const existingComp = await this.compositionService.getBySlideId(job.slide_id!, job.organization_id);

      if (existingComp && existingComp.document) {
        const doc = existingComp.document as unknown as SlideDocument;
        const bgLayerIndex = doc.layers.findIndex((l) => l.id === 'layer-bg' || l.type === 'background');

        const newImageHistoryEntry = {
          id: crypto.randomUUID(),
          label: payload.isVariation ? `Variação ${new Date().toLocaleTimeString('pt-BR')}` : 'Fundo Gerado',
          imageUrl: genOutput.imageUrl,
          assetId: asset?.id,
          createdAt: new Date().toISOString(),
        };

        if (bgLayerIndex >= 0) {
          const prevLayer = doc.layers[bgLayerIndex] as ImageLayer;
          const updatedHistory = [newImageHistoryEntry, ...(prevLayer.imageHistory || [])];
          doc.layers[bgLayerIndex] = {
            ...prevLayer,
            imageUrl: genOutput.imageUrl,
            assetId: asset?.id,
            storagePath,
            imageHistory: updatedHistory,
          };
        } else {
          doc.layers.unshift({
            id: 'layer-bg',
            name: 'Background IA',
            type: 'image',
            imageUrl: genOutput.imageUrl,
            assetId: asset?.id,
            storagePath,
            x: 0,
            y: 0,
            width: formatDef.exportWidth,
            height: formatDef.exportHeight,
            zIndex: 0,
            visible: true,
            locked: false,
            imageHistory: [newImageHistoryEntry],
          });
        }
        devStore.updateComposition(job.slide_id!, doc, existingComp.revision);
        try {
          await this.compositionService.saveComposition({
            slideId: job.slide_id!,
            projectId: job.project_id!,
            organizationId: job.organization_id,
            document: doc,
            expectedRevision: existingComp.revision,
            userId: job.requested_by || 'system',
          });
        } catch (e) {}
      } else {
        // Create initial composition with new generated background
        // Fetch client logo if available
        let logoAsset: any = null;
        try {
          const { data } = await this.supabase
            .from('client_assets')
            .select('storage_path')
            .eq('client_id', job.client_id!)
            .in('asset_type', ['logo_primary', 'logo_monochrome'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          logoAsset = data;
        } catch (e) {}

        if (!logoAsset) {
          const client = devStore.getClientById(job.client_id!);
          logoAsset = client?.logoAsset;
        }

        const defaultDoc = await this.compositionService.initializeDefaultDocument({
          format: formatDef,
          brandProfile,
          content: {
            title: slide?.title || undefined,
            subtitle: slide?.subtitle || undefined,
            body: slide?.body || undefined,
            cta: slide?.cta || undefined,
          },
          clientLogoUrl: logoAsset?.storage_path ? `/api/assets/raw?path=${encodeURIComponent(logoAsset.storage_path)}` : undefined,
          backgroundUrl: genOutput.imageUrl,
        });

        devStore.updateComposition(job.slide_id!, defaultDoc, 1);
        try {
          await this.compositionService.saveComposition({
            slideId: job.slide_id!,
            projectId: job.project_id!,
            organizationId: job.organization_id,
            document: defaultDoc,
            expectedRevision: 1,
            userId: job.requested_by || 'system',
          });
        } catch (e) {}
      }

      // 12. Mark Slide Ready & Complete Job
      job.status = 'completed';
      job.finished_at = new Date().toISOString();
      devStore.saveJob(job);

      try {
        await this.supabase
          .from('project_slides')
          .update({ status: 'ready', updated_at: new Date().toISOString() })
          .eq('id', job.slide_id!);

        await this.supabase
          .from('ai_jobs')
          .update({
            status: 'completed',
            finished_at: job.finished_at,
          })
          .eq('id', jobId);
      } catch (e) {}

      Logger.info({
        operation: 'process_job',
        organizationId: job.organization_id,
        durationMs: Date.now() - startTime,
        result: 'success',
        metadata: { jobId },
      });

      return job;
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      Logger.error({ operation: 'process_job', result: 'error', metadata: { jobId } }, err);

      const attempts = (job.attempts || 0) + 1;
      const status = attempts >= (job.max_attempts || 3) ? 'failed' : 'queued';

      const { data: failedJob } = await this.supabase
        .from('ai_jobs')
        .update({
          status,
          attempts,
          last_error: errorMessage,
          finished_at: status === 'failed' ? new Date().toISOString() : null,
        })
        .eq('id', jobId)
        .select()
        .single();

      return failedJob || job;
    }
  }

  /**
   * Retrieves all jobs for a project
   */
  async getProjectJobs(projectId: string, organizationId: string): Promise<AIJobRow[]> {
    const { data, error } = await this.supabase
      .from('ai_jobs')
      .select('*')
      .eq('project_id', projectId)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
}
