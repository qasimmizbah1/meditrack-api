async function testContractors() {
  console.log('🧪 1. Logging in as Admin...');
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@meditrack.com', password: 'Password@123' })
  });
  const { data: { token } } = await loginRes.json();

  console.log('🧪 2. Fetching Contractors Directory...');
  const res = await fetch('http://localhost:5000/api/contractors', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(`Status: ${res.status}, Total Contractors: ${data.data?.length}`);
  console.log('Sample Contractor:', data.data?.[0]);

  console.log('🧪 3. Fetching Contractor Profile with Documents...');
  const profileRes = await fetch(`http://localhost:5000/api/contractors/${data.data?.[0].id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const profileData = await profileRes.json();
  console.log('Documents Count:', profileData.data?.documents?.length);
  console.log('Sample Document:', profileData.data?.documents?.[0]);
}

testContractors().catch(console.error);
