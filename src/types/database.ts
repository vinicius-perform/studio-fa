// src/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: unknown }
  | unknown[];

export type AppRole = 'owner' | 'admin' | 'manager' | 'designer' | 'viewer';
export type ClientStatus = 'active' | 'paused' | 'archived';
export type BrandStatus = 'empty' | 'collecting' | 'analyzing' | 'ready' | 'needs_review';
export type AssetType =
  | 'logo_primary'
  | 'logo_secondary'
  | 'logo_monochrome'
  | 'font'
  | 'brand_manual'
  | 'icon'
  | 'graphic_element'
  | 'reference_art'
  | 'client_photo'
  | 'base_image'
  | 'generated_image'
  | 'export'
  | 'other';
export type ReferenceType =
  | 'instagram_post'
  | 'carousel'
  | 'story'
  | 'advertisement'
  | 'cover'
  | 'branding'
  | 'other';
export type BrandProfileStatus =
  | 'draft'
  | 'analyzing'
  | 'needs_review'
  | 'approved'
  | 'superseded'
  | 'archived';
export type BrandProfileSource = 'ai' | 'manual' | 'hybrid';
export type ProjectType = 'single_post' | 'carousel';
export type ProjectStatus =
  | 'draft'
  | 'ready'
  | 'queued'
  | 'generating'
  | 'review'
  | 'changes_requested'
  | 'approved'
  | 'exporting'
  | 'exported'
  | 'failed'
  | 'archived';
export type ProjectFormat =
  | 'instagram_feed_4_5'
  | 'instagram_square'
  | 'instagram_story'
  | 'custom';
export type SlideStatus =
  | 'draft'
  | 'ready'
  | 'generating'
  | 'review'
  | 'approved'
  | 'failed';
export type GenerationOperationType =
  | 'brand_analysis'
  | 'reference_analysis'
  | 'embedding'
  | 'image_generate'
  | 'image_edit'
  | 'variation'
  | 'background_generate'
  | 'other';
export type GenerationRequestStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type GenerationOutputType =
  | 'preview'
  | 'background'
  | 'edited_image'
  | 'composite'
  | 'final'
  | 'auxiliary';
export type AIJobType =
  | 'analyze_brand'
  | 'analyze_reference'
  | 'create_embedding'
  | 'generate_image'
  | 'edit_image'
  | 'generate_variation';
