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
var shared_1 = require("@enrollpro/shared");
var pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
var adapter = new adapter_pg_1.PrismaPg(pool);
var prisma = new index_js_1.PrismaClient({ adapter: adapter });
var SCP_TYPES = [
    "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
    "SPECIAL_PROGRAM_IN_THE_ARTS",
    "SPECIAL_PROGRAM_IN_SPORTS",
    "SPECIAL_PROGRAM_IN_JOURNALISM",
    "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
    "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
];
var PROGRAM_PREFIX = {
    REGULAR: "REG",
    SCIENCE_TECHNOLOGY_AND_ENGINEERING: "STE",
    SPECIAL_PROGRAM_IN_THE_ARTS: "SPA",
    SPECIAL_PROGRAM_IN_SPORTS: "SPS",
    SPECIAL_PROGRAM_IN_JOURNALISM: "SPJ",
    SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: "SPFL",
    SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: "SPTVE",
};
var DEFAULT_SCP_OPTIONS = {
    SPECIAL_PROGRAM_IN_THE_ARTS: [
        { optionType: "ART_FIELD", value: "MUSIC" },
        { optionType: "ART_FIELD", value: "DANCE" },
        { optionType: "ART_FIELD", value: "VISUAL_ARTS" },
    ],
    SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: [
        { optionType: "LANGUAGE", value: "MANDARIN" },
        { optionType: "LANGUAGE", value: "JAPANESE" },
    ],
    SPECIAL_PROGRAM_IN_SPORTS: [
        { optionType: "SPORT", value: "BASKETBALL" },
        { optionType: "SPORT", value: "VOLLEYBALL" },
        { optionType: "SPORT", value: "ATHLETICS" },
    ],
};
var PH_FIRST_NAMES = [
    "Juan",
    "Maria",
    "Jose",
    "Angelica",
    "Miguel",
    "Princess",
    "Carlo",
    "Jasmine",
    "Rafael",
    "Nicole",
    "Paolo",
    "Gabriela",
];
var PH_MIDDLE_NAMES = [
    "Santos",
    "Reyes",
    "Garcia",
    "Cruz",
    "Mendoza",
    "Aquino",
    "Flores",
    "Navarro",
    "Torres",
    "Bautista",
    "Castro",
    "Valdez",
];
var PH_LAST_NAMES = [
    "Dela Cruz",
    "Reyes",
    "Santos",
    "Garcia",
    "Mendoza",
    "Fernandez",
    "Navarro",
    "Ramos",
    "Bautista",
    "Gonzales",
    "Torres",
    "Villanueva",
];
var PH_PLACE_OF_BIRTHS = [
    "Tandag City, Surigao del Sur",
    "Bislig City, Surigao del Sur",
    "Butuan City, Agusan del Norte",
    "Davao City, Davao del Sur",
    "Cebu City, Cebu",
    "Iligan City, Lanao del Norte",
];
var PH_RELIGIONS = [
    "ROMAN CATHOLIC",
    "IGLESIA NI CRISTO",
    "SEVENTH-DAY ADVENTIST",
    "ISLAM",
    "BORN AGAIN CHRISTIAN",
    "UNITED CHURCH OF CHRIST IN THE PHILIPPINES",
];
var PH_MOTHER_TONGUES = [
    "CEBUANO",
    "TAGALOG",
    "SURIGAONON",
    "MANDAYA",
    "BISAYA",
    "ENGLISH",
];
var SCP_DEFAULT_CUTOFFS = {
    SCIENCE_TECHNOLOGY_AND_ENGINEERING: 85,
    SPECIAL_PROGRAM_IN_THE_ARTS: 80,
    SPECIAL_PROGRAM_IN_SPORTS: 82,
    SPECIAL_PROGRAM_IN_JOURNALISM: 80,
    SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: 78,
    SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: 79,
};
function getPipelineForScpType(scpType, isTwoPhase) {
    var _a;
    if (scpType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING") {
        return (0, shared_1.getSteSteps)(isTwoPhase);
    }
    return (_a = shared_1.SCP_DEFAULT_PIPELINES[scpType]) !== null && _a !== void 0 ? _a : [];
}
function buildTrackingNumber(scpType, year, sequence) {
    return "".concat(PROGRAM_PREFIX[scpType], "-").concat(year, "-").concat(String(sequence).padStart(5, "0"));
}
function buildContactNumber(sequence) {
    var lastNineDigits = String(100000000 + sequence).slice(-9);
    return "09".concat(lastNineDigits);
}
function buildEmail(firstName, lastName, sequence) {
    var safeFirst = firstName.toLowerCase().replace(/[^a-z0-9]+/g, "");
    var safeLast = lastName.toLowerCase().replace(/[^a-z0-9]+/g, "");
    return "".concat(safeFirst, ".").concat(safeLast).concat(sequence, "@example.com");
}
function buildPsaBirthCertNumber(sequence) {
    return "PSA-".concat(new Date().getUTCFullYear(), "-").concat(String(sequence).padStart(8, "0"));
}
function buildScpCutoffScore(scpType) {
    var _a;
    return (_a = SCP_DEFAULT_CUTOFFS[scpType]) !== null && _a !== void 0 ? _a : 75;
}
function buildScpGradeRequirements(scpType) {
    var rules = [
        {
            ruleType: "GENERAL_AVERAGE_MIN",
            minAverage: 85,
            subjects: [],
            subjectThresholds: [],
        },
    ];
    if (scpType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING") {
        rules.push({
            ruleType: "SUBJECT_AVERAGE_MIN",
            minAverage: 85,
            subjects: ["ENGLISH", "SCIENCE", "MATHEMATICS"],
            subjectThresholds: [],
        });
    }
    return rules;
}
function buildScpRankingFormula(scpType) {
    if (scpType === "SPECIAL_PROGRAM_IN_SPORTS") {
        return {
            components: [
                { metric: "sports_skills_tryout", weight: 0.7 },
                { metric: "interview", weight: 0.2 },
                { metric: "general_average", weight: 0.1 },
            ],
            tieBreaker: ["sports_skills_tryout", "general_average", "lrn"],
        };
    }
    return {
        components: [
            { metric: "qualifying_exam", weight: 0.6 },
            { metric: "interview", weight: 0.25 },
            { metric: "general_average", weight: 0.15 },
        ],
        tieBreaker: ["qualifying_exam", "general_average", "lrn"],
    };
}
function buildStepCutoffScore(kind, defaultCutoff) {
    return kind === "INTERVIEW" ? null : defaultCutoff;
}
function buildProgramStepDate(stepOrder) {
    var baseYear = new Date().getUTCFullYear();
    return new Date(Date.UTC(baseYear, 0, 10 + stepOrder * 4));
}
function seedScpConfigurations(schoolYearId) {
    return __awaiter(this, void 0, void 0, function () {
        var _loop_1, _i, SCP_TYPES_1, scpType;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _loop_1 = function (scpType) {
                        var cutoffScore, gradeRequirements, rankingFormula, config, pipeline, optionData;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    cutoffScore = buildScpCutoffScore(scpType);
                                    gradeRequirements = buildScpGradeRequirements(scpType);
                                    rankingFormula = buildScpRankingFormula(scpType);
                                    return [4 /*yield*/, prisma.scpProgramConfig.upsert({
                                            where: {
                                                uq_scp_program_configs_type: {
                                                    schoolYearId: schoolYearId,
                                                    scpType: scpType,
                                                },
                                            },
                                            update: {
                                                isOffered: true,
                                                cutoffScore: cutoffScore,
                                                gradeRequirements: gradeRequirements,
                                                rankingFormula: rankingFormula,
                                            },
                                            create: {
                                                schoolYearId: schoolYearId,
                                                scpType: scpType,
                                                isOffered: true,
                                                isTwoPhase: false,
                                                cutoffScore: cutoffScore,
                                                gradeRequirements: gradeRequirements,
                                                rankingFormula: rankingFormula,
                                            },
                                        })];
                                case 1:
                                    config = _c.sent();
                                    pipeline = getPipelineForScpType(scpType, config.isTwoPhase);
                                    return [4 /*yield*/, prisma.scpProgramStep.deleteMany({
                                            where: { scpProgramConfigId: config.id },
                                        })];
                                case 2:
                                    _c.sent();
                                    if (!(pipeline.length > 0)) return [3 /*break*/, 4];
                                    return [4 /*yield*/, prisma.scpProgramStep.createMany({
                                            data: pipeline.map(function (step) { return ({
                                                scpProgramConfigId: config.id,
                                                stepOrder: step.stepOrder,
                                                kind: step.kind,
                                                label: step.label,
                                                description: step.description,
                                                isRequired: step.isRequired,
                                                scheduledDate: buildProgramStepDate(step.stepOrder),
                                                scheduledTime: "08:00",
                                                venue: "".concat(PROGRAM_PREFIX[scpType], " Assessment Center"),
                                                notes: "Default schedule for ".concat(scpType, " pipeline step ").concat(step.stepOrder, "."),
                                                cutoffScore: buildStepCutoffScore(step.kind, cutoffScore),
                                            }); }),
                                        })];
                                case 3:
                                    _c.sent();
                                    _c.label = 4;
                                case 4: return [4 /*yield*/, prisma.scpProgramOption.deleteMany({
                                        where: { scpProgramConfigId: config.id },
                                    })];
                                case 5:
                                    _c.sent();
                                    optionData = ((_a = DEFAULT_SCP_OPTIONS[scpType]) !== null && _a !== void 0 ? _a : []).map(function (option) { return ({
                                        scpProgramConfigId: config.id,
                                        optionType: option.optionType,
                                        value: option.value,
                                    }); });
                                    if (!(optionData.length > 0)) return [3 /*break*/, 7];
                                    return [4 /*yield*/, prisma.scpProgramOption.createMany({ data: optionData })];
                                case 6:
                                    _c.sent();
                                    _c.label = 7;
                                case 7:
                                    console.log("Configured ".concat(scpType, ": ").concat(pipeline.length, " step(s), ").concat(optionData.length, " option(s)."));
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, SCP_TYPES_1 = SCP_TYPES;
                    _b.label = 1;
                case 1:
                    if (!(_i < SCP_TYPES_1.length)) return [3 /*break*/, 4];
                    scpType = SCP_TYPES_1[_i];
                    return [5 /*yield**/, _loop_1(scpType)];
                case 2:
                    _b.sent();
                    _b.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function seedScpApplications(schoolYearId, gradeLevelId, encodedById) {
    return __awaiter(this, void 0, void 0, function () {
        var year, globalCounter, _i, SCP_TYPES_2, scpType, i, seedNumber, firstName, middleName, lastName, lrn, sex, extensionName, placeOfBirth, religion, motherTongue, isIpCommunity, isLearnerWithDisability, is4PsBeneficiary, isBalikAral, disabilityTypes, ipGroupName, specialNeedsCategory, householdId4Ps, lastYearEnrolled, lastGradeLevel, birthMonth, birthDay, birthdate, psaBirthCertNumber, trackingNumber, learner, contactNumber, email, submittedAt, primaryContact, guardianRelationship, application;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    year = new Date().getFullYear();
                    globalCounter = 1;
                    _i = 0, SCP_TYPES_2 = SCP_TYPES;
                    _a.label = 1;
                case 1:
                    if (!(_i < SCP_TYPES_2.length)) return [3 /*break*/, 8];
                    scpType = SCP_TYPES_2[_i];
                    i = 1;
                    _a.label = 2;
                case 2:
                    if (!(i <= 3)) return [3 /*break*/, 7];
                    seedNumber = globalCounter;
                    firstName = PH_FIRST_NAMES[(seedNumber - 1) % PH_FIRST_NAMES.length];
                    middleName = PH_MIDDLE_NAMES[(seedNumber - 1) % PH_MIDDLE_NAMES.length];
                    lastName = PH_LAST_NAMES[(seedNumber - 1) % PH_LAST_NAMES.length];
                    lrn = "190000".concat(String(seedNumber).padStart(6, "0"));
                    sex = seedNumber % 2 === 0 ? "FEMALE" : "MALE";
                    extensionName = seedNumber % 6 === 0 ? "JR" : null;
                    placeOfBirth = PH_PLACE_OF_BIRTHS[(seedNumber - 1) % PH_PLACE_OF_BIRTHS.length];
                    religion = PH_RELIGIONS[(seedNumber - 1) % PH_RELIGIONS.length];
                    motherTongue = PH_MOTHER_TONGUES[(seedNumber - 1) % PH_MOTHER_TONGUES.length];
                    isIpCommunity = seedNumber % 7 === 0;
                    isLearnerWithDisability = seedNumber % 5 === 0;
                    is4PsBeneficiary = seedNumber % 4 === 0;
                    isBalikAral = seedNumber % 11 === 0;
                    disabilityTypes = isLearnerWithDisability
                        ? ["HEARING IMPAIRMENT"]
                        : [];
                    ipGroupName = isIpCommunity ? "MANOBO" : null;
                    specialNeedsCategory = isLearnerWithDisability
                        ? "HEARING IMPAIRMENT"
                        : null;
                    householdId4Ps = is4PsBeneficiary
                        ? "4PS-".concat(String(seedNumber).padStart(6, "0"))
                        : null;
                    lastYearEnrolled = isBalikAral ? String(year - 2) : null;
                    lastGradeLevel = isBalikAral ? "Grade 6" : null;
                    birthMonth = (seedNumber % 12) + 1;
                    birthDay = ((seedNumber * 3) % 28) + 1;
                    birthdate = new Date("2014-".concat(String(birthMonth).padStart(2, "0"), "-").concat(String(birthDay).padStart(2, "0")));
                    psaBirthCertNumber = buildPsaBirthCertNumber(seedNumber);
                    trackingNumber = buildTrackingNumber(scpType, year, seedNumber);
                    return [4 /*yield*/, prisma.learner.upsert({
                            where: { lrn: lrn },
                            update: {
                                isPendingLrnCreation: false,
                                psaBirthCertNumber: psaBirthCertNumber,
                                firstName: firstName,
                                middleName: middleName,
                                lastName: lastName,
                                extensionName: extensionName,
                                birthdate: birthdate,
                                sex: sex,
                                studentPhoto: "/uploads/students/".concat(trackingNumber.toLowerCase(), ".jpg"),
                                placeOfBirth: placeOfBirth,
                                religion: religion,
                                motherTongue: motherTongue,
                                isIpCommunity: isIpCommunity,
                                ipGroupName: ipGroupName,
                                isLearnerWithDisability: isLearnerWithDisability,
                                disabilityTypes: disabilityTypes,
                                specialNeedsCategory: specialNeedsCategory,
                                hasPwdId: isLearnerWithDisability,
                                is4PsBeneficiary: is4PsBeneficiary,
                                householdId4Ps: householdId4Ps,
                                isBalikAral: isBalikAral,
                                lastYearEnrolled: lastYearEnrolled,
                                lastGradeLevel: lastGradeLevel,
                            },
                            create: {
                                lrn: lrn,
                                isPendingLrnCreation: false,
                                psaBirthCertNumber: psaBirthCertNumber,
                                firstName: firstName,
                                middleName: middleName,
                                lastName: lastName,
                                extensionName: extensionName,
                                birthdate: birthdate,
                                sex: sex,
                                studentPhoto: "/uploads/students/".concat(trackingNumber.toLowerCase(), ".jpg"),
                                placeOfBirth: placeOfBirth,
                                religion: religion,
                                motherTongue: motherTongue,
                                isIpCommunity: isIpCommunity,
                                ipGroupName: ipGroupName,
                                isLearnerWithDisability: isLearnerWithDisability,
                                disabilityTypes: disabilityTypes,
                                specialNeedsCategory: specialNeedsCategory,
                                hasPwdId: isLearnerWithDisability,
                                is4PsBeneficiary: is4PsBeneficiary,
                                householdId4Ps: householdId4Ps,
                                isBalikAral: isBalikAral,
                                lastYearEnrolled: lastYearEnrolled,
                                lastGradeLevel: lastGradeLevel,
                            },
                        })];
                case 3:
                    learner = _a.sent();
                    contactNumber = buildContactNumber(seedNumber);
                    email = buildEmail(firstName, lastName, seedNumber);
                    submittedAt = new Date(Date.UTC(year, 0, 5 + seedNumber));
                    primaryContact = seedNumber % 3 === 0
                        ? "GUARDIAN"
                        : seedNumber % 2 === 0
                            ? "MOTHER"
                            : "FATHER";
                    guardianRelationship = primaryContact === "GUARDIAN" ? "AUNT" : primaryContact;
                    return [4 /*yield*/, prisma.earlyRegistrationApplication.upsert({
                            where: { trackingNumber: trackingNumber },
                            update: {
                                learnerId: learner.id,
                                schoolYearId: schoolYearId,
                                gradeLevelId: gradeLevelId,
                                applicantType: scpType,
                                learnerType: "NEW_ENROLLEE",
                                status: "SUBMITTED_BEERF",
                                channel: "F2F",
                                contactNumber: contactNumber,
                                email: email,
                                primaryContact: primaryContact,
                                guardianRelationship: guardianRelationship,
                                hasNoMother: false,
                                hasNoFather: false,
                                isPrivacyConsentGiven: true,
                                encodedById: encodedById,
                                verifiedAt: null,
                                verifiedById: null,
                                submittedAt: submittedAt,
                            },
                            create: {
                                learnerId: learner.id,
                                schoolYearId: schoolYearId,
                                gradeLevelId: gradeLevelId,
                                trackingNumber: trackingNumber,
                                applicantType: scpType,
                                learnerType: "NEW_ENROLLEE",
                                status: "SUBMITTED_BEERF",
                                channel: "F2F",
                                contactNumber: contactNumber,
                                email: email,
                                primaryContact: primaryContact,
                                guardianRelationship: guardianRelationship,
                                hasNoMother: false,
                                hasNoFather: false,
                                isPrivacyConsentGiven: true,
                                encodedById: encodedById,
                                verifiedAt: null,
                                verifiedById: null,
                                submittedAt: submittedAt,
                            },
                        })];
                case 4:
                    application = _a.sent();
                    // Keep SCP seeding focused on learner + core application data only.
                    return [4 /*yield*/, Promise.all([
                            prisma.applicationChecklist.deleteMany({
                                where: { earlyRegistrationId: application.id },
                            }),
                            prisma.applicationFamilyMember.deleteMany({
                                where: { earlyRegistrationId: application.id },
                            }),
                            prisma.applicationAddress.deleteMany({
                                where: { earlyRegistrationId: application.id },
                            }),
                            prisma.earlyRegistrationAssessment.deleteMany({
                                where: { applicationId: application.id },
                            }),
                        ])];
                case 5:
                    // Keep SCP seeding focused on learner + core application data only.
                    _a.sent();
                    console.log("Seeded SCP application ".concat(trackingNumber, " (").concat(scpType, ")."));
                    globalCounter++;
                    _a.label = 6;
                case 6:
                    i++;
                    return [3 /*break*/, 2];
                case 7:
                    _i++;
                    return [3 /*break*/, 1];
                case 8: return [2 /*return*/];
            }
        });
    });
}
function seed() {
    return __awaiter(this, void 0, void 0, function () {
        var schoolYear, grade7, admin, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 6, 7, 10]);
                    return [4 /*yield*/, prisma.schoolYear.findFirst({
                            where: { status: "ACTIVE" },
                        })];
                case 1:
                    schoolYear = _a.sent();
                    if (!schoolYear) {
                        throw new Error("No active school year found. Run db:seed first and ensure one school year is ACTIVE.");
                    }
                    return [4 /*yield*/, prisma.gradeLevel.findFirst({
                            where: {
                                schoolYearId: schoolYear.id,
                                OR: [{ name: "Grade 7" }, { displayOrder: 7 }],
                            },
                            orderBy: { id: "asc" },
                        })];
                case 2:
                    grade7 = _a.sent();
                    if (!grade7) {
                        throw new Error('Grade level "Grade 7" (displayOrder 7) not found for the active school year.');
                    }
                    return [4 /*yield*/, prisma.user.findFirst({
                            where: { role: "SYSTEM_ADMIN" },
                            select: { id: true },
                            orderBy: { id: "asc" },
                        })];
                case 3:
                    admin = _a.sent();
                    if (!admin) {
                        throw new Error("No SYSTEM_ADMIN user found. Run db:seed first.");
                    }
                    console.log("Using School Year: ".concat(schoolYear.yearLabel));
                    return [4 /*yield*/, seedScpConfigurations(schoolYear.id)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, seedScpApplications(schoolYear.id, grade7.id, admin.id)];
                case 5:
                    _a.sent();
                    console.log("SCP seeding completed.");
                    return [3 /*break*/, 10];
                case 6:
                    error_1 = _a.sent();
                    console.error("ERROR during SCP seeding:", error_1);
                    process.exitCode = 1;
                    return [3 /*break*/, 10];
                case 7: return [4 /*yield*/, prisma.$disconnect()];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, pool.end()];
                case 9:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 10: return [2 /*return*/];
            }
        });
    });
}
seed();
