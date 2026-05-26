/**
 * Maintenance seed: Backfill missing important data for enrolled learners.
 *
 * Targets EnrollmentApplication records with status ENROLLED / OFFICIALLY_ENROLLED
 * that are missing any of the following:
 *   - readingProfileLevel  (PHIL-IRI / reading assessment result)
 *   - ApplicationFamilyMember records (Mother / Father / Guardian)
 *   - contactNumber on family members
 *   - email on family members
 *   - ApplicationAddress (current address)
 *
 * Run with:
 *   pnpm --filter server exec tsx prisma/seeds/maintenance/backfill-missing-learner-data.ts
 */

import "dotenv/config";
import {
  PrismaClient,
  FamilyRelationship,
  AddressType,
  ReadingProfileLevel,
} from "../../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Lookup tables for realistic Filipino placeholder data
// ---------------------------------------------------------------------------

const PH_FIRST_NAMES_FEMALE = [
  "MARIA",
  "ANGELICA",
  "PRINCESS",
  "JASMINE",
  "NICOLE",
  "GABRIELA",
  "SOFIA",
  "ISABELLA",
  "LIZA",
  "CRISTINA",
  "PATRICIA",
  "ELENA",
  "ROSA",
  "TERESA",
  "CORAZON",
  "LETICIA",
  "LEONORA",
  "IMELDA",
  "GLORIA",
  "REMEDIOS",
];

const PH_FIRST_NAMES_MALE = [
  "JUAN",
  "JOSE",
  "MIGUEL",
  "CARLO",
  "RAFAEL",
  "PAOLO",
  "ANTONIO",
  "GABRIEL",
  "MATEO",
  "DIEGO",
  "EMMANUEL",
  "CHRISTIAN",
  "JOSHUA",
  "ANGELO",
  "RICARDO",
  "ERNESTO",
  "ORLANDO",
  "SALVADOR",
  "EFREN",
  "ROLANDO",
];

const PH_LAST_NAMES = [
  "DELA CRUZ",
  "REYES",
  "SANTOS",
  "GARCIA",
  "MENDOZA",
  "FERNANDEZ",
  "NAVARRO",
  "RAMOS",
  "BAUTISTA",
  "GONZALES",
  "TORRES",
  "VILLANUEVA",
  "CRUZ",
  "PASCUAL",
  "AQUINO",
  "LUNA",
  "CASTRO",
  "BELTRAN",
  "VILLAR",
  "ZUBIRI",
];

const PH_MIDDLE_NAMES = [
  "SANTIAGO",
  "DE LEON",
  "BALTAZAR",
  "CASTILLO",
  "SORIANO",
  "DEL ROSARIO",
  "VALDEZ",
  "RODRIGUEZ",
  "MABINI",
  "PANGANIBAN",
];

const PH_BARANGAYS = [
  "BARANGAY 1",
  "BARANGAY 2",
  "SAN ISIDRO",
  "STA. LUCIA",
  "SANTO NIÑO",
  "CONCEPCION",
  "MALANDAY",
  "POBLACION",
  "SAN JOSE",
  "BAGONG BAYAN",
];

const PH_CITIES = [
  "QUEZON CITY",
  "MANILA",
  "CALOOCAN",
  "DAVAO CITY",
  "CEBU CITY",
  "ANTIPOLO",
  "PASIG",
  "TAGUIG",
  "VALENZUELA",
  "MAKATI",
];

const READING_LEVELS: ReadingProfileLevel[] = [
  "INDEPENDENT",
  "INSTRUCTIONAL",
  "FRUSTRATION",
  "NON_READER",
];

const MOTHER_OCCUPATIONS = [
  "HOUSEWIFE",
  "TEACHER",
  "NURSE",
  "VENDOR",
  "GOVERNMENT EMPLOYEE",
  "SELF-EMPLOYED",
  "OFW",
  "FACTORY WORKER",
];

const FATHER_OCCUPATIONS = [
  "DRIVER",
  "CARPENTER",
  "ENGINEER",
  "GOVERNMENT EMPLOYEE",
  "SECURITY GUARD",
  "FARMER",
  "FISHERMAN",
  "SELF-EMPLOYED",
  "OFW",
  "FACTORY WORKER",
];

// ---------------------------------------------------------------------------
// Deterministic helpers (seed-stable, index-based)
// ---------------------------------------------------------------------------

