# SCHEMA AUDIT: DepEd System Data Verification v200.0

This document serves as a comprehensive catalog of the data fields extracted from both the database (Prisma models) and API validation (Zod schemas). It maps the active system properties to the official Department of Education School Forms (SF1, SF5, SF7) to verify compliance, enforce strict typing, and identify missing requirements.

---

## 1. Learner Data Schema Mapping (School Form 1 & School Form 5)

The `Learner` and `EnrollmentApplication` models map to the demographic and academic requirements of SF1 (School Register) and SF5 (Report on Promotion & Level of Proficiency).

### Mandatory Fields (Enforced by DB & API)
| DepEd Requirement | System Property | Type & Validation (DB / Zod) | Status |
| :--- | :--- | :--- | :--- |
| **Learner Reference Number (LRN)** | `lrn` | `VarChar(12)` / `^\d{12}$` | Enforced (Mandatory unless `hasNoLrn` is true for G7/Transferees) |
| **Last Name** | `lastName` | `String` / `min(1), max(100)` | Mandatory |
| **First Name** | `firstName` | `String` / `min(1), max(100)` | Mandatory |
| **Sex** | `sex` | `Enum (MALE/FEMALE)` / `SexEnum` | Mandatory |
| **Date of Birth** | `birthdate` | `Date` / `YYYY-MM-DD` | Mandatory |
| **Age** | *(Calculated)* | Derived from `birthdate` | Supported |
| **Barangay** | `barangay` | `String` / `min(1), max(100)` | Mandatory |
| **City/Municipality** | `cityMunicipality` | `String` / `min(1), max(100)` | Mandatory |
| **Province** | `province` | `String` / `min(1), max(100)` | Mandatory |
| **Primary Contact Number** | `contactNumber` | `String` / `/^09\d{2}-\d{3}-\d{4}$/` | Mandatory (via `earlyRegistrationSubmitSchema`) |

### Optional / Conditional Fields (Nullable in DB, Optional in API)
| DepEd Requirement | System Property | Type & Validation | Status |
| :--- | :--- | :--- | :--- |
| **Middle Name** | `middleName` | `String?` / `max(100)` | Optional |
| **Extension Name (e.g. Jr.)**| `extensionName` | `String?` / `max(20)` | Optional |
| **Mother Tongue** | `motherTongue` | `String?` / `max(100)` | Optional |
| **Religion** | `religion` | `String?` / `max(100)` | Optional |
| **IP (Ethnic Group)** | `isIpCommunity`, `ipGroupName` | `Boolean`, `String?` / `max(100)` | Supported & Verified |
| **Mother's Maiden Name** | `mother.maidenName` | `String?` / `min(1)` if `!hasNoMother` | Conditionally Mandatory |
| **Father's Name** | `father.lastName` | `String?` | Conditionally Mandatory |
| **Guardian's Name** | `guardian.lastName` | `String?` | Conditionally Mandatory |

### School Form 5 Mapping (Promotion Status)
| DepEd Requirement | System Property | Type & Validation | Status |
| :--- | :--- | :--- | :--- |
| **General Average** | `genAve` / `finalAverage` | `Float?` / `number().min(0).max(100)` | Optional (Recorded in `EnrollmentHistory` / `EnrollmentRecord`) |
| **Action Taken** | `eosyStatus` / `academicStatus` | `Enum: PROMOTED, CONDITIONALLY_PROMOTED, RETAINED...` | Supported |

### Identified Gaps in Learner Data (Recommendations)
- **SF5 Incomplete Subjects**: While `academicDeficiencyNote` (String) exists in `EnrollmentHistory`, there is no structured array property (e.g., `String[]`) strictly dedicated to enumerating specific failed or incomplete subjects.
- **BMI (SF8)**: The system tracks `heightCm` and `weightKg` in `HealthRecord`, and computes BMI at runtime. This fully satisfies SF8.

---

## 2. Personnel Data Schema Mapping (School Form 7)

The `Teacher`, `Department`, and `TeacherDesignation` models map to the requirements of SF7 (School Personnel Assignment List and Basic Profile).

### Mandatory Fields (Enforced by DB & API)
| DepEd Requirement | System Property | Type & Validation (DB / Zod) | Status |
| :--- | :--- | :--- | :--- |
| **Employee Number** | `employeeId` | `VarChar(7)` / `/^[0-9]{7}$/` | Mandatory (Unique, exactly 7 numeric digits) |
| **Last Name** | `lastName` | `String` / `requiredUpperText()` | Mandatory |
| **First Name** | `firstName` | `String` / `requiredUpperText()` | Mandatory |
| **Sex** | `sex` | `Enum (MALE/FEMALE)` | Mandatory (Defaults to FEMALE) |

### Optional / Conditional Fields
| DepEd Requirement | System Property | Type & Validation | Status |
| :--- | :--- | :--- | :--- |
| **Middle Name** | `middleName` | `String?` / `optionalUpperText()` | Optional |
| **Degree / Specialization** | `specialization` | `String?` / `Enum` | Optional |
| **Plantilla Item Code/Position** | `plantillaPosition` | `String?` / `Enum` | Optional |
| **Department / Subject Area**| `departmentId` | `Int?` (FK to `Department`) | Optional |
| **Nature of Assignment** | `personnelType` | `String?` / `TEACHING, NON_TEACHING`| Optional |
| **Service Status** | `serviceStatus` | `String` / `Enum (ACTIVE, ON_LEAVE, TRANSFERRED...)` | Defaults to "ACTIVE" |
| **Advisory Capacity** | `isClassAdviser`, `advisorySectionId` | Managed via `TeacherDesignation` | Supported |
| **Ancillary Assignments** | `ancillaryRoles` | `String[]` (via `TeacherDesignation`) | Supported |

### Identified Gaps in Personnel Data (Recommendations)
- **Nature of Appointment**: SF7 explicitly lists "Regular", "Provisional", or "Substitute". The current `personnelType` tracks Teaching vs Non-Teaching, and `plantillaPosition` holds the job title, but there isn't a strict field for the contract nature.
- **Fund Source**: SF7 requires declaring the fund source (National, City, Local). This does not exist in the current schema.
- **Tax Identification Number (TIN)**: Often requested alongside basic employee data, but currently missing from the `Teacher` model.

---

## 3. Data Integrity & Validation Notes
- **Text Normalization**: The API (Zod) applies strict `.normalize("NFC").toUpperCase()` transformations to personnel names to prevent encoding issues and enforce a standard format.
- **Relational History**: The system avoids overwriting teacher advisories by utilizing the `TeacherDesignation` and `SectionAdviser` ledgers. This guarantees that historical DepEd reports (previous school years) remain strictly immutable and verifiable.
- **UUIDs**: Students are issued a random `externalId` (UUID) to prevent internal sequential ID leakage on public-facing forms.
