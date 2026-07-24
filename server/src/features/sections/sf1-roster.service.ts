import ExcelJS from "exceljs";
import type {
  Sf1ImportCommitInput,
  Sf1ImportCommitResponse,
  Sf1ImportIssueCode,
  Sf1ImportPreviewResponse,
  Sf1ImportPreviewRow,
} from "@enrollpro/shared";
import { prisma } from "../../lib/prisma.js";
import {
  ApplicantType,
  EosyStatus,
  Prisma,
  SectioningMethod,
  Sex,
} from "../../generated/prisma/index.js";
import { ensureLearnerUserAccount } from "../learner/learner.service.js";

interface SectionContext {
  id: number;
  name: string;
  gradeLevelId: number;
  gradeLevelName: string;
  schoolYearId: number;
  programType: ApplicantType;
  maxCapacity: number;
}

interface ParsedSf1Row {
  rowNumber: number;
  genderGroup: Sex | null;
  lrn: string | null;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  extensionName: string | null;
  sex: Sex | null;
  birthdate: string | null;
  motherTongue: string | null;
  ipGroupName: string | null;
  religion: string | null;
  houseNoStreet: string | null;
  barangay: string | null;
  cityMunicipality: string | null;
  province: string | null;
  fatherName: string | null;
  motherName: string | null;
  guardianName: string | null;
  guardianRelationship: string | null;
  contactNumber: string | null;
}

interface ExistingLearnerIndex {
  learnerId: number | null;
  sectionId: number | null;
  sectionName: string | null;
}

const INACTIVE_EOSY_STATUSES: EosyStatus[] = ["TRANSFERRED_OUT", "DROPPED_OUT"];

const ACTIVE_ENROLLMENT_FILTER: Prisma.EnrollmentRecordWhereInput = {
  OR: [
    { eosyStatus: { equals: null } },
    { eosyStatus: { notIn: INACTIVE_EOSY_STATUSES } },
  ],
};

const REQUIRED_ROW_ISSUES: Array<{
  code: Sf1ImportIssueCode;
  message: string;
}> = [
  { code: "INVALID_LRN", message: "LRN must be exactly 12 numeric digits." },
  { code: "MISSING_NAME", message: "Learner name is missing or unreadable." },
  { code: "MISSING_BIRTHDATE", message: "Birthdate is missing or unreadable." },
  { code: "MISSING_SEX", message: "Sex is missing or unreadable." },
];

function cleanText(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value
    .normalize("NFC")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

function upperText(value: string | null | undefined): string | null {
  return cleanText(value)?.toUpperCase() ?? null;
}

function cellText(row: ExcelJS.Row, column: number): string | null {
  const text = row.getCell(column).text;
  return cleanText(text);
}

function cellRawText(row: ExcelJS.Row, column: number): string | null {
  const value = row.getCell(column).value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return String(value);
  return cellText(row, column);
}

function normalizeLrn(value: string | null): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length === 12 ? digits : null;
}

function findLrnColumn(row: ExcelJS.Row): number | null {
  for (let column = 1; column <= 24; column += 1) {
    const lrn = normalizeLrn(cellRawText(row, column));
    if (lrn) return column;
  }
  return null;
}

function parseSex(value: string | null, fallback: Sex | null): Sex | null {
  const text = upperText(value);
  if (!text) return fallback;
  if (text === "M" || text.includes("MALE")) return "MALE";
  if (text === "F" || text.includes("FEMALE")) return "FEMALE";
  return fallback;
}

function excelSerialToDate(serial: number): Date {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000);
}

