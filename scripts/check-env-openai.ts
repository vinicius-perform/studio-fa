import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
let key = '';
envContent.split('\n').forEach((line) => {
  const idx = line.indexOf('=');
  if (idx !== -1) {
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k === 'OPENAI_API_KEY') key = v;
  }
});

console.log('OPENAI_API_KEY is placeholder?', key === 'your-openai-api-key-here');
console.log('OPENAI_API_KEY length:', key.length);
console.log('OPENAI_API_KEY starts with sk-?', key.startsWith('sk-'));
