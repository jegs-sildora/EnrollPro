# ENROLLPRO STRATEGIC PLAN: MULTI-TENANT DYNAMIC SCP CONFIGURATION
**Architectural Goal:** Transition from hardcoded logic to a metadata-driven architecture allowing individual school beneficiaries (HNHS, EMEMHS) to configure their own Special Curricular Program (SCP) rules dynamically without developer intervention.
**Implementation Standard:** Strict adherence to EnrollPro DB Naming Conventions (snake_case SQL, PascalCase Models, camelCase fields with @map).

---

## PHASE 1: DATABASE ARCHITECTURE (POSTGRESQL & PRISMA)
To make requirements dynamic, the database must store the *rules*, not just the student data. We will utilize PostgreSQL's relational power combined with its `JSONB` data type for ultimate flexibility.

### 1. Prisma Schema Implementation
Below is the exact schema representation adhering to the established naming conventions, ensuring drift guardrails are met.

```prisma
model School {
  id                   String                 @id @default(uuid())
  name                 String
  isActive             Boolean                @default(true) @map("is_active")
  createdAt            DateTime               @default(now()) @map("created_at")
  updatedAt            DateTime               @updatedAt @map("updated_at")
  
  schoolProgramConfigs SchoolProgramConfig[]

  @@map("schools")
}

model Program {
  id                   String                 @id @default(uuid())
  code                 String                 @unique // e.g., STE, SPA, SPS, BEC
  name                 String
  createdAt            DateTime               @default(now()) @map("created_at")
  updatedAt            DateTime               @updatedAt @map("updated_at")
  
  schoolProgramConfigs SchoolProgramConfig[]

  @@map("programs")
}

model SchoolProgramConfig {
  id                   String   @id @default(uuid())
  schoolId             String   @map("school_id")
  programId            String   @map("program_id")
  isActive             Boolean  @default(true) @map("is_active")
  
  // JSONB Configuration Columns
  gradeRequirements    Json     @map("grade_requirements")
  documentRequirements Json     @map("document_requirements")
  rankingFormula       Json?    @map("ranking_formula") // Optional, used for STE
  
  createdAt            DateTime @default(now()) @map("created_at")
  updatedAt            DateTime @updatedAt @map("updated_at")

  school               School   @relation(fields: [schoolId], references: [id])
  program              Program  @relation(fields: [programId], references: [id])

  // Constraints and Indexes based on DB standards
  @@unique([schoolId, programId], name: "uq_school_program_configs_school_id_program_id")
  @@index([schoolId], name: "idx_school_program_configs_school_id")
  @@map("school_program_configs")
}

2. JSONB Data Structure Examples
grade_requirements: * STE specific: {"type": "specific", "subjects": ["Math", "Science", "English"], "minAverage": 85}

SPS general: {"type": "general", "minAverage": 85}

document_requirements: * [{"docId": "medical_cert", "isRequired": true}, {"docId": "sports_awards", "isRequired": false}]

ranking_formula: * {"examWeight": 0.65, "interviewWeight": 0.15, "gradeWeight": 0.20}

PHASE 2: THE BACKEND VALIDATION ENGINE (NODE.JS / EXPRESS)
The Express API must act as a dynamic rule evaluator rather than a static checker. Hardcoded logic (e.g., if (program === 'STE')) is strictly prohibited in this module.

1. The Configuration Endpoint
Route: GET /api/v1/schools/:schoolId/programs/:programId/config

Action: When a learner selects a school and a program on the frontend, this endpoint serves the exact JSONB configuration required for that specific pathway.

2. The Dynamic Validator Middleware
Action: When an Early Registration form is submitted, the backend fetches the school_program_configs for that specific school_id and program_id.

Execution: The system iterates through the grade_requirements JSON. If the payload does not meet the dynamically fetched threshold, the server rejects the request with a 400 Bad Request and detailed error array.

PHASE 3: ADMIN CONFIGURATION UI (REACT DASHBOARD)
School registrars (role: REGISTRAR or SYSTEM_ADMIN) require a user-friendly interface to adjust these rules annually without developer intervention.

1. The "Program Settings" Module
Program Toggles: A simple switch allowing EMEMHS to turn "ON" STE and "OFF" SPS, while HNHS might have both active. This updates the is_active boolean.

Rule Builder Interface: * Grade Thresholds: An input field where the admin sets the minimum acceptable average (e.g., modifying 85 to 83).

Subject Selectors: Checkboxes allowing the admin to dictate which specific subjects are computed for the target average.

Document Matrix: A data grid of standard documents (Medical Cert, Good Moral, Portfolio) where the admin toggles them as "Required", "Optional", or "Hidden".

Formula Sliders: Visual range sliders that must validate to exactly 100% total (e.g., sliding Exam to 60%, Interview to 20%, Grade to 20%).

PHASE 4: DYNAMIC APPLICANT FRONTEND (REACT PORTAL)
The admission form must transform into a "Smart Form" that alters its own UI based on the metadata it receives from the backend.

1. Cascading Selection Flow
Step 1 (School Context): Learner selects their target Institution (HNHS or EMEMHS).

Step 2 (Program Context): Learner selects the Program. The dropdown strictly populates based on programs where is_active === true for the chosen school.

Step 3 (Dynamic Rendering): The form instantly re-renders its layout based on the fetched school_program_configs.

Conditional Inputs: If the config requires specific subjects, it renders individual inputs for Math, Science, and English.

Conditional Uploads: If the config requires a Medical Certificate, the file upload component dynamically injects the required prop and displays a mandatory asterisk.

Immediate Feedback: As the user inputs grades, the frontend pre-validates against the fetched JSON rules, showing green success states or red warnings instantly, drastically reducing backend payload rejections.