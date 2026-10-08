const BASE_URL = 'http://localhost:5000/api';

async function runFullSuite() {
  console.log('🚀 Starting Full MediTrack API Test Suite (Native Fetch)...\n');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  async function api(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || `HTTP ${res.status}: ${res.statusText}`);
    }
    return body;
  }

  // 1. Health Check
  await test('Health Check Endpoint', async () => {
    const data = await api('/health');
    if (!data.success) throw new Error('Health check success is false');
  });

  // 2. Auth for All Roles
  const roles = [
    { role: 'ADMIN', email: 'admin@meditrack.com', pass: 'Password@123' },
    { role: 'APPROVER', email: 'approver@meditrack.com', pass: 'Password@123' },
    { role: 'CONTRACTOR', email: 'contractor@meditrack.com', pass: 'Password@123' },
    { role: 'INSPECTOR', email: 'inspector@meditrack.com', pass: 'Password@123' },
    { role: 'STAFF', email: 'staff@meditrack.com', pass: 'Password@123' },
    { role: 'AUDITOR', email: 'auditor@meditrack.com', pass: 'Password@123' }
  ];

  const tokens = {};

  for (const r of roles) {
    await test(`Login as ${r.role} (${r.email})`, async () => {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: r.email, password: r.pass })
      });
      if (!data.data?.token) throw new Error('No token returned in auth response');
      tokens[r.role] = data.data.token;
    });
  }

  const adminHeaders = { Authorization: `Bearer ${tokens.ADMIN}` };
  const staffHeaders = { Authorization: `Bearer ${tokens.STAFF}` };

  // 3. System Settings
  await test('Get System Settings (Admin)', async () => {
    const data = await api('/settings', { headers: adminHeaders });
    if (!data.data?.currency) throw new Error('Settings missing currency property');
  });

  await test('Update System Settings (Currency to ZAR)', async () => {
    const data = await api('/settings', {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ currency: 'ZAR', currency_symbol: 'R' })
    });
    if (data.data?.currency !== 'ZAR') throw new Error('Currency update response mismatch');
  });

  // 4. Users CRUD
  let createdUserId = null;
  const testEmail = `testuser_${Date.now()}@meditrack.com`;

  await test('Get Users List (Admin)', async () => {
    const data = await api('/users', { headers: adminHeaders });
    if (!Array.isArray(data.data)) throw new Error('Users data is not an array');
  });

  await test('Create New User (Admin)', async () => {
    const data = await api('/users', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Test Engineer',
        email: testEmail,
        password: 'Password@123',
        role: 'STAFF',
        phone: '+1 555-0199'
      })
    });
    createdUserId = data.data.id;
    if (!createdUserId) throw new Error('Failed to create user');
  });

  await test('Update User Name & Role (Admin)', async () => {
    const data = await api(`/users/${createdUserId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Senior Test Engineer',
        role: 'CONTRACTOR'
      })
    });
    if (data.data.name !== 'Senior Test Engineer') throw new Error('User update name failed');
  });

  await test('Delete Test User (Admin)', async () => {
    const data = await api(`/users/${createdUserId}`, {
      method: 'DELETE',
      headers: adminHeaders
    });
    if (!data.success) throw new Error('Delete user failed');
  });

  // 5. Work Orders & Audit Chain
  let sampleWoId = null;
  await test('Get Work Orders List', async () => {
    const data = await api('/work-orders', { headers: adminHeaders });
    if (!Array.isArray(data.data) || data.data.length === 0) throw new Error('No work orders returned');
    sampleWoId = data.data[0].id;
  });

  await test('Get Work Order Detail with Audit Chain', async () => {
    const wo = await api(`/work-orders/${sampleWoId}`, { headers: adminHeaders });
    const audit = await api(`/work-orders/${sampleWoId}/audit-chain`, { headers: adminHeaders });
    if (!wo.data.id) throw new Error('Work order detail missing id');
    if (!audit.data.events) throw new Error('Audit chain missing events');
  });

  // 6. Invoices List & Summary
  await test('Get Invoices List', async () => {
    const data = await api('/invoices', { headers: adminHeaders });
    if (!Array.isArray(data.data)) throw new Error('Invoices is not an array');
  });

  await test('Get Invoices Summary', async () => {
    const data = await api('/invoices/summary', { headers: adminHeaders });
    if (!data.data) throw new Error('Invoices summary missing');
  });

  // 7. Facilities & Contractors
  await test('Get Facilities List', async () => {
    const data = await api('/facilities', { headers: adminHeaders });
    if (!Array.isArray(data.data)) throw new Error('Facilities is not an array');
  });

  await test('Get Contractors List', async () => {
    const data = await api('/contractors', { headers: adminHeaders });
    if (!Array.isArray(data.data)) throw new Error('Contractors is not an array');
  });

  // 8. Notifications
  await test('Get Staff Notifications', async () => {
    const data = await api('/notifications?limit=10', { headers: staffHeaders });
    if (!Array.isArray(data.data)) throw new Error('Notifications data is not an array');
  });

  // 9. Cryptographic Audit Vault
  await test('Get Cryptographic Ledger Status', async () => {
    const data = await api('/ledger/audit-ledger', { headers: adminHeaders });
    if (!data.data) throw new Error('Ledger audit data missing');
  });

  console.log('\n=========================================');
  console.log(`📊 Total Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('=========================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runFullSuite();
