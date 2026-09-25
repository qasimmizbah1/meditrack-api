async function testAuth() {
  console.log('🧪 Testing Health Check...');
  const healthRes = await fetch('http://localhost:5000/api/health');
  const healthData = await healthRes.json();
  console.log('Health Response:', healthData);

  console.log('\n🧪 Testing Admin Login...');
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@meditrack.com',
      password: 'Password@123'
    })
  });
  const loginData = await loginRes.json();
  console.log('Login Status:', loginRes.status);
  console.log('Login Result:', loginData.success ? 'SUCCESS' : 'FAILED', loginData.data?.user);

  const token = loginData.data?.token;

  console.log('\n🧪 Testing Protected GET /api/auth/me...');
  const meRes = await fetch('http://localhost:5000/api/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const meData = await meRes.json();
  console.log('Me Status:', meRes.status);
  console.log('User Profile:', meData.data);

  console.log('\n🧪 Testing Protected GET /api/users (Admin only)...');
  const usersRes = await fetch('http://localhost:5000/api/users', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const usersData = await usersRes.json();
  console.log('Users Status:', usersRes.status);
  console.log(`Retrieved ${usersData.data?.length} users.`);
}

testAuth().catch(console.error);
