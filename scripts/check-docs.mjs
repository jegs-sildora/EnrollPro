import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, extname, join, normalize, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const canonicalDocuments = [
  "README.md",
  "ARCHITECTURE_MICROSERVICES.md",
  "docs/README.md",
  "docs/core/SYSTEM_ARCHITECTURE.md",
  "docs/core/DATA_MODEL_AND_STATUS.md",
  "docs/core/SECURITY_AND_ACCESS.md",
  "docs/core/DEVELOPMENT_WORKFLOW.md",
  "docs/features/dashboard/MASTER_DASHBOARD.md",
  "docs/features/enrollment/LEARNER_ENROLLMENT_AND_SECTIONING.md",
  "docs/features/learners/LEARNER_RECORDS.md",
  "docs/features/personnel/PERSONNEL_AND_SF7.md",
  "docs/features/school-year/SCHOOL_YEAR_OPERATIONS.md",
  "docs/features/system/SYSTEM_ADMINISTRATION.md",
  "docs/ui-ux/DESIGN_SYSTEM.md",
  "docs/features/integration/ENROLLPRO-API.md",
  "docs/features/integration/ENROLLPRO-SCHOOL-YEAR-LIFECYCLE.md",
  "docs/features/integration/INTEGRATION_API_V1.md",
  "docs/features/integration/SUBSYSTEM_API_QUICK_START.md",
  "docs/features/integration/AIMS_API_GUIDE.md",
  "docs/features/integration/ATLAS_API_GUIDE.md",
  "docs/features/integration/SMART_API_GUIDE.md",
  "docs/features/integration/MRF_API_GUIDE.md",
]

const apiRouterSections = {
  "auth/auth.router.ts": "Authentication",
  "system/system.router.ts": "Public System Configuration",
  "settings/settings.router.ts": "Settings",
  "dashboard/dashboard.router.ts": "Dashboard",
  "school-year/school-year.router.ts": "School Years",
  "sections/sections.router.ts": "Class Sections and Advisership",
  "sections/sectioning.router.ts": "Reviewed Sectioning Workspace",
  "students/students.router.ts": "Learner Registry",
  "admin/admin.router.ts": "Administration and Audit",
  "audit-logs/audit-logs.router.ts": "Administration and Audit",
  "teachers/teachers.router.ts": "Personnel Directory",
  "learner/learner.router.ts": "Learner Portal and Lookup",
  "admission/admission.router.ts": "Public Applications and Assisted Enrollment",
  "enrollment/eosy.router.ts": "EOSY",
  "enrollment/teacher-eosy.router.ts": "Teacher EOSY",
  "enrollment/enrollment.router.ts": "Enrollment Intake",
  "export/export.router.ts": "Exports",
  "sf7/sf7.router.ts": "SF7 Import And Synchronization",
  "bosy/bosy.router.ts": "BOSY Continuing Learners",
  "remedial/remedial.router.ts": "Remedial Processing",
  "integration/integration-trigger.router.ts": "Integration Triggers",
  "integration/integration.router.ts": "Partner Integration v1",
  "address/address.router.ts": "Public Address Reference",
  "geography/geography.router.ts": "Public Address Reference",
}

