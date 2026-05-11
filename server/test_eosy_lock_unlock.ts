import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from server/.env
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const API_URL = 'http://localhost:5000/api';
// We need a valid token for SYSTEM_ADMIN
// This is a placeholder, in a real scenario we'd login or use a known test token
const TOKEN = process.env.TEST_ADMIN_TOKEN || ''; 

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function runTests() {
  console.log('--- EOSY LOCK/UNLOCK TEST START ---');

  try {
    // 1. Get active School Year
    const syRes = await client.get('/school-years');
    const activeSy = syRes.data.years.find((sy: any) => sy.status === 'ACTIVE' || sy.status === 'BOSY_LOCKED');
    if (!activeSy) throw new Error('No active/locked school year found');
    console.log(`Testing with S.Y. ${activeSy.yearLabel} (ID: ${activeSy.id}, Status: ${activeSy.status})`);

    // 2. Check current lock state
    console.log('Checking current lock state...');
    const lockStateRes = await client.get(`/eosy/school-year/${activeSy.id}/export-lock`);
    console.log('Current lock state:', JSON.stringify(lockStateRes.data));

    // 3. Try to finalize school year (might fail if not all sections are finalized)
    console.log('Attempting to finalize school year...');
    try {
        const finalizeRes = await client.post('/eosy/school-year/finalize', { schoolYearId: activeSy.id });
        console.log('✅ School Year Finalized Success:', finalizeRes.data.schoolYear.status);
    } catch (err: any) {
        console.log('Finalize school year failed (as expected if unfinalized sections exist):', err.response?.data?.message);
    }

    // 4. Test Emergency Unlock (if it was already finalized)
    if (lockStateRes.data.schoolYearFinalized) {
        console.log('Testing Emergency Unlock...');
        const pin = process.env.ADMIN_BOSY_LOCK_PIN || '123456';
        const unlockRes = await client.post('/eosy/school-year/unlock', {
            schoolYearId: activeSy.id,
            pin,
            justification: 'Emergency unlock for data correction as per DepEd request.'
        });
        console.log('✅ Emergency Unlock Success:', unlockRes.data.schoolYear.status);
        
        // Finalize it again to leave it in locked state if that's what we want to test
        // But for testing purposes, we just verified it works.
    }

    console.log('--- EOSY LOCK/UNLOCK TEST COMPLETE ---');
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
