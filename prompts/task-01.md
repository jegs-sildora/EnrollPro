# Prompt for UI/UX Implementation: Conditionally Promoted Back Subjects Form

## Role & Context
Act as a Frontend Developer. We are refactoring the "Walk-In Learner Enrollment" modal in EnrollPro. 

Currently, when a registrar selects `CONDITIONALLY PROMOTED`, the UI reveals a generic multi-select dropdown for "Back Subjects." This is insufficient for DepEd compliance, as the system must also capture the specific failing grade (typically 60-74) for each failed subject. 

## The Objective
Replace the multi-select dropdown with a dynamic, 2-row maximum input system. Each row must contain a searchable Subject Dropdown paired with a restricted Numeric Input for the failing grade.

## UI Component Requirements

Please update the highlighted section in the modal with the following specifications:

### 1. Section Header
*   Keep the header: `Grade [X] Back Subjects *`
*   Remove the `0 / 2 selected` text. Replace it with a small helper text: `(Maximum of 2 subjects)` styled in muted gray.

### 2. The Subject + Grade Row Layout (Grid)
Implement a 2-column grid layout for the input row (e.g., `grid grid-cols-12 gap-4`).
*   **Column 1 (Searchable Dropdown - Span 8 or 9):**
    *   Convert this into a combobox (searchable dropdown) so the user can type "Math" to quickly find "Mathematics".
    *   Placeholder: `Search subject...`
*   **Column 2 (Grade Input - Span 4 or 3):**
    *   Add a standard text/number input field.
    *   Placeholder: `Rating` or `Grade`.
    *   Add a small right-aligned suffix inside the input if possible, or just keep it clean.

### 3. Validation & Constraints (Strict)
*   **Grade Input Limits:** The number input must strictly only accept integers between **60 and 75**. 
    *   Use `type="number"`, `min="60"`, `max="75"`, and `maxLength="2"`.
    *   If the user types a number outside this range, highlight the field border in red and show a micro-tooltip: `Grade must be between 60-75`.
*   **Subject Uniqueness:** If Subject A is selected in Row 1, disable or hide Subject A from the dropdown options in Row 2.

### 4. Dynamic Row Logic (1 or 2 Subjects)
Since a student can be conditionally promoted by failing just 1 subject, the UI should not force them to fill out 2 rows.
*   **Default State:** Show exactly 1 input row (Subject + Grade).
*   **Add Action:** Below the first row, add a subtle ghost button with a plus icon: `+ Add Second Subject`.
*   **Max Capacity:** Once clicked, reveal the second row and hide the `+ Add` button (since DepEd policy caps this at 2 subjects). 
*   **Remove Action:** On the second row, include a small 'X' or trash icon on the far right so the registrar can remove it if they clicked it by mistake.