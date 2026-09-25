async function testWorkflow() {
  console.log('🧪 1. Logging in as Approver (Elena Vance)...');
  const approverLogin = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'approver@meditrack.com', password: 'Password@123' })
  });
  const { data: { token: approverToken } } = await approverLogin.json();

  console.log('🧪 2. Transitioning Work Order wo_01: reported -> approved...');
  const approveRes = await fetch('http://localhost:5000/api/work-orders/wo_01/status', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${approverToken}`
    },
    body: JSON.stringify({
      status: 'approved',
      notes: 'Reviewed clinical priority. Approved for emergency biomedical dispatch.'
    })
  });
  const approveData = await approveRes.json();
  console.log('Approve Response:', approveData.success ? 'SUCCESS' : 'FAILED', approveData.message);

  console.log('\n🧪 3. Transitioning Work Order wo_01: approved -> assigned (to Contractor)...');
  const assignRes = await fetch('http://localhost:5000/api/work-orders/wo_01/status', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${approverToken}`
    },
    body: JSON.stringify({
      status: 'assigned',
      assigned_to: 'usr_contractor_01',
      notes: 'Assigned to Apex BioMed Solutions field specialist.'
    })
  });
  const assignData = await assignRes.json();
  console.log('Assign Response:', assignData.success ? 'SUCCESS' : 'FAILED');

  console.log('\n🧪 4. Logging in as Contractor (Apex BioMed)...');
  const contractorLogin = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'contractor@meditrack.com', password: 'Password@123' })
  });
  const { data: { token: contractorToken } } = await contractorLogin.json();

  console.log('🧪 5. Contractor Starting Work: assigned -> in_progress...');
  const startRes = await fetch('http://localhost:5000/api/work-orders/wo_01/status', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${contractorToken}`
    },
    body: JSON.stringify({
      status: 'in_progress',
      notes: 'Technician on site. Cryocooler compressor pressure manifold disassembled.'
    })
  });
  const startData = await startRes.json();
  console.log('Start Work Response:', startData.success ? 'SUCCESS' : 'FAILED');

  console.log('\n🧪 6. Fetching Full Cryptographic Audit Chain for wo_01...');
  const auditRes = await fetch('http://localhost:5000/api/work-orders/wo_01/audit-chain', {
    headers: { Authorization: `Bearer ${contractorToken}` }
  });
  const auditData = await auditRes.json();
  console.log('Audit Chain Length:', auditData.data?.chain_length);
  console.log('Cryptographic Integrity Status:', auditData.data?.integrity);
  console.log('Events in Hash Chain:');
  auditData.data?.events?.forEach((evt, idx) => {
    console.log(`  [Event #${idx + 1}] Status: ${evt.status} | Hash: ${evt.current_hash.slice(0, 16)}... | Prev: ${evt.previous_hash.slice(0, 16)}...`);
  });
}

testWorkflow().catch(console.error);
