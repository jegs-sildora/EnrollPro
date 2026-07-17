import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';
import { syncSf7FromAtlas } from '../sf7/sf7.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Shared Helper: Absolute Precision AutoFit
 * Scans ONLY learner data rows (filtering for 10+ digit numeric LRNs).
 * Sets column width to EXACTLY the maximum character length (1:1 Ratio).
 */
const applyAutoFit = (ws: ExcelJS.Worksheet, startRow: number, endRow: number, colCount: number) => {
  if (startRow > endRow) return;
  
  for (let i = 1; i <= colCount; i++) {
    const col = ws.getColumn(i);
    let maxCharLen = 0;
    
    for (let r = startRow; r <= endRow; r++) {
      const row = ws.getRow(r);
      const cell = row.getCell(i);
      
      if (cell.isMerged) continue;

      const lrnVal = row.getCell(1).value?.toString() || '';
      if (!lrnVal || lrnVal.length < 10 || isNaN(Number(lrnVal.trim()))) continue;

      const val = cell.value;
      if (val !== null && val !== undefined && val !== '') {
        const str = val.toString();
        const len = Math.max(...str.split('\n').map(l => l.length));
        if (len > maxCharLen) maxCharLen = len;
      }
    }
    
    if (maxCharLen > 0) {
      col.width = maxCharLen; 
    } else {
      col.width = 10;
    }
  }
};

