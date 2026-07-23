import assert from "node:assert/strict"
import { createServer, type Server } from "node:http"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import type { AddressInfo } from "node:net"
import * as bcrypt from "bcryptjs"
import app from "../app.js"
import {
  ApplicantType,
  Sex,
} from "../generated/prisma/index.js"
import { prisma } from "../lib/prisma.js"

const ADMIN_ACCOUNT = "lifecycle.admin"
const ADMIN_PASSWORD = "DepEdLifecycle2031!"
const INITIAL_YEAR_LABEL = "2026-2027"
const FINAL_YEAR_LABEL = "2030-2031"
const SECTION_CAPACITY = 40
const REPORT_PATH = path.resolve(
  process.cwd(),
  "uploads",
  "reports",
  "lifecycle-simulation-report.json",
)

const PROGRAMS: ReadonlyArray<{
  suffix: string
  programType: ApplicantType
  homogeneous: boolean
  sectionRank: number | null
}> = [
  {
    suffix: "STE",
    programType: ApplicantType.SCIENCE_TECHNOLOGY_AND_ENGINEERING,
    homogeneous: false,
    sectionRank: null,
  },
  {
    suffix: "SPA",
    programType: ApplicantType.SPECIAL_PROGRAM_IN_THE_ARTS,
    homogeneous: false,
    sectionRank: null,
  },
  {
    suffix: "SPS",
    programType: ApplicantType.SPECIAL_PROGRAM_IN_SPORTS,
    homogeneous: false,
    sectionRank: null,
  },
  {
    suffix: "BEC Top 5",
    programType: ApplicantType.REGULAR,
    homogeneous: true,
    sectionRank: 1,
  },
  {
    suffix: "BEC",
    programType: ApplicantType.REGULAR,
    homogeneous: false,
    sectionRank: 2,
  },
]

const FIRST_NAMES = [
  "JUAN MIGUEL",
  "MARIA ANGELA",
  "JOSE GABRIEL",
  "ANNA PATRICIA",
  "CARLO MIGUEL",
  "BEATRIZ ANNE",
  "PAOLO BENJAMIN",
  "CLARISSE JOY",
] as const

const LAST_NAMES = [
  "SANTOS",
  "REYES",
  "CRUZ",
  "GARCIA",
  "MENDOZA",
  "BAUTISTA",
  "NAVARRO",
  "RAMOS",
  "FLORES",
  "AQUINO",
] as const

type JsonObject = Record<string, unknown>

interface HttpResult<T> {
  status: number
  data: T
}

interface LoginResponse {
  token: string
}

interface CommitDraftResponse {
  committedCount: number
  skippedApplications: Array<{
    applicationId: number
    reason: string
  }>
}

interface CalendarPolicyResponse {
  calendarPolicy: {
    id: number
    status: string
  }
}

interface RolloverResponse {
  year: {
    id: number
    yearLabel: string
    status: string
  }
  rolloverSummary: {
    archivedRecords: number
    pendingConfirmations: number
    remedialHolds: number
    completers: number
    archiveOnlyDepartures: number
  }
}

interface RolloverReadinessResponse {
  ready: boolean
  blockers: Array<{
    sectionId: number
    reasons: string[]
  }>
  globalBlockers: Array<{
    code: string
    message: string
  }>
}

interface WalkInResponse {
  application: {
    id: number
    learnerId: number
    schoolYearId: number
    gradeLevelId: number
  }
}

interface IntegrationSchoolYearResponse {
  data: {
    id: number
    yearLabel: string
  }
}

interface SmartLearningArea {
  code: string
  name: string
  finalGrade: number
  result: "PASSED" | "FAILED" | "INCOMPLETE"
}

interface SmartLearnerOutcome {
  lrn: string
  finalGeneralAverage: number
  finalOutcome: "PROMOTED" | "CONDITIONALLY_PROMOTED" | "RETAINED"
  learningAreas: SmartLearningArea[]
  publishedAt: string
  revision: string
}

interface SmartSectionPayload {
  data: {
    students: SmartLearnerOutcome[]
  }
}

interface SimulationCheckpoint {
  schoolYear: string
  stage: string
  status: "PASS" | "FAIL"
  details: JsonObject
  recordedAt: string
}

interface YearSimulationSummary {
  sourceYear: string
  targetYear: string
  baselineEnrollment: number
  lateAdmissions: number
  droppedLearners: number
  transferredLearners: number
  finalActiveTally: number
  rollover: RolloverResponse["rolloverSummary"]
}

interface SimulationReport {
  startedAt: string
  completedAt: string | null
  database: string
  initialYear: string
  finalYear: string
  success: boolean
  checkpoints: SimulationCheckpoint[]
  years: YearSimulationSummary[]
  failure: {
    message: string
    stack: string | null
  } | null
}

interface SimulationContext {
  baseUrl: string
  token: string
  adminUserId: number
  smartPayloads: Map<number, SmartSectionPayload>
  report: SimulationReport
}

interface SectionPlacement {
  sectionId: number
  applicationIds: number[]
}

interface SeedResult {
  schoolYearId: number
  adminUserId: number
}

let learnerSequence = 1

function jsonRecord(value: unknown): JsonObject {
  return typeof value === "object" && value !== null
    ? value as JsonObject
    : { value }
}

function nextYearLabel(yearLabel: string): string {
  const match = /^(\d{4})-(\d{4})$/.exec(yearLabel)
  if (!match) throw new Error(`Invalid school year label: ${yearLabel}`)
  return `${Number(match[1]) + 1}-${Number(match[2]) + 1}`
}

