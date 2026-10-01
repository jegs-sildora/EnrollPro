# Prompt for UI/UX & React Implementation: Dynamic Auto-Sectioning Rules

## Role & Context
Act as a React Frontend Developer. We are upgrading the `Automated Sectioning Rules` card inside the `System Configuration` module.

Currently, the UI hardcodes the assumption that Regular BEC sections use a heterogeneous (even distribution) sorting method. However, our system must support different DepEd school policies:
- **School A:** Isolates the top students into Top BEC sections (Homogeneous), then snake-drafts the rest (Heterogeneous).
- **School B:** Does not utilize Top BEC sections, but strictly ranks *all* students from highest to lowest grades across all sections (100% Homogeneous).

We need to transform this card into a dynamic configuration panel that dictates the exact logic branch the backend sorting algorithm will execute.

## UI Component & Logic Requirements

Please refactor the `Automated Sectioning Rules` card to include the following dynamic controls:

### 1. The Top BEC Sections Configuration
*   **The Toggle:** Retain the `Enable Top BEC Sections` toggle switch.
*   **Conditional Input (New):** If the toggle is set to `TRUE`, dynamically reveal a number input directly below it labeled: `Number of Top BEC Sections (per grade level)`.
    *   *Attributes:* `type="number"`, `min="1"`, `max="5"`, `defaultValue="1"`.
    *   *Helper Text:* "The algorithm will isolate the highest-ranking learners to fill these specific sections first."

### 2. The Regular BEC Sorting Logic (Radio Group)
Transform the static `Regular BEC Sections` text block into a prominent Radio Button Group (or selectable segmented cards) so the Principal can choose the sorting behavior for the remaining population.

*   **Group Label:** `Regular BEC Distribution Method`
*   **Option A: Heterogeneous (Snake-Draft) - *Default***
    *   *Label:* Heterogeneous / Even Distribution
    *   *Description Text:* "Evenly distribute learners across all available sections to balance academic performance and male-to-female ratio."
*   **Option B: Homogeneous (Strict Ranking)**
    *   *Label:* Homogeneous / Strict Academic Ranking
    *   *Description Text:* "Strictly rank and fill sections sequentially from highest to lowest Final General Average."

### 3. State Management & Visual Transitions
*   Ensure smooth vertical expanding/collapsing (e.g., using Framer Motion or CSS transitions) when the Top BEC toggle reveals or hides the number input.
*   If Option B (Homogeneous) is selected, you might want to display a subtle UI warning or info alert: *"Note: Strict homogeneous sectioning may result in unbalanced gender ratios in certain sections."*

### 4. Backend Payload Structure
Update the save configuration payload to send these explicit algorithmic rules to the backend. The API expects:
```json
{
  "sectioning_rules": {
    "enable_top_bec": true,
    "top_bec_section_count": 1,
    "regular_bec_mode": "HETEROGENEOUS" // or "HOMOGENEOUS"
  }
}