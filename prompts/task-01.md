# Prompt for UI/UX Implementation: SCP Online Admission Form

## Role & Context
Act as a Frontend Developer. We are creating a new, dedicated public-facing page: the **Special Curricular Program (SCP) Online Admission Form** for incoming Grade 7 applicants. 

Unlike the standard enrollment form, the SCP admission process acts as an early screening mechanism (often running from January to May). It requires specialized academic history (e.g., Grade 5 Gen Ave), specific achievement records, and early documentary uploads. 

## Critical Directive
Strictly utilize the existing design system components, form layouts, data grids, and spacing tokens used in the current `Online Enrollment Form`. Do not write custom CSS or introduce new wrapper styles.

## UI Component Requirements

Please construct the form using the following structured layout:

### 1. Form Header & Program Selection
*   **Data Privacy Notice:** Reuse the exact existing `Data Privacy Notice` component at the very top of the form.
*   **SCP Selection Dropdown:** 
    *   Label: `Select Special Curricular Program *`
    *   Options: `Science, Technology, and Engineering (STE)`, `Special Program in the Arts (SPA)`, `Special Program in Sports (SPS)`.
    *   *Dynamic Helper Text:* Render an existing informational alert component below this dropdown based on the selection (e.g., If STE is selected, display: "Eligibility: No grades lower than 85% in Math and Science, and 80% in other subjects.").

### 2. Section 1: Personal Data
Reuse the exact "Media Object" and 2-column grid patterns from the standard enrollment form.
*   **Left Column:** 2x2 `Learner's Photo` upload component.
*   **Right Column Grid:** 
    *   `Last Name`, `First Name`, `Middle Name`, `Suffix` (Existing text inputs/dropdowns).
    *   `Birthdate` (Datepicker), `Age as of June 30` (Auto-calculated), `Sex` (Radio group).
    *   `Complete Home/Permanent Address` (Existing cascading dropdowns for Region/Province/City/Barangay).
    *   `Contact Numbers` (Text input).

### 3. Section 2: Previous School Data (Elementary)
Use the existing 2-column form grid component to capture the applicant's Grade 6 information.
*   `Name of School` (Text input) | `School ID` (Numeric input)
*   `Complete School Address` (Text input)
*   `School Type` (Existing Radio: Public / Private)

### 4. Section 3: Academic Profile & Qualifications (SCP Specific)
This section differentiates the admission form from the regular enrollment form. Use existing standard inputs.
*   **Row 1:** `Student's Final General Average in Grade 5 *` (Numeric input) | `Batch Rank (Grade 5)` (Numeric input, Optional).
*   **Row 2:** `Under Special Science Curriculum in Elem?` (Existing Checkbox/Radio: Yes / No).
*   **Row 3 (Dynamic Achievements Table):** 
    *   Implement an existing dynamic list/table component where students can click `+ Add Achievement`. 
    *   Columns: `Title of Competition/Contest`, `Achievement/Award`, `Level (School, District, Division, Regional, National)`. 
    *   *Logic:* If SPA is selected, rename this to `Arts Portfolio/Performances`. If SPS is selected, rename to `Sports Recognitions`.

### 5. Section 4: Documentary Requirements Upload
Instead of physical plastic envelopes, applicants will upload their screening requirements here using the existing file upload component.
*   Render a grid of upload zones (using the existing file uploader component) for the following:
    *   `Certified True Copy of Grade 6 SF9 (1st-2nd Quarter)` *Required*
    *   `PSA Birth Certificate` *Required*
    *   `Certificate of Good Moral Character` *Required*
    *   `Medical Certificate` *Required for STE and SPS*
*   Include standard helper text under each uploader (e.g., `Max file size: 5MB. Accepted formats: PDF, JPG, PNG`).

### 6. Action Footer
*   Use the existing form footer layout.
*   Include an existing checkbox: `I hereby certify that the information provided is true and correct...`
*   **Primary Button:** `Submit Admission Application` (Disable until all required `*` fields and file uploads are complete).