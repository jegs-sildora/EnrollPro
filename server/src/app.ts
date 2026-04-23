import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import authRoutes from "./features/auth/auth.router.js";
import settingsRoutes from "./features/settings/settings.router.js";
import dashboardRoutes from "./features/dashboard/dashboard.router.js";
import schoolYearRoutes from "./features/school-year/school-year.router.js";
import curriculumRoutes from "./features/curriculum/curriculum.router.js";
import sectionsRoutes from "./features/sections/sections.router.js";
import studentsRoutes from "./features/students/students.router.js";
import applicationRoutes from "./features/admission/admission.router.js";
import adminRoutes from "./features/admin/admin.router.js";
import auditLogRoutes from "./features/audit-logs/audit-logs.router.js";
import teachersRoutes from "./features/teachers/teachers.router.js";
import learnerRoutes from "./features/learner/learner.router.js";
import earlyRegRoutes from "./features/early-registration/early-reg.router.js";
import eosyRoutes from "./features/enrollment/eosy.router.js";
import enrollmentRoutes from "./features/enrollment/enrollment.router.js";
import integrationRoutes from "./features/integration/integration.router.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { historicalReadOnlyGuard } from "./middleware/historical-read-only.guard.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: express.Express = express();

const defaultClientOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://100.120.169.123:5173",
  "http://100.120.169.123:5174",
  "http://100.120.169.123:5175",
  "http://dev-jegs.buru-degree.ts.net:5173",
  "http://dev-jegs.buru-degree.ts.net:5174",
  "http://dev-jegs.buru-degree.ts.net:5175",
];
const configuredClientOrigins = [
  process.env.CLIENT_URL,
  ...(process.env.CLIENT_URLS ? process.env.CLIENT_URLS.split(",") : []),
]
  .map((origin) => origin?.trim())
  .filter((origin): origin is string => Boolean(origin));
const allowedClientOrigins = Array.from(
  new Set([...defaultClientOrigins, ...configuredClientOrigins]),
);

// Ensure uploads directory exists
const uploadsDir = path.resolve(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  }),
);
app.use(
  cors({
    origin: allowedClientOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());
app.use(historicalReadOnlyGuard);

// Static files for uploads
app.use("/uploads", express.static(uploadsDir));

// Routes
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});
app.use("/api/auth", authRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/school-years", schoolYearRoutes);
// Backward-compatible singular alias used by legacy clients.
app.use("/api/school-year", schoolYearRoutes);
app.use("/api/curriculum", curriculumRoutes);
app.use("/api/sections", sectionsRoutes);
app.use("/api/students", studentsRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/teachers", teachersRoutes);
app.use("/api/learner", learnerRoutes);
app.use("/api/early-registrations", earlyRegRoutes);
app.use("/api/eosy", eosyRoutes);
app.use("/api/enrollment", enrollmentRoutes);
app.use("/api/integration/v1", integrationRoutes);

// Error handler
app.use(errorHandler);

export default app;
