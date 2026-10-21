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

  const subjectPath = 'C:/Users/vinic/.gemini/antigravity/brain/cbd65322-2cd9-42da-9c34-5970f53e0c6b/.user_uploaded/media_1792525732743_c86dda60.png';
  const subjectBuf = fs.readFileSync(subjectPath);
  const subjectB64 = subjectBuf.toString('base64');

  // Referência do cliente
  const refPath = 'C:/Users/vinic/.gemini/antigravity/brain/cbd65322-2cd9-42da-9c34-5970f53e0c6b/.user_uploaded/media_1792527513314_6b419868.png';
  const refBuf = fs.existsSync(refPath) ? fs.readFileSync(refPath) : subjectBuf;
  const refB64 = refBuf.toString('base64');

  console.log('Passo 1: GPT-4o Vision analisando a referência e o Objeto Principal para sintetizar o prompt único igual ao ChatGPT...');

  const visionPrompt = `You are an expert art director preparing an image generation prompt.
Analyze the two attached images:
- Image 1: Visual style reference (typography, color palette, lighting, mood, background setting).
- Image 2: The hero subject of the campaign (the person who MUST appear in the generated artwork).

User instruction: "Gere uma imagem com o texto TRATAMENTO GLUTEO igual a primeira imagem anexada. Utilize a mulher de preto (Objeto Principal) para estar na imagem que você gerar. A primeira imagem é apenas uma referencia. Criar imagem 4:5"

Describe the woman from Image 2 in precise photographic detail (her short textured wavy auburn hair, facial structure, skin tone, gold hoop earrings, black sleeveless high-neck top, pose and expression).
Place her as the SOLE central hero in a luxury aesthetic clinic environment matching the lighting, warm golden tones, and marble/gold accents of Image 1.
Include the headline text "TRATAMENTO GLÚTEO" rendered in elegant golden 3D metallic serif typography seamlessly integrated beside her.

CRITICAL: There must be ONLY ONE person in the image (the woman from Image 2). Do NOT generate any other person.
Output ONLY the final detailed prompt in English.`;

  const visionResp = await fetch('https://api.openai.com/v1/chat/completions', {
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
            { type: 'text', text: visionPrompt },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${refB64}` } },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${subjectB64}` } },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 600,
    }),
  });

  const visionData = await visionResp.json();
  const synthesizedPrompt = visionData.choices?.[0]?.message?.content?.trim();
  console.log('\n--- Prompt Sintetizado pelo Vision (Estilo ChatGPT) ---');
  console.log(synthesizedPrompt);

  console.log('\nPasso 2: Enviando prompt diretamente para geração de imagem com gpt-image-2.5-flare...');
  const imgResp = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-image-2.5-flare',
      prompt: synthesizedPrompt,
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

  const generatedUrl = imgData.data?.[0]?.url;
  console.log('\nImagem gerada pelo DALL-E 3 com sucesso!');
  console.log('URL:', generatedUrl);

  const fetchImg = await fetch(generatedUrl);
  const arrBuf = await fetchImg.arrayBuffer();
  const outPath = 'C:/Users/vinic/.gemini/antigravity/brain/cbd65322-2cd9-42da-9c34-5970f53e0c6b/test-gpt-style-generation.png';
  fs.writeFileSync(outPath, Buffer.from(arrBuf));
  console.log('Salva em:', outPath);
}

main().catch(console.error);