function startYear(yearLabel: string): number {
  const value = Number.parseInt(yearLabel.slice(0, 4), 10)
  if (!Number.isInteger(value)) {
    throw new Error(`Invalid school year label: ${yearLabel}`)
  }
  return value
}

function isoDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day, 12)).toISOString()
}

function createCalendarPayload(yearLabel: string): JsonObject {
  const year = startYear(yearLabel)
  return {
    yearLabel,
    depedIssuance: `Lifecycle Simulation DepEd Calendar ${yearLabel}`,
    sourceUrl: null,
    classOpeningDate: isoDate(year, 6, 2),
    classEndDate: isoDate(year + 1, 3, 31),
    enrollOpenDate: isoDate(year, 5, 1),
    enrollCloseDate: isoDate(year, 5, 31),
    termFormat: "QUARTERS",
    term1Start: isoDate(year, 6, 2),
    term1End: isoDate(year, 8, 31),
    term2Start: isoDate(year, 9, 1),
    term2End: isoDate(year, 11, 30),
    term3Start: isoDate(year, 12, 1),
    term3End: isoDate(year + 1, 2, 28),
    term4Start: isoDate(year + 1, 3, 1),
    term4End: isoDate(year + 1, 3, 31),
  }
}

function createLrn(): string {
  const lrn = `9${String(learnerSequence).padStart(11, "0")}`
  learnerSequence += 1
  return lrn
}

function learnerName(sequence: number): {
  firstName: string
  middleName: string
  lastName: string
} {
  return {
    firstName: FIRST_NAMES[sequence % FIRST_NAMES.length]!,
    middleName: LAST_NAMES[(sequence + 3) % LAST_NAMES.length]!,
    lastName: LAST_NAMES[(sequence * 3) % LAST_NAMES.length]!,
  }
}

function addCheckpoint(
  report: SimulationReport,
  schoolYear: string,
  stage: string,
  details: JsonObject,
): void {
  report.checkpoints.push({
    schoolYear,
    stage,
    status: "PASS",
    details,
    recordedAt: new Date().toISOString(),
  })
  console.log(`PASS ${schoolYear} ${stage}`)
}

async function writeReport(report: SimulationReport): Promise<void> {
  await mkdir(path.dirname(REPORT_PATH), { recursive: true })
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8")
}

