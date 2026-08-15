import "dotenv/config";
import { PrismaClient, TeacherNatureOfAppointment, TeacherFundingSource } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function fixTeacherFields() {
  console.log("🛠️ Starting Teacher Fields Fix Script...");

  try {
    const teachers = await prisma.teacher.findMany({
      include: { department: true }
    });

    if (teachers.length === 0) {
      console.log("ℹ️ No teachers found in the database.");
      return;
    }

    console.log(`Found ${teachers.length} teachers. Checking and fixing fields...`);

    let updatedCount = 0;

    for (const teacher of teachers) {
      const isMissingFields =
        !teacher.birthdate ||
        !teacher.personnelType ||
        !teacher.undergraduateDegree ||
        !teacher.postgraduateDegree ||
        !teacher.majorSpecialization ||
        !teacher.minorSpecialization ||
        !teacher.indigenousCommunity;

      if (isMissingFields) {
        // Random birthdate between 1980 and 1995
        const year = 1980 + Math.floor(Math.random() * 16);
        const month = Math.floor(Math.random() * 12);
        const day = 1 + Math.floor(Math.random() * 28);
        const birthdate = teacher.birthdate || new Date(year, month, day);

        const personnelType = teacher.personnelType || "TEACHING";
        const undergraduateDegree = teacher.undergraduateDegree || "BACHELOR OF SECONDARY EDUCATION";
        const postgraduateDegree = teacher.postgraduateDegree || "NONE";
        
        let major = teacher.majorSpecialization || "GENERAL EDUCATION";
        let minor = teacher.minorSpecialization || "NONE";

        if (!teacher.majorSpecialization && teacher.department) {
          major = teacher.department.name.toUpperCase();
        }

        const indigenousCommunity = teacher.indigenousCommunity || "NOT_APPLICABLE";
        
        await prisma.teacher.update({
          where: { id: teacher.id },
          data: {
            birthdate,
            personnelType,
            undergraduateDegree,
            postgraduateDegree,
            majorSpecialization: major,
            minorSpecialization: minor,
            indigenousCommunity,
            natureOfAppointment: TeacherNatureOfAppointment.REGULAR_PERMANENT,
            fundingSource: TeacherFundingSource.NATIONAL
          }
        });
        
        updatedCount++;
      }
    }

    console.log(`✅ Successfully updated ${updatedCount} teachers with complete realistic data.`);
  } catch (error) {
    console.error("❌ Error running fix script:", error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

fixTeacherFields();
