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
import { FaceDetectionService } from '../src/services/ai/face-detection.service';
import { CreativeChatService } from '../src/services/ai/creative-chat.service';

async function main() {
  const sb = getSupabaseAdminClient();
  const orgId = 'd4a03d1d-f80c-4f4e-bf6e-01e58054edf6';
  const integrationService = new IntegrationService(sb);
  const apiKey = await integrationService.resolveOpenAIKey(orgId);

  const subjectPath = 'C:/Users/vinic/.gemini/antigravity/brain/cbd65322-2cd9-42da-9c34-5970f53e0c6b/.user_uploaded/media_1792525732743_c86dda60.png';
  const subjectBuf = fs.readFileSync(subjectPath);

  const detect = await FaceDetectionService.detectFaces({ apiKey, imageBuffer: subjectBuf });
  console.log('Face count:', detect.faceCount);
  const faceCrop = detect.primaryFaceCropBuffer || subjectBuf;

  const facialDesc = await FaceDetectionService.analyzeFacialIdentity({ apiKey, faceCropBuffer: faceCrop });
  console.log('\n--- Facial Identity Description ---');
  console.log(facialDesc);

  const stylingDesc = await CreativeChatService.analyzeSubjectLikeness(apiKey, subjectBuf);
  console.log('\n--- Subject Styling Description ---');
  console.log(stylingDesc);
}

main().catch(console.error);