const forbiddenReferences = [
  {
    label: "former hard-coded school identity",
    pattern: /Enriqueta Montilla de Esteban Memorial High School/i,
  },
  {
    label: "removed Early Registration route",
    pattern: /\/api\/early-registrations\b/i,
  },
  {
    label: "removed reading-assessment route",
    pattern: /\/api\/reading-assessment\b/i,
  },
  {
    label: "removed enrollment-listing route",
    pattern: /\/api\/enrollment-listings\b/i,
  },
  {
    label: "removed BOSY TLE route",
    pattern: /\/api\/bosy\/tle-programs\b/i,
  },
  {
    label: "removed TLE laboratory model",
    pattern: /\bTLE_LABORATORY\b/,
  },
  {
    label: "removed product source path",
    pattern:
      /(?:client|server)\/src\/features\/(?:reading-assessment|enrollment-listing|intake)\b/i,
  },
  {
    label: "removed Second Brain documentation",
    pattern: /EnrollPro['’]s Second Brain/i,
  },
  {
    label: "removed public API dump directory",
    pattern: /docs\/public-APIS/i,
  },
]

const excludedWorkflowTerms = [
  /Early Registration/i,
  /reading assessment/i,
  /enrollment listings?/i,
  /Internet of Things/i,
  /\bIoT\b/i,
]

const exclusionSignals =
  /\b(?:does not|do not|no |not |without|excludes?|excluded|unsupported|removed|product exclusions?)\b/i

const errors = []

function walkProductDocuments(directory) {
  const files = []
  for (const name of readdirSync(directory)) {
    const absolutePath = join(directory, name)
    const entry = statSync(absolutePath)
    if (entry.isDirectory()) {
      files.push(...walkProductDocuments(absolutePath))
    } else if ([".md", ".txt"].includes(extname(name).toLowerCase())) {
      files.push(absolutePath)
    }
  }
  return files
}

const productDocs = [
  resolve(root, "README.md"),
  resolve(root, "ARCHITECTURE_MICROSERVICES.md"),
  ...walkProductDocuments(resolve(root, "docs")),
  ...walkProductDocuments(resolve(root, "diagrams")),
]

const indexText = readFileSync(resolve(root, "docs/README.md"), "utf8")
const canonicalPaths = new Set(
  canonicalDocuments.map((documentPath) => resolve(root, documentPath)),
)

for (const filePath of productDocs) {
  if (!canonicalPaths.has(filePath)) {
    errors.push(
      `Product document is not part of the canonical set: ${relative(root, filePath).replaceAll("\\", "/")}`,
    )
  }
}

for (const documentPath of canonicalDocuments) {
  const absolutePath = resolve(root, documentPath)
  if (!existsSync(absolutePath)) {
    errors.push(`Missing canonical document: ${documentPath}`)
    continue
  }

  if (documentPath !== "docs/README.md") {
    const indexRelative = normalize(relative(resolve(root, "docs"), absolutePath))
      .replaceAll("\\", "/")
      .replace(/^\.\//, "")
    const rootRelative = normalize(relative(root, absolutePath)).replaceAll("\\", "/")
    if (!indexText.includes(`](${indexRelative})`) && !indexText.includes(`](${rootRelative})`)) {
      errors.push(`Canonical document is not listed in docs/README.md: ${documentPath}`)
    }
  }
}

for (const filePath of productDocs) {
  const relativePath = relative(root, filePath).replaceAll("\\", "/")
  const text = readFileSync(filePath, "utf8")

  for (const forbidden of forbiddenReferences) {
    if (forbidden.pattern.test(text)) {
      errors.push(`${relativePath}: contains ${forbidden.label}`)
    }
  }

  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (
      excludedWorkflowTerms.some((term) => term.test(line)) &&
      !exclusionSignals.test(line)
    ) {
      errors.push(
        `${relativePath}:${index + 1}: excluded workflow is not described as excluded`,
      )
    }
  }

  if (extname(filePath).toLowerCase() === ".md") {
    const markdownLinkPattern = /(?<!!)\[[^\]]+\]\(([^)]+)\)/gu
    for (const match of text.matchAll(markdownLinkPattern)) {
      const rawTarget = match[1].trim()
      if (
        rawTarget.startsWith("#") ||
        /^[a-z][a-z0-9+.-]*:/iu.test(rawTarget)
      ) {
        continue
      }

      const withoutTitle = rawTarget.replace(/\s+["'][^"']*["']$/u, "")
      const pathOnly = decodeURIComponent(withoutTitle.split(/[?#]/u, 1)[0])
      if (!pathOnly) {
        continue
      }

      const targetPath = resolve(dirname(filePath), pathOnly)
      if (!existsSync(targetPath)) {
        errors.push(`${relativePath}: broken local link ${rawTarget}`)
      }
    }
  }
}

const apiReferencePath = resolve(
  root,
  "docs/features/integration/ENROLLPRO-API.md",
)
const apiReference = readFileSync(apiReferencePath, "utf8")

for (const [routerPath, heading] of Object.entries(apiRouterSections)) {
  const sourcePath = resolve(root, "server/src/features", routerPath)
  if (!existsSync(sourcePath)) {
    errors.push(`API catalog check references a missing router: ${routerPath}`)
    continue
  }

  const headingMarker = `## ${heading}\n`
  const sectionStart = apiReference.indexOf(headingMarker)
  if (sectionStart < 0) {
    errors.push(`API catalog is missing section: ${heading}`)
    continue
  }

  const nextSection = apiReference.indexOf(
    "\n## ",
    sectionStart + headingMarker.length,
  )
  const sectionText = apiReference.slice(
    sectionStart,
    nextSection < 0 ? apiReference.length : nextSection,
  )
  const documentedRoutes = new Set(
    [...sectionText.matchAll(
      /^\| (GET|POST|PUT|PATCH|DELETE) \| `([^`?]+)(?:\?[^`]*)?`/gmu,
    )].map((match) => `${match[1]} ${match[2]}`),
  )
  const sourceText = readFileSync(sourcePath, "utf8")
  const mountedRoutes = [
    ...sourceText.matchAll(
      /(?:router|systemRoutes)\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/gu,
    ),
  ].map((match) => `${match[1].toUpperCase()} ${match[2]}`)

  for (const mountedRoute of mountedRoutes) {
    if (!documentedRoutes.has(mountedRoute)) {
      errors.push(
        `API catalog section ${heading} is missing ${mountedRoute} from ${routerPath}`,
      )
    }
  }
}

const appSource = readFileSync(resolve(root, "server/src/app.ts"), "utf8")
const topLevelRoutes = [
  ...appSource.matchAll(
    /apiRouter\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/gu,
  ),
].map((match) => `${match[1].toUpperCase()} /api${match[2]}`)
for (const route of topLevelRoutes) {
  const [method, path] = route.split(" ", 2)
  if (!apiReference.includes(`| ${method} | \`${path}\``)) {
    errors.push(`API catalog is missing top-level route ${route}`)
  }
}

const prismaSchema = readFileSync(
  resolve(root, "server/prisma/schema.prisma"),
  "utf8",
)
const dataModelGuide = readFileSync(
  resolve(root, "docs/core/DATA_MODEL_AND_STATUS.md"),
  "utf8",
)
for (const match of prismaSchema.matchAll(/^(?:model|enum)\s+(\w+)/gmu)) {
  const name = match[1]
  if (!dataModelGuide.includes(`\`${name}\``)) {
    errors.push(`Data model guide is missing Prisma model or enum ${name}`)
  }
}

const clientRouter = readFileSync(
  resolve(root, "client/src/router/index.tsx"),
  "utf8",
)
const systemArchitecture = readFileSync(
  resolve(root, "docs/core/SYSTEM_ARCHITECTURE.md"),
  "utf8",
)
const enrollProClientRoutes = [
  ...clientRouter.matchAll(/path:\s*"([^"]+)"/gu),
]
  .map((match) => match[1])
  .filter((routePath) => routePath !== "/smart" && routePath !== "*")
for (const routePath of enrollProClientRoutes) {
  if (!systemArchitecture.includes(`\`${routePath}\``)) {
    errors.push(`System architecture is missing client route ${routePath}`)
  }
}

if (errors.length > 0) {
  console.error("Documentation check failed:\n")
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exitCode = 1
} else {
  console.log(
    `Documentation check passed for ${productDocs.length} product documentation files.`,
  )
}
