# Prompt for UI/UX & React Implementation: Dynamic Grade-Level Color Theming

## Role & Context
Act as a React Frontend Developer. We are upgrading the `CLASS ADVISERSHIP & SECTION MANAGEMENT` workspace to implement dynamic grade-level color coding.

Currently, the active tabs and primary buttons use a static brand color. To reduce cognitive load and prevent data entry errors, the UI must dynamically re-theme itself based on the currently selected Grade Level tab, utilizing the system's predefined grade-level color palette. 

## Critical Technical Directive
**You must reuse existing design system components.** Do not generate custom UI styling code, raw CSS classes, or hardcoded hex values in the component markup. You must leverage our established Theme Provider, CSS variables, or design system color props to pass the dynamic color states to the existing `<Tabs>`, `<Button>`, and `<Card>` components.

## UI Component & Theme Logic Requirements

Please implement the following state-driven theme updates:

### 1. Theme Configuration Mapping
Ensure the active grade state is mapped to the existing system color variables. For example:
*   `Grade 7` -> Maps to `theme.colors.grade7`
*   `Grade 8` -> Maps to `theme.colors.grade8`
*   `Grade 9` -> Maps to `theme.colors.grade9`
*   `Grade 10` -> Maps to `theme.colors.grade10` 

### 2. Dynamic Component Styling
When a Grade tab is clicked, the active color must propagate to the following UI elements on the page:
*   **The Active Tab:** The background color of the active tab (e.g., `GRADE 7`) must use the specific grade color, while inactive tabs remain neutral/gray.
*   **Primary Action Buttons:** All primary solid buttons within the active view (e.g., `Open SF1 Masterlist`) must adopt the grade color as their background color.
*   **Accents & Typography:** Update subtle UI accents, such as the small colored dot indicator next to `SPECIAL CURRICULAR PROGRAMS (SCP)` and `BASIC EDUCATION CURRICULUM (BEC)`, to match the active grade color.
*   **Interactive States (Hover/Focus):** Ensure the `hover` states for icon buttons (like the Edit/Pencil and Delete/Trash icons on the section cards) utilize a tinted or localized version of the active grade color instead of a generic hover gray.

### 3. State Management
*   The thematic color state must be tightly coupled to the active tab state (`activeTab` or `selectedGrade`).
*   When the user switches tabs, the transition of the primary UI elements to the new color must be immediate and seamless, requiring no page reloads.

### 4. Empty State / Add Section Container
*   The dashed `ADD SECTION` placeholder card should subtly reflect the active theme. Update its hover border color (and the `+` icon color on hover) to use the active grade's color variable, encouraging interaction while keeping the resting state clean and muted.