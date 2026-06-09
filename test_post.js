import http from "http";

const payload = {
  schoolYear: "2026-2027",
  isPrivacyConsentGiven: true,
  gradeLevel: "7",
  hasNoLrn: false,
  lrn: "999999999999",
  isIpCommunity: false,
  is4PsBeneficiary: false,
  isBalikAral: false,
  isLearnerWithDisability: false,
  isPermanentSameAsCurrent: true,
  isScpApplication: false,
  learnerType: "NEW_ENROLLEE",
  hasNoMother: false,
  hasNoFather: false,
  isCertifiedTrue: true,
  hasScpFallbackConsent: false,
  hasSf9Deficiency: false,
  firstName: "Jane",
  lastName: "Doe",
  birthdate: "2010-01-01",
  sex: "FEMALE",
  placeOfBirth: "Manila",
  currentAddress: {
    houseNo: "123",
    street: "Main St",
    barangay: "Brgy",
    cityMunicipality: "City",
    province: "Prov",
    region: "Reg",
    country: "Philippines",
  },
  mother: { firstName: "Jane", lastName: "Doe", contactNumber: "0912-345-6789" },
  father: { firstName: "John", lastName: "Doe", contactNumber: "0912-345-6789" },
  email: "jane@example.com",
  lastSchoolName: "School",
  lastGradeCompleted: "6",
  schoolYearLastAttended: "2025-2026",
  lastSchoolType: "PUBLIC",
};

const req = http.request(
  "http://localhost:5173/api/applications",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  },
  (res) => {
    let data = "";
    res.on("data", (chunk) => {
      data += chunk;
    });
    res.on("end", () => {
      console.log("Status:", res.statusCode);
      console.log("Response:", data);
    });
  }
);

req.on("error", (err) => {
  console.error("Error:", err.message);
});

req.write(JSON.stringify(payload));
req.end();
