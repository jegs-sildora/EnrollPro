# Prompt for UI/UX Implementation: "For Review" Tabular Form Refactor

## Role & Context
Act as a Frontend Developer. We are refactoring the right-hand detail pane in the "Learner Enrollment" module for EnrollPro (a DepEd Junior High School system). 

Currently, the "For Review" application panel uses a stacked layout with large, airy form fields. This forces horizontal scrolling and slows down registrars during high-volume enrollment periods. 

## The Objective
Compress the layout by converting the profile, academic history, curriculum, and document sections into a dense, high-efficiency **Tabular Form**. The layout must minimize vertical height while preserving necessary interactive inputs (dropdowns and checkboxes).

## UI Component Requirements

Please refactor the right panel using the following structural guidelines:

### 1. Compact Profile Header
Remove the large, green ID-card style box. Replace it with a slim, horizontally aligned header at the top of the pane:
*   **Left:** Learner Name (Large, Bold) + Sex Badge (e.g., `MALE`).
*   **Right:** LRN and Incoming Grade Level.
*   *Note:* Move the contact details (Primary Contact, Relationship, Contact Number) into the tabular grid below.

### 2. Tabular Form Grid Layout
Below the header, implement a full-width, 2-column grid or table structure:
*   **Column 1 (Labels):** 30% width. Use a muted text color (e.g., `text-gray-600`), standard text size, and right-align or left-align consistently.
*   **Column 2 (Values/Inputs):** 70% width. Use standard dark text.
*   **Row Styling:** Apply a solid, subtle bottom border to each row (e.g., `border-b border-gray-200`) to guide the user's eye horizontally. Add sufficient padding to each row to make it clickable/readable without feeling cramped.

### 3. Data Mapping & Input Preservation
Map the data into the tabular rows as follows. **Crucially, maintain the interactive elements where specified.**

*   **Section 1: Contact Information**
    *   Row 1: `Primary Contact` | Value: [Name] ([Relationship]) - [Contact Number]

*   **Section 2: Academic History**
    *   Row 2: `Previous School` | Value: [School Name] (Read-only text)
    *   Row 3: `Final Gen Ave` | Value: [Grade] (Read-only text)

*   **Section 3: Curriculum Assignment**
    *   Row 4: `Requested Curriculum` | Value: [Curriculum String] (Read-only text, remove the large gray background).
    *   Row 5: `Official Program` | Value: **[Keep the `<select>` Dropdown]**. Style the dropdown to sit flush within the table cell.

*   **Section 4: Required Documents Verification**
    *   *UX Tweak:* Convert the large checkboxes into compact toggle switches or standard inline checkboxes. Move the helper text (e.g., "Original report card signed...") into a small tooltip icon (`?`) next to the label to save space.
    *   Row 6: `Physical SF9 (Report Card)` | Value: **[Keep Checkbox/Toggle]**
    *   Row 7: `PSA Birth Certificate` | Value: **[Keep Checkbox/Toggle]**

### 4. Sticky Footer (Action Buttons)
By compressing the data into this tabular format, the entire form should now fit above the fold. 
*   Ensure the action container (holding `CANCEL APPLICATION` and `ENROLL AS TEMPORARY`) is anchored to the bottom of the pane, or naturally flows immediately after the table without requiring a scroll.