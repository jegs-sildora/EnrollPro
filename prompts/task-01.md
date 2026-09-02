# Prompt for UI/UX Implementation: Back Subjects Record Redesign

## Role & Context
Act as a Frontend Developer. We need to refactor the read-only "Back Subjects Record" card in the EnrollPro Learner Profile. The current layout suffers from excessive horizontal whitespace and poor visual grouping, making it difficult to scan.

## The Objective
Transform the wide, sparse card into a structured, highly scannable "Data Row" layout. The information should flow naturally from left to right without forcing the user's eyes to jump across empty space.

## UI Component Requirements

Please refactor the internal layout of the subject card using the following structural guidelines:

### 1. Card Container & Layout System
*   **Remove Extreme Spacing:** Remove any styling that forces the content to stretch to the extreme left and right edges (e.g., remove `justify-between`). 
*   **Implement a Grid System:** Convert the inside of the card into a 4-column grid setup (or a tightly grouped flex layout) to keep the data organized and visually anchored.

### 2. Column Mapping (Left to Right)
Organize the data points into these distinct vertical columns within the card:

*   **Column 1: Subject Identity (Left-aligned)**
    *   Keep the subject icon.
    *   Display the Subject Name prominently (e.g., `GRADE 7 FILIPINO 7`).
    *   Display the Subject Code directly below the name in a smaller, muted font (e.g., `FIL7`).
*   **Column 2: Academic Context (Left-aligned)**
    *   Add a small column header or label: `School Year`.
    *   Display the historical year below it (e.g., `S.Y. 2027-2028`).
*   **Column 3: Academic Result (Center-aligned)**
    *   Add a small column header or label: `Final Rating`.
    *   Display the failing grade directly below it, retaining the bold, red text color for emphasis (e.g., `74`).
*   **Column 4: Status (Right-aligned)**
    *   Place the `UNRESOLVED` badge here. Vertically center it within the column. 

### 3. Visual Polish and Typography
*   **Alignment:** Ensure the content within all four columns is vertically centered relative to each other so the row looks perfectly balanced.
*   **Hierarchy:** Use a slightly smaller, muted text weight for the labels (`School Year`, `Final Rating`, `FIL7`) so they do not compete with the actual data (`S.Y. 2027-2028`, `74`).
*   **Borders/Backgrounds:** Keep the card's current subtle border and background, but ensure the internal padding is consistent.