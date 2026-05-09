import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();
async function run() {
  const users = await prisma.user.findMany({ select: { email: true, role: true } });
  console.log(JSON.stringify(users));
}
run();
