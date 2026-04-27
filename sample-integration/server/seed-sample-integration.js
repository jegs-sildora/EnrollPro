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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
var index_js_1 = require("../../server/src/generated/prisma/index.js");
var adapter_pg_1 = require("@prisma/adapter-pg");
var bcrypt = require("bcryptjs");
var pg = require("pg");
var SAMPLE_TEACHER_EMPLOYEE_PREFIX = "SINT-T";
var SAMPLE_STAFF_EMAIL_SUFFIX = "@sample.integration.local";
var SAMPLE_LEARNER_LRN_PREFIX = "2099";
var SAMPLE_SECTION_PREFIX = "SINT-";
var SAMPLE_STAFF_PASSWORD = (_a = process.env.SAMPLE_INTEGRATION_PASSWORD) !== null && _a !== void 0 ? _a : "SampleIntegration2026!";
var pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
var adapter = new adapter_pg_1.PrismaPg(pool);
var prisma = new index_js_1.PrismaClient({ adapter: adapter });
var GRADE_NAME_BY_CODE = {
    G7: "Grade 7",
    G8: "Grade 8",
    G9: "Grade 9",
    G10: "Grade 10",
};
var TEACHER_SEEDS = [
    ["Ana", "Ramos", null, "MATHEMATICS"],
    ["Mark", "Santos", "Luna", "SCIENCE"],
    ["Joy", "Dizon", null, "ENGLISH"],
    ["Paolo", "Mendoza", "Cruz", "FILIPINO"],
    ["Rhea", "Torres", null, "ARALING PANLIPUNAN"],
    ["Carlo", "Villanueva", "Reyes", "MAPEH"],
    ["Lea", "Garcia", null, "TLE"],
    ["Joel", "Navarro", "Perez", "VALUES EDUCATION"],
    ["Grace", "Aquino", null, "ICT"],
    ["Nico", "Flores", "Diaz", "ESP"],
];
var STAFF_SEEDS = [
    ["System", "Admin One", "SYSTEM_ADMIN", "sysadmin1", "09180000001"],
    ["System", "Admin Two", "SYSTEM_ADMIN", "sysadmin2", "09180000002"],
    ["System", "Admin Three", "SYSTEM_ADMIN", "sysadmin3", "09180000003"],
    ["System", "Admin Four", "SYSTEM_ADMIN", "sysadmin4", "09180000004"],
    ["System", "Admin Five", "SYSTEM_ADMIN", "sysadmin5", "09180000005"],
    ["Registrar", "One", "REGISTRAR", "registrar1", "09180000006"],
    ["Registrar", "Two", "REGISTRAR", "registrar2", "09180000007"],
    ["Registrar", "Three", "REGISTRAR", "registrar3", "09180000008"],
    ["Registrar", "Four", "REGISTRAR", "registrar4", "09180000009"],
    ["Registrar", "Five", "REGISTRAR", "registrar5", "09180000010"],
];
var STUDENT_SEEDS = [
    ["Juan", "Dela Cruz", "Santos", "MALE", "G7", "RIZAL", "REGULAR"],
    ["Maria", "Villanueva", "Reyes", "FEMALE", "G7", "BONIFACIO", "REGULAR"],
    [
        "Miguel",
        "Torres",
        "Garcia",
        "MALE",
        "G7",
        "STE-A",
        "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
    ],
    ["Jasmine", "Mendoza", "Flores", "FEMALE", "G8", "MABINI", "REGULAR"],
    [
        "Paolo",
        "Ramos",
        "Bautista",
        "MALE",
        "G8",
        "SPFL-A",
        "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
    ],
    ["Nicole", "Navarro", "Aquino", "FEMALE", "G9", "LUNA", "REGULAR"],
    [
        "Carlo",
        "Fernandez",
        "Valdez",
        "MALE",
        "G9",
        "SPA-A",
        "SPECIAL_PROGRAM_IN_THE_ARTS",
    ],
    ["Angelica", "Gonzales", "Castro", "FEMALE", "G10", "MABINI", "REGULAR"],
    [
        "Dennis",
        "Lopez",
        "Soriano",
        "MALE",
        "G10",
        "SPS-A",
        "SPECIAL_PROGRAM_IN_SPORTS",
    ],
    [
        "Faith",
        "Ortega",
        "Lim",
        "FEMALE",
        "G10",
        "SPTVE-A",
        "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
    ],
];
var SAMPLE_TEACHERS = TEACHER_SEEDS.map(function (_a, index) {
    var firstName = _a[0], lastName = _a[1], middleName = _a[2], specialization = _a[3];
    return ({
        employeeId: "".concat(SAMPLE_TEACHER_EMPLOYEE_PREFIX, "-").concat(String(index + 1).padStart(3, "0")),
        firstName: firstName,
        lastName: lastName,
        middleName: middleName,
        specialization: specialization,
        email: "".concat(firstName.toLowerCase(), ".").concat(lastName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ".")).concat(SAMPLE_STAFF_EMAIL_SUFFIX),
        contactNumber: "091700000".concat(String(index + 1).padStart(2, "0")),
    });
});
var SAMPLE_STAFF = STAFF_SEEDS.map(function (_a) {
    var firstName = _a[0], lastName = _a[1], role = _a[2], emailLocalPart = _a[3], mobileNumber = _a[4];
    return ({
        firstName: firstName,
        lastName: lastName,
        middleName: null,
        role: role,
        designation: role === "SYSTEM_ADMIN" ? "SYSTEM ADMINISTRATOR" : "REGISTRAR",
        email: "".concat(emailLocalPart).concat(SAMPLE_STAFF_EMAIL_SUFFIX),
        mobileNumber: mobileNumber,
    });
});
var SAMPLE_STUDENTS = STUDENT_SEEDS.map(function (_a) {
    var firstName = _a[0], lastName = _a[1], middleName = _a[2], sex = _a[3], gradeCode = _a[4], sectionSuffix = _a[5], applicantType = _a[6];
    return ({
        firstName: firstName,
        lastName: lastName,
        middleName: middleName,
        sex: sex,
        gradeName: GRADE_NAME_BY_CODE[gradeCode],
        sectionName: "".concat(SAMPLE_SECTION_PREFIX, "-").concat(gradeCode, "-").concat(sectionSuffix),
        applicantType: applicantType,
    });
});
function getActiveSchoolYear() {
    return __awaiter(this, void 0, void 0, function () {
        var activeYear, settings;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.schoolYear.findFirst({
                        where: { status: "ACTIVE" },
                        select: { id: true, yearLabel: true },
                    })];
                case 1:
                    activeYear = _a.sent();
                    if (!activeYear) {
                        throw new Error("No ACTIVE school year found. Run db:seed first and activate a school year.");
                    }
                    return [4 /*yield*/, prisma.schoolSetting.findFirst({
                            select: { id: true, activeSchoolYearId: true },
                        })];
                case 2:
                    settings = _a.sent();
                    if (!(settings && settings.activeSchoolYearId !== activeYear.id)) return [3 /*break*/, 4];
                    return [4 /*yield*/, prisma.schoolSetting.update({
                            where: { id: settings.id },
                            data: { activeSchoolYearId: activeYear.id },
                        })];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4: return [2 /*return*/, activeYear];
            }
        });
    });
}
function ensureGradeLevel(params) {
    return __awaiter(this, void 0, void 0, function () {
        var existing, displayOrder;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.gradeLevel.findFirst({
                        where: {
                            schoolYearId: params.schoolYearId,
                            name: params.gradeName,
                        },
                        select: { id: true },
                    })];
                case 1:
                    existing = _a.sent();
                    if (existing) {
                        return [2 /*return*/, existing];
                    }
                    displayOrder = Number.parseInt(params.gradeName.replace("Grade ", ""), 10);
                    return [2 /*return*/, prisma.gradeLevel.create({
                            data: {
                                schoolYearId: params.schoolYearId,
                                name: params.gradeName,
                                displayOrder: displayOrder,
                            },
                            select: { id: true },
                        })];
            }
        });
    });
}
function ensureSection(params) {
    return __awaiter(this, void 0, void 0, function () {
        var existing;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.section.findFirst({
                        where: {
                            gradeLevelId: params.gradeLevelId,
                            name: params.sectionName,
                            programType: params.applicantType,
                        },
                        select: { id: true },
                    })];
                case 1:
                    existing = _a.sent();
                    if (existing) {
                        return [2 /*return*/, existing];
                    }
                    return [2 /*return*/, prisma.section.create({
                            data: {
                                gradeLevelId: params.gradeLevelId,
                                name: params.sectionName,
                                programType: params.applicantType,
                                maxCapacity: 45,
                            },
                            select: { id: true },
                        })];
            }
        });
    });
}
function seedTeachers() {
    return __awaiter(this, void 0, void 0, function () {
        var created, updated, _i, SAMPLE_TEACHERS_1, teacher, existing;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    created = 0;
                    updated = 0;
                    _i = 0, SAMPLE_TEACHERS_1 = SAMPLE_TEACHERS;
                    _a.label = 1;
                case 1:
                    if (!(_i < SAMPLE_TEACHERS_1.length)) return [3 /*break*/, 5];
                    teacher = SAMPLE_TEACHERS_1[_i];
                    return [4 /*yield*/, prisma.teacher.findUnique({
                            where: { employeeId: teacher.employeeId },
                            select: { id: true },
                        })];
                case 2:
                    existing = _a.sent();
                    return [4 /*yield*/, prisma.teacher.upsert({
                            where: { employeeId: teacher.employeeId },
                            update: {
                                firstName: teacher.firstName,
                                lastName: teacher.lastName,
                                middleName: teacher.middleName,
                                specialization: teacher.specialization,
                                email: teacher.email,
                                contactNumber: teacher.contactNumber,
                                isActive: true,
                            },
                            create: {
                                employeeId: teacher.employeeId,
                                firstName: teacher.firstName,
                                lastName: teacher.lastName,
                                middleName: teacher.middleName,
                                specialization: teacher.specialization,
                                email: teacher.email,
                                contactNumber: teacher.contactNumber,
                                isActive: true,
                            },
                        })];
                case 3:
                    _a.sent();
                    if (existing) {
                        updated++;
                    }
                    else {
                        created++;
                    }
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 1];
                case 5: return [2 /*return*/, { created: created, updated: updated }];
            }
        });
    });
}
function seedStaffUsers() {
    return __awaiter(this, void 0, void 0, function () {
        var hashedPassword, created, updated, _i, SAMPLE_STAFF_1, user, existing, operator;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, bcrypt.hash(SAMPLE_STAFF_PASSWORD, 12)];
                case 1:
                    hashedPassword = _a.sent();
                    created = 0;
                    updated = 0;
                    _i = 0, SAMPLE_STAFF_1 = SAMPLE_STAFF;
                    _a.label = 2;
                case 2:
                    if (!(_i < SAMPLE_STAFF_1.length)) return [3 /*break*/, 6];
                    user = SAMPLE_STAFF_1[_i];
                    return [4 /*yield*/, prisma.user.findUnique({
                            where: { email: user.email },
                            select: { id: true },
                        })];
                case 3:
                    existing = _a.sent();
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { email: user.email },
                            update: {
                                firstName: user.firstName,
                                lastName: user.lastName,
                                middleName: user.middleName,
                                designation: user.designation,
                                mobileNumber: user.mobileNumber,
                                role: user.role,
                                isActive: true,
                                password: hashedPassword,
                            },
                            create: {
                                firstName: user.firstName,
                                lastName: user.lastName,
                                middleName: user.middleName,
                                designation: user.designation,
                                mobileNumber: user.mobileNumber,
                                email: user.email,
                                password: hashedPassword,
                                role: user.role,
                                isActive: true,
                                mustChangePassword: true,
                            },
                        })];
                case 4:
                    _a.sent();
                    if (existing) {
                        updated++;
                    }
                    else {
                        created++;
                    }
                    _a.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 2];
                case 6: return [4 /*yield*/, prisma.user.findFirst({
                        where: {
                            email: {
                                endsWith: SAMPLE_STAFF_EMAIL_SUFFIX,
                            },
                            role: {
                                in: ["SYSTEM_ADMIN", "REGISTRAR"],
                            },
                        },
                        select: { id: true },
                        orderBy: [{ role: "asc" }, { id: "asc" }],
                    })];
                case 7:
                    operator = _a.sent();
                    if (!operator) {
                        throw new Error("Unable to resolve sample operator user.");
                    }
                    return [2 /*return*/, {
                            created: created,
                            updated: updated,
                            operatorId: operator.id,
                        }];
            }
        });
    });
}
function seedStudents(params) {
    return __awaiter(this, void 0, void 0, function () {
        var created, updated, yearToken, i, student, sequence, gradeLevel, section, lrn, learner, trackingNumber, existingApplication, application, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    created = 0;
                    updated = 0;
                    yearToken = new Date().getFullYear();
                    i = 0;
                    _b.label = 1;
                case 1:
                    if (!(i < SAMPLE_STUDENTS.length)) return [3 /*break*/, 12];
                    student = SAMPLE_STUDENTS[i];
                    sequence = i + 1;
                    return [4 /*yield*/, ensureGradeLevel({
                            schoolYearId: params.schoolYearId,
                            gradeName: student.gradeName,
                        })];
                case 2:
                    gradeLevel = _b.sent();
                    return [4 /*yield*/, ensureSection({
                            gradeLevelId: gradeLevel.id,
                            sectionName: student.sectionName,
                            applicantType: student.applicantType,
                        })];
                case 3:
                    section = _b.sent();
                    lrn = "".concat(SAMPLE_LEARNER_LRN_PREFIX).concat(String(sequence).padStart(8, "0"));
                    return [4 /*yield*/, prisma.learner.upsert({
                            where: { lrn: lrn },
                            update: {
                                firstName: student.firstName,
                                lastName: student.lastName,
                                middleName: student.middleName,
                                sex: student.sex,
                                disabilityTypes: [],
                            },
                            create: {
                                lrn: lrn,
                                firstName: student.firstName,
                                lastName: student.lastName,
                                middleName: student.middleName,
                                sex: student.sex,
                                birthdate: new Date("2012-01-".concat(String((sequence % 28) + 1).padStart(2, "0"))),
                                disabilityTypes: [],
                            },
                            select: { id: true },
                        })];
                case 4:
                    learner = _b.sent();
                    trackingNumber = "SINT-ENR-".concat(yearToken, "-").concat(String(sequence).padStart(4, "0"));
                    return [4 /*yield*/, prisma.enrollmentApplication.findUnique({
                            where: { trackingNumber: trackingNumber },
                            select: { id: true },
                        })];
                case 5:
                    existingApplication = _b.sent();
                    if (!existingApplication) return [3 /*break*/, 7];
                    return [4 /*yield*/, prisma.enrollmentApplication.update({
                            where: { id: existingApplication.id },
                            data: {
                                learnerId: learner.id,
                                schoolYearId: params.schoolYearId,
                                gradeLevelId: gradeLevel.id,
                                status: "ENROLLED",
                                learnerType: "NEW_ENROLLEE",
                                applicantType: student.applicantType,
                                admissionChannel: "F2F",
                                learningModalities: ["FACE_TO_FACE"],
                                isPrivacyConsentGiven: true,
                                guardianRelationship: "PARENT",
                                hasNoMother: false,
                                hasNoFather: false,
                                encodedById: params.operatorId,
                            },
                            select: { id: true },
                        })];
                case 6:
                    _a = _b.sent();
                    return [3 /*break*/, 9];
                case 7: return [4 /*yield*/, prisma.enrollmentApplication.create({
                        data: {
                            learnerId: learner.id,
                            schoolYearId: params.schoolYearId,
                            gradeLevelId: gradeLevel.id,
                            status: "ENROLLED",
                            trackingNumber: trackingNumber,
                            learnerType: "NEW_ENROLLEE",
                            applicantType: student.applicantType,
                            admissionChannel: "F2F",
                            learningModalities: ["FACE_TO_FACE"],
                            isPrivacyConsentGiven: true,
                            guardianRelationship: "PARENT",
                            hasNoMother: false,
                            hasNoFather: false,
                            encodedById: params.operatorId,
                        },
                        select: { id: true },
                    })];
                case 8:
                    _a = _b.sent();
                    _b.label = 9;
                case 9:
                    application = _a;
                    return [4 /*yield*/, prisma.enrollmentRecord.upsert({
                            where: { enrollmentApplicationId: application.id },
                            update: {
                                schoolYearId: params.schoolYearId,
                                sectionId: section.id,
                                enrolledById: params.operatorId,
                            },
                            create: {
                                enrollmentApplicationId: application.id,
                                schoolYearId: params.schoolYearId,
                                sectionId: section.id,
                                enrolledById: params.operatorId,
                            },
                        })];
                case 10:
                    _b.sent();
                    if (existingApplication) {
                        updated++;
                    }
                    else {
                        created++;
                    }
                    _b.label = 11;
                case 11:
                    i++;
                    return [3 /*break*/, 1];
                case 12: return [2 /*return*/, { created: created, updated: updated }];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var schoolYear, teacherStats, staffStats, studentStats;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getActiveSchoolYear()];
                case 1:
                    schoolYear = _a.sent();
                    return [4 /*yield*/, seedTeachers()];
                case 2:
                    teacherStats = _a.sent();
                    return [4 /*yield*/, seedStaffUsers()];
                case 3:
                    staffStats = _a.sent();
                    return [4 /*yield*/, seedStudents({
                            schoolYearId: schoolYear.id,
                            operatorId: staffStats.operatorId,
                        })];
                case 4:
                    studentStats = _a.sent();
                    console.log("\nSample integration seed complete.");
                    console.log("School Year: ".concat(schoolYear.yearLabel));
                    console.log("Teachers -> created: ".concat(teacherStats.created, ", updated: ").concat(teacherStats.updated));
                    console.log("Staff -> created: ".concat(staffStats.created, ", updated: ").concat(staffStats.updated));
                    console.log("Students -> created: ".concat(studentStats.created, ", updated: ").concat(studentStats.updated));
                    console.log("Sample staff password: ".concat(SAMPLE_STAFF_PASSWORD));
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (error) {
    console.error("Sample integration seed failed:", error);
    process.exitCode = 1;
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
