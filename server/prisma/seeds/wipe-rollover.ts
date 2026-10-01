import "dotenv/config";
import { PrismaClient, Prisma } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export const wipeRollover = async () => {
  console.log("🧹 Reversing School Year Rollover...");

  try {
    const activeSetting = await prisma.schoolSetting.findFirst({
      include: { activeSchoolYear: true },
    });

    if (!activeSetting || !activeSetting.activeSchoolYearId) {
      console.error("❌ No active school year setting found.");
      return;
    }

    const targetYearId = activeSetting.activeSchoolYearId;
    const targetYear = await prisma.schoolYear.findUnique({
      where: { id: targetYearId },
    });

    if (!targetYear || !targetYear.clonedFromId) {
      console.error(
        "❌ Active school year is not a rolled-over year (missing clonedFromId). Cannot reverse."
      );
      return;
    }

    const sourceYearId = targetYear.clonedFromId;
    const sourceYear = await prisma.schoolYear.findUnique({
      where: { id: sourceYearId },
    });

    if (!sourceYear) {
      console.error("❌ Source school year not found. Cannot reverse.");
      return;
    }

    console.log(`Reverting from ${targetYear.yearLabel} back to ${sourceYear.yearLabel}...`);

    await prisma.$transaction(
      async (tx) => {
        // 1. Delete target year records
        console.log("Deleting records from the target year...");
        await tx.enrollmentRecord.deleteMany({ where: { schoolYearId: targetYearId } });
        await tx.enrollmentHistory.deleteMany({ where: { schoolYearId: targetYearId } });
        await tx.enrollmentApplication.deleteMany({ where: { schoolYearId: targetYearId } });
        await tx.sectionAdviser.deleteMany({ where: { section: { schoolYearId: targetYearId } } });
        await tx.schoolFormArtifact.deleteMany({ where: { schoolYearId: targetYearId } });
        await tx.healthRecord.deleteMany({ where: { schoolYearId: targetYearId } });
        await tx.section.deleteMany({ where: { schoolYearId: targetYearId } });

        // Delete the target year itself
        await tx.schoolYear.delete({ where: { id: targetYearId } });

        // Delete rollover audit logs
        await tx.auditLog.deleteMany({
          where: { actionType: "SY_ROLLOVER_COMPLETED", recordId: targetYearId },
        });

        // 2. Revert SchoolSetting
        console.log("Reverting SchoolSetting...");
        await tx.schoolSetting.update({
          where: { id: activeSetting.id },
          data: {
            activeSchoolYearId: sourceYearId,
            systemPhase: "EOSY_CLOSING",
          },
        });

        // 3. Revert SchoolYear status
        console.log("Restoring source SchoolYear...");
        await tx.schoolYear.update({
          where: { id: sourceYearId },
          data: {
            status: "ACTIVE",
            isEosyFinalized: false,
          },
        });

        // 4. Re-activate SectionAdvisers
        console.log("Restoring SectionAdviser assignments...");
        await tx.sectionAdviser.updateMany({
          where: {
            schoolYearId: sourceYearId,
            status: "REVOKED",
          },
          data: {
            status: "ACTIVE",
            effectiveTo: null,
          },
        });

        // 5. Recreate EnrollmentApplication and EnrollmentRecord from EnrollmentHistory
        console.log("Restoring source year Enrollment Records from History...");
        const histories = await tx.enrollmentHistory.findMany({
          where: { schoolYearId: sourceYearId },
          include: { section: true },
        });

        for (const h of histories) {
          const programType = h.section?.programType || "REGULAR";

          // Recreate Application
          const app = await tx.enrollmentApplication.create({
            data: {
              learnerId: h.learnerId,
              schoolYearId: h.schoolYearId,
              gradeLevelId: h.gradeLevelId,
              status: "OFFICIALLY_ENROLLED",
              admissionChannel: "F2F",
              trackingNumber: `RESTORED-${sourceYearId}-${h.learnerId}`,
              encodedById: 1, // Assume systemic admin ID
              applicantType: programType,
              assignedProgram: programType,
            },
          });

          // Recreate Record if section was assigned
          if (h.sectionId) {
            await tx.enrollmentRecord.create({
              data: {
                enrollmentApplicationId: app.id,
                learnerId: h.learnerId,
                schoolYearId: h.schoolYearId,
                sectionId: h.sectionId,
                enrolledById: 1, // Assume systemic admin ID
                dateSectioned: new Date(),
                enrolledAt: new Date(),
                isLateEnrollee: false,
                sectioningMethod: "BATCH_ALGORITHM",
                finalAverage: h.genAve,
                eosyStatus: h.eosyStatus,
                academicDeficiencyNote: h.academicDeficiencyNote,
              },
            });
          }
        }

        // 6. Delete the EnrollmentHistory for the source year since they are now restored
        await tx.enrollmentHistory.deleteMany({
          where: { schoolYearId: sourceYearId },
        });

        console.log(`✅ Restored ${histories.length} records successfully.`);
      },
      {
        timeout: 120_000, // 2 mins for large restoration
        maxWait: 5_000,
      }
    );

    console.log(`✅ Rollover reversed successfully! System is back in SY ${sourceYear.yearLabel} (EOSY_CLOSING).`);
  } catch (err) {
    console.error("❌ Error reversing rollover:", err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
};

wipeRollover().then(() => process.exit(0)).catch(() => process.exit(1));
