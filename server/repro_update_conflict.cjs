const { PrismaClient, SectionAdviserStatus } = require("./src/generated/prisma/index.js");
const prisma = new PrismaClient();

async function main() {
  const id = 134;
  const name = "STE 7-SIRIUS";
  const maxCapacity = 35;
  const advisingTeacherId = 147;
  const programType = "SCIENCE_TECHNOLOGY_AND_ENGINEERING";

  console.log(`Attempting to update section ${id} to name "${name}"...`);

  try {
    const existing = await prisma.section.findUnique({
      where: { id },
      include: {
        advisers: {
          where: { status: SectionAdviserStatus.ACTIVE },
        },
      },
    });

    if (!existing) {
      console.log("Section not found");
      return;
    }

    const section = await prisma.$transaction(async (tx) => {
      const s = await tx.section.update({
        where: { id },
        data: {
          name: name.trim(),
          maxCapacity: Number(maxCapacity),
          programType: programType,
        },
      });

      if (advisingTeacherId !== undefined) {
        const currentActive = existing.advisers[0];

        if (!currentActive || currentActive.teacherId !== advisingTeacherId) {
           console.log("Changing teacher...");
          // (Simplified logic for debug)
          if (currentActive) {
            await tx.sectionAdviser.update({
              where: { id: currentActive.id },
              data: { status: SectionAdviserStatus.HANDED_OVER },
            });
          }

          if (advisingTeacherId) {
            await tx.sectionAdviser.create({
              data: {
                sectionId: s.id,
                teacherId: advisingTeacherId,
                schoolYearId: s.schoolYearId,
                status: SectionAdviserStatus.ACTIVE,
                effectiveFrom: new Date(),
              },
            });
          }
        } else {
            console.log("Teacher unchanged");
        }
      }
      return s;
    });

    console.log("Update successful!", JSON.stringify(section, null, 2));
  } catch (error) {
    console.error("Update failed!");
    console.error("Code:", error.code);
    console.error("Meta:", JSON.stringify(error.meta, null, 2));
    console.error("Message:", error.message);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
