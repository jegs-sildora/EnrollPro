import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const exportSF1 = async (req: Request, res: Response) => {
  const { sectionId } = req.params;

  try {
    const sId = sectionId as string;
    const section = await prisma.section.findUnique({
      where: { id: parseInt(sId) },
      include: {
        gradeLevel: true,
        schoolYear: true,
      }
    });

    if (!section) {
      res.status(404).json({ message: 'Section not found' });
      return;
    }

    const enrollmentRecords = await prisma.enrollmentRecord.findMany({
      where: { sectionId: parseInt(sId) },
      include: {
        enrollmentApplication: {
          include: {
            learner: true,
            addresses: true,
            familyMembers: true,
          }
        }
      }
    });

    const templatePath = path.resolve(__dirname, '../../../templates/blank_sf1.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) {
      throw new Error('Worksheet not found in template');
    }

    // Header Info (Optional: Fill in School Name, etc. if fields exist in template)
    // For now focusing on learner data injection as requested.

    // Helper functions
    const formatDate = (date: Date | null) => {
      if (!date) return '';
      const d = new Date(date);
      return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;
    };

    const getFullName = (learner: any) => {
      const middleName = learner.middleName ? ` ${learner.middleName}` : '';
      const extensionName = learner.extensionName ? ` ${learner.extensionName}` : '';
      return `${learner.lastName.toUpperCase()}, ${learner.firstName.toUpperCase()}${middleName.toUpperCase()}${extensionName.toUpperCase()}`;
    };

    const getAddressParts = (addresses: any[]) => {
      const addr = addresses.find(a => a.addressType === 'CURRENT') || addresses.find(a => a.addressType === 'PERMANENT') || addresses[0];
      if (!addr) return { street: '', barangay: '', city: '', province: '' };
      return {
        street: [addr.houseNoStreet, addr.street, addr.sitio].filter(Boolean).join(' '),
        barangay: addr.barangay || '',
        city: addr.cityMunicipality || '',
        province: addr.province || ''
      };
    };

    const getFamilyInfo = (familyMembers: any[], app: any) => {
      const father = familyMembers.find(m => m.relationship === 'FATHER');
      const mother = familyMembers.find(m => m.relationship === 'MOTHER');
      const guardian = familyMembers.find(m => m.relationship === 'GUARDIAN');
      
      const fatherName = father ? `${father.lastName.toUpperCase()}, ${father.firstName.toUpperCase()}${father.middleName ? ' ' + father.middleName.toUpperCase() : ''}` : (app.hasNoFather ? 'N/A' : '');
      const motherName = mother ? `${mother.lastName.toUpperCase()}, ${mother.firstName.toUpperCase()}${mother.middleName ? ' ' + mother.middleName.toUpperCase() : ''}` : (app.hasNoMother ? 'N/A' : '');
      const guardianName = guardian ? `${guardian.lastName.toUpperCase()}, ${guardian.firstName.toUpperCase()}${guardian.middleName ? ' ' + guardian.middleName.toUpperCase() : ''}` : '';
      const guardianRel = app.guardianRelationship || '';

      return { fatherName, motherName, guardianName, guardianRel };
    };

    const calculateAge = (birthdate: Date, classOpeningDate: Date | null) => {
      const refDate = classOpeningDate ? new Date(classOpeningDate) : new Date();
      let age = refDate.getFullYear() - birthdate.getFullYear();
      const m = refDate.getMonth() - birthdate.getMonth();
      if (m < 0 || (m === 0 && refDate.getDate() < birthdate.getDate())) {
        age--;
      }
      return age;
    };

    const getRemarks = (record: any) => {
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

      return remarks.join('; ');
    };

    // Grouping and Sorting
    const males = enrollmentRecords
      .filter(r => r.enrollmentApplication.learner.sex === 'MALE')
      .sort((a, b) => a.enrollmentApplication.learner.lastName.localeCompare(b.enrollmentApplication.learner.lastName));

    const females = enrollmentRecords
      .filter(r => r.enrollmentApplication.learner.sex === 'FEMALE')
      .sort((a, b) => a.enrollmentApplication.learner.lastName.localeCompare(b.enrollmentApplication.learner.lastName));

    let currentRow = 7;

    const writeLearnerRow = (record: any) => {
      const { enrollmentApplication: app } = record;
      const { learner } = app;
      const addr = getAddressParts(app.addresses);
      const fam = getFamilyInfo(app.familyMembers, app);

      const row = worksheet.getRow(currentRow);
      row.getCell(1).value = learner.lrn;
      row.getCell(2).value = getFullName(learner);
      row.getCell(3).value = learner.sex === 'MALE' ? 'M' : 'F';
      row.getCell(4).value = formatDate(learner.birthdate);
      row.getCell(5).value = calculateAge(learner.birthdate, section.schoolYear.classOpeningDate);
      row.getCell(6).value = learner.motherTongue;
      row.getCell(7).value = learner.isIpCommunity ? (learner.ipGroupName || 'Yes') : 'No';
      row.getCell(8).value = learner.religion;
      row.getCell(9).value = addr.street;
      row.getCell(10).value = addr.barangay;
      row.getCell(11).value = addr.city;
      row.getCell(12).value = addr.province;
      row.getCell(13).value = fam.fatherName;
      row.getCell(14).value = fam.motherName;
      row.getCell(15).value = fam.guardianName;
      row.getCell(16).value = fam.guardianRel;
      row.getCell(17).value = app.contactNumber;
      row.getCell(18).value = app.learningModalities?.join(', ');
      row.getCell(19).value = getRemarks(record);
      
      row.commit();
      currentRow++;
    };

    // Headers setup for 1-column-per-field layout
    const headers = [
      'LRN', 'Name', 'Sex', 'Birth Date', 'Age', 'Mother Tongue', 'IP Community', 
      'Religion', 'Street', 'Barangay', 'City/Municipality', 'Province', 
      'Father\'s Name', 'Mother\'s Name', 'Guardian\'s Name', 'Relationship', 
      'Contact Number', 'Learning Modality', 'Remarks'
    ];

    // Clear template styling and setup headers
    worksheet.spliceRows(1, worksheet.rowCount); // Clear existing content
    const headerRow = worksheet.getRow(1);
    headers.forEach((h, i) => {
      headerRow.getCell(i + 1).value = h;
    });
    headerRow.font = { bold: true, name: 'Arial', size: 10 };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.commit();

    currentRow = 2; // Start data after header

    // Males
    males.forEach(writeLearnerRow);

    // Total Male
    let totalRow = worksheet.getRow(currentRow);
    totalRow.getCell(2).value = '<=== TOTAL MALE';
    totalRow.getCell(3).value = males.length;
    totalRow.font = { bold: true };
    currentRow++;

    // Females
    females.forEach(writeLearnerRow);

    // Total Female
    totalRow = worksheet.getRow(currentRow);
    totalRow.getCell(2).value = '<=== TOTAL FEMALE';
    totalRow.getCell(3).value = females.length;
    totalRow.font = { bold: true };
    currentRow++;

    // Combined
    totalRow = worksheet.getRow(currentRow);
    totalRow.getCell(2).value = '<=== COMBINED TOTAL';
    totalRow.getCell(3).value = males.length + females.length;
    totalRow.font = { bold: true };

    // 1. Print Setup & Page Configuration
    worksheet.pageSetup = {
      orientation: 'landscape',
      paperSize: 14,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
      printTitlesRow: '1:1',
    };

    // 2. Data Typography, Alignment & Borders
    const lastDataRow = currentRow;
    const centerCols = [1, 3, 4, 5, 17]; 

    for (let i = 1; i <= lastDataRow; i++) {
      const row = worksheet.getRow(i);
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber > headers.length) return;
        
        cell.font = cell.font || { name: 'Arial', size: 9 };
        cell.alignment = cell.alignment || { vertical: 'middle' };
        
        if (centerCols.includes(colNumber)) {
          cell.alignment.horizontal = 'center';
        }

        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      const rowValue = row.getCell(2).value?.toString() || '';
      if (rowValue.includes('<===')) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
          cell.font = { name: 'Arial', size: 9, bold: true };
        });
      }
    }

    // Advanced Literal AutoFit Logic
    const applyAutoFit = (ws: ExcelJS.Worksheet) => {
      ws.columns.forEach((column) => {
        let maxColumnLength = 0;
        
        column.eachCell?.({ includeEmpty: true }, (cell) => {
          let cellLength = 0;
          if (cell.value) {
            if (typeof cell.value === 'string') {
              const lines = cell.value.split('\n');
              cellLength = Math.max(...lines.map(line => line.length));
            } else if (cell.value instanceof Date) {
              cellLength = 10;
            } else {
              cellLength = cell.value.toString().length;
            }
          }
          if (cellLength > maxColumnLength) maxColumnLength = cellLength;
        });

        // Literal auto-fit uses character count as width
        // We add a tiny offset of 2 for better readability in Excel UI
        if (maxColumnLength > 0) {
          column.width = maxColumnLength + 2;
        }
      });
    };

    applyAutoFit(worksheet);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="SF1_${section.name.replace(/\s+/g, '_')}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('SF1 Export Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal Server Error' });
    }
  }
};

