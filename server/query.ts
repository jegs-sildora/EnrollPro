import { prisma } from './src/lib/prisma.js'; async function main() { const addr = await prisma.address.findFirst(); console.log(addr); } main().finally(() => process.exit(0));
