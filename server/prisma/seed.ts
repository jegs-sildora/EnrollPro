import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
	// Ensure school settings row exists
	const existing = await prisma.schoolSettings.findFirst();
	if (!existing) {
		await prisma.schoolSettings.create({ data: { schoolName: 'My School' } });
		console.log('Created default SchoolSettings row.');
	} else {
		console.log('SchoolSettings already exists.');
	}

	// Create first SYSTEM_ADMIN account
	const email = process.env.ADMIN_EMAIL ?? 'admin@deped.edu.ph';
	const password = process.env.ADMIN_PASSWORD ?? 'Admin2026!';

	// Refactored to granular names
	const firstName = process.env.ADMIN_FIRST_NAME ?? 'System';
	const lastName = process.env.ADMIN_LAST_NAME ?? 'Administrator';

	const existingAdmin = await prisma.user.findUnique({ where: { email } });
	if (existingAdmin) {
		console.log(`Admin account already exists: ${email}`);
		return;
	}

	const hashed = await bcrypt.hash(password, 12);

	await prisma.user.create({
		data: {
			firstName,
			lastName,
			email,
			password: hashed,
			role: 'SYSTEM_ADMIN',
			isActive: true,
			mustChangePassword: true,
		},
	});

	console.log(`✅ System Admin created: ${email}`);
	console.log(`   Temporary password:   ${password}`);
	console.log(`   ⚠  Change this password immediately after first login.`);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
