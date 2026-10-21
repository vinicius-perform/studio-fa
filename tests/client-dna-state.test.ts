// tests/client-dna-state.test.ts
import { describe, it, expect } from 'bun:test';
import { normalizeBrandDNAForDisplay, DisplayBrandDNA } from '../src/types/domain/dna';

describe('HOTFIX: Normalização de Brand DNA e Estados de Memória Visual', () => {
  // A) Cliente sem referências (dna null ou vazio)
  it('A) deve tratar cliente sem referências (dna null ou vazio) retornando null com segurança', () => {
    const fromNull = normalizeBrandDNAForDisplay(null);
    expect(fromNull).toBeNull();

    const fromUndefined = normalizeBrandDNAForDisplay(undefined);
    expect(fromUndefined).toBeNull();

    const fromEmpty = normalizeBrandDNAForDisplay({});
    expect(fromEmpty).toBeNull();

    // Simula resolução de estado na UI
    const client = {
      id: 'client-1',
      name: 'Cliente Sem Peças',
      visual_memory_status: 'awaiting_references',
      dna: {},
    };
    const pieces: any[] = [];
    const displayDna = normalizeBrandDNAForDisplay(client.dna);
    const visualStatus =
      client.visual_memory_status ||
      (pieces.length > 0 ? (displayDna ? 'ready' : 'awaiting_analysis') : 'awaiting_references');

    expect(displayDna).toBeNull();
    expect(visualStatus).toBe('awaiting_references');
  });

  // B) Cliente com peças + awaiting_analysis + dna null / {}
  it('B) deve suportar cliente com 13 peças em awaiting_analysis com dna: {} sem quebrar', () => {
    const rawDnaFromDb = {};
    const displayDna = normalizeBrandDNAForDisplay(rawDnaFromDb);
    expect(displayDna).toBeNull();

    const client = {
      id: 'c14b4641-620f-463a-9afb-0352c978974c',
      name: 'Fazendo Acontecer',
      visual_memory_status: 'awaiting_analysis',
      dna: {},
      pieces_count: 13,
    };
    const pieces = Array.from({ length: 13 }, (_, i) => ({ id: `piece-${i}` }));

    const visualStatus =
      client.visual_memory_status ||
      (pieces.length > 0 || (client.pieces_count && client.pieces_count > 0)
        ? (displayDna ? 'ready' : 'awaiting_analysis')
        : 'awaiting_references');

    expect(visualStatus).toBe('awaiting_analysis');
    expect(pieces.length).toBe(13);
    // Nenhuma exceção deve ocorrer ao inspecionar displayDna
    expect(displayDna?.colorSystem?.primary).toBeUndefined();
  });

  // C) Cliente com DNA parcial sem colorSystem
  it('C) deve tolerar cliente com DNA parcial sem colorSystem sem quebrar nem inventar cor falsa', () => {
    const partialDna = {
      version: 1,
      summary: 'Marca em transição visual sem paleta consolidada',
      typography: {
        titleFont: 'Poppins',
        bodyFont: 'Open Sans',
      },
    };

    const displayDna = normalizeBrandDNAForDisplay(partialDna);
    expect(displayDna).not.toBeNull();
    expect(displayDna!.summary).toBe('Marca em transição visual sem paleta consolidada');
    expect(displayDna!.colorSystem).toBeNull();
    expect(displayDna!.typography?.titleFont).toBe('Poppins');

    // Valida que acesso a cor primária é seguro e não injeta swatch falso
    const primaryColor = displayDna?.colorSystem?.primary || null;
    expect(primaryColor).toBeNull();
  });

  // C.1) Cliente com colorSystem parcial (apenas cor primária informada)
  it('C.1) deve suportar colorSystem com apenas primária sem inventar secundária ou accent', () => {
    const partialColors = {
      summary: 'Identidade com apenas uma cor detectada',
      colorSystem: {
        primary: '#123456',
      },
    };

    const displayDna = normalizeBrandDNAForDisplay(partialColors);
    expect(displayDna).not.toBeNull();
    expect(displayDna!.colorSystem).not.toBeNull();
    expect(displayDna!.colorSystem!.primary).toBe('#123456');
    expect(displayDna!.colorSystem!.secondary).toBeNull();
    expect(displayDna!.colorSystem!.accent).toBeNull();
    expect(displayDna!.colorSystem!.distributionRules).toBeNull();
  });

  // D) Cliente ready com DNA completo
  it('D) deve renderizar painel completo com DNA consolidado de forma íntegra', () => {
    const fullDna = {
      version: 2,
      lastConsolidatedAt: '2026-10-19T18:00:00.000Z',
      analyzedPiecesCount: 15,
      summary: 'Identidade visual moderna com estética minimalista',
      toneAndVoice: 'Sofisticado e Tecnológico',
      colorSystem: {
        primary: '#0F1113',
        secondary: '#1F2937',
        accent: '#CEF52A',
        neutrals: ['#FFFFFF', '#F3F4F6'],
        distributionRules: '60% neutros, 30% primária, 10% acento',
        allowedCombinations: ['Fundo escuro com acento neon'],
        forbiddenCombinations: ['Texto acento sobre fundo claro'],
      },
      typography: {
        titleFont: 'Space Grotesk',
        bodyFont: 'Inter',
        hierarchyGuidelines: 'Títulos em Bold uppercase',
        caseRules: 'UPPERCASE nos títulos',
      },
      composition: {
        dominantLayout: 'Assimétrico com grid estruturado',
        whiteSpaceRule: 'Margem ampla de segurança',
        visualDensity: 'medium' as const,
        focalPointGuideline: 'Hierarquia guiada pelo título',
      },
      do: ['Preservar contraste elevado', 'Utilizar logotipo oficial com respiro'],
      dont: ['Não distorcer o logotipo', 'Não utilizar degradês desalinhados'],
    };

    const displayDna = normalizeBrandDNAForDisplay(fullDna);
    expect(displayDna).not.toBeNull();
    expect(displayDna!.version).toBe(2);
    expect(displayDna!.colorSystem!.primary).toBe('#0F1113');
    expect(displayDna!.colorSystem!.secondary).toBe('#1F2937');
    expect(displayDna!.colorSystem!.accent).toBe('#CEF52A');
    expect(displayDna!.colorSystem!.neutrals.length).toBe(2);
    expect(displayDna!.typography!.titleFont).toBe('Space Grotesk');
    expect(displayDna!.composition!.dominantLayout).toBe('Assimétrico com grid estruturado');
    expect(displayDna!.do.length).toBe(2);
    expect(displayDna!.dont.length).toBe(2);
  });

  // E) Status error / failed
  it('E) deve apresentar estado de erro sem crash e permitir resolução consistente', () => {
    const client = {
      id: 'client-err',
      name: 'Cliente Com Erro de Análise',
      visual_memory_status: 'error',
      dna: {},
    };

    const displayDna = normalizeBrandDNAForDisplay(client.dna);
    const visualStatus = client.visual_memory_status;

    expect(displayDna).toBeNull();
    expect(visualStatus).toBe('error');

    // Valida que em status error ou failed não há dependência de propriedades de DNA
    const isErrorState = visualStatus === 'error' || visualStatus === 'failed';
    expect(isErrorState).toBe(true);
  });

  // F) Status needs_refresh / needs_review
  it('F) deve suportar status needs_refresh preservando DNA anterior e sinalizando pendência', () => {
    const oldDna = {
      version: 1,
      summary: 'DNA inicial',
      colorSystem: {
        primary: '#111111',
      },
    };
    const client = {
      id: 'client-refresh',
      name: 'Cliente Atualizado',
      visual_memory_status: 'needs_refresh',
      dna: oldDna,
    };

    const displayDna = normalizeBrandDNAForDisplay(client.dna);
    expect(displayDna).not.toBeNull();
    expect(displayDna!.colorSystem!.primary).toBe('#111111');
    expect(client.visual_memory_status).toBe('needs_refresh');
  });
});
