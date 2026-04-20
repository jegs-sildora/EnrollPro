import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import app from "../app.js";
import { prisma } from "../lib/prisma.js";

type IntegrationFixture = {
  schoolYearId: number;
  gradeLevelId: number;
  sectionId: number;
  learnerId: number;
  enrollmentApplicationId: number;
  enrollmentRecordId: number;
  userId: number;
  teacherId: number;
  teacherDesignationId: number;
  learnerLastName: string;
};

type ApiResult = {
  status: number;
  body: any;
};

function asHeaders(initHeaders?: HeadersInit): Headers {
  const headers = new Headers(initHeaders);
  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }
  return headers;
}

async function requestJson(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<ApiResult> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: asHeaders(init?.headers),
  });

  const text = await response.text();
  let body: any = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return {
    status: response.status,
    body,
  };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function deleteFixture(
  fixture: Partial<IntegrationFixture>,
): Promise<void> {
  if (fixture.teacherDesignationId) {
    await prisma.teacherDesignation.deleteMany({
      where: { id: fixture.teacherDesignationId },
    });
  }

  if (fixture.enrollmentRecordId) {
    await prisma.enrollmentRecord.deleteMany({
      where: { id: fixture.enrollmentRecordId },
    });
  }

  if (fixture.enrollmentApplicationId) {
    await prisma.enrollmentApplication.deleteMany({
      where: { id: fixture.enrollmentApplicationId },
    });
  }

  if (fixture.learnerId) {
    await prisma.learner.deleteMany({
      where: { id: fixture.learnerId },
    });
  }

  if (fixture.sectionId) {
    await prisma.section.deleteMany({
      where: { id: fixture.sectionId },
    });
  }

  if (fixture.teacherId) {
    await prisma.teacher.deleteMany({
      where: { id: fixture.teacherId },
    });
  }

  if (fixture.userId) {
    await prisma.user.deleteMany({
      where: { id: fixture.userId },
    });
  }

  if (fixture.gradeLevelId) {
    await prisma.gradeLevel.deleteMany({
      where: { id: fixture.gradeLevelId },
    });
  }

  if (fixture.schoolYearId) {
    await prisma.schoolYear.deleteMany({
      where: { id: fixture.schoolYearId },
    });
  }
}

async function createFixture(seed: string): Promise<IntegrationFixture> {
  const fixture: Partial<IntegrationFixture> = {};

  try {
    const schoolYear = await prisma.schoolYear.create({
      data: {
        yearLabel: `IT-${seed}`,
        status: "ACTIVE",
        isManualOverrideOpen: true,
      },
    });
    fixture.schoolYearId = schoolYear.id;

    const gradeLevel = await prisma.gradeLevel.create({
      data: {
        name: `Grade 7-${seed}`,
        displayOrder: 7,
        schoolYearId: schoolYear.id,
      },
    });
    fixture.gradeLevelId = gradeLevel.id;

    const user = await prisma.user.create({
      data: {
        firstName: "Integration",
        lastName: "Tester",
        email: `integration-user-${seed}@example.com`,
        password: "test-password",
        role: "REGISTRAR",
        sex: "MALE",
      },
    });
    fixture.userId = user.id;

    const teacher = await prisma.teacher.create({
      data: {
        firstName: "Faculty",
        lastName: `One-${seed}`,
        email: `integration-faculty-${seed}@example.com`,
      },
    });
    fixture.teacherId = teacher.id;

    const section = await prisma.section.create({
      data: {
        name: `Section-${seed}`,
        gradeLevelId: gradeLevel.id,
        programType: "REGULAR",
        maxCapacity: 40,
        advisingTeacherId: teacher.id,
      },
    });
    fixture.sectionId = section.id;

    const learnerLastName = `Integration-${seed}`;
    const learner = await prisma.learner.create({
      data: {
        firstName: "Sample",
        lastName: learnerLastName,
        sex: "MALE",
        birthdate: new Date("2011-01-15"),
      },
    });
    fixture.learnerId = learner.id;
    fixture.learnerLastName = learnerLastName;

    const enrollmentApplication = await prisma.enrollmentApplication.create({
      data: {
        learnerId: learner.id,
        schoolYearId: schoolYear.id,
        gradeLevelId: gradeLevel.id,
        status: "ENROLLED",
        trackingNumber: `TRK-${seed}`,
        learningModalities: ["IN_PERSON"],
      },
    });
    fixture.enrollmentApplicationId = enrollmentApplication.id;

    const enrollmentRecord = await prisma.enrollmentRecord.create({
      data: {
        enrollmentApplicationId: enrollmentApplication.id,
        schoolYearId: schoolYear.id,
        sectionId: section.id,
        enrolledById: user.id,
      },
    });
    fixture.enrollmentRecordId = enrollmentRecord.id;

    const teacherDesignation = await prisma.teacherDesignation.create({
      data: {
        teacherId: teacher.id,
        schoolYearId: schoolYear.id,
        advisorySectionId: section.id,
        isClassAdviser: true,
        isTic: true,
        updatedById: user.id,
      },
    });
    fixture.teacherDesignationId = teacherDesignation.id;

    return fixture as IntegrationFixture;
  } catch (error) {
    await deleteFixture(fixture);
    throw error;
  }
}

