import fs from 'node:fs';
import path from 'node:path';

const envContent = fs.readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const idx = t.indexOf('=');
  if (idx !== -1) {
    process.env[t.slice(0, idx).trim()] = t.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
  }
}

import { getSupabaseAdminClient } from '../src/lib/supabase/admin';
import { IntegrationService } from '../src/services/integrations/integration.service';

async function testEdits() {
  const sb = getSupabaseAdminClient();
  const orgId = 'd4a03d1d-f80c-4f4e-bf6e-01e58054edf6';
  const integrationService = new IntegrationService(sb);
  const apiKey = await integrationService.resolveOpenAIKey(orgId);

  const subjectPath = 'C:/Users/vinic/.gemini/antigravity/brain/cbd65322-2cd9-42da-9c34-5970f53e0c6b/.user_uploaded/media_1792525732743_c86dda60.png';
  const imgBlob = new Blob([fs.readFileSync(subjectPath)], { type: 'image/png' });

  const formData = new FormData();
  formData.append('image', imgBlob, 'subject.png');
  formData.append('prompt', 'A woman in black sleeveless top in a luxury aesthetic clinic with gold 3D text TRATAMENTO GLUTEO');
  formData.append('model', 'dall-e-2');
  formData.append('size', '1024x1024');

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const data = await res.json();
  console.log('Images edits result:', data);
}

testEdits().catch(console.error);
