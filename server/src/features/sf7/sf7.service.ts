import axios from "axios";
import ExcelJS from "exceljs";
import type {
  Sf7AtlasSyncResponse,
  Sf7ImportCommitInput,
  Sf7ImportCommitResponse,
  Sf7ImportPreviewResponse,
  Sf7ImportPreviewRow,
  Sf7SchedulePeriodPreview,
} from "@enrollpro/shared";
import { prisma } from "../../lib/prisma.js";
import {
  TeacherFundingSource,
  TeacherNatureOfAppointment,
  Weekday,
} from "../../generated/prisma/index.js";

const DATA_START_ROW = 20;
const MAX_IMPORT_ROWS = 300;

type ImportFileKind = "XLSX" | "CSV";

interface Sf7ImportSource {
  fileName?: string | null;
  mimeType?: string | null;
}

interface ParsedSf7Row {
  rowNumber: number;
  employeeIdRaw: string | null;
  fullName: string | null;
  sex: string | null;
  fundingSource: string | null;
  plantillaPosition: string | null;
  natureOfAppointment: string | null;
  degree: string | null;
  undergraduateDegree: string | null;
  postgraduateDegree: string | null;
  majorSpecialization: string | null;
  minorSpecialization: string | null;
  assignmentText: string | null;
  dayText: string | null;
  startTimeText: string | null;
  endTimeText: string | null;
  weeklyMinutesText: string | null;
  remarks: string | null;
  schedulePeriods: Sf7SchedulePeriodPreview[];
}

interface EmployeeIdParseResult {
  value: string | null;
  issue: string | null;
}

const WEEKDAY_BY_LABEL: Record<string, Weekday> = {
  MON: "MONDAY",
  MONDAY: "MONDAY",
  TUE: "TUESDAY",
  TUESDAY: "TUESDAY",
  WED: "WEDNESDAY",
  WEDNESDAY: "WEDNESDAY",
  THU: "THURSDAY",
  THURSDAY: "THURSDAY",
  FRI: "FRIDAY",
  FRIDAY: "FRIDAY",
};

const FUNDING_BY_TEXT: Array<[RegExp, TeacherFundingSource]> = [
  [/SPECIAL\s+EDUCATION|SEF/i, "SPECIAL_EDUCATION_FUND"],
  [/LOCAL\s+SCHOOL\s+BOARD|LSB/i, "LOCAL_SCHOOL_BOARD"],
  [/\bPTA\b/i, "PTA"],
  [/\bNGO\b/i, "NGO"],
  [/NATIONAL/i, "NATIONAL"],
  [/OTHER/i, "OTHER"],
];

const NATURE_BY_TEXT: Array<[RegExp, TeacherNatureOfAppointment]> = [
  [/REGULAR|PERMANENT/i, "REGULAR_PERMANENT"],
  [/PROVISIONAL/i, "PROVISIONAL"],
  [/SUBSTITUTE/i, "SUBSTITUTE"],
  [/CONTRACTUAL|CONTRACT/i, "CONTRACTUAL"],
  [/VOLUNTEER/i, "VOLUNTEER"],
  [/LOCAL\s+SCHOOL\s+BOARD|LSB/i, "LOCAL_SCHOOL_BOARD"],
  [/OTHER/i, "OTHER"],
];

interface ExistingTeacherMatch {
  id: number;
  employeeId: string | null;
}

interface AtlasFaculty {
  id: number;
  employeeCode: string | null;
  employeeId: string | null;
  externalId: number | null;
}

interface AtlasScheduleEntry {
  facultyId: number | null;
  day: string | null;
  dayOfWeek: string | null;
  startTime: string | null;
  endTime: string | null;
  subjectCode: string | null;
  subjectName: string | null;
  sectionName: string | null;
  sectionLabel: string | null;
  sectionId: number | null;
}

interface AtlasFacultyResponse {
  faculty: AtlasFaculty[];
}

interface AtlasPublishedScheduleResponse {
  entries: AtlasScheduleEntry[];
}

