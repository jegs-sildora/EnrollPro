import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
  try {
    console.log("Testing prisma query...");
    const count = await prisma.applicant.count();
    console.log("Total applicants:", count);

    const apps = await prisma.applicant.findMany({
      take: 5,
      include: {
        gradeLevel: true,
        strand: true,
      },
    });
    console.log("First 5 apps:", JSON.stringify(apps, null, 2));

    console.log("Testing with status filter...");
    const submitted = await prisma.applicant.findMany({
      where: { status: "SUBMITTED_BEEF" },
    });
    console.log("Submitted BEEF count:", submitted.length);

    try {
      console.log(
        'Testing with status="ALL" (expect failure if not handled in code)...',
      );
      const allFilter = await prisma.applicant.findMany({
        where: { status: "ALL" as any },
      });
      console.log("ALL filter count:", allFilter.length);
    } catch (e: any) {
      console.log('Expected Prisma failure for status="ALL":', e.message);
    }
  } catch (error) {
    console.error("Prisma test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
