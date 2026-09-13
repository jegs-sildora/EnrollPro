# Prompt for UI/UX Implementation: Walk-In Modal Extended Demographics & Address

## Role & Context
Act as a Frontend Developer. We are updating the "Walk-In Learner Enrollment" modal in EnrollPro. 

We need to restructure the top personal details section to accommodate a Learner's Photo upload, integrate the "Mother Tongue" field, and add a comprehensive, structured "Current Home Address" section mirroring the official DepEd SF1 requirements.

## UI Component Requirements

Please refactor the modal layout using the following specifications:

### 1. Section 1: Personal Details & Photo (Media Object Layout)
Wrap the identity fields in a grid container with a fixed left column (for the photo) and a fluid right column (e.g., `grid grid-cols-[120px_1fr] gap-6`).

*   **Left Column (Learner's Photo):**
    *   Create a 2x2 aspect ratio upload box (`border-dashed border-2 border-gray-300`).
    *   Include a camera icon and the text `UPLOAD PHOTO`. Add the label `Learner's Photo` above it.
*   **Right Column (Dense Data Grid):**
    *   Use a 2-column internal grid for the text inputs.
    *   **Row 1:** `Last Name *` (Span 1) | `First Name *` (Span 1)
    *   **Row 2:** `Middle Name` (Span 1) | `Suffix (Extension)` (Span 1 - Dropdown)
    *   **Row 3:** `Birthdate *` (Span 1 - Datepicker) | `Sex *` (Span 1 - Radio/Toggle)
    *   **Row 4 (New):** `Mother Tongue *` (Span 2 - Full width of this column). Use a searchable dropdown (Combobox) containing standard Philippine languages/dialects (e.g., Hiligaynon, Tagalog, Cebuano).

### 2. Section 2: Current Home Address (Cascading Grid)
Below the Personal Details and Curriculum sections, add a new section header: **`CURRENT HOME ADDRESS`**. 
Use a strict 2-column grid (`grid grid-cols-2 gap-4`) to keep the form compact and prevent excessive vertical scrolling inside the modal.

*   **Row 1 (Manual Entry):**
    *   Input 1: `House No. / Street` (Placeholder: `e.g. 123 or Rizal Street`)
    *   Input 2: `Sitio / Purok` (Placeholder: `e.g. Sitio Calambuga`)
*   **Row 2 (Cascading Dropdowns - Level 1):**
    *   Input 1: `Region *` (Dropdown: `Select Region...`)
    *   Input 2: `Province *` (Dropdown: `Select Region First`). **Logic:** This field MUST be disabled until a Region is selected. Once selected, populate only the provinces within that region.
*   **Row 3 (Cascading Dropdowns - Level 2):**
    *   Input 1: `City / Municipality *` (Dropdown: `Select Province First`). **Logic:** Disabled until Province is selected.
    *   Input 2: `Barangay *` (Dropdown: `Select City First`). **Logic:** Disabled until City is selected.

### 3. Checkbox Action
*   **Bottom of Address Section:** Add a full-width checkbox (`col-span-2`) labeled: **`Permanent Address is same as Current Address`**. Keep it checked by default to save the registrar time.

### 4. Layout & Spacing Polish
*   Use subtle horizontal dividers (`border-b border-gray-200`) with ample padding (`py-6`) between the Personal Details block and the Home Address block to establish clear visual sections.
*   Ensure all required fields `*` feature a red asterisk to visually enforce completion before the "Save as Temporary" button becomes active.