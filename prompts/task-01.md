# Prompt for UI/UX Implementation: Curricular Program Distribution Card

## Role & Context
Act as a Frontend Developer. We are refactoring the "Learners by Curricular Program" summary card on the Master Dashboard for EnrollPro (a DepEd Junior High School system). 

Currently, the card suffers from a broken vertical layout (excessive top whitespace), poor readability due to ALL CAPS text, and a lack of visual hierarchy in the data labels.

## The Objective
Redesign the internal layout of this card to distribute content evenly. Update the typography to use standard DepEd acronyms, and create a clearer distinction between the raw data and the descriptive text.

## UI Component Requirements

Please implement the following structural and styling changes to the card:

### 1. Layout & Vertical Spacing (Flex Fix)
*   **Remove Bottom Anchoring:** Fix the container's flex/grid properties so the four program rows are distributed evenly across the available vertical space of the card, eliminating the massive empty gap at the top. 
*   **Spacing:** Ensure consistent, comfortable padding between the card header (`Learners by Curricular Program`) and the first progress bar row, matching the spacing on the adjacent "Class Section Capacity" card.

### 2. Typography & DepEd Naming Conventions
Remove the ALL CAPS styling. Convert the program names to Title Case and prominently feature their DepEd acronyms, as this is how school personnel naturally refer to them. Update the labels to exactly this format:
*   `Basic Education Curriculum (BEC)`
*   `Science, Technology, and Engineering (STE)`
*   `Special Program in the Arts (SPA)`
*   `Special Program in Sports (SPS)`
*   *Styling:* Use a standard dark text color with a medium font weight for these labels.

### 3. Data Label Hierarchy
Currently, `33 Learners (41%)` is uniformly styled in heavy red, which competes for attention with the bar itself. Break this string into distinct visual weights:
*   **Raw Count (`33`):** Make the number bold and use the primary dark text color.
*   **Label (`Learners`):** Use a normal font weight and a muted gray color.
*   **Percentage (`(41%)`):** Keep this muted gray, or use a subtle tint of the primary brand color, but keep the font weight normal. 
*   *Example output:* **33** <span style="color: gray">Learners (41%)</span>

### 4. Progress Bar Polish
*   **Shape:** Ensure the progress bars have fully rounded (pill-shaped) corners to match modern dashboard aesthetics.
*   **Track Background:** Make sure the empty portion of the bar (the track) uses a very faint, subtle gray or ultra-light red to clearly show the total capacity line without adding visual noise.
*   **Color Coding (Optional UX Enhancement):** Consider keeping the main `BEC` (Regular) program bar in your primary brand red, but assigning a slightly different, complementary color (or a distinct shade of red/maroon) to the Special Curricular Programs (STE, SPA, SPS) to visually separate regular vs. special enrollees.