async function testWorkOrders() {
  console.log('🧪 Logging in as Staff...');
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'staff@meditrack.com', password: 'Password@123' })
  });
  const { data: { token } } = await loginRes.json();

  console.log('🧪 Fetching Work Orders...');
  const woRes = await fetch('http://localhost:5000/api/work-orders', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const woData = await woRes.json();
  console.log(`Status: ${woRes.status}, Total Work Orders: ${woData.data?.length}`);
  console.log('Sample Work Order:', woData.data?.[0]);
}

testWorkOrders().catch(console.error);
