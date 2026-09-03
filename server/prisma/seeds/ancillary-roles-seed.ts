import "dotenv/config";
import { PrismaClient, Sex, Role } from "../../src/generated/prisma/index.js";
import * as bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

/**
 * # EnrollPro Dummy Faculty Staffing Recommendation
 * Date: 2026-08-29
 * ATLAS evidence source: Tailnet run 440, schoolId 1, schoolYearId 2
 * Tailnet target: https://njgrm.buru-degree.ts.net
 * 
 * ## Executive Decision
 * Add 4 real dummy faculty records in EnrollPro:
 * | Department | Current active ATLAS faculty | Add | Target active faculty | Why |
 * |---|---:|---:|---:|---|
 * | ENG | 3 | 1 | 4 | Clears 30 Developmental Reading sessions, 22.5 hours |
 * | MATH | 2 | 1 | 3 | Clears 20 Mathematics sessions, 15 hours |
 * | ESP | 2 | 1 | 3 | Clears 20 ESP sessions, 15 hours, including 10 no-slot sessions caused by both ESP teachers being saturated or occupied |
 * | MAPEH | 2 real + 1 placeholder | 1 real | 3 real | Clears 20 SPS specialization sessions, 15 hours, and allows retiring or ignoring Teacher X |
 * 
 * Do not add a SCI or TLE teacher solely for the current Robotics blocker. In run 440, Robotics is blocked because Grade 10 Silver has no remaining section periods, not because the assigned Robotics teacher lacks weekly capacity.
 * 
 * ## EnrollPro Dummy Data Instructions
 * Create exactly these new active faculty records in EnrollPro dummy data:
 * 
 * | Suggested employee id | Department | Suggested name | Scheduling attributes |
 * |---|---|---|---|
 * | 2000061 | ENG | Dummy ENG Reading Teacher | active, non-stale, max 30h/week, can teach Developmental Reading |
 * | 2000062 | MATH | Dummy Mathematics Teacher | active, non-stale, max 30h/week, can teach Mathematics |
 * | 2000063 | ESP | Dummy ESP GMRC Teacher | active, non-stale, max 30h/week, can teach ESP/GMRC |
 * | 2000064 | MAPEH | Dummy SPS MAPEH Teacher | active, non-stale, max 30h/week, can teach SPS specialization / MAPEH-owned SPS classes |
 * 
 * Constraints:
 * - Do not create placeholder teachers for this fix. These should be real dummy EnrollPro faculty records.
 * - Do not assign ancillary minutes to the new dummy teachers.
 * - Keep all four active for schoolId 1 and the 2026-2027 active school year.
 * - Ensure EnrollPro department values match ATLAS department codes exactly: ENG, MATH, ESP, MAPEH.
 * - Ensure the new teachers sync into ATLAS faculty mirrors as active and non-stale.
 */

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding ancillary roles and dummy faculty...");
  
  // 1. Assign ancillary roles to the most recent existing teacher in the database
  const mostRecentTeacher = await prisma.teacher.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  if (mostRecentTeacher) {
    await prisma.teacher.update({
      where: { id: mostRecentTeacher.id },
      data: {
        ancillaryRoles: {
          push: "SDRRM COORDINATOR"
        }
      }
    });
    console.log(`Updated recent teacher (Employee ID: ${mostRecentTeacher.employeeId}) with ancillary role SDRRM COORDINATOR.`);
  }

  // 2. Add the 4 dummy teachers without ancillary roles
  const departments = await prisma.department.findMany({
    where: { code: { in: ['ENG', 'MATH', 'ESP', 'MAPEH', 'SCI', 'FIL'] } }
  });

  const getDeptId = (code: string) => departments.find(d => d.code === code)?.id;

  const dummyTeachers = [
    { 
      employeeId: "2000061", deptCode: "ENG", firstName: "Jose Gabriel", middleName: "Mercado", lastName: "Santos", sex: Sex.MALE,
      email: "josegabriel.santos@deped.gov.ph", contactNumber: "09171234561", specialization: "ENGLISH", 
      undergraduateDegree: "BACHELOR OF SECONDARY EDUCATION", postgraduateDegree: "MASTER OF ARTS IN EDUCATION", majorSpecialization: "ENGLISH", 
      minorSpecialization: "", plantillaPosition: "TEACHER III", designation: "SUBJECT TEACHER", 
      birthdate: new Date("1990-05-15"), personnelType: "TEACHING", functionalAssignment: "CLASSROOM TEACHING"
    },
    { 
      employeeId: "2000062", deptCode: "MATH", firstName: "Maria Angela", middleName: "Villanueva", lastName: "Reyes", sex: Sex.FEMALE,
      email: "mariaangela.reyes@deped.gov.ph", contactNumber: "09181234562", specialization: "MATHEMATICS", 
      undergraduateDegree: "BACHELOR OF SECONDARY EDUCATION", postgraduateDegree: "", majorSpecialization: "MATHEMATICS", 
      minorSpecialization: "", plantillaPosition: "TEACHER II", designation: "SUBJECT TEACHER", 
      birthdate: new Date("1992-08-22"), personnelType: "TEACHING", functionalAssignment: "CLASSROOM TEACHING"
    },
    { 
      employeeId: "2000063", deptCode: "ESP", firstName: "Juan Miguel", middleName: "Bautista", lastName: "Cruz", sex: Sex.MALE,
      email: "juanmiguel.cruz@deped.gov.ph", contactNumber: "09191234563", specialization: "EDUKASYON SA PAGPAPAKATAO", 
      undergraduateDegree: "BACHELOR OF SECONDARY EDUCATION", postgraduateDegree: "MASTER OF ARTS IN EDUCATION", majorSpecialization: "EDUKASYON SA PAGPAPAKATAO", 
      minorSpecialization: "", plantillaPosition: "MASTER TEACHER I", designation: "SUBJECT TEACHER", 
      birthdate: new Date("1985-11-30"), personnelType: "TEACHING", functionalAssignment: "CLASSROOM TEACHING"
    },
    { 
      employeeId: "2000064", deptCode: "MAPEH", firstName: "Anna Patricia", middleName: "Ramos", lastName: "Garcia", sex: Sex.FEMALE,
      email: "annapatricia.garcia@deped.gov.ph", contactNumber: "09201234564", specialization: "MAPEH", 
      undergraduateDegree: "BACHELOR OF SECONDARY EDUCATION", postgraduateDegree: "", majorSpecialization: "MAPEH", 
      minorSpecialization: "", plantillaPosition: "TEACHER I", designation: "SUBJECT TEACHER", 
      birthdate: new Date("1995-02-14"), personnelType: "TEACHING", functionalAssignment: "CLASSROOM TEACHING"
    },
    { 
      employeeId: "2000065", deptCode: "SCI", firstName: "Ricardo", middleName: "Torres", lastName: "Santos", sex: Sex.MALE,
      email: "ricardo.santos@deped.gov.ph", contactNumber: "09172000065", specialization: "SCIENCE", 
      undergraduateDegree: "BACHELOR OF SECONDARY EDUCATION", postgraduateDegree: "MASTER OF ARTS IN EDUCATION", majorSpecialization: "SCIENCE", 
      minorSpecialization: "", plantillaPosition: "TEACHER III", designation: "SUBJECT TEACHER", 
      birthdate: new Date("1988-03-12"), personnelType: "TEACHING", functionalAssignment: "CLASSROOM TEACHING"
    },
    { 
      employeeId: "2000066", deptCode: "SCI", firstName: "Marites", middleName: "Laxamana", lastName: "Del Rosario", sex: Sex.FEMALE,
      email: "marites.delrosario@deped.gov.ph", contactNumber: "09182000066", specialization: "SCIENCE", 
      undergraduateDegree: "BACHELOR OF SECONDARY EDUCATION", postgraduateDegree: "", majorSpecialization: "SCIENCE", 
      minorSpecialization: "", plantillaPosition: "TEACHER II", designation: "SUBJECT TEACHER", 
      birthdate: new Date("1991-06-25"), personnelType: "TEACHING", functionalAssignment: "CLASSROOM TEACHING"
    },
    { 
      employeeId: "2000067", deptCode: "SCI", firstName: "Jonathan", middleName: "Cruz", lastName: "Villanueva", sex: Sex.MALE,
      email: "jonathan.villanueva@deped.gov.ph", contactNumber: "09192000067", specialization: "SCIENCE", 
      undergraduateDegree: "BACHELOR OF SECONDARY EDUCATION", postgraduateDegree: "", majorSpecialization: "SCIENCE", 
      minorSpecialization: "", plantillaPosition: "TEACHER I", designation: "SUBJECT TEACHER", 
      birthdate: new Date("1994-09-08"), personnelType: "TEACHING", functionalAssignment: "CLASSROOM TEACHING"
    },
    { 
      employeeId: "2000068", deptCode: "SCI", firstName: "Karen", middleName: "Gomez", lastName: "Tolentino", sex: Sex.FEMALE,
      email: "karen.tolentino@deped.gov.ph", contactNumber: "09202000068", specialization: "SCIENCE", 
      undergraduateDegree: "BACHELOR OF SECONDARY EDUCATION", postgraduateDegree: "MASTER OF ARTS IN EDUCATION", majorSpecialization: "SCIENCE", 
      minorSpecialization: "", plantillaPosition: "MASTER TEACHER I", designation: "SUBJECT TEACHER", 
      birthdate: new Date("1983-12-19"), personnelType: "TEACHING", functionalAssignment: "CLASSROOM TEACHING"
    },
    { 
      employeeId: "2000069", deptCode: "SCI", firstName: "Dennis", middleName: "Aquino", lastName: "Bautista", sex: Sex.MALE,
      email: "dennis.bautista@deped.gov.ph", contactNumber: "09212000069", specialization: "SCIENCE", 
      undergraduateDegree: "BACHELOR OF SECONDARY EDUCATION", postgraduateDegree: "", majorSpecialization: "SCIENCE", 
      minorSpecialization: "", plantillaPosition: "TEACHER II", designation: "SUBJECT TEACHER", 
      birthdate: new Date("1990-04-05"), personnelType: "TEACHING", functionalAssignment: "CLASSROOM TEACHING"
    },
    { 
      employeeId: "2000070", deptCode: "MAPEH", firstName: "Rowena", middleName: "Lim", lastName: "Marcelo", sex: Sex.FEMALE,
      email: "rowena.marcelo@deped.gov.ph", contactNumber: "09222000070", specialization: "MAPEH", 
      undergraduateDegree: "BACHELOR OF SECONDARY EDUCATION", postgraduateDegree: "MASTER OF ARTS IN EDUCATION", majorSpecialization: "MAPEH", 
      minorSpecialization: "", plantillaPosition: "TEACHER III", designation: "SUBJECT TEACHER", 
      birthdate: new Date("1987-07-16"), personnelType: "TEACHING", functionalAssignment: "CLASSROOM TEACHING"
    },
    { 
      employeeId: "2000071", deptCode: "MAPEH", firstName: "Frederick", middleName: "Reyes", lastName: "Ocampo", sex: Sex.MALE,
      email: "frederick.ocampo@deped.gov.ph", contactNumber: "09232000071", specialization: "MAPEH", 
      undergraduateDegree: "BACHELOR OF SECONDARY EDUCATION", postgraduateDegree: "", majorSpecialization: "MAPEH", 
      minorSpecialization: "", plantillaPosition: "TEACHER I", designation: "SUBJECT TEACHER", 
      birthdate: new Date("1996-10-27"), personnelType: "TEACHING", functionalAssignment: "CLASSROOM TEACHING"
    },
    { 
      employeeId: "2000072", deptCode: "FIL", firstName: "Divina", middleName: "Mendoza", lastName: "Escarez", sex: Sex.FEMALE,
      email: "divina.escarez@deped.gov.ph", contactNumber: "09242000072", specialization: "FILIPINO", 
      undergraduateDegree: "BACHELOR OF SECONDARY EDUCATION", postgraduateDegree: "", majorSpecialization: "FILIPINO", 
      minorSpecialization: "", plantillaPosition: "TEACHER II", designation: "SUBJECT TEACHER", 
      birthdate: new Date("1989-01-03"), personnelType: "TEACHING", functionalAssignment: "CLASSROOM TEACHING"
    },
    { 
      employeeId: "2000073", deptCode: "ENG", firstName: "Corazon", middleName: "Garcia", lastName: "Ramirez", sex: Sex.FEMALE,
      email: "corazon.ramirez@deped.gov.ph", contactNumber: "09252000073", specialization: "ENGLISH", 
      undergraduateDegree: "BACHELOR OF SECONDARY EDUCATION", postgraduateDegree: "MASTER OF ARTS IN EDUCATION", majorSpecialization: "ENGLISH", 
      minorSpecialization: "DEVELOPMENTAL READING", plantillaPosition: "TEACHER III", designation: "SUBJECT TEACHER", 
      birthdate: new Date("1986-04-12"), personnelType: "TEACHING", functionalAssignment: "CLASSROOM TEACHING"
    },
    { 
      employeeId: "2000074", deptCode: "FIL", firstName: "Alfredo", middleName: "Santos", lastName: "Marquez", sex: Sex.MALE,
      email: "alfredo.marquez@deped.gov.ph", contactNumber: "09262000074", specialization: "FILIPINO", 
      undergraduateDegree: "BACHELOR OF SECONDARY EDUCATION", postgraduateDegree: "", majorSpecialization: "FILIPINO", 
      minorSpecialization: "DEVELOPMENTAL READING", plantillaPosition: "TEACHER I", designation: "SUBJECT TEACHER", 
      birthdate: new Date("1994-09-21"), personnelType: "TEACHING", functionalAssignment: "CLASSROOM TEACHING"
    },
    { 
      employeeId: "2000075", deptCode: "ESP", firstName: "Teresita", middleName: "Reyes", lastName: "Domingo", sex: Sex.FEMALE,
      email: "teresita.domingo@deped.gov.ph", contactNumber: "09272000075", specialization: "EDUKASYON SA PAGPAPAKATAO", 
      undergraduateDegree: "BACHELOR OF SECONDARY EDUCATION", postgraduateDegree: "", majorSpecialization: "EDUKASYON SA PAGPAPAKATAO", 
      minorSpecialization: "", plantillaPosition: "TEACHER II", designation: "SUBJECT TEACHER", 
      birthdate: new Date("1991-11-05"), personnelType: "TEACHING", functionalAssignment: "CLASSROOM TEACHING"
    },
    { 
      employeeId: "2000076", deptCode: "SCI", firstName: "Roberto", middleName: "Cruz", lastName: "Alcantara", sex: Sex.MALE,
      email: "roberto.alcantara@deped.gov.ph", contactNumber: "09282000076", specialization: "SCIENCE", 
      undergraduateDegree: "BACHELOR OF SECONDARY EDUCATION", postgraduateDegree: "MASTER OF ARTS IN EDUCATION", majorSpecialization: "SCIENCE", 
      minorSpecialization: "BIOLOGY", plantillaPosition: "MASTER TEACHER I", designation: "SUBJECT TEACHER", 
      birthdate: new Date("1982-02-18"), personnelType: "TEACHING", functionalAssignment: "CLASSROOM TEACHING"
    }
  ];

  for (const t of dummyTeachers) {
    const deptId = getDeptId(t.deptCode);
    if (!deptId) {
      console.warn(`Department ${t.deptCode} not found, skipping dummy teacher ${t.employeeId}`);
      continue;
    }

    const defaultPassword = await bcrypt.hash("DepEd2026!", 10);

    const user = await prisma.user.upsert({
      where: { employeeId: t.employeeId },
      update: {
        firstName: t.firstName,
        middleName: t.middleName,
        lastName: t.lastName,
        email: t.email,
        sex: t.sex,
        roles: [Role.TEACHER]
      },
      create: {
        employeeId: t.employeeId,
        firstName: t.firstName,
        middleName: t.middleName,
        lastName: t.lastName,
        email: t.email,
        sex: t.sex,
        password: defaultPassword,
        roles: [Role.TEACHER],
      }
    });

    await prisma.teacher.upsert({
      where: { employeeId: t.employeeId },
      update: {
        middleName: t.middleName,
        email: t.email,
        contactNumber: t.contactNumber,
        specialization: t.specialization,
        undergraduateDegree: t.undergraduateDegree,
        postgraduateDegree: t.postgraduateDegree,
        majorSpecialization: t.majorSpecialization,
        minorSpecialization: t.minorSpecialization,
        plantillaPosition: t.plantillaPosition,
        designation: t.designation,
        birthdate: t.birthdate,
        personnelType: t.personnelType,
        functionalAssignment: t.functionalAssignment,
        userId: user.id,
      },
      create: {
        employeeId: t.employeeId,
        firstName: t.firstName,
        middleName: t.middleName,
        lastName: t.lastName,
        sex: t.sex,
        email: t.email,
        contactNumber: t.contactNumber,
        specialization: t.specialization,
        undergraduateDegree: t.undergraduateDegree,
        postgraduateDegree: t.postgraduateDegree,
        majorSpecialization: t.majorSpecialization,
        minorSpecialization: t.minorSpecialization,
        plantillaPosition: t.plantillaPosition,
        designation: t.designation,
        birthdate: t.birthdate,
        personnelType: t.personnelType,
        functionalAssignment: t.functionalAssignment,
        departments: { connect: [{ id: deptId }] },
        isActive: true,
        serviceStatus: "ACTIVE",
        natureOfAppointment: "REGULAR_PERMANENT",
        fundingSource: "NATIONAL",
        ancillaryRoles: [], // Do not assign ancillary minutes to the new dummy teachers
        userId: user.id,
      }
    });
    console.log(`Inserted dummy teacher ${t.employeeId} for department ${t.deptCode} (User ID: ${user.id})`);
  }

  // 3. Resolve the 3 no-department teachers
  const idleTeachers = [
    { employeeId: "1234501", deptCode: "MAPEH" }, // Jose Rizal
    { employeeId: "1234502", deptCode: "SCI" },   // Apolinario Mabini
    { employeeId: "1234503", deptCode: "SCI" },   // Melchora Aquino
  ];

  for (const idle of idleTeachers) {
    const deptId = getDeptId(idle.deptCode);
    if (deptId) {
      await prisma.teacher.update({
        where: { employeeId: idle.employeeId },
        data: { departments: { connect: [{ id: deptId }] } }
      });
      console.log(`Updated idle teacher ${idle.employeeId} with department ${idle.deptCode}`);
    } else {
      console.warn(`Department ${idle.deptCode} not found for idle teacher ${idle.employeeId}`);
    }
  }

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
