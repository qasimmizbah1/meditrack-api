import bcrypt from 'bcrypt';
import crypto from 'crypto';
import db from './db.js';
import { ROLES, WORK_ORDER_PRIORITY, WORK_ORDER_STATUS, CONTRACTOR_COMPLIANCE_STATUS } from '../config/constants.js';
import { computeEventHash, GENESIS_HASH } from '../utils/crypto.js';

async function seedDatabase() {
  try {
    console.log('🌱 Starting Database Seeding...');

    // 1. Seed Roles
    const rolesList = [
      { id: 'role_admin', name: ROLES.ADMIN, description: 'Full system administrator with all privileges' },
      { id: 'role_staff', name: ROLES.STAFF, description: 'Facility staff member who reports and views facility issues' },
      { id: 'role_approver', name: ROLES.APPROVER, description: 'Facility leadership who reviews and approves work orders' },
      { id: 'role_contractor', name: ROLES.CONTRACTOR, description: 'Maintenance contractor assigned to execute work orders' },
      { id: 'role_inspector', name: ROLES.INSPECTOR, description: 'Quality & safety inspector who audits and verifies work' },
      { id: 'role_auditor', name: ROLES.AUDITOR, description: 'External/Internal compliance auditor with read-only & hash-verification rights' }
    ];

    for (const r of rolesList) {
      await db.query(
        `INSERT INTO roles (id, name, description) 
         VALUES (?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name, description = excluded.description`,
        [r.id, r.name, r.description]
      );
    }
    console.log('✅ Roles seeded.');

    // 2. Seed Permissions
    const permissionsList = [
      { id: 'perm_wo_read', name: 'work_orders:read', module: 'work_orders', description: 'View work orders' },
      { id: 'perm_wo_create', name: 'work_orders:create', module: 'work_orders', description: 'Create work orders' },
      { id: 'perm_wo_approve', name: 'work_orders:approve', module: 'work_orders', description: 'Approve or reject work orders' },
      { id: 'perm_wo_assign', name: 'work_orders:assign', module: 'work_orders', description: 'Assign contractor to work orders' },
      { id: 'perm_wo_update_status', name: 'work_orders:update_status', module: 'work_orders', description: 'Update work order status' },
      { id: 'perm_wo_verify', name: 'work_orders:verify', module: 'work_orders', description: 'Verify completed work orders' },
      { id: 'perm_contractors_manage', name: 'contractors:manage', module: 'contractors', description: 'Create and manage contractors' },
      { id: 'perm_facilities_manage', name: 'facilities:manage', module: 'facilities', description: 'Manage hospital facilities' },
      { id: 'perm_invoices_manage', name: 'invoices:manage', module: 'invoices', description: 'Create and approve invoices' },
      { id: 'perm_audit_view', name: 'audit:view', module: 'audit', description: 'View cryptographic hash chain and verify proofs' },
      { id: 'perm_users_manage', name: 'users:manage', module: 'users', description: 'Manage user accounts and roles' }
    ];

    for (const p of permissionsList) {
      await db.query(
        `INSERT INTO permissions (id, name, module, description)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name, module = excluded.module, description = excluded.description`,
        [p.id, p.name, p.module, p.description]
      );
    }
    console.log('✅ Permissions seeded.');

    // 3. Seed Facilities
    const facilitiesList = [
      {
        id: 'fac_01',
        name: 'Metro General Hospital - Main Campus',
        code: 'FAC-MGH-01',
        type: 'Hospital',
        address: '100 Medical Center Blvd',
        city: 'New York',
        state: 'NY',
        contact_name: 'Dr. Robert Vance',
        contact_email: 'rvance@metrogeneral.org',
        contact_phone: '+1 (555) 201-1100',
        total_beds: 450,
        status: 'active'
      },
      {
        id: 'fac_02',
        name: 'St. Jude Trauma & Surgical Pavilion',
        code: 'FAC-SJP-02',
        type: 'Trauma Center',
        address: '450 Mercy Way',
        city: 'Boston',
        state: 'MA',
        contact_name: 'Claire Holloway',
        contact_email: 'cholloway@stjude-pavilion.org',
        contact_phone: '+1 (555) 201-2200',
        total_beds: 280,
        status: 'active'
      },
      {
        id: 'fac_03',
        name: 'Hope Valley Children’s Hospital',
        code: 'FAC-HVCH-03',
        type: 'Pediatric Hospital',
        address: '78 Pediatric Lane',
        city: 'Chicago',
        state: 'IL',
        contact_name: 'David Kim',
        contact_email: 'dkim@hopevalleyhealth.org',
        contact_phone: '+1 (555) 201-3300',
        total_beds: 190,
        status: 'active'
      },
      {
        id: 'fac_04',
        name: 'Apex Advanced Diagnostic & MRI Wing',
        code: 'FAC-ADM-04',
        type: 'Diagnostic Lab',
        address: '920 Research Parkway',
        city: 'San Francisco',
        state: 'CA',
        contact_name: 'Anita Desai',
        contact_email: 'adesai@apexdiagnostic.com',
        contact_phone: '+1 (555) 201-4400',
        total_beds: 50,
        status: 'active'
      },
      {
        id: 'fac_05',
        name: 'Riverdale North Clinic & Urgent Care',
        code: 'FAC-RNC-05',
        type: 'Clinic',
        address: '33 Valley Stream Road',
        city: 'Denver',
        state: 'CO',
        contact_name: 'Steven Croft',
        contact_email: 'scroft@riverdalehealth.org',
        contact_phone: '+1 (555) 201-5500',
        total_beds: 25,
        status: 'maintenance'
      }
    ];

    for (const f of facilitiesList) {
      await db.query(
        `INSERT INTO facilities (id, name, code, type, address, city, state, contact_name, contact_email, contact_phone, total_beds, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
            name = excluded.name,
            code = excluded.code,
            type = excluded.type,
            address = excluded.address,
            city = excluded.city,
            state = excluded.state,
            contact_name = excluded.contact_name,
            contact_email = excluded.contact_email,
            contact_phone = excluded.contact_phone,
            total_beds = excluded.total_beds,
            status = excluded.status`,
        [f.id, f.name, f.code, f.type, f.address, f.city, f.state, f.contact_name, f.contact_email, f.contact_phone, f.total_beds, f.status]
      );
    }
    console.log('✅ Facilities seeded.');

    // 4. Seed Contractors
    const contractorsList = [
      {
        id: 'usr_contractor_01',
        name: 'Apex BioMed Solutions LLC',
        registration_number: 'REG-BIO-2026-08',
        specialty: 'Biomedical & Diagnostic Imaging Systems',
        contact_person: 'David Henderson',
        email: 'contractor@meditrack.com',
        phone: '+1 (555) 010-0004',
        address: '770 Industrial Science Way',
        city: 'Boston',
        state: 'MA',
        compliance_status: CONTRACTOR_COMPLIANCE_STATUS.COMPLIANT,
        rating: 4.9
      },
      {
        id: 'cont_02',
        name: 'CryoTech Clinical Air & HVAC Corp',
        registration_number: 'REG-HVAC-2026-14',
        specialty: 'Hospital Cleanroom & Laminar Air Flow',
        contact_person: 'Sarah O’Connor',
        email: 'service@cryotech-hvac.com',
        phone: '+1 (555) 402-8811',
        address: '120 Coldstream Blvd',
        city: 'New York',
        state: 'NY',
        compliance_status: CONTRACTOR_COMPLIANCE_STATUS.COMPLIANT,
        rating: 4.8
      },
      {
        id: 'cont_03',
        name: 'VoltGuard Hospital Power & Generators',
        registration_number: 'REG-ELEC-2026-22',
        specialty: 'High Voltage Emergency Life Support Circuits',
        contact_person: 'Michael Ray',
        email: 'dispatch@voltguardpower.com',
        phone: '+1 (555) 402-9922',
        address: '500 Gridline Drive',
        city: 'Chicago',
        state: 'IL',
        compliance_status: CONTRACTOR_COMPLIANCE_STATUS.WARNING,
        rating: 4.6
      },
      {
        id: 'cont_04',
        name: 'SafePure Medical Water & RO Filtration',
        registration_number: 'REG-PLUMB-2026-31',
        specialty: 'Dialysis Water Treatment & Medical Gases',
        contact_person: 'Karen White',
        email: 'ops@safepuremed.com',
        phone: '+1 (555) 402-7733',
        address: '34 Aqua Park Road',
        city: 'San Francisco',
        state: 'CA',
        compliance_status: CONTRACTOR_COMPLIANCE_STATUS.COMPLIANT,
        rating: 4.95
      }
    ];

    for (const c of contractorsList) {
      await db.query(
        `INSERT INTO contractors (id, name, registration_number, specialty, contact_person, email, phone, address, city, state, compliance_status, rating)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
            name = excluded.name,
            registration_number = excluded.registration_number,
            specialty = excluded.specialty,
            contact_person = excluded.contact_person,
            email = excluded.email,
            phone = excluded.phone,
            address = excluded.address,
            city = excluded.city,
            state = excluded.state,
            compliance_status = excluded.compliance_status,
            rating = excluded.rating`,
        [c.id, c.name, c.registration_number, c.specialty, c.contact_person, c.email, c.phone, c.address, c.city, c.state, c.compliance_status, c.rating]
      );

      // Seed compliance documents for each contractor
      await db.query(
        `INSERT INTO contractor_documents (id, contractor_id, title, document_type, file_url, expiry_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING`,
        [`doc_${c.id}_01`, c.id, 'ISO 13485 Medical Device Maintenance Accreditation', 'Certification', '/uploads/contractors/iso-cert.pdf', '2027-12-31', 'valid']
      );

      await db.query(
        `INSERT INTO contractor_documents (id, contractor_id, title, document_type, file_url, expiry_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING`,
        [`doc_${c.id}_02`, c.id, '$10,000,000 Commercial General Liability Policy', 'Insurance', '/uploads/contractors/insurance-policy.pdf', '2027-06-30', 'valid']
      );
    }
    console.log('✅ Contractors & Compliance Documents seeded.');

    // 5. Seed Demo Users
    const defaultPassword = 'Password@123';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const demoUsers = [
      {
        id: 'usr_admin_01',
        name: 'Dr. Sarah Jenkins (Admin)',
        email: 'admin@meditrack.com',
        role: ROLES.ADMIN,
        roleId: 'role_admin',
        facilityId: null,
        phone: '+1 (555) 010-0001'
      },
      {
        id: 'usr_staff_01',
        name: 'James Rodriguez (Nurse / Staff)',
        email: 'staff@meditrack.com',
        role: ROLES.STAFF,
        roleId: 'role_staff',
        facilityId: 'fac_01',
        phone: '+1 (555) 010-0002'
      },
      {
        id: 'usr_approver_01',
        name: 'Elena Vance (Facility Director)',
        email: 'approver@meditrack.com',
        role: ROLES.APPROVER,
        roleId: 'role_approver',
        facilityId: 'fac_01',
        phone: '+1 (555) 010-0003'
      },
      {
        id: 'usr_contractor_01',
        name: 'Apex BioMed Solutions (Contractor)',
        email: 'contractor@meditrack.com',
        role: ROLES.CONTRACTOR,
        roleId: 'role_contractor',
        facilityId: null,
        phone: '+1 (555) 010-0004'
      },
      {
        id: 'usr_inspector_01',
        name: 'Marcus Chen (Safety Inspector)',
        email: 'inspector@meditrack.com',
        role: ROLES.INSPECTOR,
        roleId: 'role_inspector',
        facilityId: null,
        phone: '+1 (555) 010-0005'
      },
      {
        id: 'usr_auditor_01',
        name: 'Rachel Sterling (Lead Compliance Auditor)',
        email: 'auditor@meditrack.com',
        role: ROLES.AUDITOR,
        roleId: 'role_auditor',
        facilityId: null,
        phone: '+1 (555) 010-0006'
      }
    ];

    for (const u of demoUsers) {
      await db.query(
        `INSERT INTO users (id, name, email, password_hash, role, role_id, facility_id, phone, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
         ON CONFLICT (email) DO UPDATE SET 
            name = excluded.name, 
            password_hash = excluded.password_hash, 
            role = excluded.role,
            role_id = excluded.role_id,
            facility_id = excluded.facility_id,
            phone = excluded.phone`,
        [u.id, u.name, u.email, passwordHash, u.role, u.roleId, u.facilityId, u.phone]
      );
    }
    console.log('✅ Demo Users seeded.');

    // 6. Seed Demo Work Orders
    const sampleWorkOrders = [
      {
        id: 'wo_01',
        tracking_number: 'WO-2026-0001',
        title: 'MRI Scanner Cryocooler Pressure Drop Warning',
        description: 'Primary MRI unit #2 in Diagnostic Wing showing intermittent pressure fluctuations in the liquid helium cooling compressor.',
        facility_id: 'fac_04',
        location_details: 'Diagnostic Center, MRI Suite 2, Ground Floor',
        category: 'Biomedical Equipment',
        priority: 'critical',
        status: WORK_ORDER_STATUS.REPORTED,
        reported_by: 'usr_staff_01',
        estimated_cost: 4500,
        due_date: '2026-10-02'
      },
      {
        id: 'wo_02',
        tracking_number: 'WO-2026-0002',
        title: 'Operating Room 3 HEPA Laminar Air Flow Sensor Alert',
        description: 'Air change cycles in OR-3 dropped below 20 ACH. Filter differential pressure sensor flagged for maintenance.',
        facility_id: 'fac_01',
        location_details: 'Metro General, Surgical Block C, OR 3',
        category: 'HVAC',
        priority: 'high',
        status: WORK_ORDER_STATUS.REPORTED,
        reported_by: 'usr_staff_01',
        estimated_cost: 1850,
        due_date: '2026-09-30'
      },
      {
        id: 'wo_03',
        tracking_number: 'WO-2026-0003',
        title: 'Emergency Generator 2 Automatic Transfer Switch Service',
        description: 'Quarterly compliance testing revealed a 1.2s delay on ATS switchgear for emergency life support circuits.',
        facility_id: 'fac_02',
        location_details: 'St. Jude Basement Power Substation B',
        category: 'Electrical',
        priority: 'high',
        status: WORK_ORDER_STATUS.REPORTED,
        reported_by: 'usr_staff_01',
        estimated_cost: 2200,
        due_date: '2026-10-05'
      },
      {
        id: 'wo_04',
        tracking_number: 'WO-2026-0004',
        title: 'Pediatric ICU Dialysis Water Filtration Membrane Check',
        description: 'Routine maintenance check for reverse osmosis water purifiers in the dialysis ward.',
        facility_id: 'fac_03',
        location_details: 'Children’s Hospital, 4th Floor PICU',
        category: 'Plumbing',
        priority: 'medium',
        status: WORK_ORDER_STATUS.REPORTED,
        reported_by: 'usr_staff_01',
        estimated_cost: 950,
        due_date: '2026-10-10'
      }
    ];

    for (const wo of sampleWorkOrders) {
      await db.query(
        `INSERT INTO work_orders (id, tracking_number, title, description, facility_id, location_details, category, priority, status, reported_by, estimated_cost, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
            title = excluded.title,
            description = excluded.description,
            facility_id = excluded.facility_id,
            location_details = excluded.location_details,
            category = excluded.category,
            priority = excluded.priority,
            status = excluded.status,
            estimated_cost = excluded.estimated_cost,
            due_date = excluded.due_date`,
        [wo.id, wo.tracking_number, wo.title, wo.description, wo.facility_id, wo.location_details, wo.category, wo.priority, wo.status, wo.reported_by, wo.estimated_cost, wo.due_date]
      );

      // Seed Genesis Hash Event for each initial work order if not present
      const eventTime = '2026-09-25T06:00:00.000Z';
      const genesisHash = computeEventHash({
        previousHash: GENESIS_HASH,
        status: WORK_ORDER_STATUS.REPORTED,
        actorId: wo.reported_by,
        timestamp: eventTime
      });

      await db.query(
        `INSERT INTO status_events (id, work_order_id, status, actor_id, previous_hash, current_hash, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING`,
        [`evt_gen_${wo.id}`, wo.id, WORK_ORDER_STATUS.REPORTED, wo.reported_by, GENESIS_HASH, genesisHash, 'Initial work order creation genesis event', eventTime]
      );
    }
    console.log('✅ Demo Work Orders & Genesis Audit Hash Events seeded.');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();
