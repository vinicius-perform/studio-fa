// src/app/api/settings/ai/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { devStore } from '@/lib/dev-store';

export async function GET() {
  try {
    const envKey = process.env.OPENAI_API_KEY;
    const storeKey = devStore.getSetting('openai_api_key');
    const effectiveKey = (envKey && envKey.trim().length > 0) ? envKey.trim() : (storeKey || '');

    const configured = Boolean(effectiveKey && effectiveKey.length > 5);
    const previewKey = configured
      ? `${effectiveKey.substring(0, 7)}...${effectiveKey.substring(effectiveKey.length - 4)}`
      : null;

    return NextResponse.json({
      configured,
      previewKey,
    });
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message } }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { apiKey } = body;

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 5) {
      return NextResponse.json(
        { error: { message: 'Chave de API da OpenAI inválida.' } },
        { status: 400 }
      );
    }

    const cleanKey = apiKey.trim();

    // 1. Update in-memory runtime
    process.env.OPENAI_API_KEY = cleanKey;

    // 2. Persist in devStore
    devStore.setSetting('openai_api_key', cleanKey);

    // 3. Update .env.local if present
    try {
      const envLocalPath = path.join(process.cwd(), '.env.local');
      if (fs.existsSync(envLocalPath)) {
        let content = fs.readFileSync(envLocalPath, 'utf-8');
        if (/OPENAI_API_KEY=.*/.test(content)) {
          content = content.replace(/OPENAI_API_KEY=.*/, `OPENAI_API_KEY=${cleanKey}`);
        } else {
          content += `\nOPENAI_API_KEY=${cleanKey}\n`;
        }
        fs.writeFileSync(envLocalPath, content, 'utf-8');
      }
    } catch (e) {
      console.warn('Não foi possível gravar no .env.local, chave mantida no devStore:', e);
    }

    return NextResponse.json({
      success: true,
      configured: true,
      previewKey: `${cleanKey.substring(0, 7)}...${cleanKey.substring(cleanKey.length - 4)}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message } }, { status: 500 });
  }
}