function parseDateCell(row: ExcelJS.Row, column: number): string | null {
  const cell = row.getCell(column);
  const value = cell.value;
  let date: Date | null = null;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "number") {
    date = excelSerialToDate(value);
  } else {
    const text = cellText(row, column);
    if (text) {
      const parsed = new Date(text);
      if (!Number.isNaN(parsed.getTime())) date = parsed;
    }
  }

  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function parseName(value: string | null): {
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  extensionName: string | null;
} {
  const text = cleanText(value);
  if (!text) {
    return { firstName: null, lastName: null, middleName: null, extensionName: null };
  }

  const suffixMatch = text.match(/\b(JR\.?|SR\.?|I{2,3}|IV|V)\b$/i);
  const extensionName = suffixMatch ? suffixMatch[0].replace(/\.$/, "").toUpperCase() : null;
  const nameWithoutSuffix = suffixMatch
    ? cleanText(text.slice(0, suffixMatch.index))
    : text;

  if (nameWithoutSuffix?.includes(",")) {
    const [lastNameRaw, restRaw] = nameWithoutSuffix.split(",", 2);
    const restParts = cleanText(restRaw)?.split(" ").filter(Boolean) ?? [];
    return {
      lastName: upperText(lastNameRaw),
      firstName: upperText(restParts[0] ?? null),
      middleName: upperText(restParts.slice(1).join(" ") || null),
      extensionName,
    };
  }

  const parts = nameWithoutSuffix?.split(" ").filter(Boolean) ?? [];
  if (parts.length < 2) {
    return {
      firstName: upperText(nameWithoutSuffix),
      lastName: null,
      middleName: null,
      extensionName,
    };
  }

  return {
    firstName: upperText(parts.slice(0, -1).join(" ")),
    lastName: upperText(parts[parts.length - 1] ?? null),
    middleName: null,
    extensionName,
  };
}

function parseGenderAnchor(row: ExcelJS.Row): Sex | null {
  const values: string[] = [];
  for (let column = 1; column <= 10; column += 1) {
    const text = upperText(cellText(row, column));
    if (text) values.push(text);
  }
  const line = values.join(" ");
  if (/\bFEMALE\b|\bGIRL/.test(line)) return "FEMALE";
  if (/\bMALE\b|\bBOY/.test(line)) return "MALE";
  return null;
}

function nextNonEmptyCell(row: ExcelJS.Row, startColumn: number): string | null {
  for (let column = startColumn; column <= 24; column += 1) {
    const value = cellText(row, column);
    if (value) return value;
  }
  return null;
}

function parseSf1LearnerRow(row: ExcelJS.Row, genderGroup: Sex | null): ParsedSf1Row | null {
  const lrnColumn = findLrnColumn(row);
  if (!lrnColumn) return null;

  const isStandardSf1 = lrnColumn === 1;
  const fullName = isStandardSf1 ? cellText(row, 2) : nextNonEmptyCell(row, lrnColumn + 1);
  const parsedName = parseName(fullName);
  const sex = isStandardSf1 ? parseSex(cellText(row, 5), genderGroup) : genderGroup;

  return {
    rowNumber: row.number,
    genderGroup,
    lrn: normalizeLrn(cellRawText(row, lrnColumn)),
    fullName,
    firstName: parsedName.firstName,
    lastName: parsedName.lastName,
    middleName: parsedName.middleName,
    extensionName: parsedName.extensionName,
    sex,
    birthdate: isStandardSf1 ? parseDateCell(row, 6) : parseDateCell(row, lrnColumn + 2),
    motherTongue: isStandardSf1 ? upperText(cellText(row, 8)) : null,
    ipGroupName: isStandardSf1 ? upperText(cellText(row, 9)) : null,
    religion: isStandardSf1 ? upperText(cellText(row, 10)) : null,
    houseNoStreet: isStandardSf1 ? upperText(cellText(row, 11)) : null,
    barangay: isStandardSf1 ? upperText(cellText(row, 12)) : null,
    cityMunicipality: isStandardSf1 ? upperText(cellText(row, 13)) : null,
    province: isStandardSf1 ? upperText(cellText(row, 14)) : null,
    fatherName: isStandardSf1 ? upperText(cellText(row, 15)) : null,
    motherName: isStandardSf1 ? upperText(cellText(row, 16)) : null,
    guardianName: isStandardSf1 ? upperText(cellText(row, 17)) : null,
    guardianRelationship: isStandardSf1 ? upperText(cellText(row, 18)) : null,
    contactNumber: isStandardSf1 ? cellText(row, 19) : null,
  };
}

async function getSectionContext(sectionId: number): Promise<SectionContext | null> {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { gradeLevel: true },
  });
  if (!section) return null;
  return {
    id: section.id,
    name: section.name,
    gradeLevelId: section.gradeLevelId,
    gradeLevelName: section.gradeLevel.name,
    schoolYearId: section.schoolYearId,
    programType: section.programType,
    maxCapacity: section.maxCapacity,
  };
}