export type AIJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'changes_requested'
  | 'rejected';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_path: string | null;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_path?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          logo_path?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: AppRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: AppRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: AppRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          slug: string;
          legal_name: string | null;
          niche: string | null;
          instagram_handle: string | null;
          website: string | null;
          city: string | null;
          state: string | null;
          country: string;
          notes: string | null;
          status: ClientStatus;
          brand_status: BrandStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          slug: string;
          legal_name?: string | null;
          niche?: string | null;
          instagram_handle?: string | null;
          website?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string;
          notes?: string | null;
          status?: ClientStatus;
          brand_status?: BrandStatus;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          slug?: string;
          legal_name?: string | null;
          niche?: string | null;
          instagram_handle?: string | null;
          website?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string;
          notes?: string | null;
          status?: ClientStatus;
          brand_status?: BrandStatus;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      client_assets: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          asset_type: AssetType;
          label: string | null;
          storage_bucket: string;
          storage_path: string;
          original_filename: string;
          mime_type: string;
          file_size_bytes: number;
          width: number | null;
          height: number | null;
          has_alpha: boolean | null;
          checksum: string | null;
          metadata: Json;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          asset_type: AssetType;
          label?: string | null;
          storage_bucket: string;
          storage_path: string;
          original_filename: string;
          mime_type: string;
          file_size_bytes: number;
          width?: number | null;
          height?: number | null;
          has_alpha?: boolean | null;
          checksum?: string | null;
          metadata?: Json;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          client_id?: string;
          asset_type?: AssetType;
          label?: string | null;
          storage_bucket?: string;
          storage_path?: string;
          original_filename?: string;
          mime_type?: string;
          file_size_bytes?: number;
          width?: number | null;
          height?: number | null;
          has_alpha?: boolean | null;
          checksum?: string | null;
          metadata?: Json;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      brand_references: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          asset_id: string | null;
          title: string | null;
          description: string | null;
          reference_type: ReferenceType;
          tags: string[];
          ai_description: string | null;
          visual_features: Json;
          quality_score: number | null;
          is_approved: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          asset_id?: string | null;
          title?: string | null;
          description?: string | null;
          reference_type?: ReferenceType;
          tags?: string[];
          ai_description?: string | null;
          visual_features?: Json;
          quality_score?: number | null;
          is_approved?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          client_id?: string;
          asset_id?: string | null;
          title?: string | null;
          description?: string | null;
          reference_type?: ReferenceType;
          tags?: string[];
          ai_description?: string | null;
          visual_features?: Json;
          quality_score?: number | null;
          is_approved?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      brand_profiles: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          version: number;
          status: BrandProfileStatus;
          source: BrandProfileSource;
          summary: string;
          colors: Json;
          typography: Json;
          composition: Json;
          photography: Json;
          logo_usage: Json;
          graphical_elements: Json;
          visual_style: Json;
          content_style: Json;
          spacing_rules: Json;
          dos: Json;
          donts: Json;
          raw_analysis: Json;
          confidence_score: number | null;
          created_by: string | null;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          version: number;
          status?: BrandProfileStatus;
          source?: BrandProfileSource;
          summary: string;
          colors: Json;
          typography: Json;
          composition: Json;
          photography: Json;
          logo_usage: Json;
          graphical_elements: Json;
          visual_style: Json;
          content_style: Json;
          spacing_rules: Json;
          dos: Json;
          donts: Json;
          raw_analysis?: Json;
          confidence_score?: number | null;
          created_by?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          client_id?: string;
          version?: number;
          status?: BrandProfileStatus;
          source?: BrandProfileSource;
          summary?: string;
          colors?: Json;
          typography?: Json;
          composition?: Json;
          photography?: Json;
          logo_usage?: Json;
          graphical_elements?: Json;
          visual_style?: Json;
          content_style?: Json;
          spacing_rules?: Json;
          dos?: Json;
          donts?: Json;
          raw_analysis?: Json;
          confidence_score?: number | null;
          created_by?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reference_embeddings: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          reference_id: string;
          embedding: string;
          embedding_model: string;
          source_text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          reference_id: string;
          embedding: string;
          embedding_model: string;
          source_text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          client_id?: string;
          reference_id?: string;
          embedding?: string;
          embedding_model?: string;
          source_text?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          title: string | null;
          project_type: ProjectType;
          status: ProjectStatus;
          format: ProjectFormat;
          width: number | null;
          height: number | null;
          generation_mode: string | null;
          brief: string | null;
          metadata: Json;
          created_by: string | null;
          assigned_to: string | null;
          created_at: string;
          updated_at: string;
          approved_at: string | null;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          title?: string | null;
          project_type?: ProjectType;
          status?: ProjectStatus;
          format?: ProjectFormat;
          width?: number | null;
          height?: number | null;
          generation_mode?: string | null;
          brief?: string | null;
          metadata?: Json;
          created_by?: string | null;
          assigned_to?: string | null;
          created_at?: string;
          updated_at?: string;
          approved_at?: string | null;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          client_id?: string;
          title?: string | null;
          project_type?: ProjectType;
          status?: ProjectStatus;
          format?: ProjectFormat;
          width?: number | null;
          height?: number | null;
          generation_mode?: string | null;
          brief?: string | null;
          metadata?: Json;
          created_by?: string | null;
          assigned_to?: string | null;
          created_at?: string;
          updated_at?: string;
          approved_at?: string | null;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      project_slides: {
        Row: {
          id: string;
          organization_id: string;
          project_id: string;
          slide_index: number;
          slide_type: string | null;
          title: string | null;
          subtitle: string | null;
          body: string | null;
          cta: string | null;
          instructions: string | null;
          base_asset_id: string | null;
          status: SlideStatus;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          project_id: string;
          slide_index: number;
          slide_type?: string | null;
          title?: string | null;
          subtitle?: string | null;
          body?: string | null;
          cta?: string | null;
          instructions?: string | null;
          base_asset_id?: string | null;
          status?: SlideStatus;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          project_id?: string;
          slide_index?: number;
          slide_type?: string | null;
          title?: string | null;
          subtitle?: string | null;
          body?: string | null;
          cta?: string | null;
          instructions?: string | null;
          base_asset_id?: string | null;
          status?: SlideStatus;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_versions: {
        Row: {
          id: string;
          organization_id: string;
          project_id: string;
          version_number: number;
          snapshot: Json;
          label: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          project_id: string;
          version_number: number;
          snapshot: Json;
          label?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          project_id?: string;
          version_number?: number;
          snapshot?: Json;
          label?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      generation_requests: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          project_id: string | null;
          slide_id: string | null;
          requested_by: string | null;
          provider: string;
          model: string;
          operation_type: GenerationOperationType;
          status: GenerationRequestStatus;
          prompt: string;
          system_context: string | null;
          input_snapshot: Json;
          parameters: Json;
          provider_request_id: string | null;
          idempotency_key: string | null;
          started_at: string | null;
          completed_at: string | null;
          error_code: string | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          project_id?: string | null;
          slide_id?: string | null;
          requested_by?: string | null;
          provider: string;
          model: string;
          operation_type: GenerationOperationType;
          status?: GenerationRequestStatus;
          prompt: string;
          system_context?: string | null;
          input_snapshot: Json;
          parameters?: Json;
          provider_request_id?: string | null;
          idempotency_key?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          client_id?: string;
          project_id?: string | null;
          slide_id?: string | null;
          requested_by?: string | null;
          provider?: string;
          model?: string;
          operation_type?: GenerationOperationType;
          status?: GenerationRequestStatus;
          prompt?: string;
          system_context?: string | null;
          input_snapshot?: Json;
          parameters?: Json;
          provider_request_id?: string | null;
          idempotency_key?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      generation_outputs: {
        Row: {
          id: string;
          organization_id: string;
          generation_request_id: string;
          asset_id: string;
          output_type: GenerationOutputType;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          generation_request_id: string;
          asset_id: string;
          output_type: GenerationOutputType;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          generation_request_id?: string;
          asset_id?: string;
          output_type?: GenerationOutputType;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      approvals: {
        Row: {
          id: string;
          organization_id: string;
          entity_type: string;
          entity_id: string;
          status: ApprovalStatus;
          requested_by: string | null;
          reviewed_by: string | null;
          feedback: string | null;
          created_at: string;
          reviewed_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          entity_type: string;
          entity_id: string;
          status?: ApprovalStatus;
          requested_by?: string | null;
          reviewed_by?: string | null;
          feedback?: string | null;
          created_at?: string;
          reviewed_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          entity_type?: string;
          entity_id?: string;
          status?: ApprovalStatus;
          requested_by?: string | null;
          reviewed_by?: string | null;
          feedback?: string | null;
          created_at?: string;
          reviewed_at?: string | null;
        };
        Relationships: [];
      };
      ai_usage_events: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string | null;
          user_id: string | null;
          project_id: string | null;
          slide_id: string | null;
          generation_request_id: string | null;
          provider: string;
          model: string;
          operation_type: string;
          input_text_tokens: number | null;
          input_image_tokens: number | null;
          output_text_tokens: number | null;
          output_image_tokens: number | null;
          total_tokens: number | null;
          estimated_cost_usd: number;
          actual_cost_usd: number | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id?: string | null;
          user_id?: string | null;
          project_id?: string | null;
          slide_id?: string | null;
          generation_request_id?: string | null;
          provider: string;
          model: string;
          operation_type: string;
          input_text_tokens?: number | null;
          input_image_tokens?: number | null;
          output_text_tokens?: number | null;
          output_image_tokens?: number | null;
          total_tokens?: number | null;
          estimated_cost_usd?: number;
          actual_cost_usd?: number | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          client_id?: string | null;
          user_id?: string | null;
          project_id?: string | null;
          slide_id?: string | null;
          generation_request_id?: string | null;
          provider?: string;
          model?: string;
          operation_type?: string;
          input_text_tokens?: number | null;
          input_image_tokens?: number | null;
          output_text_tokens?: number | null;
          output_image_tokens?: number | null;
          total_tokens?: number | null;
          estimated_cost_usd?: number;
          actual_cost_usd?: number | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_jobs: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string | null;
          project_id: string | null;
          slide_id: string | null;
          job_type: AIJobType;
          status: AIJobStatus;
          priority: number;
          payload: Json;
          attempts: number;
          max_attempts: number;
          last_error: string | null;
          requested_by: string | null;
          idempotency_key: string | null;
          created_at: string;
          started_at: string | null;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id?: string | null;
          project_id?: string | null;
          slide_id?: string | null;
          job_type: AIJobType;
          status?: AIJobStatus;
          priority?: number;
          payload?: Json;
          attempts?: number;
          max_attempts?: number;
          last_error?: string | null;
          requested_by?: string | null;
          idempotency_key?: string | null;
          created_at?: string;
          started_at?: string | null;
          finished_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          client_id?: string | null;
          project_id?: string | null;
          slide_id?: string | null;
          job_type?: AIJobType;
          status?: AIJobStatus;
          priority?: number;
          payload?: Json;
          attempts?: number;
          max_attempts?: number;
          last_error?: string | null;
          requested_by?: string | null;
          idempotency_key?: string | null;
          created_at?: string;
          started_at?: string | null;
          finished_at?: string | null;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          old_data: Json | null;
          new_data: Json | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      project_creative_plans: {
        Row: {
          id: string;
          organization_id: string;
          project_id: string;
          version: number;
          brand_profile_id: string | null;
          status: string;
          global_direction: Json;
          slide_plans: Json;
          selected_reference_ids: Json;
          provider: string | null;
          model: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          project_id: string;
          version?: number;
          brand_profile_id?: string | null;
          status?: string;
          global_direction?: Json;
          slide_plans?: Json;
          selected_reference_ids?: Json;
          provider?: string | null;
          model?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          project_id?: string;
          version?: number;
          brand_profile_id?: string | null;
          status?: string;
          global_direction?: Json;
          slide_plans?: Json;
          selected_reference_ids?: Json;
          provider?: string | null;
          model?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      slide_compositions: {
        Row: {
          id: string;
          organization_id: string;
          project_id: string;
          slide_id: string;
          document: Json;
          revision: number;
          preview_asset_id: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          project_id: string;
          slide_id: string;
          document?: Json;
          revision?: number;
          preview_asset_id?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          project_id?: string;
          slide_id?: string;
          document?: Json;
          revision?: number;
          preview_asset_id?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      design_templates: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string | null;
          name: string;
          format: ProjectFormat;
          document: Json;
          preview_asset_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id?: string | null;
          name: string;
          format: ProjectFormat;
          document: Json;
          preview_asset_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          client_id?: string | null;
          name?: string;
          format?: ProjectFormat;
          document?: Json;
          preview_asset_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_organization_member: {
        Args: { p_org_id: string; p_user_id?: string };
        Returns: boolean;
      };
      has_organization_role: {
        Args: { p_org_id: string; p_roles: AppRole[]; p_user_id?: string };
        Returns: boolean;
      };
      get_user_organization_role: {
        Args: { p_org_id: string; p_user_id?: string };
        Returns: AppRole;
      };
      approve_brand_profile: {
        Args: { p_profile_id: string };
        Returns: Json;
      };
      match_brand_references: {
        Args: {
          p_organization_id: string;
          p_client_id: string;
          query_embedding: string;
          match_threshold?: number;
          match_count?: number;
        };
        Returns: {
          id: string;
          reference_id: string;
          similarity: number;
          source_text: string;
          title: string | null;
          reference_type: ReferenceType;
          tags: string[];
          visual_features: Json;
        }[];
      };
      create_audit_log: {
        Args: {
          p_org_id: string;
          p_action: string;
          p_entity_type: string;
          p_entity_id?: string;
          p_old_data?: Json;
          p_new_data?: Json;
          p_metadata?: Json;
        };
        Returns: string;
      };
    };
    Enums: {
      app_role: AppRole;
      client_status: ClientStatus;
      brand_status: BrandStatus;
      asset_type: AssetType;
      reference_type: ReferenceType;
      brand_profile_status: BrandProfileStatus;
      brand_profile_source: BrandProfileSource;
      project_type: ProjectType;
      project_status: ProjectStatus;
      project_format: ProjectFormat;
      slide_status: SlideStatus;
      generation_operation_type: GenerationOperationType;
      generation_request_status: GenerationRequestStatus;
      generation_output_type: GenerationOutputType;
      ai_job_type: AIJobType;
      ai_job_status: AIJobStatus;
      approval_status: ApprovalStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
