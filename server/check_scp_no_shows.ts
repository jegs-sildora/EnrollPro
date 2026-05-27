import { prisma } from "./src/lib/prisma.js";

async function main() {
  const schoolYearId = 52;

  const [scpCount, pendingCount] = await Promise.all([
    prisma.enrollmentApplication.count({
      where: { schoolYearId, status: "READY_FOR_ENROLLMENT" },
    }),
    prisma.enrollmentApplication.count({
      where: { schoolYearId, status: "PENDING_BEEF" },
    }),
  ]);

  console.log("SCP Priority (READY_FOR_ENROLLMENT) count:", scpCount);
  console.log("Pending BEEF count:", pendingCount);
  console.log("Total No-Shows count:", scpCount + pendingCount);

  // Get the actual applications
  const scpApps = await prisma.enrollmentApplication.findMany({
    where: { schoolYearId, status: "READY_FOR_ENROLLMENT" },
    select: {
      id: true,
      trackingNumber: true,
      applicantType: true,
      learnerType: true,
      learner: { select: { lrn: true, firstName: true, lastName: true } },
    },
  });

  const pendingApps = await prisma.enrollmentApplication.findMany({
    where: { schoolYearId, status: "PENDING_BEEF" },
    select: {
      id: true,
      trackingNumber: true,
      applicantType: true,
      learnerType: true,
      learner: { select: { lrn: true, firstName: true, lastName: true } },
    },
  });

  if (scpApps.length > 0) {
    console.log("\n=== READY_FOR_ENROLLMENT Applications ===");
    scpApps.forEach((a) => {
      console.log(
        `ID: ${a.id} | LRN: ${a.learner.lrn || "NO-LRN"} | Name: ${a.learner.lastName}, ${a.learner.firstName} | Type: ${a.applicantType}`
      );
    });
  }

  if (pendingApps.length > 0) {
    console.log("\n=== PENDING_BEEF Applications ===");
    pendingApps.forEach((a) => {
      console.log(
        `ID: ${a.id} | LRN: ${a.learner.lrn || "NO-LRN"} | Name: ${a.learner.lastName}, ${a.learner.firstName} | Type: ${a.applicantType}`
      );
    });
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
