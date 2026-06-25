# SYSTEM DIRECTIVE: Faculty Roster UI/UX Overhaul and Truncation Fix (v45.0)

**Context Persona:**
Act as a Senior UI/UX Frontend Engineer and a Philippine Department of Education (DepEd) Public High School Principal. Your standard for UI design is high-contrast, scannable, and strictly corporate GovTech. Do not use Western SaaS buzzwords. Strictly obey markdown formatting and completely avoid using any square brackets in your output.

**Core Mandate:**
Examine the Faculty and Staff Roster interface shown in the file named image_06bf9b.jpg. The current layout suffers from severe data truncation, aggressive typography, and inconsistent button states. Execute the following four structural and aesthetic corrections:

## 1. Eradicate the Advisership Truncation (Critical Layout Fix)

The system is currently using text-overflow ellipsis on the homeroom assignment (e.g., Adviser: Grade 8 - Ma...). This is an operational failure. You must guarantee the full section name is permanently visible.

- **The Fix:** Restructure the internal flexbox or CSS grid of the faculty list item. Allocate a significantly wider minimum-width strictly to the Advisership data block.
- **Text Wrapping:** If the section name is exceptionally long (e.g., Grade 8 — Science, Technology, and Engineering), allow the text to wrap cleanly to a second line within its container. You are strictly forbidden from hiding text with an ellipsis.
- **Format:** Standardize the string to read strictly as: Homeroom Adviser: Grade 8 — Mabini.

## 2. Typography and Casing Scrub

The aggressive all-caps text and warning colors are creating immense visual fatigue.

- **Faculty Names:** Overwrite the all-caps formatting (ADAMS, EDA). Force the output strictly to standard Title Case: Adams, Eda.
- **Job Titles:** Locate the role strings currently colored in red (e.g., MASTER TEACHER II, TEACHER I). In UI psychology, red implies an error or termination. Change this text color to a professional, muted slate grey, and format it strictly in standard Title Case (e.g., Master Teacher II).

## 3. Action Button Standardization

The action buttons on the far right are exhibiting inconsistent UI states (Eda Adams has an outlined button, while Elijah Block has a heavy solid button), creating visual clutter.

- **The Fix:** Unify all list item action buttons to a single, subtle secondary state. Use a soft grey outline or a muted ghost button style.
- **String Update:** Change the loud, all-caps text VIEW / EDIT PROFILE strictly to a calm, Title Case string: Open Profile.

## 4. Purge the SaaS Hallucination (Refresh Button)

Locate the Refresh button sitting on the far right of the filter bar.

- **The Fix:** Permanently delete this button from the DOM.
- **Rationale:** EnrollPro is a sovereign, offline-first local database. Filter state changes in a local React/DOM environment are instantaneous. A manual "Refresh" button implies a slow cloud-server fetch delay, which is an architectural hallucination.
