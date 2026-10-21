import fs from 'node:fs';
import path from 'node:path';

// Carrega .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8');
let apiKey = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('OPENAI_API_KEY=')) {
    apiKey = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
  }
}

async function main() {
  console.log('Testing with API key:', apiKey.slice(0, 7) + '...');
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: 'Bearer ' + apiKey },
  });
  const data = await res.json();
  if (!data.data) {
    console.error('Error fetching models:', data);
    return;
  }
  const imageModels = data.data.filter((m: any) =>
    m.id.includes('image') || m.id.includes('dall') || m.id.includes('gpt-4') || m.id.includes('responses')
  );
  console.log('Relevant models in account:');
  imageModels.forEach((m: any) => console.log(' -', m.id));
}

main().catch(console.error);
