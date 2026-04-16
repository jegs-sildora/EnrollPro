import { PrismaClient } from "./server/src/generated/prisma/index.js";

const prisma = new PrismaClient();

async function check() {
  try {
    const docs = await prisma.applicationDocument.findMany({
      take: 10,
      orderBy: { uploadedAt: 'desc' }
    });
    console.log("Recent Application Documents:", JSON.stringify(docs, null, 2));

    const checklists = await prisma.applicationChecklist.findMany({
      take: 10,
      orderBy: { updatedAt: 'desc' }
    });
    console.log("Recent Application Checklists:", JSON.stringify(checklists, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
