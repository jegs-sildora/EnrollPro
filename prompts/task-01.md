# Prompt for UI/UX Implementation: Learner Profile Header Refactor

## Role & Context
Act as a Frontend Developer. We are redesigning the "Primary Profile" header card in the Learner Profile module of EnrollPro. 

Currently, the layout is center-aligned with massive empty white space on the sides, and the metadata is split to the extreme left and right edges. We need to convert this into a modern, highly scannable, left-aligned "Media Object" layout.

## The Objective
Anchor the learner's identity (Avatar, Name, LRN, Badges) to the top left. Move the primary action button to the top right. Consolidate the metadata (Grade, Contact, Address) into a structured, left-aligned grid at the bottom of the card.

## UI Component Requirements

Please implement the following layout restructuring:

### 1. Top Row: Identity & Actions (Flex Container)
Create a top-level flex container that aligns items horizontally (`flex`, `justify-between`, `items-start`).

*   **Left Side (The Media Object):**
    *   **Avatar:** Keep the circular avatar, but ensure it is a perfect circle with smooth edges.
    *   **Text Container (beside the avatar):**
        *   **Learner Name:** Display prominently in large, bold, dark text (e.g., `text-2xl font-bold`).
        *   **LRN:** Move the Learner Reference Number up here, directly below the name. Style it in a muted gray (e.g., `LRN: 123123123123`). In DepEd, the LRN is an extension of the student's name and should never be buried in the lower metadata.
        *   **Status Badges:** Display the badges (`OFFICIALLY ENROLLED`, `WITH BACK SUBJECTS`) horizontally inline below the LRN, not stacked vertically. Keep their current green and orange color coding, but make them compact (pill-shaped).

*   **Right Side (Primary Action):**
    *   Move the `EDIT LEARNER DATA` button to the absolute top-right of this flex container. 
    *   Change it from a heavy red button to a sleek secondary/outline button (e.g., gray border with a small pencil icon) to keep the visual focus on the learner's status badges.

### 2. Divider
Add a subtle horizontal divider (`border-b border-gray-200`) below the top row to separate the identity section from the metadata section.

### 3. Bottom Row: Metadata Grid
Remove the `justify-between` layout that pushes text to the far edges. Replace it with a structured 3-column or 4-column CSS Grid (`grid grid-cols-3 gap-6`).

*   **Column 1:** 
    *   Label: `GRADE LEVEL & SECTION` (Muted, smaller text, e.g., `text-xs text-gray-500`)
    *   Value: `G8 - UNASSIGNED` (Dark, medium weight). Keep the `SPA` tag as a small inline badge next to the value.
*   **Column 2:**
    *   Label: `PRIMARY CONTACT`
    *   Value: `09230129039`
*   **Column 3:**
    *   Label: `ADDRESS`
    *   Value: `N/A` (or the full string when available).

*   *Note:* The LRN was moved to the top identity block, so it is permanently removed from this lower grid.