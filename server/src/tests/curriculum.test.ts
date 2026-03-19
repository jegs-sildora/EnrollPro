// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";

describe("Curriculum API", () => {
  let authToken: string;
  let schoolYearId: number;
  let gradeLevelId: number;
  let strandId: number;

  beforeAll(async () => {
    // Create test user
    const hashedPassword =
      "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWEHaSuu"; // 'password'
    const user = await prisma.user.create({
      data: {
        name: "Test Registrar",
        email: "test-curriculum@test.com",
        password: hashedPassword,
        role: "REGISTRAR",
      },
    });

    // Login to get token
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "test-curriculum@test.com", password: "password" });

    authToken = loginRes.body.token;

    // Create school year
    const ay = await prisma.schoolYear.create({
      data: {
        yearLabel: "2026-2027",
        status: "ACTIVE",
        isActive: true,
      },
    });
    schoolYearId = ay.id;

    // Create grade level
    const gl = await prisma.gradeLevel.create({
      data: {
        name: "Grade 11",
        displayOrder: 11,
        schoolYearId,
      },
    });
    gradeLevelId = gl.id;

    // Create strand
    const strand = await prisma.strand.create({
      data: {
        name: "STEM",
        applicableGradeLevelIds: [],
        schoolYearId,
      },
    });
    strandId = strand.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.strand.deleteMany({ where: { schoolYearId } });
    await prisma.gradeLevel.deleteMany({ where: { schoolYearId } });
    await prisma.schoolYear.delete({ where: { id: schoolYearId } });
    await prisma.user.deleteMany({
      where: { email: "test-curriculum@test.com" },
    });
    await prisma.$disconnect();
  });

  it("should list grade levels", async () => {
    const res = await request(app)
      .get(`/api/curriculum/${schoolYearId}/grade-levels`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.gradeLevels).toBeDefined();
    expect(Array.isArray(res.body.gradeLevels)).toBe(true);
    expect(res.body.gradeLevels.length).toBeGreaterThan(0);
  });

  it("should list strands", async () => {
    const res = await request(app)
      .get(`/api/curriculum/${schoolYearId}/strands`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.strands).toBeDefined();
    expect(Array.isArray(res.body.strands)).toBe(true);
    expect(res.body.strands.length).toBeGreaterThan(0);
  });

  it("should update strand-to-grade matrix", async () => {
    const matrix = [
      {
        strandId,
        gradeLevelIds: [gradeLevelId],
      },
    ];

    const res = await request(app)
      .put(`/api/curriculum/${schoolYearId}/strand-matrix`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ matrix });

    expect(res.status).toBe(200);
    expect(res.body.strands).toBeDefined();
    expect(Array.isArray(res.body.strands)).toBe(true);

    // Verify the strand was updated
    const updatedStrand = res.body.strands.find((s: any) => s.id === strandId);
    expect(updatedStrand).toBeDefined();
    expect(updatedStrand.applicableGradeLevelIds).toContain(gradeLevelId);
  });

  it("should return 400 if matrix is not an array", async () => {
    const res = await request(app)
      .put(`/api/curriculum/${schoolYearId}/strand-matrix`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ matrix: "invalid" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Matrix must be an array");
  });

  it("should require authentication", async () => {
    const res = await request(app).get(
      `/api/curriculum/${schoolYearId}/grade-levels`,
    );

    expect(res.status).toBe(401);
  });
});
