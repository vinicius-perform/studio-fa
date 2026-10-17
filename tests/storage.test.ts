// tests/storage.test.ts
import { describe, expect, it } from 'bun:test';
import { buildStoragePath, AllowedMimeTypes, StorageBucketSchema } from '@/types/domain/asset';

describe('Storage & Storage Policies Verification', () => {
  const orgA = '98765432-1111-2222-3333-444455556666';
  const clientA = 'abcdef12-3456-7890-abcd-ef1234567890';

  it('generates compliant storage paths {org_id}/{client_id}/{category}/{uuid}.{ext}', () => {
    const path = buildStoragePath({
      organizationId: orgA,
      clientId: clientA,
      category: 'logos',
      filename: 'main-brand-logo.png',
    });

    const segments = path.split('/');
    expect(segments.length).toBe(4);
    expect(segments[0]).toBe(orgA);
    expect(segments[1]).toBe(clientA);
    expect(segments[2]).toBe('logos');
    expect(segments[3]).toMatch(/^[0-9a-f-]+\.png$/);
  });

  it('supports all 5 designated private buckets', () => {
    const buckets = [
      'client-brand-assets',
      'brand-references',
      'client-inputs',
      'generated-assets',
      'exports',
    ];

    for (const b of buckets) {
      const parsed = StorageBucketSchema.safeParse(b);
      expect(parsed.success).toBe(true);
    }
  });

  it('rejects unsupported file mime types', () => {
    const unsupported = ['application/x-msdownload', 'application/javascript', 'text/html'];
    for (const mime of unsupported) {
      expect(AllowedMimeTypes.includes(mime as any)).toBe(false);
    }
  });

  it('validates supported fonts and image mime types', () => {
    const supported = [
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/pdf',
      'font/ttf',
      'font/otf',
      'font/woff',
      'font/woff2',
    ];

    for (const mime of supported) {
      expect(AllowedMimeTypes.includes(mime as any)).toBe(true);
    }
  });
});
