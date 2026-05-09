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
  console.log('--- LEARNER DIRECTORY CRUD TEST START ---');
  let studentId: number;
  let applicationId: number;

  try {
    // 1. CREATE (Special Enrollment - Late Enrollee)
    console.log('Testing Special Enrollment (Create)...');
    const randomLrn = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    const email = `late.enrollee.${randomLrn}@example.com`;

    // Need a Grade Level ID
    const glRes = await client.get('/school-years/grade-levels');
    const grade7 = glRes.data.gradeLevels.find((gl: any) => gl.name.includes('7'));
    if (!grade7) throw new Error('Grade 7 not found');
    
    const payload = {
      lrn: randomLrn,
      firstName: 'LATE',
      lastName: 'ENROLLEE',
      birthdate: '2013-05-15',
      sex: 'MALE',
      learnerType: 'NEW_ENROLLEE',
      gradeLevelId: grade7.id,
      email: email,
      contactNumber: '0917-000-0000',
      processOutcome: 'ENCODE_AND_VERIFY',
      generalAverage: 88.5,
      lastSchoolName: 'ELEMENTARY SCHOOL A',
      originatingSchoolName: 'ELEMENTARY SCHOOL A',
      checklist: {
          finalGeneralAverage: 88.5,
          isSf9Submitted: true,
          isPsaBirthCertPresented: true
      },
      guardian: {
        firstName: 'JAMES',
        lastName: 'DOE',
        relationship: 'FATHER',
        contactNumber: '0917-888-8888'
      }
    };

    const createRes = await client.post('/applications/special-enrollment', payload);
    applicationId = createRes.data.id;
    studentId = createRes.data.learnerId;
    console.log(`✅ Special Enrollment Success. App ID: ${applicationId}, Student ID: ${studentId}`);

    // ENCODE READING PROFILE
    console.log('Testing Encode Reading Profile...');
    await client.patch(`/applications/${applicationId}/reading-profile`, {
        readingProfileLevel: 'INDEPENDENT',
        readingProfileNotes: 'Testing'
    });
    console.log('✅ Reading Profile Success.');

    // APPROVE (Assign Section)
    console.log('Testing Approve (Assign Section)...');
    // Need a Section ID
    const sectionRes = await client.get('/sections', { params: { gradeLevelId: grade7.id } });
    const section = sectionRes.data.sections.find((s: any) => s.programType === 'REGULAR');
    if (!section) throw new Error('No regular section found for Grade 7');

    await client.patch(`/applications/${applicationId}/approve`, {
        sectionId: section.id,
        enrollmentDate: new Date().toISOString().split('T')[0]
    });
    console.log(`✅ Approve Success. Section: ${section.name}`);

    // ENROLL (Finalize)
    console.log('Testing Enroll (Finalize)...');
    await client.patch(`/applications/${applicationId}/enroll`);
    console.log('✅ Enroll Success.');

    // 2. READ (Student Details)
    console.log('Testing Read Student (Details)...');
    // The students API uses EnrollmentApplication ID as the primary key for "students"
    const studentRes = await client.get(`/students/${applicationId}`);
    if (studentRes.data.student.lastName !== 'ENROLLEE') throw new Error('Student data mismatch');
    console.log('✅ Read Student Success.');

    // 3. UPDATE (Phase 2 Data)
    console.log('Testing Update Student (Phase 2)...');
    await client.put(`/students/${applicationId}`, {
      firstName: 'LATE',
      lastName: 'ENROLLEE',
      middleName: 'UPDATED',
      sex: 'MALE',
      birthDate: '2013-05-15',
      religion: 'ROMAN CATHOLIC',
      contactNumber: '0917-999-9999', // Phase 2 data
      guardianInfo: {
        firstName: 'JAMES',
        lastName: 'DOE',
        relationship: 'FATHER',
        contactNumber: '0917-888-8888'
      }
    });
    const updatedRes = await client.get(`/students/${applicationId}`);
    if (updatedRes.data.student.contactNumber !== '0917-999-9999') throw new Error('Update failed: contactNumber mismatch');
    console.log('✅ Update Student Success.');

    // 4. DEACTIVATE (Profile Lock)
    console.log('Testing Profile Lock (Deactivate)...');
    const checkStatusRes = await client.get(`/applications/${applicationId}`);
    console.log('Current Status:', checkStatusRes.data.status);
    
    // Lock profile (System Module requirement - Archive/Deactivate substitute)
    await client.patch(`/applications/${applicationId}/profile-lock`, { lock: true, reason: 'Testing' });
    const lockedRes = await client.get(`/applications/${applicationId}`);
    // The response for /applications/:id depends on findDetailed
    if (!lockedRes.data.isProfileLocked && !lockedRes.data.application?.isProfileLocked) {
        // Log the response to see where isProfileLocked is
        console.log('Locked Response Data:', JSON.stringify(lockedRes.data));
        throw new Error('Profile lock failed to reflect in status');
    }
    console.log('✅ Profile Lock Success.');

    console.log('--- LEARNER DIRECTORY CRUD TEST ALL PASSED ---');
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