async function buildExistingLearnerIndex(
  rows: ParsedSf1Row[],
  schoolYearId: number,
): Promise<Map<string, ExistingLearnerIndex>> {
  const lrns = rows
    .map((row) => row.lrn)
    .filter((lrn): lrn is string => Boolean(lrn));

  if (lrns.length === 0) return new Map();

  const learners = await prisma.learner.findMany({
    where: { lrn: { in: Array.from(new Set(lrns)) } },
    select: {
      id: true,
      lrn: true,
    },
  });

  const activeRecords = await prisma.enrollmentRecord.findMany({
    where: {
      learnerId: { in: learners.map((learner) => learner.id) },
      schoolYearId,
      ...ACTIVE_ENROLLMENT_FILTER,
    },
    select: {
      learnerId: true,
      sectionId: true,
      section: { select: { name: true } },
    },
  });
  const activeRecordByLearnerId = new Map(
    activeRecords.map((record) => [record.learnerId, record]),
  );

  return new Map(
    learners
      .filter((learner) => learner.lrn)
      .map((learner) => {
        const activeRecord = activeRecordByLearnerId.get(learner.id);
        return [
          learner.lrn as string,
          {
            learnerId: learner.id,
            sectionId: activeRecord?.sectionId ?? null,
            sectionName: activeRecord?.section.name ?? null,
          },
        ];
      }),
  );
}

function issueMessage(code: Sf1ImportIssueCode, existingSectionName?: string | null): string {
  if (code === "CROSS_SECTION_CONFLICT") {
    return `LRN is already enrolled in ${existingSectionName ?? "another section"} for this school year.`;
  }
  if (code === "ALREADY_IN_SECTION") return "Learner is already listed in this section.";
  return REQUIRED_ROW_ISSUES.find((issue) => issue.code === code)?.message ?? "Review this row.";
}

function toPreviewRow(
  row: ParsedSf1Row,
  section: SectionContext,
  seenLrns: Set<string>,
  existingLearners: Map<string, ExistingLearnerIndex>,
): Sf1ImportPreviewRow {
  const issues: Sf1ImportIssueCode[] = [];
  const existing = row.lrn ? existingLearners.get(row.lrn) ?? null : null;

  if (!row.lrn) issues.push("INVALID_LRN");
  else if (seenLrns.has(row.lrn)) issues.push("DUPLICATE_IN_FILE");
  if (!row.firstName || !row.lastName) issues.push("MISSING_NAME");
  if (!row.birthdate) issues.push("MISSING_BIRTHDATE");
  if (!row.sex) issues.push("MISSING_SEX");
  if (existing?.sectionId && existing.sectionId !== section.id) {
    issues.push("CROSS_SECTION_CONFLICT");
  }
  if (existing?.sectionId === section.id) {
    issues.push("ALREADY_IN_SECTION");
  }

  if (row.lrn) seenLrns.add(row.lrn);

  const isBlocked = issues.length > 0;
  const matchStatus = isBlocked
    ? "BLOCKED"
    : existing?.learnerId
      ? "VALID_EXISTING_LEARNER"
      : "VALID_NEW_LEARNER";

  return {
    rowNumber: row.rowNumber,
    genderGroup: row.genderGroup,
    lrn: row.lrn,
    firstName: row.firstName,
    lastName: row.lastName,
    middleName: row.middleName,
    extensionName: row.extensionName,
    sex: row.sex,
    birthdate: row.birthdate,
    motherTongue: row.motherTongue,
    ipGroupName: row.ipGroupName,
    religion: row.religion,
    houseNoStreet: row.houseNoStreet,
    barangay: row.barangay,
    cityMunicipality: row.cityMunicipality,
    province: row.province,
    fatherName: row.fatherName,
    motherName: row.motherName,
    guardianName: row.guardianName,
    guardianRelationship: row.guardianRelationship,
    contactNumber: row.contactNumber,
    matchStatus,
    existingLearnerId: existing?.learnerId ?? null,
    existingSectionName: existing?.sectionName ?? null,
    issues,
    issueMessages: issues.map((issue) => issueMessage(issue, existing?.sectionName)),
  };
}

