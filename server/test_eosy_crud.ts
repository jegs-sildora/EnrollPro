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
  console.log('--- EOSY CRUD TEST START ---');

  try {
    // Get active School Year
    const syRes = await client.get('/school-years');
    const activeSy = syRes.data.years.find((sy: any) => sy.status === 'ACTIVE');
    if (!activeSy) throw new Error('No active school year found');

    // 1. LIST SECTIONS (Read)
    console.log('Testing List EOSY Sections (Read)...');
    const sectionsRes = await client.get('/eosy/sections', { params: { schoolYearId: activeSy.id } });
    const section = sectionsRes.data.sections.find((s: any) => s._count.enrollmentRecords > 0);
    if (!section) throw new Error('No section with students found for EOSY testing');
    console.log(`✅ List Sections Success. Testing Section: ${section.name}`);

    // If section already finalized from previous run, reopen it
    if (section.isEosyFinalized) {
        console.log('Section already finalized, reopening for test...');
        await client.post(`/eosy/sections/${section.id}/reopen`);
    }

    // 2. GET SECTION RECORDS (Read)
    console.log(`Testing Get Records for Section: ${section.name} (Read)...`);
    const recordsRes = await client.get(`/eosy/sections/${section.id}/records`);
    const record = recordsRes.data.records[0];
    if (!record) throw new Error('No records found in section');
    const learner = record.enrollmentApplication.learner;
    console.log(`✅ Get Records Success. Student: ${learner.lastName}, ${learner.firstName}`);

    // 3. UPDATE RECORD (Promote)
    console.log('Testing Update EOSY Record (Promoted)...');
    await client.patch(`/eosy/records/${record.id}`, {
        eosyStatus: 'PROMOTED',
        finalAverage: 89.5,
        sf1Remarks: 'Excellence'
    });
    const updatedRes = await client.get(`/eosy/sections/${section.id}/records`);
    const updatedRecord = updatedRes.data.records.find((r: any) => r.id === record.id);
    if (updatedRecord.eosyStatus !== 'PROMOTED') throw new Error('EOSY update failed');
    console.log('✅ Update Record Success.');

    // 4. FINALIZE SECTION (Create/Finalize)
    console.log('Testing Finalize Section (Update State)...');
    await client.post(`/eosy/sections/${section.id}/finalize`);
    const finalizedRes = await client.get('/eosy/sections', { params: { schoolYearId: activeSy.id } });
    const finalizedSection = finalizedRes.data.sections.find((s: any) => s.id === section.id);
    if (!finalizedSection.isEosyFinalized) throw new Error('Section finalization failed');
    console.log('✅ Finalize Section Success.');

    // 5. REOPEN SECTION (Delete/Revert)
    console.log('Testing Reopen Section (Admin Override)...');
    await client.post(`/eosy/sections/${section.id}/reopen`);
    const reopenedRes = await client.get('/eosy/sections', { params: { schoolYearId: activeSy.id } });
    const reopenedSection = reopenedRes.data.sections.find((s: any) => s.id === section.id);
    if (reopenedSection.isEosyFinalized) throw new Error('Section reopening failed');
    console.log('✅ Reopen Section Success.');

    console.log('--- EOSY CRUD TEST ALL PASSED ---');
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
