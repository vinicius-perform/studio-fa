// tests/export-dimensions.test.ts
import { describe, expect, it } from 'bun:test';
import { FORMATS, getFormatDefinition } from '@/config/formats';
import { ExportService } from '@/services/export/export.service';

describe('Phase 3 — Export Dimensions & Exact Pixel Math', () => {
  it('strictly validates Feed 4:5 dimensions and multiple-of-16 generation compliance', () => {
    const format = getFormatDefinition('instagram_feed_4_5');

    // Instagram target resolution
    expect(format.exportWidth).toBe(1080);
    expect(format.exportHeight).toBe(1350);
    expect(format.aspectRatio).toBe('4:5');

    // GPT Image multiple-of-16 requirement
    expect(format.generationWidth).toBe(1088);
    expect(format.generationHeight).toBe(1360);
    expect(format.generationWidth % 16).toBe(0);
    expect(format.generationHeight % 16).toBe(0);

    // Aspect ratio ratio comparison (~0.8)
    const exportRatio = format.exportWidth / format.exportHeight;
    const genRatio = format.generationWidth / format.generationHeight;
    expect(Math.abs(exportRatio - genRatio)).toBeLessThan(0.001);
  });

  it('strictly validates Square 1:1 dimensions and multiple-of-16 compliance', () => {
    const format = getFormatDefinition('instagram_square');

    expect(format.exportWidth).toBe(1080);
    expect(format.exportHeight).toBe(1080);
    expect(format.aspectRatio).toBe('1:1');

    expect(format.generationWidth).toBe(1088);
    expect(format.generationHeight).toBe(1088);
    expect(format.generationWidth % 16).toBe(0);
    expect(format.generationHeight % 16).toBe(0);
  });

  it('strictly validates Story 9:16 dimensions, safe areas, and 8px crop math', () => {
    const format = getFormatDefinition('instagram_story');

    expect(format.exportWidth).toBe(1080);
    expect(format.exportHeight).toBe(1920);
    expect(format.aspectRatio).toBe('9:16');

    expect(format.generationWidth).toBe(1088);
    expect(format.generationHeight).toBe(1920);
    expect(format.generationWidth % 16).toBe(0);
    expect(format.generationHeight % 16).toBe(0);

    // 8px horizontal crop (4px each side)
    expect(format.cropOffsetX).toBe(4);
    expect(format.generationWidth - (format.cropOffsetX! * 2)).toBe(1080);

    // Instagram UI protection: top and bottom safe areas must be >= 200px
    expect(format.safeArea.top).toBeGreaterThanOrEqual(200);
    expect(format.safeArea.bottom).toBeGreaterThanOrEqual(200);
  });

  it('formats standardized export filenames according to Studio FA rules', () => {
    // 1. Filename sanitization
    const sanitized = ExportService.sanitizeFilename('Clínica & Odonto São Paulo — 2026!');
    expect(sanitized).toBe('clinica-odonto-sao-paulo-2026');

    // 2. Structured filename pattern {client_slug}_{date}_slide-{index}.{ext}
    const filename = ExportService.formatFilename({
      clientSlug: 'Agência FA',
      dateStr: '2026-10-01',
      slideIndex: 0,
      ext: 'png',
    });
    expect(filename).toBe('agencia-fa_2026-10-01_slide-01.png');

    const slide4 = ExportService.formatFilename({
      clientSlug: 'studio_digital',
      dateStr: '2026-10-01',
      slideIndex: 3,
    });
    expect(slide4).toBe('studio_digital_2026-10-01_slide-04.png');
  });
});