function summarizeRows(rows: Sf1ImportPreviewRow[]): Sf1ImportPreviewResponse["summary"] {
  return {
    totalRows: rows.length,
    validRows: rows.filter((row) => row.matchStatus !== "BLOCKED").length,
    newLearners: rows.filter((row) => row.matchStatus === "VALID_NEW_LEARNER").length,
    existingLearners: rows.filter((row) => row.matchStatus === "VALID_EXISTING_LEARNER").length,
    duplicateLrnRows: rows.filter((row) => row.issues.includes("DUPLICATE_IN_FILE")).length,
    crossSectionConflicts: rows.filter((row) => row.issues.includes("CROSS_SECTION_CONFLICT")).length,
    blockedRows: rows.filter((row) => row.matchStatus === "BLOCKED").length,
  };
}

export async function previewSf1RosterImport(
  sectionId: number,
  fileBuffer: Uint8Array,
): Promise<Sf1ImportPreviewResponse> {
  const section = await getSectionContext(sectionId);
  if (!section) throw new Error("Section not found.");

  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength,
  ) as ArrayBuffer;
  await workbook.xlsx.load(arrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("SF1 workbook has no worksheet.");

  const parsedRows: ParsedSf1Row[] = [];
  let genderGroup: Sex | null = null;

  worksheet.eachRow((row) => {
    const anchor = parseGenderAnchor(row);
    if (anchor) genderGroup = anchor;
    const parsed = parseSf1LearnerRow(row, genderGroup);
    if (parsed) parsedRows.push(parsed);
  });

  const existingLearners = await buildExistingLearnerIndex(parsedRows, section.schoolYearId);
  const seenLrns = new Set<string>();
  const rows = parsedRows.map((row) =>
    toPreviewRow(row, section, seenLrns, existingLearners),
  );

  return {
    section,
    summary: summarizeRows(rows),
    rows,
  };
}

function parseCommittedBirthdate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid birthdate.");
  return date;
}

function splitGuardianName(value: string | null): {
  firstName: string;
  lastName: string;
  middleName: string | null;
} | null {
  const parsed = parseName(value);
  if (!parsed.firstName || !parsed.lastName) return null;
  return {
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    middleName: parsed.middleName,
  };
}

