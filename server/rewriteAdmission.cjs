const fs = require('fs');
let code = fs.readFileSync('src/features/admission/admission.controller.ts', 'utf8');

const newCode = `
export async function submitAdmission(req: Request, res: Response) {
  try {
    const parsed = scpAdmissionSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Validation failed", errors: parsed.error.format() });
      return;
    }
    const data = parsed.data as ScpAdmissionSubmit;

    const schoolSetting = await getOpenPublicEnrollmentSetting(res, true);
    if (!schoolSetting) return;
    const activeSchoolYearId = schoolSetting.activeSchoolYearId;

    let learner;
    const lrn = data.hasNoLrn ? null : data.lrn;
    if (lrn) {
      learner = await prisma.learner.findUnique({ where: { lrn } });
    }

    const birthdateDate = normalizeDateToUtcNoon(data.birthdate instanceof Date ? data.birthdate : new Date(data.birthdate));

    const learnerData = {
      firstName: data.firstName,
      lastName: data.lastName,
      middleName: data.middleName || null,
      extensionName: data.extensionName || null,
      birthdate: birthdateDate,
      sex: data.sex,
      placeOfBirth: data.placeOfBirth,
      motherTongue: data.motherTongue,
      religion: data.religion || null,
      isIpCommunity: data.isIpCommunity,
      ipGroupName: data.ipGroupName || null,
      is4PsBeneficiary: data.is4PsBeneficiary,
      householdId4Ps: data.householdId4Ps || null,
      isBalikAral: data.isBalikAral,
      lastYearEnrolled: data.lastYearEnrolled || null,
      isLearnerWithDisability: data.isLearnerWithDisability,
      specialNeedsCategory: data.specialNeedsCategory || null,
      hasPwdId: data.hasPwdId,
      disabilityTypes: data.disabilityTypes,
      lrn: lrn || null,
      studentPhoto: data.studentPhoto || null,
      psaBirthCertNumber: data.psaBirthCertNumber || null,
    };

    if (learner) {
      learner = await prisma.learner.update({ where: { id: learner.id }, data: learnerData });
    } else {
      learner = await prisma.learner.create({ data: learnerData });
    }

    const existingAdmission = await prisma.scpAdmission.findFirst({
      where: { learnerId: learner.id, schoolYearId: activeSchoolYearId }
    });

    if (existingAdmission) {
      res.status(409).json({ duplicate_detected: true, requires_auth: true, message: "Learner already has an admission record for this school year." });
      return;
    }

    const yearPrefix = schoolSetting.activeSchoolYear?.yearLabel?.split('-')[0] || new Date().getFullYear().toString();
    const programType = data.scpType || "REGULAR";
    const programAcronym = programType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" ? "STE" : 
                           programType === "SPECIAL_PROGRAM_IN_THE_ARTS" ? "SPA" : 
                           programType === "SPECIAL_PROGRAM_IN_SPORTS" ? "SPS" : "BEC";
    const paddedId = String(learner.id).padStart(7, '0');
    const trackingNumber = \`ADM-\${programAcronym}\${yearPrefix}\${paddedId}\`;

    const admission = await prisma.scpAdmission.create({
      data: {
        learnerId: learner.id,
        schoolYearId: activeSchoolYearId,
        program: data.scpType as ApplicantType,
        trackingNumber,
        grade5GeneralAverage: data.grade5GeneralAverage,
        underSpecialScienceCurriculum: data.underSpecialScienceCurriculum ?? false,
        artsSpecialization: data.artsSpecialization || null,
        chosenSport: data.chosenSport || null,
        
        addresses: {
          create: [
            {
              addressType: "CURRENT",
              houseNoStreet: data.currentAddress.houseNoStreet || null,
              sitio: data.currentAddress.sitio || null,
              barangay: data.currentAddress.barangay,
              cityMunicipality: data.currentAddress.cityMunicipality,
              province: data.currentAddress.cityMunicipality === "CITY OF BACOLOD" ? "CITY OF BACOLOD" : data.currentAddress.province,
              region: data.currentAddress.region,
            },
            ...(data.permanentAddress && data.permanentAddress.barangay
              ? [{
                  addressType: "PERMANENT" as const,
                  houseNoStreet: data.permanentAddress.houseNoStreet || null,
                  sitio: data.permanentAddress.sitio || null,
                  barangay: data.permanentAddress.barangay,
                  cityMunicipality: data.permanentAddress.cityMunicipality,
                  province: data.permanentAddress.cityMunicipality === "CITY OF BACOLOD" ? "CITY OF BACOLOD" : data.permanentAddress.province,
                  region: data.permanentAddress.region,
                }]
              : []),
          ],
        },
        familyMembers: {
          create: [
            ...(data.mother.firstName && data.mother.lastName
              ? [{
                  relationship: "MOTHER" as const,
                  firstName: data.mother.firstName,
                  lastName: data.mother.lastName,
                  middleName: data.mother.middleName || null,
                  contactNumber: data.mother.contactNumber || null,
                  email: data.mother.email || null,
                }]
              : []),
            ...(data.father.firstName && data.father.lastName
              ? [{
                  relationship: "FATHER" as const,
                  firstName: data.father.firstName,
                  lastName: data.father.lastName,
                  middleName: data.father.middleName || null,
                  contactNumber: data.father.contactNumber || null,
                  email: data.father.email || null,
                }]
              : []),
            ...(data.guardian?.firstName
              ? [{
                  relationship: "GUARDIAN" as const,
                  firstName: data.guardian.firstName,
                  lastName: data.guardian.lastName || "",
                  middleName: data.guardian.middleName || null,
                  contactNumber: data.guardian.contactNumber || null,
                  email: data.guardian.email || null,
                }]
              : []),
          ],
        },
        previousSchool: {
          create: {
            schoolName: data.lastSchoolName,
            schoolId: data.lastSchoolId || null,
            schoolAddress: data.lastSchoolAddress || null,
            schoolType: data.lastSchoolType,
            generalAverage: data.generalAverage || null,
            transferCertificateNo: data.transferCertificateNo || null,
          },
        }
      }
    });

    res.status(201).json({
      message: "Admission submitted successfully",
      trackingNumber: admission.trackingNumber,
      id: admission.id,
      ...buildTrackingState("PENDING_VERIFICATION", data.scpType as ApplicantType),
    });
  } catch (error) {
    console.error("Failed to submit admission:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
`;

const startIdx = code.indexOf('export async function submitAdmission');
const endIdx = code.indexOf('export async function submitEnrollment');
code = code.substring(0, startIdx) + newCode + '\n' + code.substring(endIdx);

fs.writeFileSync('src/features/admission/admission.controller.ts', code);
