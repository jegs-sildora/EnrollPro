import "dotenv/config";
import {
  PrismaClient,
  TLECategory,
  TLETrackType,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const EXPLORATORY_PROGRAMS: { name: string; category: TLECategory }[] = [
  { name: "Agri-Fishery Arts (AFA)", category: "AGRI_FISHERY_ARTS" },
  { name: "Home Economics (HE)", category: "HOME_ECONOMICS" },
  { name: "Industrial Arts (IA)", category: "INDUSTRIAL_ARTS" },
  { name: "Information and Communications Technology (ICT)", category: "ICT" },
];

const TRACK_TYPE: TLETrackType = "EXPLORATORY";

async function main() {
  console.log("Seeding default TLE Exploratory Programs...");

  for (const prog of EXPLORATORY_PROGRAMS) {
    await prisma.tLEProgram.upsert({
      where: { name: prog.name },
      update: { category: prog.category, trackType: TRACK_TYPE, isActive: true },
      create: {
        name: prog.name,
        category: prog.category,
        trackType: TRACK_TYPE,
        isActive: true,
      },
    });
    console.log(`  ✅ ${prog.name}`);
  }

  console.log("✅ Default TLE Exploratory Programs seeded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
