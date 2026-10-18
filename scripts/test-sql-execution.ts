import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
let serviceKey = '';
let supabaseUrl = '';

envContent.split('\n').forEach((line) => {
  const idx = line.indexOf('=');
  if (idx !== -1) {
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k === 'SUPABASE_SERVICE_ROLE_KEY') serviceKey = v;
    if (k === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = v;
  }
});

async function main() {
  console.log('Testing Management API...');
  try {
    const resp = await fetch('https://api.supabase.com/v1/projects/rfdossffdlayntmyqpnl/database/query', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'SELECT 1;' }),
    });
    console.log('api.supabase.com status:', resp.status, await resp.text());
  } catch (err: any) {
    console.log('api.supabase.com error:', err.message);
  }

  // Also test direct project REST query endpoint or pg-meta
  try {
    const resp2 = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: 'Bearer ' + serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'SELECT 1;' }),
    });
    console.log('exec_sql status:', resp2.status, await resp2.text());
  } catch (err: any) {
    console.log('exec_sql error:', err.message);
  }

  // Also test pg-meta if exposed
  try {
    const resp3 = await fetch(`${supabaseUrl}/pg/query`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: 'Bearer ' + serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'SELECT 1;' }),
    });
    console.log('pg/query status:', resp3.status, await resp3.text());
  } catch (err: any) {
    console.log('pg/query error:', err.message);
  }
}

main().catch(console.error);
