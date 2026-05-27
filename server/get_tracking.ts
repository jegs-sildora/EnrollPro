import { PrismaClient } from "./src/generated/prisma/index.js";
const p = new PrismaClient();
const r = await p.application.findFirst({ select: { trackingNumber: true } });
console.log(r?.trackingNumber);
await p.$disconnect();
