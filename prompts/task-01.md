# Technical Specification: Global Input Validation UI/UX Architecture

**Role:** Senior React/Next.js UI Engineer & DepEd JHS Domain Expert

## Context
Following the UX review of the Personnel Profile module, we are standardizing the input validation UI across the entire "EnrollPro" platform. The current implementation suffers from layout shifting (grid breaking), reduced contrast due to background tints, and overly aggressive error styling (red labels). 

This document serves as the comprehensive implementation plan for developers to build a stable, accessible, and user-friendly validation system for all input fields (Text, Select/Dropdowns, Date Pickers, and Checkboxes).

## Phase 1: Reusable Component Architecture
To ensure absolute consistency and prevent developers from manually styling error states on every page, we must create a centralized wrapper component (e.g., `FormField.tsx` or `ValidatedInput.tsx`).

### 1. Layout Stability (The Anti-Shift Grid)
*   **Implementation:** Wrap every input and its associated error message in a container with a fixed minimum height (e.g., `min-h-[5.5rem]`) or use absolute positioning for the error text container.
*   **Outcome:** When the error message appears, it fills the pre-allocated empty space below the input rather than pushing the surrounding elements down. This keeps multi-column grids (like the Bachelor Degree / Major / Minor row) perfectly aligned.

### 2. Styling Rules (Tailwind CSS)
Enforce strict separation between the label, the input border, and the error text.
*   **Labels:** Must strictly remain a neutral dark gray (e.g., `text-slate-700 font-medium`), even when the field is in an error state. Do not turn labels red.
*   **Input Backgrounds:** Must strictly remain solid white (`bg-white`). Do not use pink or red background tints, as they muddy the placeholder text and violate contrast accessibility standards.
*   **Input Borders (Error State):** Apply a crisp red border and ring only when invalid (`border-red-500 focus:ring-red-500 focus:border-red-500`).
*   **Error Message Text:** Use a small, highly legible red text (`text-red-600 text-xs mt-1.5`) paired with a small SVG alert icon to ensure colorblind accessibility.

## Phase 2: Validation Logic Integration (React Hook Form + Zod)
Manage form state and validation schemas centrally so the UI components only have to react to passed-down error strings.

### 1. Schema Definition
Define the validation schema (e.g., using Zod) mirroring the layman's terms established for DepEd personnel.
```typescript
// Example snippet of the central schema concept
const personnelSchema = z.object({
  firstName: z.string().min(1, "Please enter the name using only letters and spaces."),
  depEdId: z.string().length(7, "Please enter a valid 7-digit DepEd Employee ID."),
  // ... apply to all fields
});