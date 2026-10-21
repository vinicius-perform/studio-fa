// tests/phase-e-productions.test.ts
import { describe, expect, it } from 'bun:test';
import {
  getFormatDefinition,
  resolveGenerationSizeForCanvas,
  MIN_CUSTOM_DIMENSION,
  MAX_CUSTOM_DIMENSION,
} from '@/config/formats';
import { devStore } from '@/lib/dev-store';
import { canCreateProjects, isAdmin, isOwner } from '@/lib/auth/permissions';
import { ExportService } from '@/services/export/export.service';

describe('Phase E — Produções V2, Custom Format, Duplication & Operational Finish', () => {
  describe('1. Custom Format & Resolution Resolver', () => {
    it('enforces min and max bounds for custom canvas dimensions', () => {
      expect(MIN_CUSTOM_DIMENSION).toBe(320);
      expect(MAX_CUSTOM_DIMENSION).toBe(4096);

      // Value below minimum clamped to MIN_CUSTOM_DIMENSION
      const lowDef = getFormatDefinition('custom', 100, 200);
      expect(lowDef.exportWidth).toBe(320);
      expect(lowDef.exportHeight).toBe(320);

      // Value above maximum clamped to MAX_CUSTOM_DIMENSION
      const highDef = getFormatDefinition('custom', 5000, 6000);
      expect(highDef.exportWidth).toBe(4096);
      expect(highDef.exportHeight).toBe(4096);
    });

    it('resolves deterministic multiple-of-16 provider generation size based on aspect ratio', () => {
      // 1. Extreme vertical (ratio < 0.65 -> Story 9:16)
      const storyGen = resolveGenerationSizeForCanvas(1080, 1920);
      expect(storyGen.width).toBe(1088);
      expect(storyGen.height).toBe(1920);
      expect(storyGen.width % 16).toBe(0);
      expect(storyGen.height % 16).toBe(0);

      // 2. Portrait (0.65 <= ratio < 0.9 -> Feed 4:5)
      const feedGen = resolveGenerationSizeForCanvas(1080, 1350);
      expect(feedGen.width).toBe(1088);
      expect(feedGen.height).toBe(1360);
      expect(feedGen.width % 16).toBe(0);
      expect(feedGen.height % 16).toBe(0);

      // 3. Square (0.9 <= ratio <= 1.2 -> Square 1:1)
      const squareGen = resolveGenerationSizeForCanvas(1000, 1000);
      expect(squareGen.width).toBe(1088);
      expect(squareGen.height).toBe(1088);
      expect(squareGen.width % 16).toBe(0);
      expect(squareGen.height % 16).toBe(0);

      // 4. Landscape / Wide (ratio > 1.2 -> Wide 16:9)
      const bannerGen = resolveGenerationSizeForCanvas(1200, 630);
      expect(bannerGen.width).toBe(1920);
      expect(bannerGen.height).toBe(1088);
      expect(bannerGen.width % 16).toBe(0);
      expect(bannerGen.height % 16).toBe(0);
    });

    it('constructs dynamic custom FormatDefinition preserving custom properties and safe areas', () => {
      const customDef = getFormatDefinition('custom', 1200, 630);
      expect(customDef.id).toBe('custom');
      expect(customDef.exportWidth).toBe(1200);
      expect(customDef.exportHeight).toBe(630);
      expect(customDef.aspectRatio).toBe('1200:630');
      expect(customDef.generationWidth).toBe(1920);
      expect(customDef.generationHeight).toBe(1088);
      expect(customDef.safeArea.top).toBe(Math.round(630 * 0.05));
      expect(customDef.safeArea.left).toBe(Math.round(1200 * 0.05));
    });
  });

  describe('2. Project Duplication Engine (Zero AI)', () => {
    it('deep-clones production, slides and compositions with new IDs and draft status', () => {
      // 1. Create a dummy project in devStore
      const testOrgId = devStore.getOrganizationId();
      const client = devStore.listClients()[0];
      const sourceProjectId = `test-proj-${Date.now()}`;
      const sourceSlideId = `test-slide-${Date.now()}`;

      devStore.addProject(
        {
          id: sourceProjectId,
          organization_id: testOrgId,
          client_id: client?.id || 'client-1',
          title: 'Carrossel Original de Teste',
          project_type: 'carousel',
          format: 'custom',
          width: 1200,
          height: 630,
          status: 'approved',
          created_by: 'designer-1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        [
          {
            id: sourceSlideId,
            organization_id: testOrgId,
            project_id: sourceProjectId,
            slide_index: 0,
            slide_type: 'cover',
            title: 'Lâmina 1 Original',
            status: 'approved',
          },
        ],
        [
          {
            id: `comp-orig-${Date.now()}`,
            slide_id: sourceSlideId,
            revision: 5,
            document: {
              version: 2,
              canvas: { width: 1200, height: 630, background: '#000000' },
              layers: [
                {
                  id: 'bg-1',
                  type: 'background',
                  imageUrl: 'https://example.com/asset.png',
                  x: 0,
                  y: 0,
                  width: 1200,
                  height: 630,
                },
                {
                  id: 'text-1',
                  type: 'text',
                  role: 'headline',
                  text: 'Título Principal',
                  x: 50,
                  y: 50,
                },
              ],
            },
          },
        ]
      );

      // 2. Duplicate the project
      const duplicated = devStore.duplicateProject(sourceProjectId);
      expect(duplicated).not.toBeNull();
      expect(duplicated!.project.id).not.toBe(sourceProjectId);
      expect(duplicated!.project.title).toBe('Carrossel Original de Teste — Cópia');
      expect(duplicated!.project.status).toBe('draft');
      expect(duplicated!.project.archived_at).toBeNull();
      expect(duplicated!.project.width).toBe(1200);
      expect(duplicated!.project.height).toBe(630);

      // 3. Verify slides and compositions cloned with new IDs
      expect(duplicated!.slides.length).toBe(1);
      const clonedSlide = duplicated!.slides[0];
      expect(clonedSlide.id).not.toBe(sourceSlideId);
      expect(clonedSlide.project_id).toBe(duplicated!.project.id);
      expect(clonedSlide.status).toBe('draft');

      expect(duplicated!.compositions.length).toBe(1);
      const clonedComp = duplicated!.compositions[0];
      expect(clonedComp.slide_id).toBe(clonedSlide.id);
      expect(clonedComp.revision).toBe(1); // Revision reset to 1
      expect(clonedComp.document.layers.length).toBe(2);
      expect(clonedComp.document.layers[0].imageUrl).toBe('https://example.com/asset.png'); // Preserved asset URL

      // Clean up
      devStore.deleteProject(sourceProjectId);
      devStore.deleteProject(duplicated!.project.id);
    });
  });

  describe('3. Archiving / Soft Delete and Gallery Filters', () => {
    it('toggles archive status and properly filters active vs archived projects', () => {
      const testOrgId = devStore.getOrganizationId();
      const client = devStore.listClients()[0];
      const pId = `proj-archive-test-${Date.now()}`;

      devStore.addProject(
        {
          id: pId,
          organization_id: testOrgId,
          client_id: client?.id || 'client-1',
          title: 'Produção para Arquivar',
          project_type: 'single_post',
          format: 'instagram_feed_4_5',
          status: 'draft',
          archived_at: null,
          created_by: 'dev-user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        [],
        []
      );

      // Default list (active only) includes it
      let activeList = devStore.listProjects();
      expect(activeList.some((p) => p.id === pId)).toBe(true);

      // Archive it
      const archivedTime = new Date().toISOString();
      devStore.updateProject(pId, { status: 'archived', archived_at: archivedTime });

      // Default list excludes it
      activeList = devStore.listProjects();
      expect(activeList.some((p) => p.id === pId)).toBe(false);

      // Archived list includes it
      const archivedList = devStore.listProjects(undefined, 'archived', undefined, true);
      expect(archivedList.some((p) => p.id === pId)).toBe(true);

      // Restore it
      devStore.updateProject(pId, { status: 'draft', archived_at: null });
      activeList = devStore.listProjects();
      expect(activeList.some((p) => p.id === pId)).toBe(true);

      // Clean up
      devStore.deleteProject(pId);
    });
  });

  describe('4. RBAC Permissions Matrix', () => {
    it('validates role capabilities strictly', () => {
      // Owner: full access
      expect(canCreateProjects('owner')).toBe(true);
      expect(isAdmin('owner')).toBe(true);
      expect(isOwner('owner')).toBe(true);

      // Admin: full operational access
      expect(canCreateProjects('admin')).toBe(true);
      expect(isAdmin('admin')).toBe(true);
      expect(isOwner('admin')).toBe(false);

      // Designer: can create and edit assigned clients, not admin
      expect(canCreateProjects('designer')).toBe(true);
      expect(isAdmin('designer')).toBe(false);
      expect(isOwner('designer')).toBe(false);

      // Viewer: read-only, blocked from creating, editing, duplicating, archiving
      expect(canCreateProjects('viewer')).toBe(false);
      expect(isAdmin('viewer')).toBe(false);
      expect(isOwner('viewer')).toBe(false);
    });
  });

  describe('5. Export Sanitization & Deterministic Naming', () => {
    it('sanitizes special characters, accents and formats export filenames consistently', () => {
      const cleanSlug = ExportService.sanitizeFilename('São Paulo & Café — Design!');
      expect(cleanSlug).toBe('sao-paulo-cafe-design');

      const filename = ExportService.formatFilename({
        clientSlug: 'studio-fa',
        dateStr: '2026-10-19',
        slideIndex: 0,
      });
      expect(filename).toBe('studio-fa_2026-10-19_slide-01.png');

      const filenameSlide3 = ExportService.formatFilename({
        clientSlug: 'studio-fa',
        dateStr: '2026-10-19',
        slideIndex: 2,
        ext: 'jpg',
      });
      expect(filenameSlide3).toBe('studio-fa_2026-10-19_slide-03.jpg');
    });
  });
});
