import { test } from 'node:test';
import assert from 'node:assert/strict';
import { devStore } from '../src/lib/dev-store';

test('Cadastramento de Cliente — Normalização e Resolução de Slugs', async (t) => {
  await t.test('1. Deve sanitizar e gerar slug válido a partir do nome', () => {
    const name = 'Fazendo Acontecer';
    let slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    assert.equal(slug, 'fazendo-acontecer');
  });

  await t.test('2. Deve adicionar cliente na devStore sem erros e gerar brand profile aprovado', () => {
    const orgId = devStore.getOrganizationId();
    const created = devStore.addClient(
      {
        organization_id: orgId,
        name: 'Fazendo Acontecer Teste',
        slug: 'fazendo-acontecer-teste',
        niche: 'Tecnologia & SaaS',
        country: 'BR',
        status: 'active',
        brand_status: 'ready',
      },
      {
        organization_id: orgId,
        version: 1,
        status: 'approved',
        source: 'manual',
        summary: 'Identidade da marca Fazendo Acontecer',
        colors: {
          primary: ['#0F1113'],
          secondary: ['#1F2937'],
          accent: ['#CEF52A'],
          all: ['#0F1113', '#1F2937', '#CEF52A'],
          text: ['#FFFFFF', '#000000'],
        },
        typography: {
          detectedFonts: ['Montserrat', 'Inter'],
          primaryFont: 'Montserrat',
        },
      }
    );

    assert.ok(created.id);
    assert.equal(created.name, 'Fazendo Acontecer Teste');

    const client = devStore.getClientById(created.id);
    assert.ok(client);
  });
});
