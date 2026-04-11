import express from "express";
import cors from "cors";
import helmet from "helmet";
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
import { errorHandler } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: express.Express = express();

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
    origin: [
      process.env.CLIENT_URL || "http://localhost:5173",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5173",
      "http://localhost:5174",
    ],
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

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
app.use("/api/curriculum", curriculumRoutes);
app.use("/api/sections", sectionsRoutes);
app.use("/api/students", studentsRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/teachers", teachersRoutes);
app.use("/api/learner", learnerRoutes);

// Error handler
app.use(errorHandler);

export default app;
