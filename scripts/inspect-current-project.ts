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
      if (k && !k.startsWith('#') && !process.env[k]) process.env[k] = v;
    }
  });
}

import { getServiceRoleClient } from '../src/lib/supabase/server';

async function main() {
  const supabase = getServiceRoleClient();
  const projectId = '451ef30c-61d5-4012-b5a3-5a6f7f464f5e';

  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
  console.log('PROJECT:', project?.title, 'CLIENT:', project?.client_id);

  const { data: slides } = await supabase.from('project_slides').select('*').eq('project_id', projectId);
  console.log('SLIDES COUNT:', slides?.length);

  if (slides && slides.length > 0) {
    for (const s of slides) {
      console.log('SLIDE:', s.id, 'INDEX:', s.slide_index, 'TITLE:', s.title);
      const { data: comp } = await supabase.from('slide_compositions').select('*').eq('slide_id', s.id).maybeSingle();
      console.log('COMPOSITION FOUND:', !!comp, 'REVISION:', comp?.revision);
      if (comp) {
        console.log('DOCUMENT LAYERS:', (comp.document as any)?.layers?.map((l: any) => ({
          id: l.id,
          type: l.type,
          name: l.name,
          logoUrl: l.logoUrl,
          imageUrl: l.imageUrl
        })));
      }
    }
  }
}

main().catch(console.error);
