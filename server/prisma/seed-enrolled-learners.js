"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
var index_js_1 = require("../src/generated/prisma/index.js");
var adapter_pg_1 = require("@prisma/adapter-pg");
var pg = require("pg");
var pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
var adapter = new adapter_pg_1.PrismaPg(pool);
var prisma = new index_js_1.PrismaClient({ adapter: adapter });
var PH_FIRST_NAMES_MALE = ["Juan", "Jose", "Miguel", "Carlo", "Rafael", "Paolo", "Antonio", "Gabriel", "Mateo", "Diego"];
var PH_FIRST_NAMES_FEMALE = ["Maria", "Angelica", "Princess", "Jasmine", "Nicole", "Gabriela", "Sofia", "Isabella", "Liza", "Bea"];
var PH_LAST_NAMES = ["Dela Cruz", "Reyes", "Santos", "Garcia", "Mendoza", "Fernandez", "Navarro", "Ramos", "Bautista", "Gonzales", "Torres", "Villanueva"];
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var schoolYear, _a, grade7, admin, steA, steB, i, sectionName, pilot, heroes, i, hero, totalStudents, steApplicantCount, i, isSteApplicant, sex, firstName, lastName, lrn, learner, earlyRegId, earlyReg, readingLevels, readingProfileLevel;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log("🚀 Seeding 300 Verified Learners for HNHS Policy Testing...");
                    return [4 /*yield*/, prisma.schoolYear.findFirst({
                            where: { status: "ACTIVE" },
                        })];
                case 1:
                    _a = (_b.sent());
                    if (_a) return [3 /*break*/, 3];
                    return [4 /*yield*/, prisma.schoolYear.findFirst({ orderBy: { createdAt: "desc" } })];
                case 2:
                    _a = (_b.sent());
                    _b.label = 3;
                case 3:
                    schoolYear = _a;
                    if (!schoolYear)
                        throw new Error("No school year found. Run base seed first.");
                    return [4 /*yield*/, prisma.gradeLevel.findFirst({
                            where: { schoolYearId: schoolYear.id, name: { contains: "7" } }
                        })];
                case 4:
                    grade7 = _b.sent();
                    if (!grade7)
                        throw new Error("Grade 7 level not found.");
                    return [4 /*yield*/, prisma.user.findFirst({ where: { role: "SYSTEM_ADMIN" } })];
                case 5:
                    admin = _b.sent();
                    if (!admin)
                        throw new Error("No SYSTEM_ADMIN found.");
                    // 1.2 Seed Sections according to HNHS Policy
                    console.log("  - Seeding HNHS Policy compliant sections...");
                    return [4 /*yield*/, prisma.section.findFirst({ where: { name: "STE-A", gradeLevelId: grade7.id } })];
                case 6:
                    steA = _b.sent();
                    if (!!steA) return [3 /*break*/, 8];
                    return [4 /*yield*/, prisma.section.create({
                            data: {
                                name: "STE-A",
                                programType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
                                gradeLevelId: grade7.id,
                                maxCapacity: 35,
                                sortOrder: 1
                            }
                        })];
                case 7:
                    _b.sent();
                    _b.label = 8;
                case 8: return [4 /*yield*/, prisma.section.findFirst({ where: { name: "STE-B", gradeLevelId: grade7.id } })];
                case 9:
                    steB = _b.sent();
                    if (!!steB) return [3 /*break*/, 11];
                    return [4 /*yield*/, prisma.section.create({
                            data: {
                                name: "STE-B",
                                programType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
                                gradeLevelId: grade7.id,
                                maxCapacity: 35,
                                sortOrder: 2
                            }
                        })];
                case 10:
                    _b.sent();
                    _b.label = 11;
                case 11:
                    i = 1;
                    _b.label = 12;
                case 12:
                    if (!(i <= 5)) return [3 /*break*/, 16];
                    sectionName = "Section ".concat(i);
                    return [4 /*yield*/, prisma.section.findFirst({ where: { name: sectionName, gradeLevelId: grade7.id } })];
                case 13:
                    pilot = _b.sent();
                    if (!!pilot) return [3 /*break*/, 15];
                    return [4 /*yield*/, prisma.section.create({
                            data: {
                                name: sectionName,
                                programType: "REGULAR",
                                gradeLevelId: grade7.id,
                                maxCapacity: 40,
                                sortOrder: 10 + i,
                                isHomogeneous: true,
                                isSnake: false
                            }
                        })];
                case 14:
                    _b.sent();
                    _b.label = 15;
                case 15:
                    i++;
                    return [3 /*break*/, 12];
                case 16:
                    heroes = ["RIZAL", "BONIFACIO", "MABINI", "LUNA", "DEL PILAR", "SILANG"];
                    i = 0;
                    _b.label = 17;
                case 17:
                    if (!(i < heroes.length)) return [3 /*break*/, 21];
                    return [4 /*yield*/, prisma.section.findFirst({ where: { name: heroes[i], gradeLevelId: grade7.id } })];
                case 18:
                    hero = _b.sent();
                    if (!!hero) return [3 /*break*/, 20];
                    return [4 /*yield*/, prisma.section.create({
                            data: {
                                name: heroes[i],
                                programType: "REGULAR",
                                gradeLevelId: grade7.id,
                                maxCapacity: 40,
                                sortOrder: 20 + i,
                                isHomogeneous: false,
                                isSnake: true
                            }
                        })];
                case 19:
                    _b.sent();
                    _b.label = 20;
                case 20:
                    i++;
                    return [3 /*break*/, 17];
                case 21:
                    totalStudents = 400;
                    steApplicantCount = 100;
                    i = 1;
                    _b.label = 22;
                case 22:
                    if (!(i <= totalStudents)) return [3 /*break*/, 28];
                    isSteApplicant = i <= steApplicantCount;
                    sex = i % 2 === 0 ? "FEMALE" : "MALE";
                    firstName = sex === "MALE"
                        ? PH_FIRST_NAMES_MALE[i % PH_FIRST_NAMES_MALE.length]
                        : PH_FIRST_NAMES_FEMALE[i % PH_FIRST_NAMES_FEMALE.length];
                    lastName = PH_LAST_NAMES[i % PH_LAST_NAMES.length];
                    lrn = "2026".concat(String(i).padStart(8, '0'));
                    return [4 /*yield*/, prisma.learner.upsert({
                            where: { lrn: lrn },
                            update: {},
                            create: {
                                lrn: lrn,
                                firstName: firstName,
                                lastName: lastName,
                                middleName: "S.",
                                sex: sex,
                                birthdate: new Date("2013-05-15"),
                                placeOfBirth: "Hinigaran",
                                religion: "ROMAN CATHOLIC",
                                motherTongue: "HILIGAYNON"
                            }
                        })];
                case 23:
                    learner = _b.sent();
                    earlyRegId = null;
                    if (!isSteApplicant) return [3 /*break*/, 25];
                    return [4 /*yield*/, prisma.earlyRegistrationApplication.create({
                            data: {
                                learnerId: learner.id,
                                schoolYearId: schoolYear.id,
                                gradeLevelId: grade7.id,
                                trackingNumber: "STE-PRE-".concat(String(i).padStart(5, '0')),
                                applicantType: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
                                status: "READY_FOR_ENROLLMENT",
                                contactNumber: "09123456789",
                                isPrivacyConsentGiven: true,
                                assessments: {
                                    create: {
                                        type: "QUALIFYING_EXAMINATION",
                                        score: 70 + (Math.random() * 30), // Random score 70-100
                                        result: "PASSED",
                                        conductedAt: new Date()
                                    }
                                }
                            }
                        })];
                case 24:
                    earlyReg = _b.sent();
                    earlyRegId = earlyReg.id;
                    _b.label = 25;
                case 25:
                    readingLevels = ["INDEPENDENT", "INSTRUCTIONAL", "FRUSTRATION", "NON_READER"];
                    readingProfileLevel = i % 5 === 0
                        ? readingLevels[2 + (i % 2)] // FRUSTRATION or NON_READER
                        : readingLevels[i % 2];
                    // Create Enrollment Application in VERIFIED status
                    return [4 /*yield*/, prisma.enrollmentApplication.create({
                            data: {
                                learnerId: learner.id,
                                gradeLevelId: grade7.id,
                                schoolYearId: schoolYear.id,
                                earlyRegistrationId: earlyRegId,
                                applicantType: isSteApplicant ? "SCIENCE_TECHNOLOGY_AND_ENGINEERING" : "REGULAR",
                                learnerType: "NEW_ENROLLEE",
                                status: "VERIFIED", // Ready for Sectioning
                                trackingNumber: "ENR-2026-".concat(String(i).padStart(5, '0')),
                                isPrivacyConsentGiven: true,
                                readingProfileLevel: readingProfileLevel,
                                previousSchool: {
                                    create: {
                                        schoolName: "Hinigaran Elementary",
                                        schoolType: "Public",
                                        gradeCompleted: "Grade 6",
                                        schoolYearAttended: "2025-2026",
                                        // STE applicants generally have higher averages
                                        generalAverage: isSteApplicant ? (88 + Math.random() * 10) : (75 + Math.random() * 20)
                                    }
                                }
                            }
                        })];
                case 26:
                    // Create Enrollment Application in VERIFIED status
                    _b.sent();
                    if (i % 50 === 0)
                        console.log("  - Seeded ".concat(i, " verified learners..."));
                    _b.label = 27;
                case 27:
                    i++;
                    return [3 /*break*/, 22];
                case 28:
                    console.log("\n✨ Seeding Complete!");
                    console.log("--------------------------------------------------");
                    console.log("Total Verified Learners: 400");
                    console.log("STE Applicants (Tier 1): 100 (Expect 30 spillover)");
                    console.log("Regular Applicants     : 300");
                    console.log("--------------------------------------------------");
                    console.log("Ready to test Batch Sectioning Wizard for Grade 7.");
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) {
    console.error(e);
    process.exit(1);
})
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [4 /*yield*/, pool.end()];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
