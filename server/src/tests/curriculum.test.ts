// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';

describe('Curriculum API', () => {
	let authToken: string;
	let schoolYearId: number;
	let gradeLevelId: number;

	beforeAll(async () => {
		// Create test user
		const hashedPassword =
			'$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWEHaSuu'; // 'password'
		const user = await prisma.user.create({
			data: {
				firstName: 'Test',
				lastName: 'Registrar',
				email: 'test-curriculum@test.com',
				password: hashedPassword,
				role: 'REGISTRAR',
				sex: 'FEMALE',
			},
		});

		// Login to get token
		const loginRes = await request(app)
			.post('/api/auth/login')
			.send({ email: 'test-curriculum@test.com', password: 'password' });

		authToken = loginRes.body.token;

		// Create school year
		const ay = await prisma.schoolYear.create({
			data: {
				yearLabel: '2026-2027',
				status: 'ACTIVE',
				isManualOverrideOpen: true,
			},
		});
		schoolYearId = ay.id;

		// Create grade level
		const gl = await prisma.gradeLevel.create({
			data: {
				name: 'Grade 7',
				displayOrder: 7,
				schoolYearId,
			},
		});
		gradeLevelId = gl.id;
	});

	afterAll(async () => {
		// Cleanup
		await prisma.gradeLevel.deleteMany({ where: { schoolYearId } });
		await prisma.schoolYear.delete({ where: { id: schoolYearId } });
		await prisma.user.deleteMany({
			where: { email: 'test-curriculum@test.com' },
		});
		await prisma.$disconnect();
	});

	it('should list grade levels', async () => {
		const res = await request(app)
			.get(`/api/curriculum/${schoolYearId}/grade-levels`)
			.set('Authorization', `Bearer ${authToken}`);

		expect(res.status).toBe(200);
		expect(res.body.gradeLevels).toBeDefined();
		expect(Array.isArray(res.body.gradeLevels)).toBe(true);
		expect(res.body.gradeLevels.length).toBeGreaterThan(0);
	});

	it('should require authentication', async () => {
		const res = await request(app).get(
			`/api/curriculum/${schoolYearId}/grade-levels`,
		);

		expect(res.status).toBe(401);
	});
});
