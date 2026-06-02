import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🚀 Seeding Admin User...');
  
  const employeeId = '1000001';
  const password = 'DepEd2026!';
  const hashedPassword = await bcrypt.hash(password, 12);
  
  const admin = await prisma.user.upsert({
    where: { employeeId },
    update: {
      accountName: employeeId,
      password: hashedPassword,
      isActive: true,
      role: 'SYSTEM_ADMIN',
    },
    create: {
      employeeId,
      accountName: employeeId,
      firstName: 'System',
      lastName: 'Administrator',
      email: 'admin@deped.gov.ph',
      password: hashedPassword,
      role: 'SYSTEM_ADMIN',
      sex: 'FEMALE',
      isActive: true,
    },
  });

  console.log('✅ Admin User seeded successfully!');
  console.log(`   Employee ID: ${admin.employeeId}`);
  console.log(`   Name: ${admin.firstName} ${admin.lastName}`);
  console.log(`   Email: ${admin.email}`);
  console.log(`   Role: ${admin.role}`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