export async function commitSf1RosterImport({
  sectionId,
  userId,
  input,
}: {
  sectionId: number;
  userId: number;
  input: Sf1ImportCommitInput;
}): Promise<Sf1ImportCommitResponse> {
  const section = await getSectionContext(sectionId);
  if (!section) throw new Error("Section not found.");

  const validRows = input.rows.filter(
    (row) => row.matchStatus !== "BLOCKED" && row.issues.length === 0,
  );
  const learnerIds: number[] = [];
  const skippedRows: Sf1ImportCommitResponse["skippedRows"] = [];
  let createdLearnerCount = 0;
  let reusedLearnerCount = 0;

  for (const row of validRows) {
    const lrn = row.lrn;
    const firstName = row.firstName;
    const lastName = row.lastName;
    const birthdate = row.birthdate;
    const sex = row.sex;

    if (!lrn || !firstName || !lastName || !birthdate || !sex) {
      skippedRows.push({
        rowNumber: row.rowNumber,
        lrn,
        reason: "Required learner information is incomplete.",
      });
      continue;
    }

    try {
      const commitResult = await prisma.$transaction(async (tx) => {
        const existingLearner = await tx.learner.findUnique({
          where: { lrn },
          select: { id: true },
        });
        const activeRecord = existingLearner
          ? await tx.enrollmentRecord.findFirst({
              where: {
                learnerId: existingLearner.id,
                schoolYearId: section.schoolYearId,
                ...ACTIVE_ENROLLMENT_FILTER,
              },
              select: { sectionId: true },
            })
          : null;

        if (activeRecord?.sectionId === section.id) {
          throw new Error("Learner is already listed in this section.");
        }
        if (activeRecord?.sectionId) {
          throw new Error("Learner is already enrolled in another section.");
        }

        const learner = existingLearner
          ? await tx.learner.update({
              where: { id: existingLearner.id },
              data: {
                firstName,
                lastName,
                middleName: row.middleName,
                extensionName: row.extensionName,
                birthdate: parseCommittedBirthdate(birthdate),
                sex,
                motherTongue: row.motherTongue,
                religion: row.religion,
                isIpCommunity: Boolean(row.ipGroupName),
                ipGroupName: row.ipGroupName,
              },
              select: {
                id: true,
                firstName: true,
                lastName: true,
                lrn: true,
                sex: true,
              },
            })
          : await tx.learner.create({
              data: {
                lrn,
                firstName,
                lastName,
                middleName: row.middleName,
                extensionName: row.extensionName,
                birthdate: parseCommittedBirthdate(birthdate),
                sex,
                motherTongue: row.motherTongue,
                religion: row.religion,
                isIpCommunity: Boolean(row.ipGroupName),
                ipGroupName: row.ipGroupName,
              },
              select: {
                id: true,
                firstName: true,
                lastName: true,
                lrn: true,
                sex: true,
              },
            });

        const application = await tx.enrollmentApplication.upsert({
          where: {
            uq_enrollment_learner_sy: {
              learnerId: learner.id,
              schoolYearId: section.schoolYearId,
            },
          },
          update: {
            gradeLevelId: section.gradeLevelId,
            applicantType: section.programType,
            assignedProgram: section.programType,
            learnerType: "NEW_ENROLLEE",
            admissionChannel: "F2F",
            status: "OFFICIALLY_ENROLLED",
            contactNumber: row.contactNumber,
            guardianName: row.guardianName,
            guardianRelationship: row.guardianRelationship,
            isPrivacyConsentGiven: true,
            encodedById: userId,
          },
          create: {
            learnerId: learner.id,
            schoolYearId: section.schoolYearId,
            gradeLevelId: section.gradeLevelId,
            applicantType: section.programType,
            assignedProgram: section.programType,
            learnerType: "NEW_ENROLLEE",
            admissionChannel: "F2F",
            status: "OFFICIALLY_ENROLLED",
            learningModalities: ["FACE_TO_FACE"],
            contactNumber: row.contactNumber,
            guardianName: row.guardianName,
            guardianRelationship: row.guardianRelationship,
            isPrivacyConsentGiven: true,
            encodedById: userId,
          },
        });

        await tx.applicationAddress.deleteMany({
          where: { enrollmentId: application.id },
        });
        if (row.houseNoStreet || row.barangay || row.cityMunicipality || row.province) {
          await tx.applicationAddress.create({
            data: {
              enrollmentId: application.id,
              addressType: "CURRENT",
              houseNoStreet: row.houseNoStreet,
              barangay: row.barangay,
              cityMunicipality: row.cityMunicipality,
              province: row.province,
            },
          });
        }

        await tx.applicationFamilyMember.deleteMany({
          where: { enrollmentId: application.id },
        });
        const guardian = splitGuardianName(row.guardianName);
        if (guardian) {
          await tx.applicationFamilyMember.create({
            data: {
              enrollmentId: application.id,
              relationship: "GUARDIAN",
              firstName: guardian.firstName,
              lastName: guardian.lastName,
              middleName: guardian.middleName,
              contactNumber: row.contactNumber,
            },
          });
        }

        await tx.enrollmentRecord.create({
          data: {
            enrollmentApplicationId: application.id,
            learnerId: learner.id,
            sectionId: section.id,
            schoolYearId: section.schoolYearId,
            enrolledById: userId,
            dateSectioned: new Date(),
            enrolledAt: new Date(),
            sectioningMethod: SectioningMethod.INLINE_SLOTTING,
            sf1Remarks: "SF1 roster import",
          },
        });

        await ensureLearnerUserAccount(tx, {
          id: learner.id,
          firstName: learner.firstName,
          lastName: learner.lastName,
          lrn: learner.lrn,
          sex: learner.sex,
        });

        return {
          learnerId: learner.id,
          wasCreated: !existingLearner,
        };
      });

      learnerIds.push(commitResult.learnerId);
      if (commitResult.wasCreated) createdLearnerCount += 1;
      else reusedLearnerCount += 1;
    } catch (error: unknown) {
      skippedRows.push({
        rowNumber: row.rowNumber,
        lrn: row.lrn,
        reason: error instanceof Error ? error.message : "Could not import this learner.",
      });
    }
  }

  return {
    committedCount: learnerIds.length,
    skippedCount: input.rows.length - learnerIds.length,
    createdLearnerCount,
    reusedLearnerCount,
    learnerIds,
    skippedRows,
  };
}
