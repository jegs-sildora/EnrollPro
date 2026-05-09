import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

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

    // 4. Data
    let currentRow = 7;
    const sorted = enrollmentRecords.sort((a,b) => a.enrollmentApplication.learner.lastName.localeCompare(b.enrollmentApplication.learner.lastName));
    
    sorted.forEach(record => {
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
