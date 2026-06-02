import { PrismaClient } from "../../../src/generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting SCP configurations wipe...");

  // Wiping ScpProgramConfig will trigger cascade deletion for:
  // - ScpProgramStep
  // - ScpProgramOption
  // - ScpInterviewRubricCategory (via Step)
  // - ScpInterviewRubricCriterion (via Category)
  
  const result = await prisma.scpProgramConfig.deleteMany();
  console.log(`Γ£à Wiped ${result.count} SCP program configurations and all associated steps/rubrics.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
