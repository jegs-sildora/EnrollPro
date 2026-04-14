# Database Review Plan: EnrollPro DepEd JHS (Grades 7-10)

## Objectives

- Validate whether the Prisma schema in server/prisma/schema.prisma supports implemented DepEd JHS workflows documented in this repository.
- Identify schema-document mismatches in entities, attributes, relationships, constraints, naming, and lifecycle behavior.
- Evaluate normalization quality (1NF, 2NF, 3NF), including many-to-many modeling and anti-patterns.
- Assess data integrity, referential integrity, and scalability/performance risks.
- Deliver a prioritized, normalization-forward schema improvement package.

## Scope of Analysis

### In Scope

- Prisma schema structure and constraints in server/prisma/schema.prisma.
- Documentation in docs/, with priority on docs/core and docs/features for implemented requirements.
- Domain alignment across:
  - School year and school settings
  - Admission and early registration
  - Enrollment and sectioning
  - SCP configuration and screening
  - SIMS/health records
  - Teacher management
  - Audit and email logging

### Out of Scope

- Applying migrations or changing runtime code in this review phase.
- Rewriting controllers/services.
- Treating proposed future enhancements as current mandatory requirements (they will be called out separately as enhancement opportunities).

## Step-by-Step Approach

1. Build schema inventory from server/prisma/schema.prisma.
   - Models, fields, enums, defaults, foreign keys, unique constraints, and indexes.
2. Build documentation requirement matrix from docs/.
   - Required entities, attributes, relationships, and workflow/state constraints.
   - Tag each requirement as implemented baseline vs proposed enhancement.
3. Execute schema-to-doc alignment crosswalk.
   - Classify each requirement: Aligned, Partially Aligned, Missing, Contradictory.
4. Perform normalization audit.
   - 1NF: atomicity, repeating groups, arrays used as relational sets.
   - 2NF: dependency on full keys in composite-key contexts.
   - 3NF: transitive dependencies and duplicated derivable attributes.
5. Perform referential integrity and relationship audit.
   - Validate FK optionality, delete/update behavior, cardinality correctness, and missing junction tables.
6. Perform performance/scalability review.
   - Evaluate high-growth tables and index fit for expected query paths.
   - Highlight retention/archival concerns for append-heavy logs.
7. Produce final recommendation set.
   - Normalization strategy
   - Revised table/column/relationship design
   - FK/constraint updates
   - Data integrity and consistency controls
   - Optional revised Prisma schema snippets

## Assumptions

- server/prisma/schema.prisma reflects the current database contract.
- Implemented requirements in docs/core and docs/features are baseline truth for alignment.
- Known docs-vs-code reality gaps may exist and must be explicitly labeled as such.
- Manila-specific date handling remains primarily application-layer unless DB constraints are explicitly required.

## Risks and Constraints

- Documentation may contain legacy terms that conflict with current runtime/schema reality.
- Some lifecycle rules (for example status transitions) may be enforced in controllers, not in DB constraints.
- Full normalization recommendations may imply larger migrations and data backfills.
- Existing production data and backward compatibility can constrain ideal schema changes.

## Expected Outputs

- This plan file: docs/database-review-plan.md.
- A structured schema review report containing:
  - Summary of findings
  - Alignment issues
  - Normalization and design problems
  - Recommended schema improvements
  - Optional revised Prisma schema snippets
- Clear mapping from findings to source evidence (schema/doc references).

## Deliverable Format

The review output will be structured as:

1. Link/Path to Generated Plan (.md)
2. Summary of Findings
3. Alignment Issues
4. Normalization & Design Problems
5. Recommended Schema Improvements
6. Optional: Revised Prisma Schema Snippets
