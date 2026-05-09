import axios from 'axios';

const API_URL = 'http://localhost:5000/api';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJTWVNURU1fQURNSU4iLCJtdXN0Q2hhbmdlUGFzc3dvcmQiOnRydWUsImlhdCI6MTc3ODMxMjcyMiwiZXhwIjoxNzc4Mzk5MTIyfQ.KSLOsirDjih6N5eaOp6PUQMgL1CAH6-FOUON90pcplQ';

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function runTests() {
  console.log('--- USER MANAGEMENT CRUD TEST START ---');
  let userId: number;

  try {
    // 1. CREATE
    console.log('Testing Create User...');
    const randomId = Math.floor(Math.random() * 10000);
    const email = `registrar.assistant.${randomId}@deped.edu.ph`;
    const employeeId = `RA-EMP-${randomId}`;

    const createRes = await client.post('/admin/users', {
      firstName: 'REGISTRAR',
      lastName: 'ASSISTANT',
      email: email,
      employeeId: employeeId,
      password: 'TemporaryPass123!',
      role: 'HEAD_REGISTRAR',
      sex: 'FEMALE',
      designation: 'REGISTRAR ASSISTANT'
    });
    userId = createRes.data.id;
    console.log(`✅ Create Success. ID: ${userId}, Email: ${email}`);

    // 2. READ (List)
    console.log('Testing Read Users (List)...');
    const listRes = await client.get('/admin/users');
    const users = listRes.data.users;
    const found = users.find((u: any) => u.id === userId);
    if (!found) throw new Error('Created user not found in list');
    if (found.email !== email) throw new Error('User email mismatch');
    console.log('✅ Read (List) Success.');

    // 3. UPDATE (Escalate Role)
    console.log('Testing Update (Role Escalation)...');
    await client.put(`/admin/users/${userId}`, {
      firstName: 'REGISTRAR',
      lastName: 'ASSISTANT',
      email: email,
      employeeId: employeeId,
      role: 'SYSTEM_ADMIN',
      sex: 'FEMALE',
      designation: 'SYSTEM ADMINISTRATOR (PROMOTED)'
    });
    const updatedRes = await client.get('/admin/users');
    const updatedUser = updatedRes.data.users.find((u: any) => u.id === userId);
    if (updatedUser.role !== 'SYSTEM_ADMIN') throw new Error('Role update failed');
    console.log('✅ Update (Role) Success.');

    // 4. PASSWORD RESET
    console.log('Testing Password Reset...');
    await client.patch(`/admin/users/${userId}/reset-password`, {
      newPassword: 'NewSecurePassword2026!',
      mustChangePassword: false
    });
    console.log('✅ Password Reset Success.');

    // 5. DEACTIVATE (Revoke Access)
    console.log('Testing Deactivate (Revoke)...');
    // Note: We just promoted them to SYSTEM_ADMIN, and the controller blocks deactivating SYSTEM_ADMIN.
    // So let's demote them back to HEAD_REGISTRAR first to test deactivation.
    await client.put(`/admin/users/${userId}`, {
      firstName: 'REGISTRAR',
      lastName: 'ASSISTANT',
      email: email,
      employeeId: employeeId,
      role: 'HEAD_REGISTRAR',
      sex: 'FEMALE',
      designation: 'REGISTRAR ASSISTANT'
    });

    await client.patch(`/admin/users/${userId}/deactivate`);
    const deactivatedRes = await client.get('/admin/users', { params: { isActive: false } });
    const deactivatedUser = deactivatedRes.data.users.find((u: any) => u.id === userId);
    if (!deactivatedUser || deactivatedUser.isActive !== false) throw new Error('Deactivation failed');
    console.log('✅ Deactivate (Revoke) Success.');

    console.log('--- USER MANAGEMENT CRUD TEST ALL PASSED ---');
  } catch (error: any) {
    console.error('❌ TEST FAILED');
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data));
    } else {
      console.error('Error Message:', error.message);
    }
    process.exit(1);
  }
}

runTests();
