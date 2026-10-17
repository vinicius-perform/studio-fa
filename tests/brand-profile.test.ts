// tests/brand-profile.test.ts
import { describe, expect, it } from 'bun:test';
import { BrandProfileSchema, type BrandProfile } from '@/types/domain/brand';

describe('Brand Profile Schema & Versioning Rules', () => {
  const validProfile: BrandProfile = {
    summary: 'Identidade visual moderna da FA com estética premium e tecnologia.',
    colors: {
      primary: ['#0B0F17'],
      secondary: ['#1F2937'],
      accent: ['#CEF52A'],
      background: ['#FAFAFA', '#FFFFFF'],
      text: ['#111827', '#4B5563'],
    },
    typography: {
      headingStyle: 'Bold geométrica',
      bodyStyle: 'Modern sans',
      hierarchy: 'H1 > H2 > Body',
      detectedFonts: ['Inter'],
      fallbackFonts: ['sans-serif'],
    },
    composition: {
      alignment: 'Esquerda',
      density: 'Ampla com respiro',
      margins: '80px',
      visualHierarchy: 'Alto contraste',
      commonLayouts: ['Split 50/50'],
    },
    photography: {
      style: 'Editorial Corporativo',
      lighting: 'Natural suave',
      treatment: 'Neutro contemporâneo',
      subjects: ['Pessoas em ambiente corporativo'],
    },
    logoUsage: {
      preferredPositions: ['Superior esquerdo'],
      minimumClearSpace: 'Altura do símbolo',
      allowedVersions: ['Primário', 'Branco'],
      restrictions: ['Não distorcer'],
    },
    graphicalElements: {
      shapes: ['Cantos arredondados 12px'],
      patterns: ['Grid de pontos sutil'],
      textures: [],
      icons: ['Outline 1.5px'],
      effects: ['Sombra suave'],
    },
    visualStyle: {
      keywords: ['SaaS', 'Design', 'Minimalismo'],
      mood: ['Tecnológico', 'Sofisticado'],
      sophistication: 'Alta',
      contrast: 'Forte',
    },
    contentStyle: {
      titleStyle: 'Impactante e conciso',
      subtitleStyle: 'Claro em até 2 linhas',
      ctaStyle: 'Botão verde FA',
      amountOfText: 'Baixa a média',
    },
    spacingRules: ['Grid de 8px', 'Padding padrão de 64px'],
    dos: ['Manter contraste nítido', 'Usar #CEF52A somente como destaque'],
    donts: ['Não pintar o canvas todo de verde', 'Não usar fontes manuscritas'],
  };

  it('validates a complete compliant Brand Profile', () => {
    const result = BrandProfileSchema.safeParse(validProfile);
    expect(result.success).toBe(true);
  });

  it('rejects an empty summary', () => {
    const invalid = { ...validProfile, summary: '' };
    const result = BrandProfileSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('simulates atomic single approved profile constraint transition', () => {
    const profiles = [
      { id: 'p1', clientId: 'c1', version: 1, status: 'approved' },
      { id: 'p2', clientId: 'c1', version: 2, status: 'draft' },
    ];

    // Approve p2
    const targetId = 'p2';
    const updated = profiles.map((p) => {
      if (p.id === targetId) {
        return { ...p, status: 'approved' };
      }
      if (p.status === 'approved') {
        return { ...p, status: 'superseded' };
      }
      return p;
    });

    const approvedCount = updated.filter((p) => p.status === 'approved').length;
    expect(approvedCount).toBe(1);
    expect(updated.find((p) => p.id === 'p1')?.status).toBe('superseded');
    expect(updated.find((p) => p.id === 'p2')?.status).toBe('approved');
  });
});