async function runTests(): Promise<void> {
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const previousPublicSampleFlag =
    process.env.INTEGRATION_PUBLIC_SAMPLE_ENABLED;

  let fixture: IntegrationFixture | null = null;
  let server: Server | null = null;

  try {
    process.env.INTEGRATION_PUBLIC_SAMPLE_ENABLED = "true";

    fixture = await createFixture(seed);
    const fixtureData = fixture;

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");

    const address = server.address();
    assert.ok(
      address && typeof address !== "string",
      "Test server did not bind to a TCP port",
    );
    const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

    const health = await requestJson(baseUrl, "/api/integration/v1/health");
    assert.equal(health.status, 200);
    assert.equal(typeof health.body?.data?.status, "string");
    assert.equal(typeof health.body?.data?.db, "string");

    const learnersMissingScope = await requestJson(
      baseUrl,
      "/api/integration/v1/learners",
    );
    assert.equal(learnersMissingScope.status, 400);
    assert.equal(learnersMissingScope.body?.error?.code, "VALIDATION_ERROR");

    const learners = await requestJson(
      baseUrl,
      `/api/integration/v1/learners?schoolYearId=${fixtureData.schoolYearId}&search=${encodeURIComponent(fixtureData.learnerLastName)}`,
    );
    assert.equal(learners.status, 200);
    assert.equal(learners.body?.meta?.schoolYearId, fixtureData.schoolYearId);
    assert.ok(Array.isArray(learners.body?.data));

    const learnerRow = learners.body.data.find(
      (row: any) =>
        row.enrollmentApplicationId === fixtureData.enrollmentApplicationId,
    );
    assert.ok(
      learnerRow,
      "Expected learners endpoint to return seeded learner",
    );
    assert.equal(typeof learnerRow.learner.externalId, "string");
    assert.ok(learnerRow.learner.externalId.length > 0);

    const studentsAlias = await requestJson(
      baseUrl,
      `/api/integration/v1/students?schoolYearId=${fixtureData.schoolYearId}&search=${encodeURIComponent(fixtureData.learnerLastName)}`,
    );
    assert.equal(studentsAlias.status, 200);
    assert.equal(
      studentsAlias.body?.meta?.schoolYearId,
      fixtureData.schoolYearId,
    );

    const sections = await requestJson(
      baseUrl,
      `/api/integration/v1/sections?schoolYearId=${fixtureData.schoolYearId}`,
    );
    assert.equal(sections.status, 200);
    assert.ok(Array.isArray(sections.body?.data));

    const sectionRow = sections.body.data.find(
      (row: any) => row.id === fixtureData.sectionId,
    );
    assert.ok(
      sectionRow,
      "Expected sections endpoint to return seeded section",
    );
    assert.equal(sectionRow.gradeLevel.id, fixtureData.gradeLevelId);

    const sectionLearners = await requestJson(
      baseUrl,
      `/api/integration/v1/sections/${fixtureData.sectionId}/learners?schoolYearId=${fixtureData.schoolYearId}`,
    );
    assert.equal(sectionLearners.status, 200);
    assert.equal(
      sectionLearners.body?.data?.section?.id,
      fixtureData.sectionId,
    );
    assert.ok(Array.isArray(sectionLearners.body?.data?.learners));

    const sectionLearnerRow = sectionLearners.body.data.learners.find(
      (row: any) =>
        row.enrollmentApplicationId === fixtureData.enrollmentApplicationId,
    );
    assert.ok(
      sectionLearnerRow,
      "Expected section learners endpoint to return seeded learner",
    );
    assert.equal(typeof sectionLearnerRow.learner.externalId, "string");

    const faculty = await requestJson(
      baseUrl,
      `/api/integration/v1/faculty?schoolYearId=${fixtureData.schoolYearId}`,
    );
    assert.equal(faculty.status, 200);
    assert.ok(Array.isArray(faculty.body?.data));

    const facultyRow = faculty.body.data.find(
      (row: any) => row.teacherId === fixtureData.teacherId,
    );
    assert.ok(facultyRow, "Expected faculty endpoint to return seeded teacher");
    assert.equal(facultyRow.isClassAdviser, true);
    assert.equal(facultyRow.isTic, true);
    assert.equal(facultyRow.advisorySectionId, fixtureData.sectionId);

    const teachersAlias = await requestJson(
      baseUrl,
      `/api/integration/v1/teachers?schoolYearId=${fixtureData.schoolYearId}`,
    );
    assert.equal(teachersAlias.status, 200);
    assert.ok(Array.isArray(teachersAlias.body?.data));

    const staff = await requestJson(baseUrl, "/api/integration/v1/staff");
    assert.equal(staff.status, 200);
    assert.ok(Array.isArray(staff.body?.data));

    const defaultFaculty = await requestJson(
      baseUrl,
      `/api/integration/v1/default/faculty?schoolYearId=${fixtureData.schoolYearId}`,
    );
    assert.equal(defaultFaculty.status, 200);
    assert.equal(defaultFaculty.body?.meta?.sourceSystem, "ENROLLPRO");
    assert.ok(Array.isArray(defaultFaculty.body?.data));

    const defaultSmart = await requestJson(
      baseUrl,
      `/api/integration/v1/default/smart/students?schoolYearId=${fixtureData.schoolYearId}`,
    );
    assert.equal(defaultSmart.status, 200);
    assert.equal(defaultSmart.body?.meta?.sourceSystem, "SMART");
    assert.ok(Array.isArray(defaultSmart.body?.data));

    const defaultSmartLearner = defaultSmart.body?.data?.find(
      (row: any) =>
        row.enrollmentApplicationId === fixtureData.enrollmentApplicationId,
    );
    assert.ok(
      defaultSmartLearner,
      "Expected default SMART feed to include seeded learner",
    );

    const defaultAims = await requestJson(
      baseUrl,
      `/api/integration/v1/default/aims/context?schoolYearId=${fixtureData.schoolYearId}`,
    );
    assert.equal(defaultAims.status, 200);
    assert.equal(defaultAims.body?.meta?.sourceSystem, "AIMS");
    assert.ok(Array.isArray(defaultAims.body?.data));

    const sampleTeachers = await requestJson(
      baseUrl,
      "/api/integration/v1/sample/teachers",
    );
    assert.equal(sampleTeachers.status, 200);
    assert.ok(Array.isArray(sampleTeachers.body?.data));

    const sampleStaff = await requestJson(
      baseUrl,
      "/api/integration/v1/sample/staff",
    );
    assert.equal(sampleStaff.status, 200);
    assert.ok(Array.isArray(sampleStaff.body?.data));

    const sampleStudents = await requestJson(
      baseUrl,
      "/api/integration/v1/sample/students",
    );
    assert.equal(sampleStudents.status, 200);
    assert.ok(Array.isArray(sampleStudents.body?.data));

    console.log("Integration API tests passed.");
  } catch (error) {
    console.error("Integration API tests failed:", error);
    process.exitCode = 1;
  } finally {
    if (server) {
      await closeServer(server);
    }

    if (fixture) {
      await deleteFixture(fixture);
    }

    process.env.INTEGRATION_PUBLIC_SAMPLE_ENABLED = previousPublicSampleFlag;

    await prisma.$disconnect();
  }
}

void runTests();
