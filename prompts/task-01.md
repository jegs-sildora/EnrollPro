# Prompt for UI/UX Refactor: Enrollment Portal Hero Header

## Role & Context
Act as a Frontend Developer. We are refining the landing page of the public-facing `Online Enrollment Portal`. 

Currently, the header is a generic "WELCOME TO ONLINE ENROLLMENT". We need to upgrade this into a Contextual Hero Header that establishes the official DepEd enrollment period, assures Qualified SCP applicants they are in the right place, and reminds parents of the most critical prerequisite: the Learner Reference Number (LRN).

## Critical Directive
Utilize the existing design system typography tokens, badges, and spacing. Do not introduce custom CSS or new font scales. Transform the static text block into a structured, informative header.

## UI Component & Copywriting Requirements

Please refactor the header section to match this structured layout:

### 1. Dynamic Status Badge (Top)
*   Render a small, centered system Badge/Pill component above the main title.
*   **Content:** It should dynamically query the active school year from the backend (e.g., `S.Y. 2026-2027 • ENROLLMENT ONGOING`).
*   **Color:** Use a primary or success color (e.g., Blue or Green) to indicate the system is actively receiving enrollments.

### 2. Main Title (H1)
*   Replace "WELCOME TO ONLINE ENROLLMENT" with an official, authoritative title.
*   **New Text:** `Official Learner Enrollment`
*   **Styling:** Use the standard H1/Title typography token. Keep it centered.

### 3. Subtitle / Context (Lead Text)
*   Replace the generic subtext with instructions that cover both Regular BEC and Qualified SCP learners.
*   **New Text:** `For Regular Basic Education (BEC) entrants and officially Qualified SCP Applicants.`
*   **Styling:** Use a muted/secondary text color with a readable medium font size.

### 4. Critical Prerequisite Warning (Information Alert)
*   Directly below the subtitle (and above the two learner category cards), insert a standard small Information Alert banner or a highlighted helper text block. This prevents user drop-off during the form-filling process.
*   **Icon:** Standard `Info` or `Alert` icon.
*   **Text:** `Important: Please ensure you have the student's 12-digit Learner Reference Number (LRN) and PSA Birth Certificate ready before starting.`

### 5. Layout & Spacing
*   Wrap the Badge, Title, and Subtitle in a flex-col container with a standard tight gap (`gap-2`).
*   Apply a slightly larger bottom margin below the new Information Alert to separate the header clearly from the `Incoming` and `Continuing` action cards.


MAKE THE UI FORMAT TO BE THE SAME WITH THE @AdmissionChoice.tsx FILE BUT ONLY THE HEADER.