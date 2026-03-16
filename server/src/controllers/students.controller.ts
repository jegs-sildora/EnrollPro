import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const getStudents = async (req: Request, res: Response) => {
  try {
    const {
      academicYearId,
      search = '',
      gradeLevelId,
      sectionId,
      status,
      page = '1',
      limit = '15',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    // Filter by academic year (REQUIRED for data consistency)
    if (academicYearId) {
      where.academicYearId = parseInt(academicYearId as string, 10);
    }

    // Search by LRN or name
    if (search && typeof search === 'string' && search.trim()) {
      where.OR = [
        { lrn: { contains: search.trim(), mode: 'insensitive' } },
        { firstName: { contains: search.trim(), mode: 'insensitive' } },
        { lastName: { contains: search.trim(), mode: 'insensitive' } },
        { middleName: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    // Filter by grade level
    if (gradeLevelId && typeof gradeLevelId === 'string') {
      where.gradeLevelId = parseInt(gradeLevelId, 10);
    }

    // Filter by status
    if (status && typeof status === 'string') {
      where.status = status;
    }

    // Filter by section (via enrollment)
    if (sectionId && typeof sectionId === 'string') {
      where.enrollment = {
        sectionId: parseInt(sectionId, 10),
      };
    }

    // Build orderBy clause
    const orderBy: any = [];
    
    const sortField = sortBy as string;
    const order = (sortOrder as string).toLowerCase() === 'asc' ? 'asc' : 'desc';

    // Map frontend sort fields to database fields
    switch (sortField) {
      case 'lrn':
        orderBy.push({ lrn: order });
        break;
      case 'lastName':
        orderBy.push({ lastName: order });
        orderBy.push({ firstName: order });
        break;
      case 'gradeLevel':
        orderBy.push({ gradeLevel: { displayOrder: order } });
        break;
      case 'section':
        orderBy.push({ enrollment: { section: { name: order } } });
        break;
      case 'strand':
        orderBy.push({ strand: { name: order } });
        break;
      case 'status':
        orderBy.push({ status: order });
        break;
      case 'createdAt':
        orderBy.push({ createdAt: order });
        break;
      default:
        orderBy.push({ createdAt: 'desc' });
    }

    // Get total count
    const total = await prisma.applicant.count({ where });

    // Get paginated results
    const applicants = await prisma.applicant.findMany({
      where,
      include: {
        gradeLevel: true,
        strand: true,
        enrollment: {
          include: {
            section: true,
          },
        },
      },
      orderBy,
      skip,
      take: limitNum,
    });

    // Transform data
    const students = applicants.map((applicant) => {
      const addr = applicant.currentAddress as any;
      const mother = applicant.motherName as any;
      const father = applicant.fatherName as any;
      const guardian = applicant.guardianInfo as any;
      const parentName = guardian?.firstName
        ? `${guardian.firstName} ${guardian.lastName}`
        : mother?.firstName
          ? `${mother.firstName} ${mother.lastName}`
          : father?.firstName
            ? `${father.firstName} ${father.lastName}`
            : null;
      const parentContact = guardian?.contactNumber || mother?.contactNumber || father?.contactNumber || null;
      const addressStr = addr ? [addr.barangay, addr.cityMunicipality, addr.province].filter(Boolean).join(', ') : null;

      return {
        id: applicant.id,
        lrn: applicant.lrn,
        fullName: `${applicant.lastName}, ${applicant.firstName}${applicant.middleName ? ` ${applicant.middleName.charAt(0)}.` : ''}${applicant.suffix ? ` ${applicant.suffix}` : ''}`,
        firstName: applicant.firstName,
        lastName: applicant.lastName,
        middleName: applicant.middleName,
        suffix: applicant.suffix,
        sex: applicant.sex,
        birthDate: applicant.birthDate,
        address: addressStr,
        parentGuardianName: parentName,
        parentGuardianContact: parentContact,
        emailAddress: applicant.emailAddress,
        trackingNumber: applicant.trackingNumber,
        status: applicant.status,
        gradeLevel: applicant.gradeLevel.name,
        gradeLevelId: applicant.gradeLevelId,
        strand: applicant.strand?.name || null,
        strandId: applicant.strandId,
        section: applicant.enrollment?.section.name || null,
        sectionId: applicant.enrollment?.sectionId || null,
        createdAt: applicant.createdAt,
        updatedAt: applicant.updatedAt,
      };
    });

    res.json({
      students,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Failed to fetch students' });
  }
};

export const getStudentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const applicant = await prisma.applicant.findUnique({
      where: { id: parseInt(id as string, 10) },
      include: {
        gradeLevel: true,
        strand: true,
        academicYear: true,
        enrollment: {
          include: {
            section: {
              include: {
                advisingTeacher: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
            enrolledBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!applicant) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const addr = applicant.currentAddress as any;
    const mother = applicant.motherName as any;
    const father = applicant.fatherName as any;
    const guardian = applicant.guardianInfo as any;
    const parentName = guardian?.firstName
      ? `${guardian.firstName} ${guardian.lastName}`
      : mother?.firstName
        ? `${mother.firstName} ${mother.lastName}`
        : father?.firstName
          ? `${father.firstName} ${father.lastName}`
          : null;
    const parentContact = guardian?.contactNumber || mother?.contactNumber || father?.contactNumber || null;
    const addressStr = addr ? [addr.barangay, addr.cityMunicipality, addr.province].filter(Boolean).join(', ') : null;

    const student = {
      id: applicant.id,
      lrn: applicant.lrn,
      fullName: `${applicant.lastName}, ${applicant.firstName}${applicant.middleName ? ` ${applicant.middleName.charAt(0)}.` : ''}${applicant.suffix ? ` ${applicant.suffix}` : ''}`,
      firstName: applicant.firstName,
      lastName: applicant.lastName,
      middleName: applicant.middleName,
      suffix: applicant.suffix,
      sex: applicant.sex,
      birthDate: applicant.birthDate,
      address: addressStr,
      currentAddress: applicant.currentAddress,
      permanentAddress: applicant.permanentAddress,
      motherName: applicant.motherName,
      fatherName: applicant.fatherName,
      guardianInfo: applicant.guardianInfo,
      parentGuardianName: parentName,
      parentGuardianContact: parentContact,
      emailAddress: applicant.emailAddress,
      trackingNumber: applicant.trackingNumber,
      status: applicant.status,
      rejectionReason: applicant.rejectionReason,
      gradeLevel: applicant.gradeLevel.name,
      gradeLevelId: applicant.gradeLevelId,
      strand: applicant.strand?.name || null,
      strandId: applicant.strandId,
      academicYear: applicant.academicYear.yearLabel,
      academicYearId: applicant.academicYearId,
      enrollment: applicant.enrollment ? {
        id: applicant.enrollment.id,
        section: applicant.enrollment.section.name,
        sectionId: applicant.enrollment.sectionId,
        advisingTeacher: applicant.enrollment.section.advisingTeacher?.name || null,
        enrolledAt: applicant.enrollment.enrolledAt,
        enrolledBy: applicant.enrollment.enrolledBy.name,
      } : null,
      createdAt: applicant.createdAt,
      updatedAt: applicant.updatedAt,
    };

    res.json({ student });
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ message: 'Failed to fetch student details' });
  }
};

export const updateStudent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      middleName,
      suffix,
      sex,
      birthDate,
      currentAddress,
      permanentAddress,
      motherName,
      fatherName,
      guardianInfo,
      emailAddress,
    } = req.body;

    const applicant = await prisma.applicant.findUnique({
      where: { id: parseInt(id as string, 10) },
    });

    if (!applicant) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const updated = await prisma.applicant.update({
      where: { id: parseInt(id as string, 10) },
      data: {
        firstName,
        lastName,
        middleName,
        suffix,
        sex,
        birthDate: birthDate ? new Date(birthDate) : undefined,
        currentAddress: currentAddress ?? undefined,
        permanentAddress: permanentAddress ?? undefined,
        motherName: motherName ?? undefined,
        fatherName: fatherName ?? undefined,
        guardianInfo: guardianInfo ?? undefined,
        emailAddress,
      },
      include: {
        gradeLevel: true,
        strand: true,
        enrollment: {
          include: {
            section: true,
          },
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: (req as any).user?.userId || null,
        actionType: 'STUDENT_UPDATED',
        description: `Updated student record for ${updated.firstName} ${updated.lastName} (LRN: ${updated.lrn})`,
        subjectType: 'Applicant',
        subjectId: updated.id,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || null,
      },
    });

    res.json({ message: 'Student updated successfully', student: updated });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ message: 'Failed to update student' });
  }
};
