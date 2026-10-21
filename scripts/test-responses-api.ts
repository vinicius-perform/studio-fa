import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const idx = line.indexOf('=');
    if (idx !== -1) {
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (k && !k.startsWith('#') && !process.env[k]) {
        process.env[k] = v;
      }
    }
  });
}

import { getServiceRoleClient } from '../src/lib/supabase/server';
import { IntegrationService } from '../src/services/integrations/integration.service';

async function test() {
  const supabase = getServiceRoleClient();
  const orgId = 'd4a03d1d-f80c-4f4e-bf6e-01e58054edf6';
  const intService = new IntegrationService(supabase);
  const apiKey = await intService.resolveOpenAIKey(orgId);

  console.log('Testing OpenAI Responses / Chat Multimodal API...');
  console.log('API Key resolved:', apiKey ? `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}` : 'NONE');

  // Busca uma imagem real de Fazendo Acontecer
  const { data: pieces } = await supabase
    .from('client_pieces')
    .select('id, storage_bucket, storage_path')
    .eq('client_id', 'c14b4641-620f-463a-9afb-0352c978974c')
    .limit(1);

  if (pieces && pieces.length > 0) {
    const p = pieces[0];
    const { data: dl } = await supabase.storage.from(p.storage_bucket).download(p.storage_path);
    const buf = Buffer.from(await dl!.arrayBuffer());
    const base64Url = `data:image/png;base64,${buf.toString('base64')}`;

    console.log('Sending real image to /v1/responses with input_image...');
    const resp2 = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: 'Describe the dominant colors, typography style and visual contrast of this brand reference image in 2 sentences.' },
              { type: 'input_image', image_url: base64Url },
            ],
          },
        ],
      }),
    });

    console.log('Responses API with input_image status:', resp2.status);
    const dataObj = await resp2.json();
    console.log('OUTPUT MESSAGE CONTENT:', JSON.stringify(dataObj.output?.[0]?.content, null, 2));
  }
}

test().catch(console.error);
