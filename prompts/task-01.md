# Prompt for UI/UX & Logic Implementation: Bachelor Degree Major & Minor

## Role & Context
Act as a Full-Stack Developer. We are completing the `SF7 PROFILE` section of the `New Personnel Profile` modal. 

Currently, the `BACHELOR DEGREE` is a single full-width dropdown. However, in DepEd Junior High Schools, a teacher's undergraduate Major/Specialization is strictly required because it dictates their departmental teaching assignment (e.g., English, Math, Science). We need to update the Bachelor Degree section to capture the Major and Minor by mirroring the UI layout we already built for the Postgraduate section.

## Critical Directive
Transform the Bachelor Degree input area into a 3-column grid identical to the Postgraduate row. Enforce strict validation on the `Major / Specialization` field, as a Junior High School teacher cannot be hired without a declared subject specialization.

## UI Component & Logic Requirements

Please implement the following layout and state changes:

### 1. UI Refactor: The 3-Column Grid
Update the layout of the `BACHELOR DEGREE` section to match the `POSTGRADUATE DEGREE` row directly below it.
*   **Column 1: `BACHELOR DEGREE *`** 
    *   *UI:* Searchable Dropdown (Keep the existing list: BSEd, BEEd, BS, AB, etc.).
    *   *Width:* ~33% of the row.
*   **Column 2: `MAJOR / SPECIALIZATION *`**
    *   *UI:* Text Input or Searchable Dropdown.
    *   *Placeholder:* `E.G. MATHEMATICS`
    *   *Validation:* Make this field **Required**.
*   **Column 3: `MINOR (OPTIONAL)`**
    *   *UI:* Text Input.
    *   *Placeholder:* `E.G. PHYSICAL EDUCATION`

### 2. Layout Spacing
Ensure the vertical spacing between the new Bachelor Degree row and the Postgraduate Degree row is distinct so the user doesn't confuse the fields. Use a standard margin bottom (e.g., `mb-6`) below the Bachelor Degree group. Do NOT add an "Add Another" button to the Bachelor Degree section; a single row is sufficient for standard SF7 reporting.

### 3. Backend Payload Structure & Validation
Update the `POST /api/personnel` payload and backend controller to accept the new fields.
*   **JSON Payload:**
    ```json
    {
      "bachelor_degree": "Bachelor of Secondary Education (BSEd)",
      "bachelor_major": "Mathematics",
      "bachelor_minor": null,
      "postgraduate_degrees": [ ... ]
    }
    ```
*   **Database Schema:** Ensure the `personnel` or `sf7_profiles` table has `bachelor_major` and `bachelor_minor` columns (string/varchar).
*   **Controller Validation:** The backend must throw a `422 Unprocessable Entity` if `bachelor_degree` is provided but `bachelor_major` is empty.