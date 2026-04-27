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
var bcrypt = require("bcryptjs");
var adapter = new adapter_pg_1.PrismaPg({ connectionString: process.env.DATABASE_URL });
var prisma = new index_js_1.PrismaClient({ adapter: adapter });
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var settings, activeYear, grades, _i, grades_1, grade, existingGrade, email, password, firstName, lastName, existingAdmin, hashed;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, prisma.schoolSetting.findFirst()];
                case 1:
                    settings = _e.sent();
                    if (!!settings) return [3 /*break*/, 3];
                    return [4 /*yield*/, prisma.schoolSetting.create({
                            data: { schoolName: "EnrollPro" },
                        })];
                case 2:
                    settings = _e.sent();
                    console.log("Created default SchoolSettings row.");
                    return [3 /*break*/, 4];
                case 3:
                    console.log("SchoolSettings already exists.");
                    _e.label = 4;
                case 4: return [4 /*yield*/, prisma.schoolYear.findFirst({
                        where: { status: "ACTIVE" },
                    })];
                case 5:
                    activeYear = _e.sent();
                    if (!!activeYear) return [3 /*break*/, 7];
                    return [4 /*yield*/, prisma.schoolYear.create({
                            data: {
                                yearLabel: "2026-2027",
                                status: "ACTIVE",
                                classOpeningDate: new Date("2026-06-15"),
                                classEndDate: new Date("2027-03-31"),
                                earlyRegOpenDate: new Date("2026-01-01"),
                                earlyRegCloseDate: new Date("2026-05-31"),
                                enrollOpenDate: new Date("2026-05-01"),
                                enrollCloseDate: new Date("2026-06-30"),
                            },
                        })];
                case 6:
                    activeYear = _e.sent();
                    console.log("\u2705 Created Active School Year: ".concat(activeYear.yearLabel));
                    _e.label = 7;
                case 7:
                    if (!(settings.activeSchoolYearId !== activeYear.id)) return [3 /*break*/, 9];
                    return [4 /*yield*/, prisma.schoolSetting.update({
                            where: { id: settings.id },
                            data: { activeSchoolYearId: activeYear.id },
                        })];
                case 8:
                    _e.sent();
                    console.log("\u2705 SchoolSettings activeSchoolYearId set to ".concat(activeYear.yearLabel));
                    _e.label = 9;
                case 9:
                    grades = [
                        { name: "Grade 7", legacyName: "G7", displayOrder: 7 },
                        { name: "Grade 8", legacyName: "G8", displayOrder: 8 },
                        { name: "Grade 9", legacyName: "G9", displayOrder: 9 },
                        { name: "Grade 10", legacyName: "G10", displayOrder: 10 },
                    ];
                    _i = 0, grades_1 = grades;
                    _e.label = 10;
                case 10:
                    if (!(_i < grades_1.length)) return [3 /*break*/, 16];
                    grade = grades_1[_i];
                    return [4 /*yield*/, prisma.gradeLevel.findFirst({
                            where: {
                                schoolYearId: activeYear.id,
                                OR: [
                                    { name: grade.name },
                                    { name: grade.legacyName },
                                    { displayOrder: grade.displayOrder },
                                ],
                            },
                        })];
                case 11:
                    existingGrade = _e.sent();
                    if (!!existingGrade) return [3 /*break*/, 13];
                    return [4 /*yield*/, prisma.gradeLevel.create({
                            data: {
                                name: grade.name,
                                displayOrder: grade.displayOrder,
                                schoolYearId: activeYear.id,
                            },
                        })];
                case 12:
                    _e.sent();
                    console.log("\u2705 Created Grade Level: ".concat(grade.name));
                    return [3 /*break*/, 15];
                case 13:
                    if (!(existingGrade.name !== grade.name ||
                        existingGrade.displayOrder !== grade.displayOrder)) return [3 /*break*/, 15];
                    return [4 /*yield*/, prisma.gradeLevel.update({
                            where: { id: existingGrade.id },
                            data: {
                                name: grade.name,
                                displayOrder: grade.displayOrder,
                            },
                        })];
                case 14:
                    _e.sent();
                    console.log("\u2705 Updated Grade Level: ".concat(existingGrade.name, " -> ").concat(grade.name));
                    _e.label = 15;
                case 15:
                    _i++;
                    return [3 /*break*/, 10];
                case 16:
                    email = (_a = process.env.ADMIN_EMAIL) !== null && _a !== void 0 ? _a : "admin@deped.edu.ph";
                    password = (_b = process.env.ADMIN_PASSWORD) !== null && _b !== void 0 ? _b : "Admin2026!";
                    firstName = (_c = process.env.ADMIN_FIRST_NAME) !== null && _c !== void 0 ? _c : "System";
                    lastName = (_d = process.env.ADMIN_LAST_NAME) !== null && _d !== void 0 ? _d : "Administrator";
                    return [4 /*yield*/, prisma.user.findUnique({ where: { email: email } })];
                case 17:
                    existingAdmin = _e.sent();
                    if (existingAdmin) {
                        console.log("Admin account already exists: ".concat(email));
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, bcrypt.hash(password, 12)];
                case 18:
                    hashed = _e.sent();
                    return [4 /*yield*/, prisma.user.create({
                            data: {
                                firstName: firstName,
                                lastName: lastName,
                                email: email,
                                password: hashed,
                                role: "SYSTEM_ADMIN",
                                isActive: true,
                                mustChangePassword: true,
                            },
                        })];
                case 19:
                    _e.sent();
                    console.log("\u2705 System Admin created: ".concat(email));
                    console.log("   Temporary password:   ".concat(password));
                    console.log("   \u26A0  Change this password immediately after first login.");
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
                return [2 /*return*/];
        }
    });
}); });
