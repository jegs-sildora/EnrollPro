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
  console.log('--- SECTION TRANSFER TEST START ---');

  try {
    // Get active School Year
    const syRes = await client.get('/school-years');
    const activeSy = syRes.data.years.find((sy: any) => sy.status === 'ACTIVE');
    if (!activeSy) throw new Error('No active school year found');

    // 1. Find a learner who is enrolled
    const studentsRes = await client.get('/students', { params: { schoolYearId: activeSy.id } });
    const student = studentsRes.data.students.find((s: any) => s.status === 'ENROLLED');
    if (!student) throw new Error('No enrolled student found for transfer test');

    const applicationId = student.id;
    const currentSectionId = student.enrollment?.sectionId;
    const gradeLevelId = student.gradeLevelId;

    console.log(`Testing transfer for student: ${student.fullName} (App ID: ${applicationId})`);
    console.log(`Current Section ID: ${currentSectionId}`);

    // 2. Find a target section (different from current)
    const sectionsRes = await client.get('/sections', { params: { gradeLevelId } });
    const targetSection = sectionsRes.data.sections.find((s: any) => s.id !== currentSectionId && s.programType === 'REGULAR');
    if (!targetSection) throw new Error('No target regular section found for transfer');

    console.log(`Target Section: ${targetSection.name} (ID: ${targetSection.id})`);

    // 3. EXECUTE TRANSFER
    console.log('Executing Transfer...');
    await client.post('/sections/transfer-learner', {
        enrollmentApplicationId: applicationId,
        targetSectionId: targetSection.id,
        reason: 'Requested by parent'
    });
    console.log('✅ Transfer Request Success.');

    // 4. VERIFY
    const verifyRes = await client.get(`/students/${applicationId}`);
    if (verifyRes.data.student.enrollment?.sectionId !== targetSection.id) {
        throw new Error('Transfer failed: sectionId not updated');
    }
    console.log(`✅ Transfer Verified. New Section: ${verifyRes.data.student.enrollment.section}`);

    console.log('--- SECTION TRANSFER TEST ALL PASSED ---');
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
