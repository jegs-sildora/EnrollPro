# Technical Implementation Plan: Distance Learning Modalities Integration

**Role:** Senior UI/UX Engineer & DepEd JHS Domain Expert

## Context
In accordance with DepEd enrollment data requirements, we need to integrate the "Distance Learning Modalities" selection into the digital Enrollment Form. This addresses the physical form's requirement to capture alternative learning preferences[cite: 39]. 

## Objective
Insert a multi-select checkbox group into Step 4 of the enrollment flow, positioned directly beneath the "Preferred Curricular Program" section[cite: 40]. The plan ensures UI consistency using the existing design system and guarantees the selected data is accurately persisted to the database.

---

## 1. UI/UX Design & Placement Instructions

### Location & Container
*   **Target Placement:** Render the new section immediately below the `Preferred Curricular Program` block[cite: 40].
*   **Container Styling:** Wrap the section in the standard form container (e.g., a white or lightly tinted `<Card>` or `<div>` with standard padding and rounded corners) to match the visual weight of the adjacent "Preferred Curricular Program" box[cite: 40].

### Typography & Labels
*   **Primary Section Label:** Use the standard field label typography (e.g., dark maroon or slate, bold, uppercase) and title it: **ALTERNATIVE LEARNING MODALITY PREFERENCES**.
*   **Helper Text / Question:** Directly below the label, insert the exact text from the physical form using a muted, smaller text variant: *"If the school will implement other distance learning modalities aside from face-to-face instruction, what would you prefer for your child? (Check all that applies)"*[cite: 39].

### Input Component Selection
*   **Component:** Utilize the existing `<Checkbox>` and `<CheckboxGroup>` components from the design system. Do not use radio buttons, as parents are allowed to select multiple options[cite: 39].
*   **Grid Layout:** To optimize vertical space and maintain readability, arrange the checkboxes in a responsive CSS Grid:
    *   Mobile: 1 column (`grid-cols-1`).
    *   Tablet/Desktop: 2 or 3 columns (`md:grid-cols-2 lg:grid-cols-3`) with standard gap spacing (e.g., `gap-4`).

### The Options
Map the exact options from the physical form into the checkbox group[cite: 39]:
1.  Blended (Combination)[cite: 39]
2.  Educational Television[cite: 39]
3.  Homeschooling[cite: 39]
4.  Modular (Digital)[cite: 39]
5.  Modular (Print)[cite: 39]
6.  Online[cite: 39]
7.  Radio-Based Television[cite: 39]

---

## 2. State Management & Validation

*   **Data Type:** The state for this field must be an **Array of Strings** (e.g., `learningModalities: string[]`), initialized as an empty array `[]`.
*   **Checkbox Logic:** 
    *   `onChange`: If checked, append the option's value to the array.
    *   `onChange`: If unchecked, filter/remove the option's value from the array.
*   **Validation Rule:** Since the question asks what they prefer *if* other modalities are implemented aside from face-to-face[cite: 39], this field should logically be **Optional**. If the array is empty upon submission, the system implicitly understands the preference is strictly standard face-to-face.

---

## 3. Database & Backend Integration

### Database Schema Update
*   **Target Table:** `enrollment_applications` (or the specific table handling Step 4 metadata).
*   **New Column:** Add a new column named `preferred_learning_modalities`.
*   **Data Type:** 
    *   If using PostgreSQL: Use `JSONB` or `TEXT[]` (Array of Strings) to store the multiple selections efficiently.
    *   If using MySQL: Use `JSON`.

### API Payload Updates
*   **Request Body:** Ensure the frontend `POST`/`PUT` payload includes the `preferred_learning_modalities` array when submitting Step 4.
*   **Backend Validation:** Update the backend validation schema (e.g., Zod, Joi, or Laravel form requests) to accept an array. Validate that every string inside the array strictly matches one of the 7 predefined enum values listed above to prevent dirty data insertion.