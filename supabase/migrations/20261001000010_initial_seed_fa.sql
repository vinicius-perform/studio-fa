-- Migration: 20261001000010_initial_seed_fa.sql
-- Description: Initial seed for default organization 'FA' (idempotent, does not bind unauthorized users)

INSERT INTO public.organizations (name, slug, settings)
VALUES (
    'FA',
    'fa',
    jsonb_build_object(
        'timezone', 'America/Sao_Paulo',
        'default_locale', 'pt-BR',
        'primary_brand_color', '#CEF52A',
        'allowed_formats', jsonb_build_array('instagram_feed_4_5', 'instagram_square', 'instagram_story', 'custom'),
        'ai_preferences', jsonb_build_object(
            'default_provider', 'openai',
            'quality_threshold', 0.75
        )
    )
)
ON CONFLICT (slug) DO NOTHING;