function cleanText(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .normalize("NFC")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length > 0 ? normalized : null;
}

function upperText(value: string | null | undefined): string | null {
  const cleaned = cleanText(value);
  return cleaned ? cleaned.toUpperCase() : null;
}

function cellText(row: ExcelJS.Row, column: number): string | null {
  return cleanText(row.getCell(column).text);
}

function cellLines(row: ExcelJS.Row, column: number): string[] {
  const value = row.getCell(column).text;
  return value
    .split(/\r?\n/)
    .map((line) => cleanText(line))
    .filter((line): line is string => Boolean(line));
}

function parseEmployeeId(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

function parseEmployeeIdWithIssue(value: string | null): EmployeeIdParseResult {
  const cleaned = cleanText(value);
  const parsed = parseEmployeeId(cleaned);
  if (!cleaned) {
    return { value: null, issue: "Missing employee ID." };
  }
  if (!parsed) {
    return { value: null, issue: "Employee ID has no readable number." };
  }
  const issue =
    cleaned.replace(/\D/g, "") !== cleaned
      ? "Employee ID contains formatting characters; digits were used for matching."
      : parsed.length < 4
        ? "Employee ID is unusually short. Please verify the civil service identification number."
        : null;
  return { value: parsed, issue };
}

function parseSex(value: string | null): "MALE" | "FEMALE" | null {
  const text = upperText(value);
  if (!text) return null;
  if (text === "M" || text.includes("MALE")) return "MALE";
  if (text === "F" || text.includes("FEMALE")) return "FEMALE";
  return null;
}

function mapFundingSource(value: string | null): TeacherFundingSource | null {
  if (!value) return null;
  return FUNDING_BY_TEXT.find(([pattern]) => pattern.test(value))?.[1] ?? null;
}

function mapNature(value: string | null): TeacherNatureOfAppointment | null {
  if (!value) return null;
  return NATURE_BY_TEXT.find(([pattern]) => pattern.test(value))?.[1] ?? null;
}

function splitDegrees(value: string | null): {
  undergraduateDegree: string | null;
  postgraduateDegree: string | null;
} {
  const text = upperText(value);
  if (!text) return { undergraduateDegree: null, postgraduateDegree: null };
  const parts = text
    .split(/\s*(?:\/|;|\+|\n)\s*/)
    .map((part) => cleanText(part))
    .filter((part): part is string => Boolean(part));
  return {
    undergraduateDegree: parts[0] ?? null,
    postgraduateDegree: parts.slice(1).join(" / ") || null,
  };
}

function extractIndigenousCommunity(remarks: string | null): string | null {
  if (!remarks) return null;
  const match = remarks.match(/(?:IP|INDIGENOUS|ETHNIC(?:\s+GROUP)?)[:\s-]+([^;,\n]+)/i);
  return upperText(match?.[1] ?? null);
}

function normalizeTime(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/(\d{1,2})[:.](\d{2})\s*(AM|PM)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function minutesBetween(startTime: string, endTime: string): number {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  return Math.max(0, endHour * 60 + endMinute - (startHour * 60 + startMinute));
}

function parseDay(value: string | null): Weekday | null {
  if (!value) return null;
  return WEEKDAY_BY_LABEL[upperText(value) ?? ""] ?? null;
}

function parseSchedulePeriods(row: ExcelJS.Row): Sf7SchedulePeriodPreview[] {
  const days = cellLines(row, 14);
  const starts = cellLines(row, 15);
  const ends = cellLines(row, 16);
  const assignmentText = cellText(row, 13);
  const maxLength = Math.max(days.length, starts.length, ends.length);
  const periods: Sf7SchedulePeriodPreview[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    const dayOfWeek = parseDay(days[index] ?? days[0] ?? null);
    const startTime = normalizeTime(starts[index] ?? starts[0] ?? null);
    const endTime = normalizeTime(ends[index] ?? ends[0] ?? null);
    if (!dayOfWeek || !startTime || !endTime) continue;
    const minutes = minutesBetween(startTime, endTime);
    if (minutes <= 0) continue;
    periods.push({
      dayOfWeek,
      startTime,
      endTime,
      subjectLabel: assignmentText,
      sectionLabel: null,
      minutes,
    });
  }

  return periods;
}

function parseSchedulePeriodsFromValues(values: {
  dayText: string | null;
  startTimeText: string | null;
  endTimeText: string | null;
  assignmentText: string | null;
}): Sf7SchedulePeriodPreview[] {
  const days = values.dayText?.split(/\r?\n|;/).map(cleanText).filter((item): item is string => Boolean(item)) ?? [];
  const starts = values.startTimeText?.split(/\r?\n|;/).map(cleanText).filter((item): item is string => Boolean(item)) ?? [];
  const ends = values.endTimeText?.split(/\r?\n|;/).map(cleanText).filter((item): item is string => Boolean(item)) ?? [];
  const maxLength = Math.max(days.length, starts.length, ends.length);
  const periods: Sf7SchedulePeriodPreview[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    const dayOfWeek = parseDay(days[index] ?? days[0] ?? null);
    const startTime = normalizeTime(starts[index] ?? starts[0] ?? null);
    const endTime = normalizeTime(ends[index] ?? ends[0] ?? null);
    if (!dayOfWeek || !startTime || !endTime) continue;
    const minutes = minutesBetween(startTime, endTime);
    if (minutes <= 0) continue;
    periods.push({
      dayOfWeek,
      startTime,
      endTime,
      subjectLabel: upperText(values.assignmentText),
      sectionLabel: null,
      minutes,
    });
  }

  return periods;
}

function parsedRowFromWorksheet(row: ExcelJS.Row, rowNumber: number): ParsedSf7Row {
  const degree = cellText(row, 8);
  const degreeParts = splitDegrees(degree);
  const remarks = cellText(row, 18);
  return {
    rowNumber,
    employeeIdRaw: cellText(row, 1),
    fullName: cellText(row, 2),
    sex: cellText(row, 3),
    fundingSource: cellText(row, 4),
    plantillaPosition: cellText(row, 6),
    natureOfAppointment: cellText(row, 7),
    degree,
    undergraduateDegree: degreeParts.undergraduateDegree,
    postgraduateDegree: degreeParts.postgraduateDegree,
    majorSpecialization: cellText(row, 9),
    minorSpecialization: cellText(row, 11),
    assignmentText: cellText(row, 13),
    dayText: cellLines(row, 14).join("\n"),
    startTimeText: cellLines(row, 15).join("\n"),
    endTimeText: cellLines(row, 16).join("\n"),
    weeklyMinutesText: cellText(row, 17),
    remarks,
    schedulePeriods: parseSchedulePeriods(row),
  };
}

function parsedRowsFromCsv(buffer: Buffer): ParsedSf7Row[] {
  const rows = parseCsvText(buffer);
  const [headerRow, ...dataRows] = rows;
  if (!headerRow) return [];
  const headers = headerRow.map(normalizeCsvHeader);
  return dataRows.slice(0, MAX_IMPORT_ROWS).map((cells, index) => {
    const record: Record<string, string | null> = {};
    headers.forEach((header, cellIndex) => {
      if (header) record[header] = cleanText(cells[cellIndex] ?? null);
    });
    const degree = csvValue(record, ["Degree / Post Graduate", "Degree", "Education", "Educational Attainment"]);
    const degreeParts = splitDegrees(degree);
    const dayText = csvValue(record, ["Day", "Daily Program Day", "Teaching Day"]);
    const startTimeText = csvValue(record, ["Start Time", "From", "Time From"]);
    const endTimeText = csvValue(record, ["End Time", "To", "Time To"]);
    const assignmentText = csvValue(record, [
      "Subject Taught Advisory Class and Ancillary Assignment",
      "Assignment Text",
      "Assignment",
      "Subject",
    ]);

    return {
      rowNumber: index + 2,
      employeeIdRaw: csvValue(record, ["Employee No", "Employee Number", "Employee ID", "TIN", "Employee No / TIN"]),
      fullName: csvValue(record, ["Full Name", "Name", "Personnel Name", "Teacher Name"]),
      sex: csvValue(record, ["Sex", "Gender"]),
      fundingSource: csvValue(record, ["Fund Source", "Funding Source", "Fund"]),
      plantillaPosition: csvValue(record, [
        "Civil Service Plantilla Code",
        "Plantilla Position",
        "Position / Designation",
        "Position",
      ]),
      natureOfAppointment: csvValue(record, [
        "Nature of Appointment",
        "Employment Nature",
        "Employment Status",
        "Appointment Status",
      ]),
      degree,
      undergraduateDegree:
        csvValue(record, ["Undergraduate Degree", "Bachelor Degree"]) ?? degreeParts.undergraduateDegree,
      postgraduateDegree:
        csvValue(record, ["Postgraduate Degree", "Graduate Degree", "Post Graduate"]) ?? degreeParts.postgraduateDegree,
      majorSpecialization: csvValue(record, ["Major / Specialization", "Major", "Specialization"]),
      minorSpecialization: csvValue(record, ["Minor", "Minor Specialization"]),
      assignmentText,
      dayText,
      startTimeText,
      endTimeText,
      weeklyMinutesText: csvValue(record, ["Weekly Minutes", "Total Weekly Minutes", "Actual Teaching Minutes"]),
      remarks: csvValue(record, ["Remarks", "Administrative Remarks", "IP Community / Ethnic Group"]),
      schedulePeriods: parseSchedulePeriodsFromValues({
        dayText,
        startTimeText,
        endTimeText,
        assignmentText,
      }),
    };
  });
}

function buildPreviewRows(
  parsedRows: ParsedSf7Row[],
  teacherByEmployeeId: Map<string, ExistingTeacherMatch>,
): Sf7ImportPreviewRow[] {
  const employeeIdCounts = new Map<string, number>();
  parsedRows.forEach((row) => {
    const employeeId = parseEmployeeId(row.employeeIdRaw);
    if (employeeId) employeeIdCounts.set(employeeId, (employeeIdCounts.get(employeeId) ?? 0) + 1);
  });

  return parsedRows
    .map((sourceRow) => {
      const employeeIdResult = parseEmployeeIdWithIssue(sourceRow.employeeIdRaw);
      const employeeId = employeeIdResult.value;
      const fullName = upperText(sourceRow.fullName);
      if (!employeeId && !fullName) return null;

      const fundingSource = mapFundingSource(sourceRow.fundingSource);
      const natureOfAppointment = mapNature(sourceRow.natureOfAppointment);
      const importedWeeklyMinutes = parseWeeklyMinutes(sourceRow.weeklyMinutesText);
      const calculatedWeeklyMinutes = sourceRow.schedulePeriods.reduce(
        (sum, period) => sum + period.minutes,
        0,
      );
      const matchedTeacher = employeeId ? teacherByEmployeeId.get(employeeId) ?? null : null;
      const issues: string[] = [];

      if (employeeIdResult.issue) issues.push(employeeIdResult.issue);
      if (employeeId && (employeeIdCounts.get(employeeId) ?? 0) > 1) {
        issues.push("Duplicate employee number found in the uploaded file.");
      }
      if (employeeId && !matchedTeacher) issues.push("No matching EnrollPro teacher for employee ID.");
      if (!fundingSource) issues.push("Fund source could not be identified.");
      if (!natureOfAppointment) issues.push("Nature of appointment could not be identified.");
      if (!parseSex(sourceRow.sex)) issues.push("Sex value could not be identified.");
      if (importedWeeklyMinutes !== null && importedWeeklyMinutes !== calculatedWeeklyMinutes) {
        issues.push("Weekly minutes recalculated from daily program.");
      }

      return {
        rowNumber: sourceRow.rowNumber,
        teacherId: matchedTeacher?.id ?? null,
        matchStatus: !employeeId ? "MISSING_EMPLOYEE_ID" : matchedTeacher ? "MATCHED" : "NO_MATCH",
        employeeId,
        fullName,
        sex: parseSex(sourceRow.sex),
        fundingSource,
        plantillaPosition: upperText(sourceRow.plantillaPosition),
        natureOfAppointment,
        undergraduateDegree: upperText(sourceRow.undergraduateDegree),
        postgraduateDegree: upperText(sourceRow.postgraduateDegree),
        majorSpecialization: upperText(sourceRow.majorSpecialization),
        minorSpecialization: upperText(sourceRow.minorSpecialization),
        assignmentText: upperText(sourceRow.assignmentText),
        administrativeRemarks: cleanText(sourceRow.remarks),
        indigenousCommunity: extractIndigenousCommunity(sourceRow.remarks),
        schedulePeriods: sourceRow.schedulePeriods,
        importedWeeklyMinutes,
        calculatedWeeklyMinutes,
        issues,
      } satisfies Sf7ImportPreviewRow;
    })
    .filter((row): row is Sf7ImportPreviewRow => Boolean(row));
}

function parseWeeklyMinutes(value: string | null): number | null {
  if (!value) return null;
  const numeric = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

function detectImportFileKind(source?: Sf7ImportSource): ImportFileKind {
  const fileName = source?.fileName?.toLowerCase() ?? "";
  const mimeType = source?.mimeType?.toLowerCase() ?? "";
  if (fileName.endsWith(".csv") || mimeType.includes("csv")) return "CSV";
  return "XLSX";
}

function parseCsvText(buffer: Buffer): string[][] {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      if (row.some((cell) => cleanText(cell))) rows.push(row);
      row = [];
      current = "";
      continue;
    }
    current += char;
  }

  row.push(current);
  if (row.some((cell) => cleanText(cell))) rows.push(row);
  return rows;
}

function normalizeCsvHeader(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function csvValue(record: Record<string, string | null>, aliases: string[]): string | null {
  for (const alias of aliases) {
    const normalizedAlias = normalizeCsvHeader(alias);
    const value = record[normalizedAlias];
    if (value) return cleanText(value);
  }
  return null;
}

function toSummary(rows: Sf7ImportPreviewRow[]): Sf7ImportPreviewResponse["summary"] {
  return {
    totalRows: rows.length,
    matchedRows: rows.filter((row) => row.matchStatus === "MATCHED").length,
    missingEmployeeIdRows: rows.filter((row) => row.matchStatus === "MISSING_EMPLOYEE_ID").length,
    noMatchRows: rows.filter((row) => row.matchStatus === "NO_MATCH").length,
    issueCount: rows.reduce((sum, row) => sum + row.issues.length, 0),
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseAtlasFacultyResponse(value: unknown): AtlasFacultyResponse {
  if (!isObjectRecord(value)) return { faculty: [] };
  const rawFaculty = Array.isArray(value.faculty) ? value.faculty : [];
  return {
    faculty: rawFaculty
      .filter(isObjectRecord)
      .map((item) => ({
        id: readNumber(item.id) ?? readNumber(item.externalId) ?? 0,
        employeeCode: readString(item.employeeCode),
        employeeId: readString(item.employeeId),
        externalId: readNumber(item.externalId),
      }))
      .filter((item) => item.id > 0),
  };
}

function parseAtlasScheduleResponse(value: unknown): AtlasPublishedScheduleResponse {
  if (!isObjectRecord(value)) return { entries: [] };
  const rawEntries = Array.isArray(value.entries)
    ? value.entries
    : Array.isArray(value.assignments)
      ? value.assignments
      : [];
  return {
    entries: rawEntries.filter(isObjectRecord).map((item) => ({
      facultyId: readNumber(item.facultyId),
      day: readString(item.day),
      dayOfWeek: readString(item.dayOfWeek),
      startTime: readString(item.startTime),
      endTime: readString(item.endTime),
      subjectCode: readString(item.subjectCode),
      subjectName: readString(item.subjectName),
      sectionName: readString(item.sectionName),
      sectionLabel: readString(item.sectionLabel),
      sectionId: readNumber(item.sectionId),
    })),
  };
}

function normalizeAtlasEntry(entry: AtlasScheduleEntry): Sf7SchedulePeriodPreview | null {
  const dayOfWeek = parseDay(entry.dayOfWeek ?? entry.day);
  const startTime = normalizeTime(entry.startTime);
  const endTime = normalizeTime(entry.endTime);
  if (!dayOfWeek || !startTime || !endTime) return null;
  const minutes = minutesBetween(startTime, endTime);
  if (minutes <= 0) return null;
  return {
    dayOfWeek,
    startTime,
    endTime,
    subjectLabel: upperText(entry.subjectName ?? entry.subjectCode),
    sectionLabel: upperText(entry.sectionName ?? entry.sectionLabel ?? String(entry.sectionId ?? "")),
    minutes,
  };
}

export async function previewSf7Import(
  buffer: Buffer,
  source?: Sf7ImportSource,
): Promise<Sf7ImportPreviewResponse> {
  const teachers = await prisma.teacher.findMany({
    select: { id: true, employeeId: true },
  });
  const teacherByEmployeeId = new Map<string, ExistingTeacherMatch>();
  teachers.forEach((teacher) => {
    if (teacher.employeeId) teacherByEmployeeId.set(teacher.employeeId, teacher);
  });

  const parsedRows: ParsedSf7Row[] = [];
  const fileKind = detectImportFileKind(source);

  if (fileKind === "CSV") {
    parsedRows.push(...parsedRowsFromCsv(buffer));
  } else {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.getWorksheet("School Form 7 (SF7)") ?? workbook.worksheets[0];
    if (!worksheet) {
      throw new Error("SF7 workbook has no worksheet.");
    }

    const lastRow = Math.min(worksheet.rowCount, DATA_START_ROW + MAX_IMPORT_ROWS);
    for (let rowNumber = DATA_START_ROW; rowNumber <= lastRow; rowNumber += 1) {
      parsedRows.push(parsedRowFromWorksheet(worksheet.getRow(rowNumber), rowNumber));
    }
  }

  const rows = buildPreviewRows(parsedRows, teacherByEmployeeId);
  return { rows, summary: toSummary(rows) };
}

export async function commitSf7Import(
  input: Sf7ImportCommitInput,
): Promise<Sf7ImportCommitResponse> {
  const updatedTeacherIds: number[] = [];
  const skippedRows: Sf7ImportCommitResponse["skippedRows"] = [];

  for (const row of input.rows) {
    if (row.matchStatus !== "MATCHED" || !row.teacherId) {
      skippedRows.push({
        rowNumber: row.rowNumber,
        employeeId: row.employeeId,
        reason: "Row is not matched to an EnrollPro teacher.",
      });
      continue;
    }
    if (row.issues.some((issue) => issue.toUpperCase().includes("DUPLICATE EMPLOYEE NUMBER"))) {
      skippedRows.push({
        rowNumber: row.rowNumber,
        employeeId: row.employeeId,
        reason: "Duplicate employee number in uploaded file.",
      });
      continue;
    }

    await prisma.teacher.update({
      where: { id: row.teacherId },
      data: {
        plantillaPosition: row.plantillaPosition,
        undergraduateDegree: row.undergraduateDegree,
        postgraduateDegree: row.postgraduateDegree,
        majorSpecialization: row.majorSpecialization,
        minorSpecialization: row.minorSpecialization,
        administrativeRemarks: row.administrativeRemarks,
        indigenousCommunity: row.indigenousCommunity,
        ...(row.natureOfAppointment ? { natureOfAppointment: row.natureOfAppointment } : {}),
        ...(row.fundingSource ? { fundingSource: row.fundingSource } : {}),
      },
    });
    updatedTeacherIds.push(row.teacherId);
  }

  return {
    updatedCount: updatedTeacherIds.length,
    skippedCount: skippedRows.length,
    updatedTeacherIds,
    skippedRows,
  };
}

function atlasHeaders(): Record<string, string> {
  const key = process.env.ATLAS_API_KEY?.trim();
  return key ? { Authorization: `Bearer ${key}`, "X-Integration-Key": key } : {};
}

export async function syncSf7FromAtlas(
  schoolYearId: number,
): Promise<Sf7AtlasSyncResponse> {
  const settings = await prisma.schoolSetting.findFirst({
    select: { id: true, depedSchoolId: true },
  });
  const schoolId = process.env.ATLAS_SCHOOL_ID?.trim() || settings?.depedSchoolId || String(settings?.id ?? 1);
  const baseUrl = process.env.ATLAS_API_BASE_URL || "http://njgrm.buru-degree.ts.net:5001";
  const headers = atlasHeaders();

  const [teachers, facultyResponse] = await Promise.all([
    prisma.teacher.findMany({
      where: { isActive: true, serviceStatus: "ACTIVE" },
      select: { id: true, employeeId: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    axios.get<unknown>(`${baseUrl}/api/v1/faculty`, {
      params: { schoolId, schoolYearId },
      headers,
      timeout: 15000,
    }),
  ]);

  const atlasFaculty = parseAtlasFacultyResponse(facultyResponse.data).faculty;
  const results: Sf7AtlasSyncResponse["results"] = [];

  for (const teacher of teachers) {
    const teacherName = `${teacher.lastName}, ${teacher.firstName}`;
    const atlasMatch = atlasFaculty.find((faculty) => {
      if (teacher.employeeId && faculty.employeeCode === teacher.employeeId) return true;
      if (teacher.employeeId && faculty.employeeId === teacher.employeeId) return true;
      return faculty.externalId === teacher.id;
    });

    if (!atlasMatch) {
      results.push({
        teacherId: teacher.id,
        employeeId: teacher.employeeId,
        teacherName,
        status: "SKIPPED",
        periodCount: 0,
        totalWeeklyMinutes: 0,
        reason: "Teacher not found in ATLAS faculty list.",
      });
      continue;
    }

    try {
      const scheduleResponse = await axios.get<unknown>(
        `${baseUrl}/api/v1/schools/${schoolId}/schedules/published/faculty/${atlasMatch.id}`,
        {
          params: { schoolYearId },
          headers,
          timeout: 15000,
        },
      );
      const periods = parseAtlasScheduleResponse(scheduleResponse.data)
        .entries
        .map(normalizeAtlasEntry)
        .filter((period): period is Sf7SchedulePeriodPreview => Boolean(period));

      await prisma.$transaction(async (tx) => {
        await tx.teacherSchedulePeriod.deleteMany({
          where: { teacherId: teacher.id, schoolYearId },
        });
        if (periods.length > 0) {
          await tx.teacherSchedulePeriod.createMany({
            data: periods.map((period) => ({
              teacherId: teacher.id,
              schoolYearId,
              dayOfWeek: period.dayOfWeek,
              startTime: period.startTime,
              endTime: period.endTime,
              subjectLabel: period.subjectLabel,
              sectionLabel: period.sectionLabel,
            })),
          });
        }
      });

      results.push({
        teacherId: teacher.id,
        employeeId: teacher.employeeId,
        teacherName,
        status: "SYNCED",
        periodCount: periods.length,
        totalWeeklyMinutes: periods.reduce((sum, period) => sum + period.minutes, 0),
        reason: periods.length > 0 ? null : "ATLAS returned no published schedule periods.",
      });
    } catch (error: unknown) {
      results.push({
        teacherId: teacher.id,
        employeeId: teacher.employeeId,
        teacherName,
        status: "FAILED",
        periodCount: 0,
        totalWeeklyMinutes: 0,
        reason: error instanceof Error ? error.message : "ATLAS schedule request failed.",
      });
    }
  }

  return {
    schoolYearId,
    syncedCount: results.filter((result) => result.status === "SYNCED").length,
    skippedCount: results.filter((result) => result.status === "SKIPPED").length,
    failedCount: results.filter((result) => result.status === "FAILED").length,
    results,
  };
}
