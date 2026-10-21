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

async function testSafeAnalysis() {
  const sb = getSupabaseAdminClient();
  const orgId = 'd4a03d1d-f80c-4f4e-bf6e-01e58054edf6';
  const integrationService = new IntegrationService(sb);
  const apiKey = await integrationService.resolveOpenAIKey(orgId);

  const subjectPath = 'C:/Users/vinic/.gemini/antigravity/brain/cbd65322-2cd9-42da-9c34-5970f53e0c6b/.user_uploaded/media_1792525732743_c86dda60.png';
  const subjectBuf = fs.readFileSync(subjectPath);
  const b64 = subjectBuf.toString('base64');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Provide an art-direction visual brief of the subject in this image for an advertising campaign: describe the haircut and hair color, clothing style, colors, accessories, expression, pose, and overall aesthetic styling.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${b64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 300,
      temperature: 0.1,
    }),
  });

  const data = await res.json();
  console.log('Result:', data.choices?.[0]?.message?.content);
}

testSafeAnalysis().catch(console.error);