export const exportLisMaster = async (req: Request, res: Response) => {
  try {
    const schoolYearIdRaw = req.query.schoolYearId ? Number(req.query.schoolYearId) : null;
    
    let targetSchoolYearId = schoolYearIdRaw;
    if (targetSchoolYearId === null) {
      const settings = await prisma.schoolSetting.findFirst({ select: { activeSchoolYearId: true } });
      if (!settings?.activeSchoolYearId) {
        res.status(400).json({ message: 'No active School Year configured' });
        return;
      }
      targetSchoolYearId = settings.activeSchoolYearId;
    }

    const enrollmentRecords = await prisma.enrollmentRecord.findMany({
      where: { schoolYearId: targetSchoolYearId },
      include: {
        enrollmentApplication: {
          include: {
            learner: true,
            addresses: true,
            familyMembers: true,
            gradeLevel: true,
          }
        },
        section: true,
        schoolYear: true,
      },
      orderBy: [
        { section: { name: 'asc' } },
        { enrollmentApplication: { learner: { lastName: 'asc' } } }
      ]
    });

    if (enrollmentRecords.length === 0) {
      res.status(404).json({ message: 'No enrollment records found for this year' });
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('LIS Master List');

    // Helper functions (re-declared or shared if refactored)
    const formatDate = (date: Date | null) => {
      if (!date) return '';
      const d = new Date(date);
      return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;
    };

    const getAddressParts = (addresses: any[]) => {
      const addr = addresses.find(a => a.addressType === 'CURRENT') || addresses.find(a => a.addressType === 'PERMANENT') || addresses[0];
      if (!addr) return { street: '', barangay: '', city: '', province: '' };
      return {
        street: [addr.houseNoStreet, addr.street, addr.sitio].filter(Boolean).join(' '),
        barangay: addr.barangay || '',
        city: addr.cityMunicipality || '',
        province: addr.province || ''
      };
    };

    const getFamilyInfo = (familyMembers: any[], app: any) => {
      const father = familyMembers.find(m => m.relationship === 'FATHER');
      const mother = familyMembers.find(m => m.relationship === 'MOTHER');
      const guardian = familyMembers.find(m => m.relationship === 'GUARDIAN');
      
      const fatherName = father ? `${father.lastName.toUpperCase()}, ${father.firstName.toUpperCase()}` : (app.hasNoFather ? 'N/A' : '');
      const motherName = mother ? `${mother.lastName.toUpperCase()}, ${mother.firstName.toUpperCase()}` : (app.hasNoMother ? 'N/A' : '');
      const guardianName = guardian ? `${guardian.lastName.toUpperCase()}, ${guardian.firstName.toUpperCase()}` : '';
      return { fatherName, motherName, guardianName };
    };

    const calculateAge = (birthdate: Date, classOpeningDate: Date | null) => {
      const refDate = classOpeningDate ? new Date(classOpeningDate) : new Date();
      let age = refDate.getFullYear() - birthdate.getFullYear();
      const m = refDate.getMonth() - birthdate.getMonth();
      if (m < 0 || (m === 0 && refDate.getDate() < birthdate.getDate())) {
        age--;
      }
      return age;
    };

    const headers = [
      'LRN', 'Last Name', 'First Name', 'Middle Name', 'Extension', 'Sex', 
      'Birth Date', 'Age', 'Grade Level', 'Section', 'Mother Tongue', 'IP Community', 
      'Religion', 'Street', 'Barangay', 'City/Municipality', 'Province', 
      'Father\'s Name', 'Mother\'s Name', 'Guardian\'s Name', 'Contact Number', 
      'Learning Modality', 'Status'
    ];

    const headerRow = worksheet.getRow(1);
    headers.forEach((h, i) => {
      headerRow.getCell(i + 1).value = h;
    });
    headerRow.font = { bold: true, name: 'Arial', size: 10 };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    enrollmentRecords.forEach((record, index) => {
      const app = record.enrollmentApplication;
      const learner = app.learner;
      const addr = getAddressParts(app.addresses);
      const fam = getFamilyInfo(app.familyMembers, app);
      const row = worksheet.getRow(index + 2);

      row.getCell(1).value = learner.lrn;
      row.getCell(2).value = learner.lastName.toUpperCase();
      row.getCell(3).value = learner.firstName.toUpperCase();
      row.getCell(4).value = learner.middleName?.toUpperCase() || '';
      row.getCell(5).value = learner.extensionName?.toUpperCase() || '';
      row.getCell(6).value = learner.sex === 'MALE' ? 'M' : 'F';
      row.getCell(7).value = formatDate(learner.birthdate);
      row.getCell(8).value = calculateAge(learner.birthdate, record.schoolYear.classOpeningDate);
      row.getCell(9).value = app.gradeLevel.name;
      row.getCell(10).value = record.section.name;
      row.getCell(11).value = learner.motherTongue;
      row.getCell(12).value = learner.isIpCommunity ? (learner.ipGroupName || 'Yes') : 'No';
      row.getCell(13).value = learner.religion;
      row.getCell(14).value = addr.street;
      row.getCell(15).value = addr.barangay;
      row.getCell(16).value = addr.city;
      row.getCell(17).value = addr.province;
      row.getCell(18).value = fam.fatherName;
      row.getCell(19).value = fam.motherName;
      row.getCell(20).value = fam.guardianName;
      row.getCell(21).value = app.contactNumber;
      row.getCell(22).value = app.learningModalities?.join(', ');
      row.getCell(23).value = app.status;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber > headers.length) return;
        cell.font = { name: 'Arial', size: 9 };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    const applyAutoFit = (ws: ExcelJS.Worksheet) => {
      ws.columns.forEach((column) => {
        let maxColumnLength = 0;
        column.eachCell?.({ includeEmpty: true }, (cell) => {
          let cellLength = 0;
          if (cell.value) {
            cellLength = cell.value.toString().length;
          }
          if (cellLength > maxColumnLength) maxColumnLength = cellLength;
        });
        if (maxColumnLength > 0) {
          column.width = maxColumnLength + 2;
        }
      });
    };

    applyAutoFit(worksheet);

    const schoolYearLabel = enrollmentRecords[0]?.schoolYear?.yearLabel || 'Extract';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="LIS-Master-${schoolYearLabel.replace(/\s+/g, '_')}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('LIS Master Export Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal Server Error' });
    }
  }
};
