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
  console.log('--- TEACHER CRUD TEST START ---');
  let teacherId: number;

  try {
    // 1. CREATE
    console.log('Testing Create...');
    const randomId = Math.floor(Math.random() * 10000);
    const employeeId = `TEST-EMP-${randomId}`;
    const email = `juan.tester.${randomId}@deped.edu.ph`;

    const createRes = await client.post('/teachers', {
      firstName: 'JUAN',
      lastName: 'TESTER',
      middleName: 'CRUD',
      email: email,
      employeeId: employeeId,
      contactNumber: '09171234567',
      specialization: 'MAJOR IN MATHEMATICS',
      department: 'MATH',
      plantillaPosition: 'TEACHER I',
      subjects: ['MATHEMATICS']
    });
    teacherId = createRes.data.teacher.id;
    console.log(`✅ Create Success. ID: ${teacherId}, Employee ID: ${employeeId}`);

    // 2. READ (List)
    console.log('Testing Read (List)...');
    const listRes = await client.get('/teachers');
    const teachers = listRes.data.teachers;
    const found = teachers.find((t: any) => t.id === teacherId);
    if (!found) throw new Error('Created teacher not found in list');
    console.log('✅ Read (List) Success.');

    // 3. READ (Single)
    console.log('Testing Read (Single)...');
    const showRes = await client.get(`/teachers/${teacherId}`);
    if (showRes.data.teacher.lastName !== 'TESTER') throw new Error('Read mismatch');
    console.log('✅ Read (Single) Success.');

    // 4. UPDATE
    console.log('Testing Update...');
    await client.put(`/teachers/${teacherId}`, {
      firstName: 'JUAN',
      lastName: 'TESTER',
      middleName: 'CRUD',
      email: email,
      employeeId: employeeId,
      contactNumber: '09171234567',
      specialization: 'MAJOR IN MATHEMATICS',
      department: 'MATH',
      plantillaPosition: 'TEACHER II',
      subjects: ['MATHEMATICS']
    });
    const updatedRes = await client.get(`/teachers/${teacherId}`);
    if (updatedRes.data.teacher.plantillaPosition !== 'TEACHER II') {
        throw new Error('Update failed: Plantilla position mismatch');
    }
    console.log('✅ Update Success.');

    // 5. DEACTIVATE
    console.log('Testing Deactivate...');
    await client.patch(`/teachers/${teacherId}/deactivate`, { reason: 'Retirement' });
    const deactivatedRes = await client.get(`/teachers/${teacherId}`);
    if (deactivatedRes.data.teacher.isActive !== false) {
        throw new Error('Deactivate failed: Teacher still active');
    }
    console.log('✅ Deactivate Success.');

    // 6. REACTIVATE
    console.log('Testing Reactivate...');
    await client.patch(`/teachers/${teacherId}/reactivate`);
    const reactivatedRes = await client.get(`/teachers/${teacherId}`);
    if (reactivatedRes.data.teacher.isActive !== true) {
        throw new Error('Reactivate failed: Teacher still inactive');
    }
    console.log('✅ Reactivate Success.');

    // 7. DESIGNATION
    console.log('Testing Designation...');
    // Get School Year
    const syRes = await client.get('/school-years');
    const activeSy = syRes.data.years.find((sy: any) => sy.status === 'ACTIVE');
    if (!activeSy) throw new Error('No active school year found');

    // Get a Section
    const sectionRes = await client.get('/sections', { params: { schoolYearId: activeSy.id } });
    let section: any;
    if (sectionRes.data.sections) {
        section = sectionRes.data.sections[0];
    } else if (sectionRes.data.gradeLevels) {
        section = sectionRes.data.gradeLevels[0].sections[0];
    }
    
    if (!section) throw new Error('No section found');

    console.log(`Assigning teacher as adviser to: ${section.name}`);
    await client.put(`/teachers/${teacherId}/designation`, {
      schoolYearId: activeSy.id,
      isClassAdviser: true,
      advisorySectionId: section.id,
      ancillaryRoles: ['COORDINATOR'],
      designationNotes: 'Testing designation',
      effectiveFrom: '2026-06-01'
    });

    const designationRes = await client.get(`/teachers/${teacherId}/designation`, { params: { schoolYearId: activeSy.id } });
    if (!designationRes.data.designation?.isClassAdviser) throw new Error('Designation not saved correctly');
    if (designationRes.data.designation?.advisorySection?.id !== section.id) throw new Error('Advisory section mismatch');
    console.log('✅ Designation Success.');

    console.log('--- TEACHER CRUD TEST ALL PASSED ---');
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
