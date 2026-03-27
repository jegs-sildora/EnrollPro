================================================================================
                    SPEC-DRIVEN DEVELOPMENT SYSTEM FOR VIBE CODING
                                  FILE ARCHITECTURE
================================================================================

This system externalizes the AI's memory into a strict Markdown file hierarchy.
It prevents context rot, hallucination, and feature creep by ensuring the AI
only loads the exact information it needs for the current task.

DIRECTORY STRUCTURE:
enrollpro/
├── .agent/                 # The AI's custom instructions and skills
│   ├── instructions.md     # The Master Rules (Persona and global config)
│   └── skills/             # Domain-specific operating procedures
│       ├── 01_database.md
│       ├── 02_api_routes.md
│       └── 03_ui_components.md
├── .spec/                  # The AI's brain, memory, and state machine
│   ├── 00_PROJECT.md       # The North Star (Immutable Vision)
│   ├── 01_REQUIREMENTS.md  # Scope and Boundaries (Immutable Constraints)
│   ├── 02_ROADMAP.md       # Execution Timeline (Updated rarely)
│   ├── 03_STATE.md         # Current RAM/Status (Updated constantly)
│   └── phases/             # Isolated execution contexts
│       ├── phase_1_CONTEXT.md
│       ├── phase_1_PLAN.md
│       └── phase_1_SUMMARY.md
├── client/                 # React 19 Frontend
├── server/                 # Express 5 Backend
└── docs/                   # Additional documentation

================================================================================
                          THE CORE FILES ("THE HARD DRIVE")
================================================================================
These files ground the AI when starting a new session. They establish the
fundamental rules of the project.

--- 00_PROJECT.md ---
Philosophy: The North Star. Prevents the AI from losing the plot or hallucinating
architectures months into development. Defines EnrollPro as a PERN stack application.
Format:
* Goal: 1-2 sentence summary of what the application does.
* Target Audience: Who the end user is.
* Tech Stack: Strict definitions (PERN Stack, React 19, Express 5, PostgreSQL 18)
  so the AI never mixes frameworks.
* Hard Constraints: Things the AI must NEVER do (e.g., "Do not use Redux",
  "Always use Tailwind v4").

--- 01_REQUIREMENTS.md ---
Philosophy: The Boundaries. Defense against AI "feature creep" and scope expansion.
Maps directly to the 5 modules defined in PRD.md.
Format:
* In Scope (v1): The MVP features that must be built now.
* Out of Scope (v2/Future): Ideas to ignore for now.

--- 02_ROADMAP.md ---
Philosophy: The Execution Timeline. Breaks the requirements into sequential chunks.
Format:
* Phase 1: Setup & Infrastructure.
* Phase 2: Core Feature Implementation.
* Phase 3: Polish.

================================================================================
                          THE SKILLS FILES ("THE RULES")
================================================================================
While `.spec/` holds your project's memory, the `.agent/` directory holds the
custom skills the AI needs to write code effectively for your specific codebase.
These files act as the technical operating procedures.

--- instructions.md ---
Philosophy: The Master Rules. The global prompt that dictates the AI's persona,
communication style, and general coding standards for the workspace.

--- skills/01_database.md ---
Philosophy: Domain-Specific Operating Procedure for PostgreSQL and Prisma 6.
Format:
* Conventions: Model naming (PascalCase) vs Field naming (camelCase).
* Rules: Always use Prisma Client; never string-interpolated raw SQL.

--- skills/02_api_routes.md ---
Philosophy: Backend Contract for Express 5 and Node.js.
Format:
* Standards: Zod validation on every route.
* Error Handling: Standard JSON error formats.

--- skills/03_ui_components.md ---
Philosophy: Frontend Contract for React 19, Vite, and Tailwind v4.
Format:
* Styling: Use Tailwind CSS and Shadcn/UI exclusively.
* Components: Strict functional components.
* Notifications: Use Sileo toasts, never alert().

================================================================================
                          THE EXECUTION FILES ("THE RAM")
================================================================================
These files isolate context. You do not feed the AI the entire project history;
you only feed it the current state and the specific plan.

--- 03_STATE.md ---
Philosophy: The Save State. The bridge between chat sessions. The AI reads this
first to understand exactly where it left off.
Format:
* Current Phase: The active milestone.
* Completed Tasks: High-level list of what is already done and stable.
* Current Task: What is actively being built right now.
* Blockers/Known Issues: Bugs or pending decisions.

--- phases/phase_X_PLAN.md ---
Philosophy: The Atomic Task (The Contract). The AI must draft this before writing
code.

================================================================================
                                THE WORKFLOW LOOP
================================================================================
1. BOOT-UP: Attach `.agent/instructions.md`, `00_PROJECT.md`, `01_REQUIREMENTS.md`,
   and `03_STATE.md` to a new chat session.
2. PLANNING: Ask the AI to draft a `PLAN.md` for the current phase, explicitly
   telling it to reference specific `.agent/skills/` files as needed.
3. EXECUTION: Give the AI *only* the `PLAN.md` and the required source files.
4. VERIFICATION: Test the output against the verification steps in the plan.
5. SAVE & QUIT: Force the AI to update `03_STATE.md` with new progress.
================================================================================