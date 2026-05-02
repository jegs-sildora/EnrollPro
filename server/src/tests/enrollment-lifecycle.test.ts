import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import jwt from "jsonwebtoken";

import app from "../app.js";
import { prisma } from "../lib/prisma.js";

type Fixture = {
  schoolYearId: number;
  gradeLevelId: number;
  sectionId: number;
  learnerId: number;
  enrollmentApplicationId: number;
  enrollmentRecordId: number;
  userId: number;
};

type SchoolSettingSnapshot = {
  id: number;
  previousActiveSchoolYearId: number | null;
  created: boolean;
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
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
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

function authHeader(userId: number, role: "HEAD_REGISTRAR" | "SYSTEM_ADMIN") {
  const secret = process.env.JWT_SECRET || "integration-test-secret";
  process.env.JWT_SECRET = secret;

  const token = jwt.sign({ userId, role }, secret, { expiresIn: "1h" });
  return { Authorization: `Bearer ${token}` };
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

async function ensureActiveSchoolYear(
  schoolYearId: number,
): Promise<SchoolSettingSnapshot> {
  const existing = await prisma.schoolSetting.findFirst({
    select: { id: true, activeSchoolYearId: true },
    orderBy: { id: "asc" },
  });

  if (existing) {
    await prisma.schoolSetting.update({
      where: { id: existing.id },
      data: { activeSchoolYearId: schoolYearId },
    });

    return {
      id: existing.id,
      previousActiveSchoolYearId: existing.activeSchoolYearId,
      created: false,
    };
  }

  const created = await prisma.schoolSetting.create({
    data: {
      schoolName: "Integration Test School",
      activeSchoolYearId: schoolYearId,
    },
    select: { id: true },
  });

  return {
    id: created.id,
    previousActiveSchoolYearId: null,
    created: true,
  };
}

async function restoreSchoolSetting(
  snapshot: SchoolSettingSnapshot | null,
): Promise<void> {
  if (!snapshot) return;

  if (snapshot.created) {
    await prisma.schoolSetting.deleteMany({ where: { id: snapshot.id } });
    return;
  }

  await prisma.schoolSetting.update({
    where: { id: snapshot.id },
    data: { activeSchoolYearId: snapshot.previousActiveSchoolYearId },
  });
}

async function createFixture(seed: string): Promise<Fixture> {
  const schoolYear = await prisma.schoolYear.create({
    data: {
      yearLabel: `LIFE-${seed}`,
      status: "ACTIVE",
      portalControl: "FORCE_OPEN_PHASE_2",
    },
  });

  const gradeLevel = await prisma.gradeLevel.upsert({
    where: { name: `Grade 7-${seed}` },
    update: {},
    create: {
      name: `Grade 7-${seed}`,
      displayOrder: 7,
    },
  });

  const user = await prisma.user.create({
    data: {
      firstName: "Lifecycle",
      lastName: "Tester",
      email: `lifecycle-${seed}@example.com`,
      password: "test-password",
      role: "HEAD_REGISTRAR",
      sex: "FEMALE",
      isActive: true,
    },
  });

  const section = await prisma.section.create({
    data: {
      name: `Lifecycle-Section-${seed}`,
      gradeLevelId: gradeLevel.id,
      schoolYearId: schoolYear.id,
      programType: "REGULAR",
      maxCapacity: 40,
    },
  });

  const learner = await prisma.learner.create({
    data: {
      firstName: "Seeded",
      lastName: `Learner-${seed}`,
      sex: "MALE",
      birthdate: new Date("2012-01-15"),
      lrn: `1${Date.now().toString().slice(-11)}`,
    },
  });

  const enrollmentApplication = await prisma.enrollmentApplication.create({
    data: {
      learnerId: learner.id,
      schoolYearId: schoolYear.id,
      gradeLevelId: gradeLevel.id,
      status: "ENROLLED",
      trackingNumber: `LIFE-TRK-${seed}`,
      learningModalities: ["IN_PERSON"],
      admissionChannel: "F2F",
      isPrivacyConsentGiven: true,
      encodedById: user.id,
    },
  });

  const enrollmentRecord = await prisma.enrollmentRecord.create({
    data: {
      enrollmentApplicationId: enrollmentApplication.id,
      schoolYearId: schoolYear.id,
      sectionId: section.id,
      enrolledById: user.id,
    },
  });

  return {
    schoolYearId: schoolYear.id,
    gradeLevelId: gradeLevel.id,
    sectionId: section.id,
    learnerId: learner.id,
    enrollmentApplicationId: enrollmentApplication.id,
    enrollmentRecordId: enrollmentRecord.id,
    userId: user.id,
  };
}

async function cleanupFixture(
  fixture: Fixture,
  specialAppIds: number[],
  specialLearnerIds: number[],
): Promise<void> {
  await prisma.auditLog.deleteMany({ where: { userId: fixture.userId } });

  await prisma.enrollmentRecord.deleteMany({
    where: {
      OR: [
        { id: fixture.enrollmentRecordId },
        { enrollmentApplicationId: { in: specialAppIds } },
      ],
    },
  });

  await prisma.applicationChecklist.deleteMany({
    where: {
      OR: [
        { enrollmentId: fixture.enrollmentApplicationId },
        { enrollmentId: { in: specialAppIds } },
      ],
    },
  });

  await prisma.enrollmentApplication.deleteMany({
    where: {
      id: { in: [fixture.enrollmentApplicationId, ...specialAppIds] },
    },
  });

  await prisma.learner.deleteMany({
    where: {
      id: { in: [fixture.learnerId, ...specialLearnerIds] },
    },
  });

  await prisma.section.deleteMany({ where: { id: fixture.sectionId } });
  await prisma.gradeLevel.deleteMany({ where: { id: fixture.gradeLevelId } });
  await prisma.user.deleteMany({ where: { id: fixture.userId } });
  await prisma.schoolYear.deleteMany({ where: { id: fixture.schoolYearId } });
}

async function runTests(): Promise<void> {
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  let fixture: Fixture | null = null;
  let schoolSettingSnapshot: SchoolSettingSnapshot | null = null;
  let server: Server | null = null;

  const specialApplicationIds: number[] = [];
  const specialLearnerIds: number[] = [];

  try {
    fixture = await createFixture(seed);
    schoolSettingSnapshot = await ensureActiveSchoolYear(fixture.schoolYearId);

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");

    const address = server.address();
    assert.ok(
      address && typeof address !== "string",
      "Test server did not bind to a TCP port",
    );

    const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
    const registrarHeaders = authHeader(fixture.userId, "HEAD_REGISTRAR");

    const unenrollValidation = await requestJson(
      baseUrl,
      `/api/applications/${fixture.enrollmentApplicationId}/unenroll`,
      {
        method: "PATCH",
        headers: registrarHeaders,
        body: JSON.stringify({ reason: "   " }),
      },
    );

    assert.equal(unenrollValidation.status, 400);
    assert.equal(unenrollValidation.body?.message, "Validation failed");
    assert.ok(
      Array.isArray(unenrollValidation.body?.errors?.reason),
      "Expected unenroll reason validation errors",
    );

    const retainedRecord = await prisma.enrollmentRecord.findUnique({
      where: { enrollmentApplicationId: fixture.enrollmentApplicationId },
      select: { id: true },
    });
    assert.ok(
      retainedRecord,
      "Enrollment record should remain after validation failure",
    );

    const walkInPayload = {
      hasNoLrn: true,
      firstName: "Walkin",
      lastName: `AutoVerified-${seed}`,
      middleName: "Encoder",
      birthdate: "2012-07-01",
      sex: "FEMALE",
      placeOfBirth: "CITY OF SAN FERNANDO",
      learnerType: "NEW_ENROLLEE",
      applicantType: "REGULAR",
      gradeLevelId: fixture.gradeLevelId,
      academicStatus: "PROMOTED",
      currentAddress: {
        houseNoStreet: "PUROK 4",
        sitio: "SITIO MALINIS",
        barangay: "BARANGAY UNO",
        cityMunicipality: "SAN FERNANDO",
        province: "PAMPANGA",
      },
      mother: {
        firstName: "MARIA",
        lastName: "ENCODER",
        contactNumber: "09171234567",
      },
      checklist: {
        academicStatus: "PROMOTED",
        isSf9Submitted: true,
        isPsaBirthCertPresented: true,
        isOriginalPsaBcCollected: true,
        finalGeneralAverage: 91.5,
      },
    };

    const specialEnrollment = await requestJson(
      baseUrl,
      "/api/applications/special-enrollment",
      {
        method: "POST",
        headers: registrarHeaders,
        body: JSON.stringify(walkInPayload),
      },
    );

    assert.equal(specialEnrollment.status, 201);
    assert.equal(specialEnrollment.body?.status, "VERIFIED");
    assert.equal(specialEnrollment.body?.admissionChannel, "F2F");

    const specialApplicationId = Number(specialEnrollment.body?.id);
    assert.ok(Number.isInteger(specialApplicationId));
    specialApplicationIds.push(specialApplicationId);

    const persistedSpecial = await prisma.enrollmentApplication.findUnique({
      where: { id: specialApplicationId },
      include: {
        learner: {
          select: { id: true, isPendingLrnCreation: true, lrn: true },
        },
        checklist: {
          select: {
            academicStatus: true,
            isSf9Submitted: true,
            isPsaBirthCertPresented: true,
            isOriginalPsaBcCollected: true,
          },
        },
        addresses: {
          select: {
            addressType: true,
            barangay: true,
            cityMunicipality: true,
            province: true,
          },
        },
        familyMembers: {
          select: {
            relationship: true,
            firstName: true,
            lastName: true,
            contactNumber: true,
          },
        },
        previousSchool: {
          select: {
            schoolName: true,
            generalAverage: true,
          },
        },
        enrollmentRecord: {
          select: { id: true },
        },
      },
    });

    assert.ok(persistedSpecial, "Special enrollment must be saved");
    specialLearnerIds.push(persistedSpecial.learner.id);

    assert.equal(persistedSpecial.status, "VERIFIED");
    assert.equal(persistedSpecial.learner.isPendingLrnCreation, true);
    assert.equal(persistedSpecial.learner.lrn, null);
    assert.equal(persistedSpecial.checklist?.academicStatus, "PROMOTED");
    assert.equal(persistedSpecial.checklist?.isSf9Submitted, true);
    assert.equal(persistedSpecial.checklist?.isPsaBirthCertPresented, true);
    assert.equal(persistedSpecial.checklist?.isOriginalPsaBcCollected, true);
    const currentAddress = persistedSpecial.addresses.find(
      (address) => address.addressType === "CURRENT",
    );
    assert.ok(currentAddress, "Current address should be saved");
    assert.equal(currentAddress?.barangay, "BARANGAY UNO");
    assert.equal(currentAddress?.cityMunicipality, "SAN FERNANDO");
    const mother = persistedSpecial.familyMembers.find(
      (member) => member.relationship === "MOTHER",
    );
    assert.ok(mother, "Mother record should be saved");
    assert.equal(mother?.firstName, "MARIA");
    assert.equal(mother?.lastName, "ENCODER");
    assert.equal(mother?.contactNumber, "09171234567");
    assert.equal(persistedSpecial.previousSchool?.schoolName, null);
    assert.equal(persistedSpecial.previousSchool?.generalAverage, 91.5);
    assert.equal(persistedSpecial.enrollmentRecord, null);

    console.log("Enrollment lifecycle integration tests passed.");
  } catch (error) {
    console.error("Enrollment lifecycle integration tests failed:", error);
    process.exitCode = 1;
  } finally {
    if (server) {
      await closeServer(server);
    }

    if (schoolSettingSnapshot) {
      await restoreSchoolSetting(schoolSettingSnapshot);
    }

    if (fixture) {
      await cleanupFixture(fixture, specialApplicationIds, specialLearnerIds);
    }

    await prisma.$disconnect();
  }
}

void runTests();