export const exportSF1 = async (req: Request, res: Response) => {
  const { sectionId } = req.params;

  if (typeof sectionId !== 'string') {
    res.status(400).json({ message: 'Invalid Section ID' });
    return;
  }

  try {
    const section = await prisma.section.findUnique({
      where: { id: parseInt(sectionId, 10) },
      include: { gradeLevel: true, schoolYear: true }
    });

    if (!section) return res.status(404).json({ message: 'Section not found' });

    const enrollmentRecords = await prisma.enrollmentRecord.findMany({
      where: { sectionId: section.id },
      include: {
        enrollmentApplication: {
          include: { 
            learner: true, 
            addresses: true, 
            familyMembers: true 
          }
        }
      }
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('SF1');
    
    const formatDate = (d: Date | null) => d ? `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}` : '';
    
    const getFullName = (l: { lastName: string; firstName: string; middleName?: string | null; extensionName?: string | null }) => {
      const middleName = l.middleName ? ` ${l.middleName}` : '';
      const extensionName = l.extensionName ? ` ${l.extensionName}` : '';
      return `${l.lastName.toUpperCase()}, ${l.firstName.toUpperCase()}${middleName.toUpperCase()}${extensionName.toUpperCase()}`;
    };

    const getAddressParts = (addresses: { addressType: string; houseNoStreet?: string | null; street?: string | null; sitio?: string | null; barangay?: string | null; cityMunicipality?: string | null; province?: string | null }[]) => {
      const addr = addresses.find(a => a.addressType === 'CURRENT') || addresses.find(a => a.addressType === 'PERMANENT') || addresses[0];
      if (!addr) return { street: '', barangay: '', city: '', province: '' };
      return {
        street: [addr.houseNoStreet, addr.street, addr.sitio].filter(Boolean).join(' '),
        barangay: addr.barangay || '',
        city: addr.cityMunicipality || '',
        province: addr.province || ''
      };
    };

    type FamilyMember = { relationship: string; lastName: string; firstName: string; middleName?: string | null; maidenName?: string | null };
    const getFamilyInfo = (familyMembers: FamilyMember[], app: { hasNoFather?: boolean; hasNoMother?: boolean; guardianRelationship?: string | null }) => {
      const father = familyMembers.find(m => m.relationship === 'FATHER');
      const mother = familyMembers.find(m => m.relationship === 'MOTHER');
      const guardian = familyMembers.find(m => m.relationship === 'GUARDIAN');
      
      const formatMember = (m: FamilyMember) => `${m.lastName.toUpperCase()}, ${m.firstName.toUpperCase()}${m.middleName ? ' ' + m.middleName.toUpperCase() : ''}`;

      const fatherName = father ? formatMember(father) : (app.hasNoFather ? 'N/A' : '');
      const motherName = mother ? formatMember(mother) : (app.hasNoMother ? 'N/A' : '');
      const guardianName = guardian ? formatMember(guardian) : '';
      const guardianRel = app.guardianRelationship || '';

      return { fatherName, motherName, guardianName, guardianRel };
    };

    const calculateAge = (birthdate: Date, classOpeningDate: Date | null) => {
      const refDate = classOpeningDate ? new Date(classOpeningDate) : new Date();
      let age = refDate.getFullYear() - birthdate.getFullYear();
      const m = refDate.getMonth() - birthdate.getMonth();
      if (m < 0 || (m === 0 && refDate.getDate() < birthdate.getDate())) age--;
      return age;
    };

    type RecordForRemarks = { transferOutDate?: Date | null; dropOutDate?: Date | null; sf1Remarks?: string | null; enrollmentApplication: { applicantType: string; learnerType: string; learner: { is4PsBeneficiary: boolean; isBalikAral: boolean; isLearnerWithDisability: boolean; specialNeedsCategory?: string | null } } };
    const getRemarks = (record: RecordForRemarks) => {
      const remarks = [];
      const { enrollmentApplication: app } = record;
      const { learner } = app;

      if (record.transferOutDate) remarks.push(`T/O ${formatDate(record.transferOutDate)}`);
      if (app.applicantType === 'TRANSFEREE' || app.learnerType === 'TRANSFEREE') remarks.push('T/I');
      if (record.dropOutDate) remarks.push(`DRP ${formatDate(record.dropOutDate)}`);
      if (app.applicantType === 'LATE_ENROLLEE') remarks.push('LE');
      if (learner.is4PsBeneficiary) remarks.push('CCT');
      if (learner.isBalikAral || app.learnerType === 'RETURNING') remarks.push('B/A');
      if (learner.isLearnerWithDisability) remarks.push(`SNED (${learner.specialNeedsCategory || 'Unspecified'})`);
      
      if (record.sf1Remarks) remarks.push(record.sf1Remarks);

      return remarks.join('; ') || 'Registered';
    };

    // 1. Titles (Merged)
    worksheet.mergeCells('A1:S1');
    worksheet.getCell('A1').value = 'School Form 1 (SF 1) School Register';
    worksheet.getCell('A1').font = { bold: true, size: 12, name: 'Arial Narrow' };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.mergeCells('A2:S2');
    worksheet.getCell('A2').value = '(This replaces Form 1, Master List & STS Form 2-Family Background and Profile)';
    worksheet.getCell('A2').font = { italic: true, size: 8, name: 'Arial Narrow' };
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    // 2. Metadata
    const m4 = worksheet.getRow(4);
    m4.getCell(1).value = 'School Year:'; m4.getCell(2).value = section.schoolYear.yearLabel;
    m4.getCell(7).value = 'Grade Level:'; m4.getCell(8).value = section.gradeLevel.name;
    m4.getCell(11).value = 'Section:'; m4.getCell(12).value = section.name;
    m4.font = { size: 8, name: 'Arial Narrow' };

    // 3. Merged Headers
    const styleHeader = (cell: ExcelJS.Cell) => {
      cell.font = { bold: true, size: 7, name: 'Arial Narrow' };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    };

    const vMerges = [
      { col: 'A', v: 'LRN' }, { col: 'B', v: 'NAME\n(Last Name, First Name, Middle Name)' },
      { col: 'C', v: 'Sex (M/F)' }, { col: 'D', v: 'BIRTH DATE\n(mm/dd/yyyy)' },
      { col: 'E', v: 'AGE as of 1st Friday June' }, { col: 'F', v: 'MOTHER TONGUE (Grade 1 to 3 Only)' },
      { col: 'G', v: 'IP\n(Ethnic Group)' }, { col: 'H', v: 'RELIGION' },
      { col: 'Q', v: 'Contact Number of Parent or Guardian' }, { col: 'R', v: 'Learning Modality' },
      { col: 'S', v: 'REMARKS\n(Please refer to the legend on last page)' }
    ];

    vMerges.forEach(m => {
      worksheet.mergeCells(`${m.col}5:${m.col}6`);
      worksheet.getCell(`${m.col}5`).value = m.v;
      styleHeader(worksheet.getCell(`${m.col}5`));
      styleHeader(worksheet.getCell(`${m.col}6`));
    });

    worksheet.mergeCells('I5:L5'); worksheet.getCell('I5').value = 'ADDRESS'; styleHeader(worksheet.getCell('I5'));
    worksheet.getCell('I6').value = 'House #/ Street/ Sitio/ Purok'; worksheet.getCell('J6').value = 'Barangay';
    worksheet.getCell('K6').value = 'Municipality/ City'; worksheet.getCell('L6').value = 'Province';
    ['I6', 'J6', 'K6', 'L6'].forEach(c => styleHeader(worksheet.getCell(c)));

    worksheet.mergeCells('M5:N5'); worksheet.getCell('M5').value = 'PARENTS'; styleHeader(worksheet.getCell('M5'));
    worksheet.getCell('M6').value = "Father's Name (Last, First, Middle)"; worksheet.getCell('N6').value = "Mother's Maiden Name (Last, First, Middle)";
    ['M6', 'N6'].forEach(c => styleHeader(worksheet.getCell(c)));

    worksheet.mergeCells('O5:P5'); worksheet.getCell('O5').value = 'GUARDIAN\n(if Not Parent)'; styleHeader(worksheet.getCell('O5'));
    worksheet.getCell('O6').value = 'Name'; worksheet.getCell('P6').value = 'Relationship';
    ['O6', 'P6'].forEach(c => styleHeader(worksheet.getCell(c)));

    // 4. Data with Strict DepEd Sorting: Boys (A-Z) first, followed by Girls (A-Z)
    const sorted = enrollmentRecords.sort((a, b) => {
      const learnerA = a.enrollmentApplication.learner;
      const learnerB = b.enrollmentApplication.learner;

      // Group by Sex (M before F)
      if (learnerA.sex !== learnerB.sex) {
        return learnerA.sex === "MALE" ? -1 : 1;
      }

      // Within same sex, sort by Last Name
      return learnerA.lastName.localeCompare(learnerB.lastName);
    });

    let currentRow = 7;
    sorted.forEach((record) => {
      const app = record.enrollmentApplication;
      const l = app.learner;
      const ad = getAddressParts(app.addresses);
      const fam = getFamilyInfo(app.familyMembers, app);
      const row = worksheet.getRow(currentRow);
      
      row.getCell(1).value = l.lrn;
      row.getCell(2).value = getFullName(l);
      row.getCell(3).value = l.sex === 'MALE' ? 'M' : 'F';
      row.getCell(4).value = formatDate(l.birthdate);
      row.getCell(5).value = calculateAge(l.birthdate, section.schoolYear.classOpeningDate);
      row.getCell(6).value = l.motherTongue;
      row.getCell(7).value = l.isIpCommunity ? (l.ipGroupName || 'Yes') : 'No';
      row.getCell(8).value = l.religion;
      row.getCell(9).value = ad.street; row.getCell(10).value = ad.barangay;
      row.getCell(11).value = ad.city; row.getCell(12).value = ad.province;
      row.getCell(13).value = fam.fatherName; row.getCell(14).value = fam.motherName;
      row.getCell(15).value = fam.guardianName; row.getCell(16).value = fam.guardianRel;
      row.getCell(17).value = app.contactNumber;
      row.getCell(18).value = app.learningModalities?.join(', ');
      row.getCell(19).value = getRemarks(record);
      
      row.eachCell({ includeEmpty: true }, (c, cn) => {
        if (cn > 19) return;
        c.font = { name: 'Arial Narrow', size: 8 };
        c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
      currentRow++;
    });

    // 5. Finalize
    worksheet.pageSetup = { orientation: 'landscape', paperSize: 14 as ExcelJS.PaperSize, fitToPage: false };
    applyAutoFit(worksheet, 7, currentRow, 19);
    worksheet.getColumn(5).width = 3.14; // Fixed Age width

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="SF1_${section.name.replace(/\s+/g, '_')}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('SF1 Export Error:', error);
    if (!res.headersSent) res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const exportLisMaster = async (req: Request, res: Response) => {
  try {
    const records = await prisma.enrollmentRecord.findMany({
      include: { enrollmentApplication: { include: { learner: true } }, section: true, schoolYear: true }
    });
    if (records.length === 0) return res.status(404).json({ message: 'No records found' });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Master');
    const headers = ['LRN', 'Last Name', 'First Name', 'Sex', 'Birth Date', 'Status'];
    const hRow = worksheet.getRow(1);
    headers.forEach((h, i) => {
      const cell = hRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, name: 'Arial Narrow', size: 10 };
      cell.alignment = { horizontal: 'center' };
    });

    records.forEach((r, i) => {
      const l = r.enrollmentApplication.learner;
      const row = worksheet.getRow(i + 2);
      row.getCell(1).value = l.lrn;
      row.getCell(2).value = l.lastName.toUpperCase();
      row.getCell(3).value = l.firstName.toUpperCase();
      row.getCell(4).value = l.sex === 'MALE' ? 'M' : 'F';
      row.getCell(6).value = r.enrollmentApplication.status;
      row.eachCell(c => {
        c.font = { name: 'Arial Narrow', size: 9 };
        c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
    });

    applyAutoFit(worksheet, 1, records.length + 2, headers.length);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="LIS_Master.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Master Export Error:', error);
    if (!res.headersSent) res.status(500).json({ message: 'Internal Server Error' });
  }
};

const SF7_TEMPLATE_FILE =
  'School Form 7 (SF7) School Personnel Assignment List and Basic Profile.xlsx';

const SF7_WEEKDAY_ORDER: Record<string, number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
};

const sf7FundingLabels: Record<string, string> = {
  NATIONAL: 'National',
  SPECIAL_EDUCATION_FUND: 'Special Education Fund',
  LOCAL_SCHOOL_BOARD: 'Local School Board',
  PTA: 'PTA',
  NGO: 'NGO',
  OTHER: 'Other',
};

const sf7NatureLabels: Record<string, string> = {
  REGULAR_PERMANENT: 'Regular / Permanent',
  PROVISIONAL: 'Provisional',
  SUBSTITUTE: 'Substitute',
  CONTRACTUAL: 'Contractual',
  VOLUNTEER: 'Volunteer',
  LOCAL_SCHOOL_BOARD: 'Local School Board',
  OTHER: 'Other',
};

const sf7DayLabels: Record<string, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
};

function minutesFromTimeLabel(value: string): number {
  const [hoursRaw, minutesRaw] = value.split(':');
  return Number(hoursRaw) * 60 + Number(minutesRaw);
}

function calculateSf7PeriodMinutes(startTime: string, endTime: string): number {
  return Math.max(0, minutesFromTimeLabel(endTime) - minutesFromTimeLabel(startTime));
}

function formatTeacherFullName(teacher: {
  lastName: string;
  firstName: string;
  middleName: string | null;
  suffix: string | null;
}): string {
  const middle = teacher.middleName ? ` ${teacher.middleName}` : '';
  const suffix = teacher.suffix ? ` ${teacher.suffix}` : '';
  return `${teacher.lastName}, ${teacher.firstName}${middle}${suffix}`.toUpperCase();
}

function isTeachingPersonnel(teacher: {
  personnelType: string | null;
  functionalAssignment: string | null;
  plantillaPosition: string | null;
  designation: string | null;
}): boolean {
  const haystack = [
    teacher.personnelType,
    teacher.functionalAssignment,
    teacher.plantillaPosition,
    teacher.designation,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toUpperCase();

  return (
    haystack.includes('TEACH') ||
    haystack.includes('MASTER TEACHER') ||
    haystack.includes('HEAD TEACHER') ||
    haystack.includes('SCHOOL HEAD')
  );
}

function plantillaSortRank(position: string | null): number {
  const text = position?.toUpperCase() ?? '';
  if (text.includes('PRINCIPAL')) return 100;
  if (text.includes('HEAD TEACHER')) return 90;
  if (text.includes('MASTER TEACHER')) return 80;
  if (text.includes('TEACHER III')) return 73;
  if (text.includes('TEACHER II')) return 72;
  if (text.includes('TEACHER I')) return 71;
  if (text.includes('ADMINISTRATIVE')) return 60;
  if (text.includes('REGISTRAR')) return 55;
  if (text.includes('AIDE')) return 40;
  return 10;
}

function pushCount(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function writeSummaryPairs(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  labelColumn: number,
  countColumn: number,
  rows: Array<[string, number]>,
): void {
  rows.slice(0, 5).forEach(([label, count], index) => {
    const row = worksheet.getRow(startRow + index);
    row.getCell(labelColumn).value = label;
    row.getCell(countColumn).value = count;
  });
}

interface Sf7SchedulePeriod {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  subjectLabel: string | null;
  sectionLabel: string | null;
}

interface Sf7MergeRange {
  startColumn: string;
  startRow: number;
  endColumn: string;
  endRow: number;
  raw: string;
}

interface Sf7PersonnelTile {
  startRow: number;
  endRow: number;
}

function sortSchedulePeriods(periods: Sf7SchedulePeriod[]): Sf7SchedulePeriod[] {
  return [...periods].sort((a, b) => {
    const dayDifference =
      (SF7_WEEKDAY_ORDER[a.dayOfWeek] ?? 99) -
      (SF7_WEEKDAY_ORDER[b.dayOfWeek] ?? 99);
    if (dayDifference !== 0) return dayDifference;
    return a.startTime.localeCompare(b.startTime);
  });
}

function joinNonEmpty(values: Array<string | null | undefined>, separator = '; '): string {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(separator);
}

function degreeColumnValue(
  undergraduateDegree: string | null | undefined,
  postgraduateDegree: string | null | undefined,
): string {
  return joinNonEmpty([undergraduateDegree, postgraduateDegree], ' / ');
}

function formatTeachingLoadLine(period: Sf7SchedulePeriod): string {
  const section = period.sectionLabel?.trim();
  const subject = period.subjectLabel?.trim();
  if (section && subject) return `${section} - ${subject}`;
  if (section) return section;
  if (subject) return subject;
  return '';
}

function detailedServiceRemark(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return /\b(DETAILED|BORROWED|ORIGINATING|MOTHER\s+SCHOOL|FROM\s+SCHOOL|FROM\s+OFFICE)\b/i.test(trimmed)
    ? trimmed
    : null;
}

function buildSf7Remarks(teacher: {
  administrativeRemarks: string | null;
  indigenousCommunity: string | null;
}): string {
  return joinNonEmpty([
    teacher.indigenousCommunity
      ? `IP Community / Ethnic Group: ${teacher.indigenousCommunity}`
      : null,
    detailedServiceRemark(teacher.administrativeRemarks),
  ], '\n');
}

function parseSf7MergeRange(range: string): Sf7MergeRange | null {
  const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!match) return null;
  return {
    startColumn: match[1] ?? '',
    startRow: Number(match[2]),
    endColumn: match[3] ?? '',
    endRow: Number(match[4]),
    raw: range,
  };
}

function shiftSf7MergeRange(range: Sf7MergeRange, rowOffset: number): string {
  return `${range.startColumn}${range.startRow + rowOffset}:${range.endColumn}${range.endRow + rowOffset}`;
}

function getSf7MergeRanges(worksheet: ExcelJS.Worksheet): Sf7MergeRange[] {
  return (worksheet.model.merges ?? [])
    .map(parseSf7MergeRange)
    .filter((range): range is Sf7MergeRange => Boolean(range));
}

function getSf7PersonnelTiles(worksheet: ExcelJS.Worksheet): Sf7PersonnelTile[] {
  return getSf7MergeRanges(worksheet)
    .filter((range) => range.startColumn === 'A' && range.endColumn === 'A')
    .filter((range) => range.startRow >= 20 && range.endRow > range.startRow)
    .map((range) => ({ startRow: range.startRow, endRow: range.endRow }))
    .sort((left, right) => left.startRow - right.startRow);
}

function cloneSf7Style(style: Partial<ExcelJS.Style>): Partial<ExcelJS.Style> {
  return JSON.parse(JSON.stringify(style)) as Partial<ExcelJS.Style>;
}

function cloneSf7Value(value: ExcelJS.CellValue): ExcelJS.CellValue {
  if (value instanceof Date) return new Date(value.getTime());
  if (value && typeof value === 'object') {
    return JSON.parse(JSON.stringify(value)) as ExcelJS.CellValue;
  }
  return value;
}

function copySf7TemplateRow(
  worksheet: ExcelJS.Worksheet,
  sourceRowNumber: number,
  targetRowNumber: number,
): void {
  const sourceRow = worksheet.getRow(sourceRowNumber);
  const targetRow = worksheet.getRow(targetRowNumber);
  targetRow.height = sourceRow.height;

  for (let column = 1; column <= 19; column += 1) {
    const sourceCell = sourceRow.getCell(column);
    const targetCell = targetRow.getCell(column);
    targetCell.value = cloneSf7Value(sourceCell.value);
    targetCell.style = cloneSf7Style(sourceCell.style);
    targetCell.numFmt = sourceCell.numFmt;
  }
}

function duplicateSf7PersonnelTile(
  worksheet: ExcelJS.Worksheet,
  sourceTile: Sf7PersonnelTile,
  insertAtRow: number,
): Sf7PersonnelTile {
  const rowCount = sourceTile.endRow - sourceTile.startRow + 1;
  const existingRanges = getSf7MergeRanges(worksheet);
  const rangesToShift = existingRanges.filter((range) => range.startRow >= insertAtRow);
  const sourceTileRanges = existingRanges.filter(
    (range) => range.startRow >= sourceTile.startRow && range.endRow <= sourceTile.endRow,
  );

  rangesToShift.forEach((range) => worksheet.unMergeCells(range.raw));
  worksheet.spliceRows(insertAtRow, 0, ...Array.from({ length: rowCount }, () => []));

  for (let offset = 0; offset < rowCount; offset += 1) {
    copySf7TemplateRow(worksheet, sourceTile.startRow + offset, insertAtRow + offset);
  }

  rangesToShift.forEach((range) => {
    worksheet.mergeCells(shiftSf7MergeRange(range, rowCount));
  });

  const newTile: Sf7PersonnelTile = {
    startRow: insertAtRow,
    endRow: insertAtRow + rowCount - 1,
  };

  sourceTileRanges.forEach((range) => {
    worksheet.mergeCells(shiftSf7MergeRange(range, newTile.startRow - sourceTile.startRow));
  });

  return newTile;
}

function ensureSf7PersonnelTiles(
  worksheet: ExcelJS.Worksheet,
  requiredCount: number,
): Sf7PersonnelTile[] {
  const tiles = getSf7PersonnelTiles(worksheet);
  const sourceTile = tiles[tiles.length - 1] ?? null;
  if (!sourceTile) {
    throw new Error('SF7 template has no personnel data tile.');
  }

  while (tiles.length < requiredCount) {
    const lastTile = tiles[tiles.length - 1] ?? sourceTile;
    tiles.push(duplicateSf7PersonnelTile(worksheet, sourceTile, lastTile.endRow + 1));
  }

  return tiles;
}

function applySf7DataAlignment(cell: ExcelJS.Cell): void {
  cell.alignment = {
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true,
    textRotation: 0,
  };
}

function setSf7CellValue(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  columnNumber: number,
  value: string | number,
): void {
  const cell = worksheet.getRow(rowNumber).getCell(columnNumber);
  cell.value = value === '' ? null : value;
  applySf7DataAlignment(cell);
}

function appendSf7CellLine(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  columnNumber: number,
  value: string,
): void {
  if (!value.trim()) return;
  const cell = worksheet.getRow(rowNumber).getCell(columnNumber);
  const current = typeof cell.value === 'string' || typeof cell.value === 'number'
    ? String(cell.value)
    : '';
  cell.value = current ? `${current}\n${value}` : value;
  applySf7DataAlignment(cell);
}

function clearSf7TileData(worksheet: ExcelJS.Worksheet, tile: Sf7PersonnelTile): void {
  [1, 2, 3, 4, 6, 7, 8, 9, 11, 18].forEach((column) => {
    worksheet.getRow(tile.startRow).getCell(column).value = null;
  });

  for (let rowNumber = tile.startRow; rowNumber < tile.endRow; rowNumber += 1) {
    for (let column = 13; column <= 17; column += 1) {
      worksheet.getRow(rowNumber).getCell(column).value = null;
    }
  }
}

function writeSf7ScheduleRows(
  worksheet: ExcelJS.Worksheet,
  tile: Sf7PersonnelTile,
  periods: Sf7SchedulePeriod[],
  advisoryClass: string | null,
  ancillary: string | null,
): void {
  const availableRows = Math.max(1, tile.endRow - tile.startRow);
  const extraAssignments = [
    advisoryClass ? `Advisory Class: ${advisoryClass}` : null,
    ancillary ? `Ancillary Assignment: ${ancillary}` : null,
  ].filter((value): value is string => Boolean(value));
  let writtenLines = 0;

  periods.forEach((period) => {
    const targetRow = tile.startRow + Math.min(writtenLines, availableRows - 1);
    appendSf7CellLine(worksheet, targetRow, 13, formatTeachingLoadLine(period));
    appendSf7CellLine(worksheet, targetRow, 14, sf7DayLabels[period.dayOfWeek] ?? period.dayOfWeek);
    appendSf7CellLine(worksheet, targetRow, 15, period.startTime);
    appendSf7CellLine(worksheet, targetRow, 16, period.endTime);
    writtenLines += 1;
  });

  extraAssignments.forEach((assignment) => {
    const targetRow = tile.startRow + Math.min(writtenLines, availableRows - 1);
    appendSf7CellLine(worksheet, targetRow, 13, assignment);
    writtenLines += 1;
  });
}

async function refreshSf7SchedulesForExport(schoolYearId: number): Promise<void> {
  try {
    await syncSf7FromAtlas(schoolYearId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'ATLAS schedule sync failed';
    console.warn(`SF7 export continued with stored EnrollPro schedules. ${message}`);
  }
}

export const exportSF7 = async (req: Request, res: Response) => {
  try {
    const explicitSchoolYearId =
      typeof req.query.schoolYearId === 'string'
        ? parseInt(req.query.schoolYearId, 10)
        : req.schoolYearId;

    const settings = await prisma.schoolSetting.findFirst({
      include: { activeSchoolYear: true },
    });

    const schoolYearId = explicitSchoolYearId ?? settings?.activeSchoolYearId ?? null;
    if (!schoolYearId || Number.isNaN(schoolYearId)) {
      return res.status(400).json({ message: 'School year is required' });
    }

    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id: schoolYearId },
      select: { id: true, yearLabel: true },
    });

    if (!schoolYear) {
      return res.status(404).json({ message: 'School year not found' });
    }

    await refreshSf7SchedulesForExport(schoolYearId);

    const teachers = await prisma.teacher.findMany({
      where: { isActive: true, serviceStatus: 'ACTIVE' },
      include: {
        department: true,
        schedulePeriods: {
          where: { schoolYearId },
        },
        teacherDesignations: {
          where: { schoolYearId },
          include: {
            advisorySection: {
              include: { gradeLevel: true },
            },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    teachers.sort((left, right) => {
      const leftRank = plantillaSortRank(left.plantillaPosition ?? left.designation);
      const rightRank = plantillaSortRank(right.plantillaPosition ?? right.designation);
      if (leftRank !== rightRank) return rightRank - leftRank;
      if (left.fundingSource !== right.fundingSource) {
        return left.fundingSource.localeCompare(right.fundingSource);
      }
      const lastNameCompare = left.lastName.localeCompare(right.lastName);
      return lastNameCompare !== 0
        ? lastNameCompare
        : left.firstName.localeCompare(right.firstName);
    });

    const workbook = new ExcelJS.Workbook();
    const templatePath = path.resolve(__dirname, '../../../templates', SF7_TEMPLATE_FILE);
    await workbook.xlsx.readFile(templatePath);

    const worksheet =
      workbook.getWorksheet('School Form 7 (SF7)') ?? workbook.worksheets[0];

    if (!worksheet) {
      return res.status(500).json({ message: 'SF7 template worksheet not found' });
    }

    worksheet.getCell('B5').value = 'School ID';
    worksheet.getCell('B7').value = 'School Name';
    worksheet.getCell('G5').value = 'Region';
    worksheet.getCell('I5').value = 'Division';
    worksheet.getCell('I7').value = 'District';
    worksheet.getCell('P7').value = 'School Year';
    worksheet.getCell('D5').value = settings?.depedSchoolId ?? '';
    worksheet.getCell('H5').value = settings?.region ?? '';
    worksheet.getCell('K5').value = settings?.division ?? '';
    worksheet.getCell('D7').value = settings?.schoolName ?? 'EnrollPro School';
    worksheet.getCell('K7').value = settings?.division ?? settings?.region ?? '';
    worksheet.getCell('R7').value = schoolYear.yearLabel;

    const nationalTeaching = new Map<string, number>();
    const nationalNonTeaching = new Map<string, number>();
    const otherAppointments = new Map<string, { teaching: number; nonTeaching: number; nature: string; fund: string }>();

    teachers.forEach((teacher) => {
      const position = teacher.plantillaPosition ?? teacher.designation ?? 'Unspecified';
      const teaching = isTeachingPersonnel(teacher);
      if (teacher.fundingSource === 'NATIONAL') {
        pushCount(teaching ? nationalTeaching : nationalNonTeaching, position);
        return;
      }

      const key = `${position}|${teacher.natureOfAppointment}|${teacher.fundingSource}`;
      const current =
        otherAppointments.get(key) ?? {
          teaching: 0,
          nonTeaching: 0,
          nature: sf7NatureLabels[teacher.natureOfAppointment] ?? teacher.natureOfAppointment,
          fund: sf7FundingLabels[teacher.fundingSource] ?? teacher.fundingSource,
        };
      if (teaching) current.teaching += 1;
      else current.nonTeaching += 1;
      otherAppointments.set(key, current);
    });

    writeSummaryPairs(worksheet, 12, 1, 3, [...nationalTeaching.entries()]);
    writeSummaryPairs(worksheet, 12, 6, 9, [...nationalNonTeaching.entries()]);

    [...otherAppointments.entries()].slice(0, 5).forEach(([key, value], index) => {
      const row = worksheet.getRow(12 + index);
      const [position] = key.split('|');
      row.getCell(11).value = position;
      row.getCell(14).value = value.nature;
      row.getCell(16).value = value.fund;
      row.getCell(18).value = value.teaching;
      row.getCell(19).value = value.nonTeaching;
    });

    const personnelTiles = ensureSf7PersonnelTiles(worksheet, teachers.length);

    teachers.forEach((teacher, index) => {
      const tile = personnelTiles[index];
      if (!tile) return;

      const sortedPeriods = sortSchedulePeriods(teacher.schedulePeriods);
      const designation = teacher.teacherDesignations[0] ?? null;
      const advisoryClass = designation?.advisorySection
        ? `${designation.advisorySection.gradeLevel.name} - ${designation.advisorySection.name}`
        : null;
      const ancillary = designation?.ancillaryRoles?.join(', ') ?? null;
      const weeklyMinutes = sortedPeriods.reduce(
        (sum, period) =>
          sum + calculateSf7PeriodMinutes(period.startTime, period.endTime),
        0,
      );
      const degree = degreeColumnValue(
        teacher.undergraduateDegree,
        teacher.postgraduateDegree,
      );
      const majorSpecialization = teacher.majorSpecialization?.trim() ?? '';
      const minorSpecialization = teacher.minorSpecialization?.trim() ?? '';
      const remarks = buildSf7Remarks(teacher);

      clearSf7TileData(worksheet, tile);
      setSf7CellValue(worksheet, tile.startRow, 1, teacher.employeeId ?? '');
      setSf7CellValue(worksheet, tile.startRow, 2, formatTeacherFullName(teacher));
      setSf7CellValue(worksheet, tile.startRow, 3, teacher.sex === 'MALE' ? 'M' : 'F');
      setSf7CellValue(
        worksheet,
        tile.startRow,
        4,
        sf7FundingLabels[teacher.fundingSource] ?? teacher.fundingSource,
      );
      setSf7CellValue(
        worksheet,
        tile.startRow,
        6,
        teacher.plantillaPosition ?? teacher.designation ?? '',
      );
      setSf7CellValue(
        worksheet,
        tile.startRow,
        7,
        sf7NatureLabels[teacher.natureOfAppointment] ?? teacher.natureOfAppointment,
      );
      setSf7CellValue(worksheet, tile.startRow, 8, degree);
      setSf7CellValue(worksheet, tile.startRow, 9, majorSpecialization);
      setSf7CellValue(worksheet, tile.startRow, 11, minorSpecialization);
      writeSf7ScheduleRows(worksheet, tile, sortedPeriods, advisoryClass, ancillary);
      setSf7CellValue(
        worksheet,
        tile.startRow,
        17,
        sortedPeriods.length > 0 ? weeklyMinutes : '',
      );
      setSf7CellValue(worksheet, tile.startRow, 18, remarks);
    });

    worksheet.pageSetup = {
      orientation: 'landscape',
      paperSize: 14 as ExcelJS.PaperSize,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="SF7_${schoolYear.yearLabel.replace(/\s+/g, '_')}.xlsx"`,
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error: unknown) {
    console.error('SF7 Export Error:', error);
    if (!res.headersSent) {
      const message = error instanceof Error ? error.message : 'Internal Server Error';
      res.status(500).json({ message });
    }
  }
};
