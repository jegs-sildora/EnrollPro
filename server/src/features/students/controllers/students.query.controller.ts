import { Request, Response } from "express";
import {
  createStudentsControllerDeps,
  StudentsControllerDeps,
} from "../services/students-controller.deps.js";

type FamilyMemberLike = {
  relationship: string;
  firstName: string;
  lastName: string;
  contactNumber?: string | null;
};

type AddressLike = {
  addressType: string;
  barangay?: string | null;
  cityMunicipality?: string | null;
  province?: string | null;
};

const buildFullName = (person: {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  suffix?: string | null;
}): string => {
  const middle = person.middleName ? ` ${person.middleName.charAt(0)}.` : "";
  const suffix = person.suffix ? ` ${person.suffix}` : "";
  return `${person.lastName}, ${person.firstName}${middle}${suffix}`;
};

const pickParentOrGuardian = (
  familyMembers: FamilyMemberLike[] = [],
): { name: string | null; contact: string | null } => {
  const mother = familyMembers.find((f) => f.relationship === "MOTHER");
  const father = familyMembers.find((f) => f.relationship === "FATHER");
  const guardian = familyMembers.find((f) => f.relationship === "GUARDIAN");

  const selected = guardian ?? mother ?? father;
  return {
    name: selected ? `${selected.firstName} ${selected.lastName}` : null,
    contact:
      guardian?.contactNumber ??
      mother?.contactNumber ??
      father?.contactNumber ??
      null,
  };
};

const buildAddress = (addresses: AddressLike[] = []): string | null => {
  const currentAddress = addresses.find((a) => a.addressType === "CURRENT");
  if (!currentAddress) {
    return null;
  }

  return [
    currentAddress.barangay,
    currentAddress.cityMunicipality,
    currentAddress.province,
  ]
    .filter(Boolean)
    .join(", ");
};

export const createStudentsQueryController = (
  deps: StudentsControllerDeps = createStudentsControllerDeps(),
) => {
  const getStudents = async (req: Request, res: Response) => {
    try {
      const { applicants, total, pageNum, limitNum } =
        await deps.searchStudents(req.query as any);

      const students = applicants.map((applicant) => {
        const parentOrGuardian = pickParentOrGuardian(
          applicant.familyMembers as FamilyMemberLike[],
        );

        return {
          id: applicant.id,
          lrn: applicant.lrn,
          fullName: buildFullName(applicant),
          firstName: applicant.firstName,
          lastName: applicant.lastName,
          middleName: applicant.middleName,
          suffix: applicant.suffix,
          sex: applicant.sex,
          birthDate: applicant.birthDate,
          address: buildAddress(applicant.addresses as AddressLike[]),
          parentGuardianName: parentOrGuardian.name,
          parentGuardianContact: parentOrGuardian.contact,
          emailAddress: applicant.emailAddress,
          trackingNumber: applicant.trackingNumber,
          status: applicant.status,
          gradeLevel: applicant.gradeLevel.name,
          gradeLevelId: applicant.gradeLevelId,
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
      console.error("Error fetching students:", error);
      res.status(500).json({ message: "Failed to fetch students" });
    }
  };

  const getStudentById = async (req: Request, res: Response) => {
    try {
      const parsedId = Number.parseInt(String(req.params.id ?? ""), 10);
      if (Number.isNaN(parsedId)) {
        return res.status(400).json({ message: "Invalid student id" });
      }

      const applicant = await deps.prisma.applicant.findUnique({
        where: { id: parsedId },
        include: {
          gradeLevel: true,
          schoolYear: true,
          addresses: true,
          familyMembers: true,
          previousSchool: true,
          enrollment: {
            include: {
              section: {
                include: {
                  advisingTeacher: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      middleName: true,
                    },
                  },
                },
              },
              enrolledBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      if (!applicant) {
        return res.status(404).json({ message: "Student not found" });
      }

      const addresses = applicant.addresses as AddressLike[];
      const familyMembers = applicant.familyMembers as FamilyMemberLike[];
      const currentAddr = addresses.find((a) => a.addressType === "CURRENT");
      const permanentAddr = addresses.find(
        (a) => a.addressType === "PERMANENT",
      );
      const mother = familyMembers.find((f) => f.relationship === "MOTHER");
      const father = familyMembers.find((f) => f.relationship === "FATHER");
      const guardian = familyMembers.find((f) => f.relationship === "GUARDIAN");
      const parentOrGuardian = pickParentOrGuardian(familyMembers);

      const student = {
        id: applicant.id,
        lrn: applicant.lrn,
        fullName: buildFullName(applicant),
        firstName: applicant.firstName,
        lastName: applicant.lastName,
        middleName: applicant.middleName,
        suffix: applicant.suffix,
        sex: applicant.sex,
        birthDate: applicant.birthDate,
        address: buildAddress(addresses),
        currentAddress: currentAddr || null,
        permanentAddress: permanentAddr || null,
        motherName: mother || null,
        fatherName: father || null,
        guardianInfo: guardian || null,
        parentGuardianName: parentOrGuardian.name,
        parentGuardianContact: parentOrGuardian.contact,
        emailAddress: applicant.emailAddress,
        trackingNumber: applicant.trackingNumber,
        status: applicant.status,
        rejectionReason: applicant.rejectionReason,
        gradeLevel: applicant.gradeLevel.name,
        gradeLevelId: applicant.gradeLevelId,
        schoolYear: applicant.schoolYear.yearLabel,
        schoolYearId: applicant.schoolYearId,
        enrollment: applicant.enrollment
          ? {
              id: applicant.enrollment.id,
              section: applicant.enrollment.section.name,
              sectionId: applicant.enrollment.sectionId,
              advisingTeacher: applicant.enrollment.section.advisingTeacher
                ? buildFullName(applicant.enrollment.section.advisingTeacher)
                : null,
              enrolledAt: applicant.enrollment.enrolledAt,
              enrolledBy: `${applicant.enrollment.enrolledBy.lastName}, ${applicant.enrollment.enrolledBy.firstName}`,
            }
          : null,
        createdAt: applicant.createdAt,
        updatedAt: applicant.updatedAt,
      };

      res.json({ student });
    } catch (error) {
      console.error("Error fetching student:", error);
      res.status(500).json({ message: "Failed to fetch student details" });
    }
  };

  return {
    getStudents,
    getStudentById,
  };
};

const studentsQueryController = createStudentsQueryController();

export const { getStudents, getStudentById } = studentsQueryController;
