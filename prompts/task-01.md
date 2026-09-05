# Prompt for UI/UX Implementation: Batch Enrollment Confirmation Modal

## Role & Context
Act as a Frontend Developer. We are refactoring the "Batch Enroll Selected Learners" confirmation modal in the Learner Enrollment module of EnrollPro (a DepEd Junior High School system). 

Currently, the modal uses destructive/error-state UI patterns (a red warning triangle) for a positive action, and lacks critical verification data (LRN) in the list.

## The Objective
Redesign the modal to convey a constructive, official administrative action rather than a destructive warning. Improve the data density of the learner list to meet DepEd verification standards.

## UI Component Requirements

Please update the modal component with the following specifications:

### 1. Header & Iconography (Semantic Correction)
*   **Remove Error Icon:** Delete the red warning triangle at the top of the modal.
*   **New Icon:** Replace it with a neutral or positive icon, such as a "Users/Group" icon or a "Clipboard with Checkmark". Use a brand-neutral color (e.g., primary brand maroon or a success green) with a soft background tint.
*   **Header Copy:** Keep `Enroll Selected Learners`.
*   **Subtitle Copy:** Change the generic question to: *`You are about to officially enroll the following learners for the upcoming school year. Please review the list below.`*

### 2. The Learner List (Data Density)
Update the scrollable list to include the Learner Reference Number (LRN) to prevent mistaken identity.
*   **List Header:** Keep the total count banner (e.g., `19 Learners Selected`), but style it with a subtle background (e.g., `bg-gray-50`) to separate it from the rows.
*   **Row Layout (Per Learner):**
    *   **Left Column (Identity):** 
        *   **Primary Text:** Learner Name (e.g., `RAMOS, CAMILLE JOY R.`) - Dark, medium weight.
        *   **Secondary Text:** LRN (e.g., `LRN: 100000000037`) - Muted gray, smaller text block positioned directly under the name.
    *   **Right Column (Grade):** Keep the incoming grade badge (e.g., `G8` in yellow).

### 3. Action Buttons (Safe Affordance)
*   **Primary Button (`ENROLL`):** Ensure this button uses a "Safe Primary" color. If the system's primary action color is maroon, use that, but ensure it does not look like a "Delete" button. Alternatively, use a standard Success Green (e.g., `bg-green-600`).
*   **Secondary Button (`CANCEL`):** Keep this as a standard ghost/outline button to simply close the modal without taking action.

## State Management 
*   **On Confirm:** Close the modal, trigger a success toast (e.g., *"Successfully enrolled 19 learners"*), and update the main dashboard queues (moving them from the pending list to the officially enrolled list).