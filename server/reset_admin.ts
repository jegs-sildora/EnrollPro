import { PrismaClient } from './src/generated/prisma/index.js';
import * as bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function run() {
  const hashedPassword = await bcrypt.hash('Admin2026!', 12);
  await prisma.user.update({
    where: { email: 'admin@deped.edu.ph' },
    data: { password: hashedPassword }
  });
  console.log('Admin password reset successful');
}
run();
