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

const parsePositiveInt = (value: unknown): number | null => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const createStudentsQueryController = (
  deps: StudentsControllerDeps = createStudentsControllerDeps(),
) => {
  const getStudents = async (req: Request, res: Response) => {
    try {
      const schoolYearId = parsePositiveInt(req.query.schoolYearId);
      if (!schoolYearId) {
        return res.status(400).json({ message: "schoolYearId is required" });
      }

      const {
        applications,
        total,
        page: pageNum,
        limit: limitNum,
      } = await deps.searchStudents(req.query as any);

      const students = applications.map((applicant: any) => {
        const parentOrGuardian = pickParentOrGuardian(
          applicant.familyMembers as FamilyMemberLike[],
        );

        return {
          learningProgram:
            applicant.enrollmentRecord?.section.programType ||
            applicant.programDetail?.scpType ||
            "REGULAR",
          dateEnrolled:
            applicant.enrollmentRecord?.enrolledAt || applicant.createdAt,
          id: applicant.id,
          lrn: applicant.learner?.lrn,
          fullName: applicant.learner ? buildFullName(applicant.learner) : "",
          firstName: applicant.learner?.firstName,
          lastName: applicant.learner?.lastName,
          middleName: applicant.learner?.middleName,
          suffix: applicant.learner?.extensionName,
          sex: applicant.learner?.sex,
          birthDate: applicant.learner?.birthdate,
          address: buildAddress(applicant.addresses as AddressLike[]),
          parentGuardianName: parentOrGuardian.name,
          parentGuardianContact: parentOrGuardian.contact,
          emailAddress: applicant.earlyRegistration?.email ?? null,
          trackingNumber: applicant.trackingNumber,
          status: applicant.status,
          lifecycleOutcome: applicant.enrollmentRecord?.eosyStatus || null,
          dropOutReason: applicant.enrollmentRecord?.dropOutReason || null,
          dropOutDate: applicant.enrollmentRecord?.dropOutDate || null,
          transferOutDate: applicant.enrollmentRecord?.transferOutDate || null,
          transferOutSchoolName:
            applicant.enrollmentRecord?.transferOutSchoolName || null,
          transferOutReason:
            applicant.enrollmentRecord?.transferOutReason || null,
          gradeLevel: applicant.gradeLevel.name,
          gradeLevelId: applicant.gradeLevelId,
          section: applicant.enrollmentRecord?.section.name || null,
          sectionId: applicant.enrollmentRecord?.sectionId || null,
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

  const getStudentsSummary = async (req: Request, res: Response) => {
    try {
      const schoolYearId = parsePositiveInt(req.query.schoolYearId);
      if (!schoolYearId) {
        return res.status(400).json({ message: "schoolYearId is required" });
      }

      const summary = await deps.fetchStudentsSummary({
        schoolYearId,
        status: req.query.status as string | undefined,
      });

      res.json(summary);
    } catch (error) {
      console.error("Error fetching students summary:", error);
      res.status(500).json({ message: "Failed to fetch students summary" });
    }
  };

  const getStudentById = async (req: Request, res: Response) => {
    try {
      const parsedId = Number.parseInt(String(req.params.id ?? ""), 10);
      if (Number.isNaN(parsedId)) {
        return res.status(400).json({ message: "Invalid student id" });
      }

      const applicant = await deps.prisma.enrollmentApplication.findUnique({
        where: { id: parsedId },
        include: {
          learner: true,
          gradeLevel: true,
          schoolYear: true,
          addresses: true,
          familyMembers: true,
          previousSchool: true,
          earlyRegistration: true,
          enrollmentRecord: {
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
        lrn: applicant.learner?.lrn,
        fullName: applicant.learner ? buildFullName(applicant.learner) : "",
        firstName: applicant.learner?.firstName,
        lastName: applicant.learner?.lastName,
        middleName: applicant.learner?.middleName,
        suffix: applicant.learner?.extensionName,
        sex: applicant.learner?.sex,
        birthDate: applicant.learner?.birthdate,
        address: buildAddress(addresses),
        currentAddress: currentAddr || null,
        permanentAddress: permanentAddr || null,
        motherName: mother || null,
        fatherName: father || null,
        guardianInfo: guardian || null,
        parentGuardianName: parentOrGuardian.name,
        parentGuardianContact: parentOrGuardian.contact,
        emailAddress: applicant.earlyRegistration?.email ?? null,
        trackingNumber: applicant.trackingNumber,
        status: applicant.status,
        rejectionReason: applicant.rejectionReason,
        gradeLevel: applicant.gradeLevel.name,
        gradeLevelId: applicant.gradeLevelId,
        schoolYear: applicant.schoolYear.yearLabel,
        schoolYearId: applicant.schoolYearId,
        enrollment: applicant.enrollmentRecord
          ? {
              id: applicant.enrollmentRecord.id,
              section: applicant.enrollmentRecord.section.name,
              sectionId: applicant.enrollmentRecord.sectionId,
              eosyStatus: applicant.enrollmentRecord.eosyStatus,
              dropOutReason: applicant.enrollmentRecord.dropOutReason,
              dropOutDate: applicant.enrollmentRecord.dropOutDate,
              transferOutDate: applicant.enrollmentRecord.transferOutDate,
              transferOutSchoolName:
                applicant.enrollmentRecord.transferOutSchoolName,
              transferOutReason: applicant.enrollmentRecord.transferOutReason,
              advisingTeacher: applicant.enrollmentRecord.section
                .advisingTeacher
                ? buildFullName(
                    applicant.enrollmentRecord.section.advisingTeacher,
                  )
                : null,
              enrolledAt: applicant.enrollmentRecord.enrolledAt,
              enrolledBy: `${applicant.enrollmentRecord.enrolledBy.lastName}, ${applicant.enrollmentRecord.enrolledBy.firstName}`,
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
    getStudentsSummary,
    getStudentById,
  };
};

const studentsQueryController = createStudentsQueryController();

export const { getStudents, getStudentsSummary, getStudentById } =
  studentsQueryController;
