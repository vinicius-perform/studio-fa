import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const keys = envContent.split('\n').map(l => l.split('=')[0].trim()).filter(k => k && !k.startsWith('#'));
  console.log('Keys in .env.local:', keys);
}
