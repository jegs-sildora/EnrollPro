import { prisma } from "../lib/prisma.js";
import {
  generatePortalPin,
  verifyPin,
} from "../features/learner/portal-pin.service.js";

async function runTests() {
  console.log("Starting SIMS Tests...");

  try {
    // 1. Check if portalPinService generatePortalPin works correctly
    const { raw, hash } = generatePortalPin();
    console.log(`Generated PIN: ${raw}`);
    const isValid = await verifyPin(raw, hash);
    if (!isValid) throw new Error("PIN Verification Failed!");
    console.log("PIN Verification Passed.");

    // 2. We can't easily test full controllers without express, but we can test the service functions.
    // Ensure we can create a test applicant and test the schema.
    const activeYear =
      (await prisma.schoolYear.findFirst({
        where: { status: "ACTIVE" },
      })) ||
      (await prisma.schoolYear.create({
        data: { yearLabel: "TEST-2026", status: "ACTIVE" },
      }));

    const gradeLevel =
      (await prisma.gradeLevel.findFirst()) ||
      (await prisma.gradeLevel.create({
        data: { name: "Grade 7", displayOrder: 7, schoolYearId: activeYear.id },
      }));

    // Create a user for recording
    const user =
      (await prisma.user.findFirst()) ||
      (await prisma.user.create({
        data: {
          firstName: "Test",
          lastName: "User",
          email: "test@test.com",
          password: "pwd",
          role: "HEAD_REGISTRAR",
          sex: "MALE",
        },
      }));

    const testLearner = await prisma.learner.create({
      data: {
        lrn: "111122223333",
        firstName: "Test",
        lastName: "Learner",
        sex: "MALE",
        birthdate: new Date("2010-01-01"),
      },
    });

    const testApplicant = await prisma.enrollmentApplication.create({
      data: {
        learnerId: testLearner.id,
        trackingNumber: `TRK-${Date.now()}`,
        status: "ENROLLED",
        gradeLevelId: gradeLevel.id,
        schoolYearId: activeYear.id,
        portalPin: hash,
        portalPinChangedAt: new Date(),
      },
    });
    console.log(
      "Test Learner + EnrollmentApplication created with ENROLLED status and portal PIN.",
    );

    // Test health record creation
    const record = await prisma.healthRecord.create({
      data: {
        learnerId: testLearner.id,
        schoolYearId: activeYear.id,
        assessmentPeriod: "BOSY",
        assessmentDate: new Date(),
        weightKg: 50.5,
        heightCm: 150.0,
        recordedById: user.id,
      },
    });
    console.log("Health Record created successfully.");

    // Test unique constraint (duplicate BOSY)
    try {
      await prisma.healthRecord.create({
        data: {
          learnerId: testLearner.id,
          schoolYearId: activeYear.id,
          assessmentPeriod: "BOSY",
          assessmentDate: new Date(),
          weightKg: 51.5,
          heightCm: 151.0,
          recordedById: user.id,
        },
      });
      throw new Error("Duplicate BoSY record should have failed!");
    } catch (err: any) {
      if (err.code === "P2002") {
        console.log("Duplicate BoSY check passed (P2002 thrown).");
      } else {
        throw err;
      }
    }

    // Clean up
    await prisma.healthRecord.deleteMany({
      where: { learnerId: testLearner.id },
    });
    await prisma.enrollmentApplication.delete({
      where: { id: testApplicant.id },
    });
    await prisma.learner.delete({ where: { id: testLearner.id } });
    console.log("Cleaned up test data.");

    console.log("All SIMS backend logic tests passed.");
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
