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
function getPreservedCounts(client) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, users, teachers, schoolSettings, schoolYears, gradeLevels, sections, scpProgramConfigs, scpProgramSteps, scpProgramOptions;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.all([
                        client.user.count(),
                        client.teacher.count(),
                        client.schoolSetting.count(),
                        client.schoolYear.count(),
                        client.gradeLevel.count(),
                        client.section.count(),
                        client.scpProgramConfig.count(),
                        client.scpProgramStep.count(),
                        client.scpProgramOption.count(),
                    ])];
                case 1:
                    _a = _b.sent(), users = _a[0], teachers = _a[1], schoolSettings = _a[2], schoolYears = _a[3], gradeLevels = _a[4], sections = _a[5], scpProgramConfigs = _a[6], scpProgramSteps = _a[7], scpProgramOptions = _a[8];
                    return [2 /*return*/, {
                            users: users,
                            teachers: teachers,
                            schoolSettings: schoolSettings,
                            schoolYears: schoolYears,
                            gradeLevels: gradeLevels,
                            sections: sections,
                            scpProgramConfigs: scpProgramConfigs,
                            scpProgramSteps: scpProgramSteps,
                            scpProgramOptions: scpProgramOptions,
                        }];
            }
        });
    });
}
function formatPreservedCounts(prefix, counts) {
    return ("".concat(prefix, " ") +
        "users=".concat(counts.users, ", ") +
        "teachers=".concat(counts.teachers, ", ") +
        "schoolSettings=".concat(counts.schoolSettings, ", ") +
        "schoolYears=".concat(counts.schoolYears, ", ") +
        "gradeLevels=".concat(counts.gradeLevels, ", ") +
        "sections=".concat(counts.sections, ", ") +
        "scpProgramConfigs=".concat(counts.scpProgramConfigs, ", ") +
        "scpProgramSteps=".concat(counts.scpProgramSteps, ", ") +
        "scpProgramOptions=".concat(counts.scpProgramOptions));
}
function hasPreservedCountMismatch(before, after) {
    return (before.users !== after.users ||
        before.teachers !== after.teachers ||
        before.schoolSettings !== after.schoolSettings ||
        before.schoolYears !== after.schoolYears ||
        before.gradeLevels !== after.gradeLevels ||
        before.sections !== after.sections ||
        before.scpProgramConfigs !== after.scpProgramConfigs ||
        before.scpProgramSteps !== after.scpProgramSteps ||
        before.scpProgramOptions !== after.scpProgramOptions);
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var preservedBefore_1, summary, error_1;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("⚠️  Starting learner/application data wipe...");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, getPreservedCounts(prisma)];
                case 2:
                    preservedBefore_1 = _a.sent();
                    return [4 /*yield*/, prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                            var enrollmentRecordsResult, enrollmentPreviousSchoolsResult, enrollmentProgramDetailsResult, applicationAddressesResult, applicationFamilyMembersResult, applicationChecklistsResult, earlyRegAssessmentsResult, enrollmentAppsResult, earlyRegAppsResult, healthRecordsResult, learnersResult, preservedAfter;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, tx.enrollmentRecord.deleteMany({})];
                                    case 1:
                                        enrollmentRecordsResult = _a.sent();
                                        return [4 /*yield*/, tx.enrollmentPreviousSchool.deleteMany({})];
                                    case 2:
                                        enrollmentPreviousSchoolsResult = _a.sent();
                                        return [4 /*yield*/, tx.enrollmentProgramDetail.deleteMany({})];
                                    case 3:
                                        enrollmentProgramDetailsResult = _a.sent();
                                        return [4 /*yield*/, tx.applicationAddress.deleteMany({})];
                                    case 4:
                                        applicationAddressesResult = _a.sent();
                                        return [4 /*yield*/, tx.applicationFamilyMember.deleteMany({})];
                                    case 5:
                                        applicationFamilyMembersResult = _a.sent();
                                        return [4 /*yield*/, tx.applicationChecklist.deleteMany({})];
                                    case 6:
                                        applicationChecklistsResult = _a.sent();
                                        return [4 /*yield*/, tx.earlyRegistrationAssessment.deleteMany({})];
                                    case 7:
                                        earlyRegAssessmentsResult = _a.sent();
                                        return [4 /*yield*/, tx.enrollmentApplication.deleteMany({})];
                                    case 8:
                                        enrollmentAppsResult = _a.sent();
                                        return [4 /*yield*/, tx.earlyRegistrationApplication.deleteMany({})];
                                    case 9:
                                        earlyRegAppsResult = _a.sent();
                                        return [4 /*yield*/, tx.healthRecord.deleteMany({})];
                                    case 10:
                                        healthRecordsResult = _a.sent();
                                        return [4 /*yield*/, tx.learner.deleteMany({})];
                                    case 11:
                                        learnersResult = _a.sent();
                                        return [4 /*yield*/, getPreservedCounts(tx)];
                                    case 12:
                                        preservedAfter = _a.sent();
                                        if (hasPreservedCountMismatch(preservedBefore_1, preservedAfter)) {
                                            throw new Error("Master data changed during wipe. " +
                                                "".concat(formatPreservedCounts("before:", preservedBefore_1), "; ") +
                                                "".concat(formatPreservedCounts("after:", preservedAfter), ". ") +
                                                "Wipe aborted to protect baseline records.");
                                        }
                                        return [2 /*return*/, {
                                                enrollmentRecordsCleared: enrollmentRecordsResult.count,
                                                enrollmentPreviousSchoolsCleared: enrollmentPreviousSchoolsResult.count,
                                                enrollmentProgramDetailsCleared: enrollmentProgramDetailsResult.count,
                                                applicationAddressesCleared: applicationAddressesResult.count,
                                                applicationFamilyMembersCleared: applicationFamilyMembersResult.count,
                                                applicationChecklistsCleared: applicationChecklistsResult.count,
                                                earlyRegAssessmentsCleared: earlyRegAssessmentsResult.count,
                                                enrollmentAppsCleared: enrollmentAppsResult.count,
                                                earlyRegAppsCleared: earlyRegAppsResult.count,
                                                healthRecordsCleared: healthRecordsResult.count,
                                                learnersCleared: learnersResult.count,
                                                preservedAfter: preservedAfter,
                                            }];
                                }
                            });
                        }); })];
                case 3:
                    summary = _a.sent();
                    console.log("\u2705 Enrollment records cleared (".concat(summary.enrollmentRecordsCleared, ")."));
                    console.log("\u2705 Enrollment previous school rows cleared (".concat(summary.enrollmentPreviousSchoolsCleared, ")."));
                    console.log("\u2705 Enrollment program details cleared (".concat(summary.enrollmentProgramDetailsCleared, ")."));
                    console.log("\u2705 Application addresses cleared (".concat(summary.applicationAddressesCleared, ")."));
                    console.log("\u2705 Application family members cleared (".concat(summary.applicationFamilyMembersCleared, ")."));
                    console.log("\u2705 Application checklists cleared (".concat(summary.applicationChecklistsCleared, ")."));
                    console.log("\u2705 Early registration assessments cleared (".concat(summary.earlyRegAssessmentsCleared, ")."));
                    console.log("\u2705 Enrollment applications cleared (".concat(summary.enrollmentAppsCleared, ")."));
                    console.log("\u2705 Early registration applications cleared (".concat(summary.earlyRegAppsCleared, ")."));
                    console.log("\u2705 Health records cleared (".concat(summary.healthRecordsCleared, ")."));
                    console.log("\u2705 Learners cleared (".concat(summary.learnersCleared, ")."));
                    console.log("\u2705 Users preserved: ".concat(summary.preservedAfter.users));
                    console.log("\u2705 Teachers preserved: ".concat(summary.preservedAfter.teachers));
                    console.log("\u2705 School settings preserved: ".concat(summary.preservedAfter.schoolSettings));
                    console.log("\u2705 School years preserved: ".concat(summary.preservedAfter.schoolYears));
                    console.log("\u2705 Grade levels preserved: ".concat(summary.preservedAfter.gradeLevels));
                    console.log("\u2705 Sections preserved: ".concat(summary.preservedAfter.sections));
                    console.log("\u2705 SCP configs preserved: ".concat(summary.preservedAfter.scpProgramConfigs));
                    console.log("\u2705 SCP steps preserved: ".concat(summary.preservedAfter.scpProgramSteps));
                    console.log("\u2705 SCP options preserved: ".concat(summary.preservedAfter.scpProgramOptions));
                    console.log("\n✨ Learner/application data reset successful!");
                    console.log("   Preserved: Users, Teachers, SchoolYears, Sections, GradeLevels, SchoolSettings, and SCP configuration.");
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _a.sent();
                    console.error("❌ Error during wipe:", error_1);
                    process.exit(1);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
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
