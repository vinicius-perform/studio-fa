async function verifyAssets() {
  console.log('Verificando carregamento de CSS e JS no dev server...');
  const resp = await fetch('http://localhost:3000/login');
  console.log('/login status:', resp.status);
  const html = await resp.text();

  const cssMatches = Array.from(new Set(html.match(/\/_next\/static\/css\/[^"']+/g) || []));
  const jsMatches = Array.from(new Set(html.match(/\/_next\/static\/chunks\/[^"']+/g) || []));

  console.log(`Found ${cssMatches.length} CSS files and ${jsMatches.length} JS chunk files.`);

  for (const c of cssMatches) {
    const cResp = await fetch('http://localhost:3000' + c);
    console.log(`CSS [${cResp.status}]: ${c} (${cResp.headers.get('content-type')})`);
  }

  for (const j of jsMatches.slice(0, 5)) {
    const jResp = await fetch('http://localhost:3000' + j);
    console.log(`JS [${jResp.status}]: ${j} (${jResp.headers.get('content-type')})`);
  }
}

verifyAssets().catch(console.error);
