import { PrismaClient } from "./src/generated/prisma/index.js";

const prisma = new PrismaClient();

async function checkSettings() {
  try {
    const settings = await prisma.schoolSetting.findFirst({
      include: {
        activeSchoolYear: true
      }
    });

    if (!settings) {
      console.log("No school settings found.");
      return;
    }

    console.log("School Name:", settings.schoolName);
    console.log("Active School Year ID:", settings.activeSchoolYearId);
    
    if (settings.activeSchoolYear) {
      const sy = settings.activeSchoolYear;
      console.log("SY Label:", sy.yearLabel);
      console.log("SY Status:", sy.status);
      console.log("Manual Override:", sy.isManualOverrideOpen);
      console.log("Early Reg Open:", sy.earlyRegOpenDate);
      console.log("Early Reg Close:", sy.earlyRegCloseDate);
      console.log("Enrollment Open:", sy.enrollOpenDate);
      console.log("Enrollment Close:", sy.enrollCloseDate);
      
      const now = new Date();
      console.log("Current Time (UTC):", now.toISOString());
      
      // Manila Time check (Approximate since we're in JS)
      const manilaNow = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);
      console.log("Manila Today:", manilaNow);
    } else {
      console.log("No active school year linked to settings.");
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

checkSettings();