async function requestJson<T>(
  context: Pick<SimulationContext, "baseUrl" | "token">,
  route: string,
  options: {
    method?: string
    body?: unknown
    schoolYearId?: number
    headers?: Record<string, string>
    expectedStatuses?: number[]
  } = {},
): Promise<HttpResult<T>> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...options.headers,
  }
  if (context.token) headers.Authorization = `Bearer ${context.token}`
  if (options.schoolYearId) {
    headers["x-school-year-context-id"] = String(options.schoolYearId)
  }
  if (options.body !== undefined) headers["Content-Type"] = "application/json"

  const response = await fetch(`${context.baseUrl}${route}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined
      ? undefined
      : JSON.stringify(options.body),
  })
  const rawText = await response.text()
  let data: unknown = null
  if (rawText) {
    try {
      data = JSON.parse(rawText) as unknown
    } catch {
      data = rawText
    }
  }

  const expected = options.expectedStatuses ?? [200]
  if (!expected.includes(response.status)) {
    throw new Error(
      `${options.method ?? "GET"} ${route} returned ${response.status}: ${rawText}`,
    )
  }

  return {
    status: response.status,
    data: data as T,
  }
}

async function startHttpServer(server: Server): Promise<{
  server: Server
  baseUrl: string
}> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("Could not determine local server address.")
  }
  return {
    server,
    baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
  }
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
}

function createSmartMockServer(
  payloads: Map<number, SmartSectionPayload>,
): Server {
  return createServer((request, response) => {
    const match = /^\/api\/grades\/section\/(\d+)/.exec(
      request.url?.split("?")[0] ?? "",
    )
    if (request.method !== "GET" || !match) {
      response.writeHead(404, { "Content-Type": "application/json" })
      response.end(JSON.stringify({ message: "SMART mock route not found." }))
      return
    }

    const sectionId = Number.parseInt(match[1]!, 10)
    const payload = payloads.get(sectionId)
    if (!payload) {
      response.writeHead(404, { "Content-Type": "application/json" })
      response.end(JSON.stringify({
        message: `No published SMART result for section ${sectionId}.`,
      }))
      return
    }

    response.writeHead(200, { "Content-Type": "application/json" })
    response.end(JSON.stringify(payload))
  })
}

async function seedFoundation(): Promise<SeedResult> {
  const password = await bcrypt.hash(ADMIN_PASSWORD, 12)
  const admin = await prisma.user.create({
    data: {
      accountName: ADMIN_ACCOUNT,
      employeeId: "7654321",
      firstName: "JOSE",
      middleName: "PROTO",
      lastName: "RIZAL",
      sex: Sex.MALE,
      password,
      roles: ["SYSTEM_ADMIN", "HEAD_REGISTRAR"],
      isActive: true,
      mustChangePassword: false,
    },
  })

  const grades = await Promise.all(
    [7, 8, 9, 10].map((grade) =>
      prisma.gradeLevel.create({
        data: {
          name: `Grade ${grade}`,
          displayOrder: grade,
        },
      }),
    ),
  )

  const initialYear = await prisma.schoolYear.create({
    data: {
      yearLabel: INITIAL_YEAR_LABEL,
      status: "ACTIVE",
      termFormat: "QUARTERS",
      classOpeningDate: new Date(isoDate(2026, 6, 2)),
      classEndDate: new Date(isoDate(2027, 3, 31)),
      enrollOpenDate: new Date(isoDate(2026, 5, 1)),
      enrollCloseDate: new Date(isoDate(2026, 5, 31)),
      term1Start: new Date(isoDate(2026, 6, 2)),
      term1End: new Date(isoDate(2026, 8, 31)),
      term2Start: new Date(isoDate(2026, 9, 1)),
      term2End: new Date(isoDate(2026, 11, 30)),
      term3Start: new Date(isoDate(2026, 12, 1)),
      term3End: new Date(isoDate(2027, 2, 28)),
      term4Start: new Date(isoDate(2027, 3, 1)),
      term4End: new Date(isoDate(2027, 3, 31)),
    },
  })

  await prisma.schoolSetting.create({
    data: {
      schoolName: "Hinigaran National High School",
      depedSchoolId: "302478",
      division: "Negros Occidental",
      region: "Region VI",
      activeSchoolYearId: initialYear.id,
      systemPhase: "OFFICIAL_ENROLLMENT",
      steEnabled: true,
      spaEnabled: true,
      spsEnabled: true,
      enableHomogeneousSections: true,
      homogeneousSectionCount: 1,
      heterogeneousRoundRobin: true,
    },
  })

  let teacherSequence = 1
  for (const grade of grades) {
    for (let programIndex = 0; programIndex < PROGRAMS.length; programIndex += 1) {
      const program = PROGRAMS[programIndex]!
      const teacherEmployeeId = String(1000000 + teacherSequence)
      const teacherUser = await prisma.user.create({
        data: {
          employeeId: teacherEmployeeId,
          accountName: `teacher.${teacherSequence}`,
          firstName: `TEACHER ${teacherSequence}`,
          lastName: "SIMULATION",
          sex: teacherSequence % 2 === 0 ? Sex.FEMALE : Sex.MALE,
          password,
          roles: ["TEACHER", "CLASS_ADVISER"],
          isActive: true,
          mustChangePassword: false,
        },
      })
      const teacher = await prisma.teacher.create({
        data: {
          employeeId: teacherEmployeeId,
          firstName: teacherUser.firstName,
          lastName: teacherUser.lastName,
          sex: teacherUser.sex,
          userId: teacherUser.id,
          plantillaPosition: "TEACHER I",
          designation: "CLASS ADVISER",
        },
      })
      const section = await prisma.section.create({
        data: {
          name: `G${grade.displayOrder} ${program.suffix}`,
          maxCapacity: SECTION_CAPACITY,
          gradeLevelId: grade.id,
          schoolYearId: initialYear.id,
          programType: program.programType,
          sortOrder: programIndex + 1,
          isHomogeneous: program.homogeneous,
          isSnake: true,
          sectionRank: program.sectionRank,
        },
      })
      await prisma.sectionAdviser.create({
        data: {
          sectionId: section.id,
          teacherId: teacher.id,
          schoolYearId: initialYear.id,
          effectiveFrom: new Date(isoDate(2026, 6, 2)),
        },
      })

      for (let learnerIndex = 0; learnerIndex < 4; learnerIndex += 1) {
        await createReadyLearner({
          schoolYearId: initialYear.id,
          gradeLevelId: grade.id,
          programType: program.programType,
          sequence: learnerSequence,
          learnerType: "NEW_ENROLLEE",
        })
      }
      teacherSequence += 1
    }
  }

  return {
    schoolYearId: initialYear.id,
    adminUserId: admin.id,
  }
}

async function createReadyLearner(input: {
  schoolYearId: number
  gradeLevelId: number
  programType: ApplicantType
  sequence: number
  learnerType: "NEW_ENROLLEE" | "TRANSFEREE"
}): Promise<number> {
  const name = learnerName(input.sequence)
  const sex = input.sequence % 2 === 0 ? Sex.FEMALE : Sex.MALE
  const lrn = createLrn()
  const learner = await prisma.learner.create({
    data: {
      lrn,
      firstName: name.firstName,
      middleName: name.middleName,
      lastName: name.lastName,
      birthdate: new Date(Date.UTC(2012, input.sequence % 12, 10)),
      sex,
      placeOfBirth: "Hinigaran, Negros Occidental",
      religion: "Roman Catholic",
      motherTongue: "Hiligaynon",
      hasPsaBirthCertificate: true,
      birthCertificateType: "PSA_BIRTH_CERTIFICATE",
      disabilityTypes: [],
      missingRequirements: [],
    },
  })
  const application = await prisma.enrollmentApplication.create({
    data: {
      learnerId: learner.id,
      schoolYearId: input.schoolYearId,
      gradeLevelId: input.gradeLevelId,
      applicantType: input.programType,
      assignedProgram: input.programType,
      learnerType: input.learnerType,
      admissionChannel: "F2F",
      status: "READY_FOR_SECTIONING",
      learningModalities: ["FACE_TO_FACE"],
      isPrivacyConsentGiven: true,
      confirmationConsent: true,
      contactNumber: `09${String(100000000 + input.sequence).slice(-9)}`,
      guardianName: `MARIA ${name.lastName}`,
      guardianRelationship: "GUARDIAN",
      complianceStatus: "COMPLIED",
      addresses: {
        create: {
          addressType: "CURRENT",
          houseNoStreet: `PUROK ${input.sequence}`,
          barangay: "BARANGAY 1",
          cityMunicipality: "HINIGARAN",
          province: "NEGROS OCCIDENTAL",
          country: "PHILIPPINES",
          zipCode: "6106",
        },
      },
      familyMembers: {
        create: {
          relationship: "GUARDIAN",
          firstName: "MARIA",
          lastName: name.lastName,
          contactNumber: `09${String(100000000 + input.sequence).slice(-9)}`,
        },
      },
    },
  })
  return application.id
}

async function login(baseUrl: string): Promise<string> {
  const response = await requestJson<LoginResponse>(
    { baseUrl, token: "" },
    "/api/auth/login",
    {
      method: "POST",
      body: {
        accountName: ADMIN_ACCOUNT,
        password: ADMIN_PASSWORD,
      },
    },
  )
  assert.ok(response.data.token, "Login did not return a bearer token.")
  return response.data.token
}

async function setPhase(
  context: SimulationContext,
  schoolYearId: number,
  phase: "OFFICIAL_ENROLLMENT" | "CLASSES_ONGOING" | "EOSY_CLOSING",
): Promise<void> {
  await requestJson(
    context,
    "/api/settings/phase",
    {
      method: "PATCH",
      body: { phase },
      schoolYearId,
    },
  )
}

async function assignReadyLearners(
  context: SimulationContext,
  schoolYearId: number,
): Promise<number> {
  const [applications, sections] = await Promise.all([
    prisma.enrollmentApplication.findMany({
      where: {
        schoolYearId,
        status: "READY_FOR_SECTIONING",
        enrollmentRecord: null,
      },
      orderBy: { id: "asc" },
    }),
    prisma.section.findMany({
      where: { schoolYearId },
      include: {
        _count: { select: { enrollmentRecords: true } },
      },
      orderBy: [
        { gradeLevel: { displayOrder: "asc" } },
        { sortOrder: "asc" },
      ],
    }),
  ])

  if (applications.length === 0) return 0

  const projectedCounts = new Map(
    sections.map((section) => [section.id, section._count.enrollmentRecords]),
  )
  const placements = new Map<number, number[]>()

  for (const application of applications) {
    const effectiveProgram =
      application.assignedProgram ?? application.applicantType
    const candidates = sections
      .filter(
        (section) =>
          section.gradeLevelId === application.gradeLevelId
          && section.programType === effectiveProgram,
      )
      .sort(
        (left, right) =>
          (projectedCounts.get(left.id) ?? 0)
          - (projectedCounts.get(right.id) ?? 0)
          || left.sortOrder - right.sortOrder,
      )
    const section = candidates[0]
    if (!section) {
      throw new Error(
        `No compatible section for application ${application.id}.`,
      )
    }
    const nextCount = (projectedCounts.get(section.id) ?? 0) + 1
    if (nextCount > section.maxCapacity) {
      throw new Error(`Section ${section.name} exceeded capacity.`)
    }
    projectedCounts.set(section.id, nextCount)
    const applicationIds = placements.get(section.id) ?? []
    applicationIds.push(application.id)
    placements.set(section.id, applicationIds)
  }

  const assignments: SectionPlacement[] = Array.from(placements.entries())
    .map(([sectionId, applicationIds]) => ({ sectionId, applicationIds }))
  const response = await requestJson<CommitDraftResponse>(
    context,
    "/api/sectioning/commit-draft",
    {
      method: "POST",
      schoolYearId,
      body: {
        assignments,
        overrides: {},
        allowCapacityOverride: false,
      },
    },
  )
  assert.equal(response.data.skippedApplications.length, 0)
  assert.equal(response.data.committedCount, applications.length)
  return response.data.committedCount
}

async function resolveRemedialHolds(
  context: SimulationContext,
  schoolYearId: number,
): Promise<{ promoted: number; retained: number }> {
  const holds = await prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId,
      status: "REMEDIAL_HOLD",
    },
    orderBy: { id: "asc" },
  })
  let promoted = 0
  let retained = 0
  for (let index = 0; index < holds.length; index += 1) {
    const hold = holds[index]!
    const outcome = index % 2 === 0 ? "PROMOTED" : "RETAINED"
    await requestJson(
      context,
      `/api/remedial/${hold.learnerId}/resolve`,
      {
        method: "PATCH",
        schoolYearId,
        body: {
          schoolYearId,
          summerGrade: outcome === "PROMOTED" ? 78 : 72,
          outcome,
        },
      },
    )
    if (outcome === "PROMOTED") promoted += 1
    else retained += 1
  }
  return { promoted, retained }
}

async function confirmContinuingLearners(
  context: SimulationContext,
  schoolYearId: number,
): Promise<number> {
  const pending = await prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId,
      status: "PENDING_CONFIRMATION",
    },
    orderBy: { id: "asc" },
    select: { id: true },
  })
  for (const application of pending) {
    await requestJson(
      context,
      `/api/bosy/confirm-return/${application.id}`,
      {
        method: "POST",
        schoolYearId,
      },
    )
  }
  return pending.length
}

async function addIncomingGradeSeven(
  schoolYearId: number,
): Promise<number> {
  const gradeSeven = await prisma.gradeLevel.findFirstOrThrow({
    where: { displayOrder: 7 },
  })
  let created = 0
  for (const program of PROGRAMS) {
    for (let index = 0; index < 4; index += 1) {
      await createReadyLearner({
        schoolYearId,
        gradeLevelId: gradeSeven.id,
        programType: program.programType,
        sequence: learnerSequence,
        learnerType: index === 3 ? "TRANSFEREE" : "NEW_ENROLLEE",
      })
      created += 1
    }
  }
  return created
}

async function addLateWalkIns(
  context: SimulationContext,
  schoolYearId: number,
): Promise<number> {
  const grades = await prisma.gradeLevel.findMany({
    where: { displayOrder: { in: [7, 8, 9, 10] } },
    orderBy: { displayOrder: "asc" },
  })
  let created = 0
  for (const grade of grades) {
    const sequence = learnerSequence
    const name = learnerName(sequence)
    const response = await requestJson<WalkInResponse>(
      context,
      "/api/enrollment/walk-in",
      {
        method: "POST",
        schoolYearId,
        expectedStatuses: [201],
        body: {
          lrn: createLrn(),
          firstName: name.firstName,
          middleName: name.middleName,
          lastName: name.lastName,
          birthdate: isoDate(2012 - (grade.displayOrder - 7), 7, 10),
          sex: sequence % 2 === 0 ? "FEMALE" : "MALE",
          gradeLevelId: grade.id,
          assignedProgram: "REGULAR",
          previousSchoolName: "LIFECYCLE FEEDER SCHOOL",
          previousGenAve: "84",
          guardianName: "MARIA GUARDIAN",
          guardianContact: "09123456789",
          hasSf9: true,
          hasPsa: true,
        },
      },
    )
    assert.equal(response.data.application.schoolYearId, schoolYearId)
    learnerSequence += 1
    created += 1
  }
  return created
}

async function markDepartures(
  context: SimulationContext,
  schoolYearId: number,
): Promise<{ dropped: number; transferred: number }> {
  const records = await prisma.enrollmentRecord.findMany({
    where: {
      schoolYearId,
      dropOutDate: null,
      transferOutDate: null,
      enrollmentApplication: {
        isLateEnrollee: false,
      },
    },
    orderBy: { id: "asc" },
    select: {
      enrollmentApplicationId: true,
    },
    take: 2,
  })
  assert.equal(records.length, 2, "Two active learners are required.")

  await requestJson(
    context,
    `/api/students/${records[0]!.enrollmentApplicationId}/lifecycle/dropout`,
    {
      method: "POST",
      schoolYearId,
      body: {
        dropOutDate: isoDate(startYear(
          (await prisma.schoolYear.findUniqueOrThrow({
            where: { id: schoolYearId },
          })).yearLabel,
        ), 10, 15),
        reasonCode: "FAMILY_RELOCATION",
        reasonNote: "Lifecycle simulation",
      },
    },
  )
  await requestJson(
    context,
    `/api/students/${records[1]!.enrollmentApplicationId}/lifecycle/transfer-out`,
    {
      method: "POST",
      schoolYearId,
      body: {
        transferDate: isoDate(startYear(
          (await prisma.schoolYear.findUniqueOrThrow({
            where: { id: schoolYearId },
          })).yearLabel,
        ), 11, 5),
        destinationSchool: "SIMULATION RECEIVING SCHOOL",
        reasonNote: "Family relocation",
      },
    },
  )
  return { dropped: 1, transferred: 1 }
}

async function countActiveEnrollment(schoolYearId: number): Promise<number> {
  return prisma.enrollmentRecord.count({
    where: {
      schoolYearId,
      dropOutDate: null,
      transferOutDate: null,
    },
  })
}

function outcomeForRecord(
  gradeOrder: number,
  activeIndex: number,
): {
  finalOutcome: SmartLearnerOutcome["finalOutcome"]
  average: number
  failedArea: boolean
} {
  if (gradeOrder === 10) {
    if (activeIndex === 0) {
      return { finalOutcome: "RETAINED", average: 72, failedArea: true }
    }
    if (activeIndex === 1 || activeIndex === 2) {
      return {
        finalOutcome: "CONDITIONALLY_PROMOTED",
        average: 76,
        failedArea: true,
      }
    }
  } else {
    if (activeIndex === 0) {
      return { finalOutcome: "RETAINED", average: 73, failedArea: true }
    }
    if (activeIndex === 1) {
      return {
        finalOutcome: "CONDITIONALLY_PROMOTED",
        average: 77,
        failedArea: true,
      }
    }
  }
  return {
    finalOutcome: "PROMOTED",
    average: 85 + activeIndex % 10,
    failedArea: false,
  }
}

async function publishAndSyncSmartOutcomes(
  context: SimulationContext,
  schoolYearId: number,
  yearLabel: string,
): Promise<void> {
  const sections = await prisma.section.findMany({
    where: { schoolYearId },
    orderBy: [
      { gradeLevel: { displayOrder: "asc" } },
      { sortOrder: "asc" },
    ],
    include: {
      gradeLevel: { select: { displayOrder: true } },
      enrollmentRecords: {
        orderBy: { id: "asc" },
        include: {
          learner: { select: { lrn: true } },
        },
      },
    },
  })

  const gradeIndexes = new Map<number, number>()
  for (const section of sections) {
    const students: SmartLearnerOutcome[] = []
    for (const record of section.enrollmentRecords) {
      if (
        record.eosyStatus === "DROPPED_OUT"
        || record.eosyStatus === "TRANSFERRED_OUT"
      ) {
        continue
      }
      assert.match(record.learner.lrn ?? "", /^\d{12}$/)
      const activeIndex = gradeIndexes.get(section.gradeLevel.displayOrder) ?? 0
      gradeIndexes.set(section.gradeLevel.displayOrder, activeIndex + 1)
      const outcome = outcomeForRecord(
        section.gradeLevel.displayOrder,
        activeIndex,
      )
      students.push({
        lrn: record.learner.lrn!,
        finalGeneralAverage: outcome.average,
        finalOutcome: outcome.finalOutcome,
        learningAreas: [
          {
            code: "MATHEMATICS",
            name: "Mathematics",
            finalGrade: outcome.failedArea ? 72 : outcome.average,
            result: outcome.failedArea ? "FAILED" : "PASSED",
          },
          {
            code: "ENGLISH",
            name: "English",
            finalGrade: Math.max(75, outcome.average),
            result: "PASSED",
          },
        ],
        publishedAt: isoDate(startYear(yearLabel) + 1, 4, 15),
        revision: `${yearLabel}-final-r1`,
      })
    }
    context.smartPayloads.set(section.id, { data: { students } })
    await requestJson(
      context,
      `/api/integration/smart/sections/${section.id}/sync-grades`,
      {
        method: "POST",
        schoolYearId,
      },
    )
  }
}

async function finalizeAndRecordForms(
  context: SimulationContext,
  schoolYearId: number,
): Promise<void> {
  const sections = await prisma.section.findMany({
    where: { schoolYearId },
    orderBy: { id: "asc" },
    select: { id: true },
  })
  for (const section of sections) {
    await requestJson(
      context,
      `/api/eosy/sections/${section.id}/finalize`,
      {
        method: "POST",
        schoolYearId,
      },
    )
    await requestJson(
      context,
      `/api/eosy/sections/${section.id}/forms/sf5/record`,
      {
        method: "POST",
        schoolYearId,
        expectedStatuses: [201],
      },
    )
  }
  await requestJson(
    context,
    `/api/eosy/school-years/${schoolYearId}/forms/sf6/record`,
    {
      method: "POST",
      schoolYearId,
      expectedStatuses: [201],
    },
  )
}

async function createApprovedCalendar(
  context: SimulationContext,
  sourceSchoolYearId: number,
  targetYearLabel: string,
): Promise<number> {
  const draft = await requestJson<CalendarPolicyResponse>(
    context,
    "/api/school-years/calendar-policies",
    {
      method: "POST",
      schoolYearId: sourceSchoolYearId,
      expectedStatuses: [201],
      body: createCalendarPayload(targetYearLabel),
    },
  )
  const approved = await requestJson<CalendarPolicyResponse>(
    context,
    `/api/school-years/calendar-policies/${draft.data.calendarPolicy.id}/approve`,
    {
      method: "POST",
      schoolYearId: sourceSchoolYearId,
    },
  )
  assert.equal(approved.data.calendarPolicy.status, "APPROVED")
  return approved.data.calendarPolicy.id
}

async function getReadiness(
  context: SimulationContext,
  sourceSchoolYearId: number,
  calendarPolicyId?: number,
): Promise<RolloverReadinessResponse> {
  const query = calendarPolicyId
    ? `?calendarPolicyId=${calendarPolicyId}`
    : ""
  return (
    await requestJson<RolloverReadinessResponse>(
      context,
      `/api/system/rollover-readiness${query}`,
      { schoolYearId: sourceSchoolYearId },
    )
  ).data
}

async function verifyIntegrationFeeds(
  context: SimulationContext,
  expectedYearLabel: string,
): Promise<void> {
  const year = await requestJson<IntegrationSchoolYearResponse>(
    { baseUrl: context.baseUrl, token: "" },
    "/api/integration/v1/school-year",
  )
  assert.equal(year.data.data.yearLabel, expectedYearLabel)

  const publicRoutes = [
    "/api/integration/v1/sections",
    "/api/integration/v1/default/smart/students",
    "/api/integration/v1/default/aims/context",
    "/api/integration/v1/default/faculty",
  ]
  for (const route of publicRoutes) {
    await requestJson<JsonObject>(
      { baseUrl: context.baseUrl, token: "" },
      route,
    )
  }
  await requestJson<JsonObject>(
    { baseUrl: context.baseUrl, token: "" },
    "/api/integration/v1/default/mrf/identities",
    {
      headers: {
        "X-Integration-Key":
          process.env.MRF_INTEGRATION_API_KEY ?? "",
      },
    },
  )
}

async function executeRollover(
  context: SimulationContext,
  sourceSchoolYearId: number,
  calendarPolicyId: number,
  concurrent: boolean,
): Promise<RolloverResponse> {
  const execute = () =>
    requestJson<RolloverResponse>(
      context,
      "/api/school-years/rollover",
      {
        method: "POST",
        schoolYearId: sourceSchoolYearId,
        expectedStatuses: concurrent ? [201, 409, 422] : [201],
        body: {
          sourceSchoolYearId,
          calendarPolicyId,
          pin: process.env.ADMIN_BOSY_LOCK_PIN ?? "123456",
        },
      },
    )

  if (!concurrent) {
    return (await execute()).data
  }

  const results = await Promise.all([execute(), execute()])
  const successes = results.filter((result) => result.status === 201)
  assert.equal(
    successes.length,
    1,
    "Exactly one concurrent rollover request must commit.",
  )
  return successes[0]!.data
}

async function assertRolloverState(input: {
  context: SimulationContext
  sourceYearId: number
  sourceYearLabel: string
  targetYearId: number
  targetYearLabel: string
  sourceRecordCount: number
  sourceSectionSnapshot: Array<{
    name: string
    maxCapacity: number
    programType: ApplicantType
    sortOrder: number
    sectionRank: number | null
  }>
}): Promise<void> {
  const [
    sourceYear,
    targetYear,
    liveSourceRecords,
    sourceHistory,
    targetSections,
    targetRecords,
    targetAdvisers,
    activeAdvisersInSource,
    duplicateHistory,
  ] = await Promise.all([
    prisma.schoolYear.findUniqueOrThrow({ where: { id: input.sourceYearId } }),
    prisma.schoolYear.findUniqueOrThrow({ where: { id: input.targetYearId } }),
    prisma.enrollmentRecord.count({
      where: { schoolYearId: input.sourceYearId },
    }),
    prisma.enrollmentHistory.count({
      where: { schoolYearId: input.sourceYearId },
    }),
    prisma.section.findMany({
      where: { schoolYearId: input.targetYearId },
      orderBy: [
        { gradeLevel: { displayOrder: "asc" } },
        { sortOrder: "asc" },
      ],
      select: {
        name: true,
        maxCapacity: true,
        programType: true,
        sortOrder: true,
        sectionRank: true,
      },
    }),
    prisma.enrollmentRecord.count({
      where: { schoolYearId: input.targetYearId },
    }),
    prisma.sectionAdviser.count({
      where: { schoolYearId: input.targetYearId },
    }),
    prisma.sectionAdviser.count({
      where: {
        schoolYearId: input.sourceYearId,
        status: "ACTIVE",
      },
    }),
    prisma.enrollmentHistory.groupBy({
      by: ["learnerIdentifier", "schoolYearId"],
      where: { schoolYearId: input.sourceYearId },
      _count: { _all: true },
      having: {
        learnerIdentifier: {
          _count: { gt: 1 },
        },
      },
    }),
  ])

  assert.equal(sourceYear.status, "ARCHIVED")
  assert.equal(sourceYear.isEosyFinalized, true)
  assert.equal(targetYear.status, "ACTIVE")
  assert.equal(targetYear.yearLabel, input.targetYearLabel)
  assert.equal(liveSourceRecords, 0)
  assert.equal(sourceHistory, input.sourceRecordCount)
  assert.deepEqual(targetSections, input.sourceSectionSnapshot)
  assert.equal(targetRecords, 0)
  assert.equal(targetAdvisers, 0)
  assert.equal(activeAdvisersInSource, 0)
  assert.equal(duplicateHistory.length, 0)

  await verifyIntegrationFeeds(input.context, input.targetYearLabel)
}

async function runYearCycle(
  context: SimulationContext,
  cycleIndex: number,
  schoolYearId: number,
): Promise<RolloverResponse> {
  const sourceYear = await prisma.schoolYear.findUniqueOrThrow({
    where: { id: schoolYearId },
  })
  const sourceYearLabel = sourceYear.yearLabel
  const targetYearLabel = nextYearLabel(sourceYearLabel)

  await setPhase(context, schoolYearId, "OFFICIAL_ENROLLMENT")
  let confirmedContinuing = 0
  let incomingGradeSeven = 0
  let remedialResolved = { promoted: 0, retained: 0 }

  if (cycleIndex > 0) {
    remedialResolved = await resolveRemedialHolds(context, schoolYearId)
    confirmedContinuing = await confirmContinuingLearners(
      context,
      schoolYearId,
    )
    incomingGradeSeven = await addIncomingGradeSeven(schoolYearId)
  }

  const assignedAtBosy = await assignReadyLearners(context, schoolYearId)
  const baselineEnrollment = await countActiveEnrollment(schoolYearId)
  assert.ok(baselineEnrollment > 0)
  addCheckpoint(context.report, sourceYearLabel, "official-enrollment", {
    confirmedContinuing,
    incomingGradeSeven,
    assignedAtBosy,
    baselineEnrollment,
    remedialResolved,
  })

  await setPhase(context, schoolYearId, "CLASSES_ONGOING")
  const lateAdmissions = await addLateWalkIns(context, schoolYearId)
  const assignedLate = await assignReadyLearners(context, schoolYearId)
  assert.equal(assignedLate, lateAdmissions)
  const departures = await markDepartures(context, schoolYearId)
  const finalActiveTally = await countActiveEnrollment(schoolYearId)
  assert.equal(
    finalActiveTally,
    baselineEnrollment
      + lateAdmissions
      - departures.dropped
      - departures.transferred,
  )
  addCheckpoint(context.report, sourceYearLabel, "classes-ongoing", {
    baselineEnrollment,
    lateAdmissions,
    droppedLearners: departures.dropped,
    transferredLearners: departures.transferred,
    finalActiveTally,
  })

  await setPhase(context, schoolYearId, "EOSY_CLOSING")
  const targetPolicyId = await createApprovedCalendar(
    context,
    schoolYearId,
    targetYearLabel,
  )
  const blockedBeforeSmart = await getReadiness(
    context,
    schoolYearId,
    targetPolicyId,
  )
  assert.equal(blockedBeforeSmart.ready, false)
  assert.ok(
    blockedBeforeSmart.blockers.some((blocker) =>
      blocker.reasons.includes("SMART_OUTCOME_MISSING")
    ),
  )
  await verifyIntegrationFeeds(context, sourceYearLabel)

  await publishAndSyncSmartOutcomes(
    context,
    schoolYearId,
    sourceYearLabel,
  )
  const blockedBeforeForms = await getReadiness(
    context,
    schoolYearId,
    targetPolicyId,
  )
  assert.equal(blockedBeforeForms.ready, false)
  assert.ok(
    blockedBeforeForms.blockers.some((blocker) =>
      blocker.reasons.includes("SECTION_NOT_FINALIZED")
      || blocker.reasons.includes("SF5_NOT_RECORDED")
    ),
  )

  await finalizeAndRecordForms(context, schoolYearId)
  const ready = await getReadiness(
    context,
    schoolYearId,
    targetPolicyId,
  )
  assert.equal(ready.ready, true)
  addCheckpoint(context.report, sourceYearLabel, "eosy-ready", {
    sectionBlockers: ready.blockers.length,
    globalBlockers: ready.globalBlockers.length,
  })

  const sourceRecordCount = await prisma.enrollmentRecord.count({
    where: { schoolYearId },
  })
  const sourceSectionSnapshot = await prisma.section.findMany({
    where: { schoolYearId },
    orderBy: [
      { gradeLevel: { displayOrder: "asc" } },
      { sortOrder: "asc" },
    ],
    select: {
      name: true,
      maxCapacity: true,
      programType: true,
      sortOrder: true,
      sectionRank: true,
    },
  })
  const rollover = await executeRollover(
    context,
    schoolYearId,
    targetPolicyId,
    cycleIndex === 0,
  )
  assert.equal(rollover.year.yearLabel, targetYearLabel)

  await assertRolloverState({
    context,
    sourceYearId: schoolYearId,
    sourceYearLabel,
    targetYearId: rollover.year.id,
    targetYearLabel,
    sourceRecordCount,
    sourceSectionSnapshot,
  })
  addCheckpoint(context.report, sourceYearLabel, "atomic-rollover", {
    targetYearLabel,
    targetYearId: rollover.year.id,
    ...rollover.rolloverSummary,
  })

  context.report.years.push({
    sourceYear: sourceYearLabel,
    targetYear: targetYearLabel,
    baselineEnrollment,
    lateAdmissions,
    droppedLearners: departures.dropped,
    transferredLearners: departures.transferred,
    finalActiveTally,
    rollover: rollover.rolloverSummary,
  })
  return rollover
}

export async function runLifecycleSimulation(): Promise<void> {
  const report: SimulationReport = {
    startedAt: new Date().toISOString(),
    completedAt: null,
    database: "enrollpro",
    initialYear: INITIAL_YEAR_LABEL,
    finalYear: FINAL_YEAR_LABEL,
    success: false,
    checkpoints: [],
    years: [],
    failure: null,
  }
  const smartPayloads = new Map<number, SmartSectionPayload>()
  const smartServer = createSmartMockServer(smartPayloads)
  let appServer: Server | null = null

  try {
    const smart = await startHttpServer(smartServer)
    process.env.SMART_API_BASE_URL = smart.baseUrl
    process.env.SMART_API_KEY = "lifecycle-smart-service-key"

    const seed = await seedFoundation()
    const appInstance = await startHttpServer(createServer(app))
    appServer = appInstance.server
    const token = await login(appInstance.baseUrl)
    const context: SimulationContext = {
      baseUrl: appInstance.baseUrl,
      token,
      adminUserId: seed.adminUserId,
      smartPayloads,
      report,
    }

    addCheckpoint(report, INITIAL_YEAR_LABEL, "environment-seeded", {
      schoolYearId: seed.schoolYearId,
      learnerCount: await prisma.learner.count(),
      sectionCount: await prisma.section.count(),
      validLrnCount: await prisma.learner.count({
        where: { lrn: { not: null } },
      }),
    })

    let activeSchoolYearId = seed.schoolYearId
    for (let cycleIndex = 0; cycleIndex < 4; cycleIndex += 1) {
      const result = await runYearCycle(
        context,
        cycleIndex,
        activeSchoolYearId,
      )
      activeSchoolYearId = result.year.id
    }

    const finalYear = await prisma.schoolYear.findUniqueOrThrow({
      where: { id: activeSchoolYearId },
      include: {
        _count: {
          select: {
            sections: true,
            enrollmentRecords: true,
            enrollmentApplications: true,
          },
        },
      },
    })
    assert.equal(finalYear.yearLabel, FINAL_YEAR_LABEL)
    assert.equal(finalYear.status, "ACTIVE")
    assert.equal(finalYear._count.sections, 20)
    assert.equal(finalYear._count.enrollmentRecords, 0)
    assert.ok(finalYear._count.enrollmentApplications > 0)

    report.success = true
    report.completedAt = new Date().toISOString()
    addCheckpoint(report, FINAL_YEAR_LABEL, "simulation-complete", {
      activeSchoolYearId,
      sections: finalYear._count.sections,
      liveEnrollmentRecords: finalYear._count.enrollmentRecords,
      pendingApplications: finalYear._count.enrollmentApplications,
      completedRollovers: report.years.length,
    })
    await writeReport(report)
    console.log(`REPORT ${REPORT_PATH}`)
    console.log("PASS Four consecutive rollovers completed.")
  } catch (error: unknown) {
    report.failure = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack ?? null : null,
    }
    report.completedAt = new Date().toISOString()
    report.checkpoints.push({
      schoolYear:
        (
          await prisma.schoolSetting.findFirst({
            include: { activeSchoolYear: true },
          })
        )?.activeSchoolYear?.yearLabel ?? "UNKNOWN",
      stage: "simulation-failure",
      status: "FAIL",
      details: {
        message: report.failure.message,
      },
      recordedAt: new Date().toISOString(),
    })
    await writeReport(report)
    throw error
  } finally {
    if (appServer) await closeServer(appServer)
    await closeServer(smartServer)
    await prisma.$disconnect()
  }
}
