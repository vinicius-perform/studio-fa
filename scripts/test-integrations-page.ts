async function testIntegrationsRoute() {
  try {
    const res = await fetch('http://localhost:3000/settings/integrations');
    console.log('GET /settings/integrations status:', res.status);
  } catch (err: any) {
    console.log('Error fetching /settings/integrations:', err.message);
  }
}
testIntegrationsRoute();
