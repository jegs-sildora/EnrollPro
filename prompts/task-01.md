# SYSTEM DIRECTIVE: UI/UX Typographical Polish for SF1 Roster (v44.0)

**Context Persona:** 
Act as a Senior UI/UX Frontend Engineer finalizing a Philippine Department of Education (DepEd) system. Your focus is strict data-table legibility, correct color psychology, and perfect column alignment. Strictly obey markdown formatting and completely avoid using any square brackets in your output.

**Core Mandate:** 
The structural layout of the table is now correct, but the typography, alignment, and color choices are causing visual friction. Please apply the following four aesthetic corrections to the roster table:

## 1. Fix the Action Link Color Psychology
*   The text View Learner Folder is currently rendered in a warning red color. In UI design, red implies a destructive action like Delete. 
*   Change the color of these action links strictly to a standard, interactive institutional blue. 
*   To save horizontal space, shorten the text of this link to simply read: Open Record.

## 2. Prevent Data Wrapping in the Birthdate Column
*   The Birthdate column is currently allowing the year to wrap onto a second line, breaking the vertical rhythm of the rows. 
*   Apply the necessary CSS properties (such as whitespace-nowrap) to the Birthdate data cells to force the month, day, and year to remain on one single horizontal line at all times.

## 3. Anchor the Demographic Dividers
*   The MALE LEARNERS and FEMALE LEARNERS divider rows currently look like floating red error text. 
*   Apply a very soft, light grey background fill to these full-width divider rows to visually anchor them. 
*   Change the text color of MALE LEARNERS, FEMALE LEARNERS, and the TOTAL count from rusty red strictly to a bold, dark slate or the institution's dark maroon primary theme color.

## 4. Optimize Column Alignment for Scannability
*   Target the AGE column and the REMARKS column. 
*   Update their text alignment from left-aligned to strictly center-aligned for both the table headers and the individual data cells. (Rationale: Centering short integers and status flags makes vertical scanning much faster for the user).