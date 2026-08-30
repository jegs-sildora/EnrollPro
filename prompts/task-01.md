# Prompt for UI/UX Implementation: Dashboard Enrollment Table Optimization

## Role & Context
Act as a Frontend Developer. We are refining the "Enrollment Records by Grade" dashboard card for EnrollPro, a DepEd Junior High School management system. 

## The Problem
The current data table is cramped, causing text overlap in the headers and triggering a horizontal scrollbar. Additionally, the table is filled with bold "0"s, creating visual noise that makes it hard to spot actual enrollment figures.

## UI Component Requirements

Please refactor the table component inside this card with the following updates:

### 1. Optimize Column Headers (DepEd Terminology)
Shorten the column headers to prevent text wrapping and horizontal scrolling. Use these exact labels:
*   Change `CONTINUING OR PROMOTED` to **`Continuing`**
*   Change `NEW ENTRANTS` to **`New`**
*   Change `TRANSFEREES` to **`Transferee`**
*   Change `RETURNING / ALS / OSCYA` to **`Balik-Aral`**
*   Keep `TOTAL` as is.
*   *Note: Ensure all headers are center-aligned (except for the 'Grade' column which should be left-aligned).*

### 2. Conditional Formatting for Zeros (Data-Ink Ratio)
Implement conditional styling for the table cells containing the enrollment numbers to reduce visual clutter.
*   **If value is greater than 0:** The text color should be a standard dark shade with a bold font weight.
*   **If value is exactly 0:** The text color must be a muted, light gray shade with a normal (non-bold) font weight.

### 3. Highlight the Total Column
Visually distinguish the "TOTAL" column so it acts as a quick-reference summary.
*   Apply a very subtle background color to the entire `TOTAL` column (both the header and the data cells), such as a very pale tint of the primary brand color or a light gray.
*   Ensure the numbers in the `TOTAL` column are always bold, and apply the same conditional zero-muting logic to the text color mentioned above.

### 4. Layout & Spacing Adjustments
*   Remove the horizontal scrollbar by ensuring the table layout uses responsive fluid widths and appropriate scaled-down text sizing.
*   Center-align all numerical data in their respective columns for a cleaner, more organized look.