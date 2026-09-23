# Prompt for UI/UX & Logic Implementation: NLPA / Drop Out Evidence Upload

## Role & Context
Act as a Frontend Developer. We are upgrading the `Process Learner Drop Out / NLPA` modal. 

In DepEd public schools, officially dropping a student requires documented proof of intervention (e.g., Home Visitation Forms, Parent-Teacher Conference logs, anecdotal records). We need to add a robust File Upload component to this modal so class advisers can attach digital evidence directly to the learner's drop-out record.

## Critical Directive
Integrate a Drag-and-Drop file upload zone below the "Intervention Notes" field. Since adding this component will increase the height of the modal, ensure the modal body is vertically scrollable while keeping the header and footer (action buttons) fixed/sticky so they are always accessible.

## UI Component & State Logic Requirements

Please implement the following UI additions and form logic:

### 1. The Drag-and-Drop Upload Zone
*   **Placement:** Directly below the `Intervention Notes` textarea.
*   **Visual Design:** Render a dashed-border rectangular container with a light gray or muted background.
*   **Icons & Text:** Center a standard "Cloud Upload" or "Document" icon inside.
    *   *Primary Text:* `Drag and drop files here, or click to browse.`
    *   *Helper Text (Crucial for DepEd context):* `Attach intervention evidence (e.g., scanned Home Visitation Forms, Parent Agreements, or Anecdotal Records).`
    *   *Constraint Text:* `Maximum 3 files. Accepted formats: PDF, JPG, PNG (Max 5MB each).`

### 2. File Preview & Management State
Once a user selects or drops a file, the UI must provide clear feedback:
*   **File List:** Below (or replacing) the drag-and-drop zone, render a sleek vertical list of the attached files.
*   **Item Row:** Each uploaded file should display:
    *   A small file-type icon (e.g., a PDF icon or image thumbnail).
    *   The truncated file name (e.g., `Home_Visitation_Juan...pdf`).
    *   The file size (e.g., `1.2 MB`).
    *   A red `X` or Trash icon on the far right to allow the user to easily remove the file before final submission.

### 3. Form Validation & Logic Upgrades
Upgrading this UI requires upgrading the validation logic:
*   **Conditional Requirement:** If the user attaches a file, the `Intervention Notes` field should dynamically become *Required* (remove the "Optional" label). They must provide a brief written context for the evidence they are submitting.
*   **Upload Handling:** Ensure the form submission logic handles `multipart/form-data` correctly. The files should be uploaded to the server/cloud storage, and the resulting file URLs/IDs should be appended to the drop-out transaction payload.

### 4. Modal Layout Protection
*   Apply `overflow-y: auto` and a `max-height` (e.g., `max-h-[60vh]`) to the modal's internal body container. 
*   Ensure the modal footer containing the `Cancel` and `Finalize Drop Out` buttons remains permanently visible at the bottom, regardless of how many files are added to the list above it.