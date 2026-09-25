async function testFacilities() {
  console.log('🧪 Logging in as Admin...');
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@meditrack.com', password: 'Password@123' })
  });
  const { data: { token } } = await loginRes.json();

  console.log('🧪 Fetching Facilities...');
  const facRes = await fetch('http://localhost:5000/api/facilities', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const facData = await facRes.json();
  console.log(`Status: ${facRes.status}, Total Facilities: ${facData.data?.length}`);
  console.log('Sample Facility:', facData.data?.[0]);
}

testFacilities().catch(console.error);
