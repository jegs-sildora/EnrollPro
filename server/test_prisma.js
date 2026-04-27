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
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
function test() {
    return __awaiter(this, void 0, void 0, function () {
        var count, apps, submitted, allFilter, e_1, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 8, 9, 11]);
                    console.log("Testing prisma query...");
                    return [4 /*yield*/, prisma.applicant.count()];
                case 1:
                    count = _a.sent();
                    console.log("Total applicants:", count);
                    return [4 /*yield*/, prisma.applicant.findMany({
                            take: 5,
                            include: {
                                gradeLevel: true,
                                strand: true,
                            },
                        })];
                case 2:
                    apps = _a.sent();
                    console.log("First 5 apps:", JSON.stringify(apps, null, 2));
                    console.log("Testing with status filter...");
                    return [4 /*yield*/, prisma.applicant.findMany({
                            where: { status: "SUBMITTED_BEEF" },
                        })];
                case 3:
                    submitted = _a.sent();
                    console.log("Submitted BEEF count:", submitted.length);
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 6, , 7]);
                    console.log('Testing with status="ALL" (expect failure if not handled in code)...');
                    return [4 /*yield*/, prisma.applicant.findMany({
                            where: { status: "ALL" },
                        })];
                case 5:
                    allFilter = _a.sent();
                    console.log("ALL filter count:", allFilter.length);
                    return [3 /*break*/, 7];
                case 6:
                    e_1 = _a.sent();
                    console.log('Expected Prisma failure for status="ALL":', e_1.message);
                    return [3 /*break*/, 7];
                case 7: return [3 /*break*/, 11];
                case 8:
                    error_1 = _a.sent();
                    console.error("Prisma test failed:", error_1);
                    return [3 /*break*/, 11];
                case 9: return [4 /*yield*/, prisma.$disconnect()];
                case 10:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 11: return [2 /*return*/];
            }
        });
    });
}
test();
