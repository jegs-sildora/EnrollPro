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
  console.log('--- EARLY REGISTRATION CRUD TEST START ---');
  let applicationId: number;

  try {
    // Get active School Year
    const syRes = await client.get('/school-years');
    const activeSy = syRes.data.years.find((sy: any) => sy.status === 'ACTIVE');
    if (!activeSy) throw new Error('No active school year found');

    // 1. CREATE (Encode via F2F form)
    console.log('Testing Create Early Registration...');
    const randomLrn = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    
    const payload = {
      schoolYear: activeSy.yearLabel,
      gradeLevel: '7',
      hasNoLrn: false,
      lrn: randomLrn,
      learnerType: 'NEW_ENROLLEE',
      lastName: 'DOE',
      firstName: 'JOHN',
      middleName: 'QUINCY',
      birthdate: '2013-05-15',
      sex: 'MALE',
      placeOfBirth: 'MANILA',
      motherTongue: 'TAGALOG',
      barangay: 'BARANGAY 1',
      cityMunicipality: 'MANILA',
      province: 'METRO MANILA',
      isPrivacyConsentGiven: true,
      hasNoFather: false,
      father: {
        lastName: 'DOE',
        firstName: 'JAMES',
        contactNumber: '09170000001'
      },
      hasNoMother: false,
      mother: {
        maidenName: 'SMITH',
        firstName: 'JANE',
        contactNumber: '09170000002'
      },
      contactNumber: '0917-123-4567',
      primaryContact: 'FATHER'
    };

    const createRes = await client.post('/early-registrations/f2f', payload);
    applicationId = createRes.data.id;
    console.log(`✅ Create Success. ID: ${applicationId}, Tracking: ${createRes.data.trackingNumber}`);

    // 2. READ (Search/List)
    console.log('Testing Read Early Registration (List/Search)...');
    const listRes = await client.get('/early-registrations', { params: { search: 'DOE' } });
    const found = listRes.data.data.find((a: any) => a.id === applicationId);
    if (!found) throw new Error('Created application not found in list');
    console.log('✅ Read (List) Success.');

    // 3. UPDATE (Checklist/Requirements)
    console.log('Testing Update Checklist...');
    await client.patch(`/early-registrations/${applicationId}/checklist`, {
      isPsaBirthCertPresented: true,
      isSf9Submitted: true,
      academicStatus: 'PROMOTED'
    });
    const detailedRes = await client.get(`/early-registrations/${applicationId}/detailed`);
    // detailedRes.data is flattened
    if (!detailedRes.data.checklist?.isPsaBirthCertPresented) {
        throw new Error('Checklist update failed');
    }
    console.log('✅ Update Checklist Success.');

    // 4. DELETE (Withdraw/Cancel)
    console.log('Testing Withdraw (Archive)...');
    await client.patch(`/early-registrations/${applicationId}/withdraw`);
    const withdrawnRes = await client.get(`/early-registrations/${applicationId}`);
    // withdrawnRes.data is flattened
    if (withdrawnRes.data.status !== 'WITHDRAWN') {
        throw new Error('Withdrawal failed');
    }
    console.log('✅ Withdraw Success.');

    console.log('--- EARLY REGISTRATION CRUD TEST ALL PASSED ---');
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
