import fs from 'node:fs';
import path from 'node:path';

// Carrega .env.local
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

async function main() {
  const sb = getSupabaseAdminClient();
  const orgId = 'd4a03d1d-f80c-4f4e-bf6e-01e58054edf6';
  const integrationService = new IntegrationService(sb);
  const apiKey = await integrationService.resolveOpenAIKey(orgId);

  console.log('Resolvendo chave da OpenAI...');
  if (!apiKey) throw new Error('Sem chave');

  // Prompt exatamente no estilo e formulação que o ChatGPT utilizou com sucesso
  const unifiedPrompt = `A high-end luxury editorial commercial photograph for a medical and aesthetic clinic in 4:5 aspect ratio.
HERO SUBJECT: A confident, elegant female aesthetic doctor in her late 30s with short textured wavy dark auburn hair parted to the side, warm olive-tan skin tone, subtle smile, wearing bold gold hoop earrings, a fitted black sleeveless high-neck mock-turtleneck top, and tailored black trousers with hands resting in pockets.
ENVIRONMENT & STYLE: Standing inside a luxurious modern aesthetic clinic with marble counters, gold shelving, white orchids, and warm golden-amber architectural lighting.
TYPOGRAPHY: On the left side of the composition, the text 'TRATAMENTO' in elegant gold lettering and 'GLÚTEO' in bold luxury 3D golden metallic serif font with realistic reflections.
STRICT MANDATE: ONLY ONE person in the image. No second person, no background models. Single cohesive photographic capture with cinematic lighting and luxury aesthetic finish.`;

  console.log('Prompt unificado enviado para gpt-image-2.5-flare:');
  console.log(unifiedPrompt);

  const imgResp = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-image-2.5-flare',
      prompt: unifiedPrompt,
      size: '1088x1360',
      quality: 'low',
      n: 1,
    }),
  });

  const imgData = await imgResp.json();
  if (!imgResp.ok) {
    console.error('Erro na geração:', imgData);
    return;
  }

  const item = imgData.data?.[0];
  let buffer: Buffer;
  if (item?.b64_json) {
    buffer = Buffer.from(item.b64_json, 'base64');
  } else if (item?.url) {
    const r = await fetch(item.url);
    buffer = Buffer.from(await r.arrayBuffer());
  } else {
    throw new Error('Nenhuma imagem retornada');
  }

  const outPath = 'C:/Users/vinic/.gemini/antigravity/brain/cbd65322-2cd9-42da-9c34-5970f53e0c6b/test-real-gpt-unified-art.png';
  fs.writeFileSync(outPath, buffer);
  console.log('\nArte unificada gerada com sucesso e salva em:', outPath);
}

main().catch(console.error);