function pick<T>(arr: T[], idx: number): T {
  return arr[Math.abs(idx) % arr.length];
}

function phoneNumber(seed: number): string {
  // 09XX-XXX-XXXX pattern
  const prefixes = [
    "0912",
    "0917",
    "0921",
    "0927",
    "0932",
    "0939",
    "0947",
    "0956",
  ];
  const prefix = pick(prefixes, seed);
  const rest = String((seed * 7919 + 12345) % 10_000_000).padStart(7, "0");
  return `${prefix}${rest}`;
}

function emailFor(firstName: string, lastName: string, seed: number): string {
  const first = firstName.toLowerCase().replace(/[^a-z]/g, "");
  const last = lastName.toLowerCase().replace(/[^a-z]/g, "");
  const domains = ["gmail.com", "yahoo.com", "outlook.com"];
  const domain = pick(domains, seed);
  return `${first}.${last}${seed % 100}@${domain}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("🔍 Backfill: Scanning enrolled learners for missing data...\n");

  const admin = await prisma.user.findFirst({
    where: { role: { in: ["SYSTEM_ADMIN", "HEAD_REGISTRAR"] } },
  });
  if (!admin)
    throw new Error(
      "No SYSTEM_ADMIN or HEAD_REGISTRAR found. Run base seed first.",
    );

  // Fetch all ENROLLED / OFFICIALLY_ENROLLED applications with related data
  const enrolledApps = await prisma.enrollmentApplication.findMany({
    where: {
      status: { in: ["ENROLLED", "OFFICIALLY_ENROLLED"] },
    },
    include: {
      learner: true,
      familyMembers: true,
      addresses: true,
    },
    orderBy: { id: "asc" },
  });

  console.log(
    `📋 Found ${enrolledApps.length} enrolled application(s) to inspect.\n`,
  );

  let readingFixed = 0;
  let familyFixed = 0;
  let contactFixed = 0;
  let emailFixed = 0;
  let addressFixed = 0;

  for (let i = 0; i < enrolledApps.length; i++) {
    const app = enrolledApps[i];
    const learner = app.learner;
    const seed = learner.id + i; // stable per-learner seed

    // -----------------------------------------------------------------------
    // 1. Reading profile level (PHIL-IRI result)
    // -----------------------------------------------------------------------
    if (!app.readingProfileLevel) {
      const level = pick(READING_LEVELS, seed);
      await prisma.enrollmentApplication.update({
        where: { id: app.id },
        data: {
          readingProfileLevel: level,
          readingProfileAssessedAt: new Date(),
          readingProfileAssessedById: admin.id,
        },
      });
      readingFixed++;
      console.log(
        `  ✅ [App #${app.id}] ${learner.lastName}, ${learner.firstName} — Reading level set to ${level}`,
      );
    }

    // -----------------------------------------------------------------------
    // 2. Family members: ensure MOTHER exists (required for contact info)
    // -----------------------------------------------------------------------
    const existingRelationships = new Set(
      app.familyMembers.map((fm) => fm.relationship),
    );

    const membersToCreate: {
      enrollmentId: number;
      relationship: FamilyRelationship;
      firstName: string;
      lastName: string;
      middleName: string;
      contactNumber: string;
      email: string;
      occupation: string;
      maidenName?: string;
    }[] = [];

    // Always ensure MOTHER unless hasNoMother is flagged
    if (!existingRelationships.has("MOTHER") && !app.hasNoMother) {
      const mFirstName = pick(PH_FIRST_NAMES_FEMALE, seed + 100);
      const mLastName = learner.lastName; // same surname by default
      const mMiddleName = pick(PH_MIDDLE_NAMES, seed + 101);
      membersToCreate.push({
        enrollmentId: app.id,
        relationship: "MOTHER",
        firstName: mFirstName,
        lastName: mLastName,
        middleName: mMiddleName,
        maidenName: pick(PH_LAST_NAMES, seed + 102),
        contactNumber: phoneNumber(seed + 200),
        email: emailFor(mFirstName, mLastName, seed + 200),
        occupation: pick(MOTHER_OCCUPATIONS, seed),
      });
    }

    // Ensure FATHER unless hasNoFather is flagged
    if (!existingRelationships.has("FATHER") && !app.hasNoFather) {
      const fFirstName = pick(PH_FIRST_NAMES_MALE, seed + 300);
      const fLastName = learner.lastName;
      const fMiddleName = pick(PH_MIDDLE_NAMES, seed + 301);
      membersToCreate.push({
        enrollmentId: app.id,
        relationship: "FATHER",
        firstName: fFirstName,
        lastName: fLastName,
        middleName: fMiddleName,
        contactNumber: phoneNumber(seed + 400),
        email: emailFor(fFirstName, fLastName, seed + 400),
        occupation: pick(FATHER_OCCUPATIONS, seed),
      });
    }

    // If both mother and father are flagged absent, ensure a GUARDIAN exists
    if (
      app.hasNoMother &&
      app.hasNoFather &&
      !existingRelationships.has("GUARDIAN")
    ) {
      const gFirstName = pick(PH_FIRST_NAMES_FEMALE, seed + 500);
      const gLastName = pick(PH_LAST_NAMES, seed + 501);
      const gMiddleName = pick(PH_MIDDLE_NAMES, seed + 502);
      membersToCreate.push({
        enrollmentId: app.id,
        relationship: "GUARDIAN",
        firstName: gFirstName,
        lastName: gLastName,
        middleName: gMiddleName,
        contactNumber: phoneNumber(seed + 600),
        email: emailFor(gFirstName, gLastName, seed + 600),
        occupation: "RELATIVE",
      });
    }

    if (membersToCreate.length > 0) {
      await prisma.applicationFamilyMember.createMany({
        data: membersToCreate,
        skipDuplicates: true,
      });
      familyFixed += membersToCreate.length;
      for (const m of membersToCreate) {
        console.log(
          `  👨‍👩‍👧 [App #${app.id}] ${learner.lastName}, ${learner.firstName} — Added ${m.relationship}: ${m.firstName} ${m.lastName}`,
        );
      }
    }

    // -----------------------------------------------------------------------
    // 3. Patch existing family members missing contact or email
    // -----------------------------------------------------------------------
    for (const fm of app.familyMembers) {
      const updates: { contactNumber?: string; email?: string } = {};
      const fmSeed = seed + fm.id;

      if (!fm.contactNumber) {
        updates.contactNumber = phoneNumber(fmSeed + 700);
        contactFixed++;
      }
      if (!fm.email) {
        updates.email = emailFor(fm.firstName, fm.lastName, fmSeed + 800);
        emailFixed++;
      }

      if (Object.keys(updates).length > 0) {
        await prisma.applicationFamilyMember.update({
          where: { id: fm.id },
          data: updates,
        });
        console.log(
          `  📞 [App #${app.id}] Family member ${fm.firstName} ${fm.lastName} (${fm.relationship}) — Patched: ${Object.keys(updates).join(", ")}`,
        );
      }
    }

    // -----------------------------------------------------------------------
    // 4. Current address
    // -----------------------------------------------------------------------
    const hasCurrentAddress = app.addresses.some(
      (a) => a.addressType === "CURRENT",
    );
    if (!hasCurrentAddress) {
      await prisma.applicationAddress.create({
        data: {
          enrollmentId: app.id,
          addressType: "CURRENT" as AddressType,
          houseNoStreet: `${100 + seed} Street`,
          barangay: pick(PH_BARANGAYS, seed),
          cityMunicipality: pick(PH_CITIES, seed),
          province: "METRO MANILA",
          country: "PHILIPPINES",
          zipCode: "1100",
        },
      });
      addressFixed++;
      console.log(
        `  🏠 [App #${app.id}] ${learner.lastName}, ${learner.firstName} — Address added`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("\n========== BACKFILL SUMMARY ==========");
  console.log(`  Reading profile (PHIL-IRI) fixed : ${readingFixed}`);
  console.log(`  Family members created           : ${familyFixed}`);
  console.log(`  Contact numbers patched          : ${contactFixed}`);
  console.log(`  Emails patched                   : ${emailFixed}`);
  console.log(`  Addresses added                  : ${addressFixed}`);
  console.log("======================================\n");

  if (
    readingFixed + familyFixed + contactFixed + emailFixed + addressFixed ===
    0
  ) {
    console.log(
      "✨ All enrolled learners already have complete data. Nothing to do.",
    );
  } else {
    console.log("✅ Backfill complete.");
  }
}

main()
  .catch((e) => {
    console.error("❌ Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
