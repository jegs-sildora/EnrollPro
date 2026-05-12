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
import exportRoutes from "./features/export/export.router.js";
import bosyRoutes from "./features/bosy/bosy.router.js";
import remedialRoutes from "./features/remedial/remedial.router.js";
import integrationTriggerRoutes from "./features/integration/integration-trigger.router.js";
import integrationRoutes from "./features/integration/integration.router.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { historicalReadOnlyGuard } from "./middleware/historical-read-only.guard.js";
import { schoolYearContext } from "./middleware/school-year-context.middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: express.Express = express();

// Trust proxy for Tailscale Funnel / X-Forwarded-For support
app.set("trust proxy", 1);

const defaultClientOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "http://100.120.169.123:5173",
  "http://100.120.169.123:5174",
  "http://100.120.169.123:5175",
  "http://dev-jegs.buru-degree.ts.net:5173",
  "http://dev-jegs.buru-degree.ts.net:5174",
  "http://dev-jegs.buru-degree.ts.net:5175",
  "http://buru-degree.ts.net:5173",
  "http://buru-degree.ts.net:5174",
  "http://buru-degree.ts.net:5175",
  "https://dev-jegs.buru-degree.ts.net",
  "https://buru-degree.ts.net",
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

// 2. Security Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (allowedClientOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "img-src": ["'self'", "data:", "blob:", "*"], // Allow images from any source for uploads
        "script-src": ["'self'", "'unsafe-inline'"], // React needs unsafe-inline for some patterns
      },
    },
  }),
);

// 3. Standard Parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());

// 4. Guards & Routes
app.use(historicalReadOnlyGuard);

const apiRouter = express.Router();

// 5. School Year Context
// Resolve the school year ID for all API requests (from header or active settings)
apiRouter.use(schoolYearContext);

// Debug endpoint
apiRouter.get("/debug-server", (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    method: req.method,
    path: req.path,
    headers: req.headers,
    allowedOrigins: allowedClientOrigins,
  });
});

// Routes
apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true });
});
apiRouter.get("/ping", (_req, res) => {
  res.send("pong");
});
apiRouter.use("/auth", authRoutes);
apiRouter.use("/settings", settingsRoutes);
apiRouter.use("/dashboard", dashboardRoutes);
apiRouter.use("/school-years", schoolYearRoutes);
// Backward-compatible singular alias used by legacy clients.
apiRouter.use("/school-year", schoolYearRoutes);
apiRouter.use("/curriculum", curriculumRoutes);
apiRouter.use("/sections", sectionsRoutes);
apiRouter.use("/students", studentsRoutes);
apiRouter.use("/applications", applicationRoutes);
apiRouter.use("/admin", adminRoutes);
apiRouter.use("/audit-logs", auditLogRoutes);
apiRouter.use("/teachers", teachersRoutes);
apiRouter.use("/learner", learnerRoutes);
apiRouter.use("/early-registrations", earlyRegRoutes);
apiRouter.use("/eosy", eosyRoutes);
apiRouter.use("/enrollment", enrollmentRoutes);
apiRouter.use("/export", exportRoutes);
apiRouter.use("/bosy", bosyRoutes);
apiRouter.use("/remedial", remedialRoutes);
apiRouter.use("/integration", integrationTriggerRoutes);
  // Public read endpoints for ATLAS and other downstream services (no auth required).
  apiRouter.use("/integration/v1", integrationRoutes);

// Catch-all for unmatched API routes (Express 5 regex)
apiRouter.all(/(.*)/, (req, res) => {
  res.status(404).json({
    code: "NOT_FOUND",
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use("/api", apiRouter);

// Static files for uploads
app.use("/uploads", express.static(uploadsDir));

// Error handler
app.use(errorHandler);

export default app;
