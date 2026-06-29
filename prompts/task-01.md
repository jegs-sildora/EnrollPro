# SYSTEM DIRECTIVE: Account Access Merger and Security UI Injection (v72.0)

**Context Persona:** Act as a Senior GovTech Enterprise Architect and a Chief Philippine Department of Education (DepEd) High School Registrar. Your standard is high data-density, intuitive, offline-first administrative software tailored for older, non-technical school heads. Strictly avoid developer UI slang and Western SaaS buzzwords. Strictly obey markdown formatting and completely avoid using any square brackets in your output.

**Core Mandate:** The standalone "Account Access Management" page creates navigational bloat and cognitive friction. You must completely merge its functionalities (Role assignment, Access toggling, and Password resets) directly into the individual side panels of the Faculty & Staff Roster and the Master Learner Registry. Once merged, you must purge the redundant standalone page and enforce strict DepEd layman's terminology for all security controls.

Execute the following architectural UI/UX upgrades:

## 1. Sidebar Navigation Purge
The system must maintain a Single Source of Truth for user management.
* Completely remove the "Account Access" navigation item from the left sidebar under the "SYSTEM ADMINISTRATION" category.

## 2. Faculty & Staff Side Panel Injection
Target the Faculty & Staff Roster side panel (reference image_5cd924.jpg).
* Locate section "3. CONTACT DETAILS & LOGIN ACCESS".
* Rename this section strictly to: 3. CONTACT DETAILS & PORTAL SECURITY.
* **Role Management:** Keep the "SYSTEM ROLES" radio/checkbox selectors here.
* **Access Toggle:** Inject a toggle or segmented button group labeled "Portal Access Status". The two options must be strictly labeled: Active (with a green indicator) and Locked (with a red/amber indicator). Remove the words "Restricted" or "Suspend".
* **Password Control:** Inject a highly visible, secondary-styled action button strictly labeled: Reset to Default Password. Place a small warning subtext below it reading: This will reset the teacher's portal password to their DepEd Employee ID.

## 3. Master Learner Registry Side Panel Injection
Target the Enrolled Learner Details side panel (reference image_5cdce9.jpg).
* Scroll to the bottom of the panel, below "III. BACKGROUND & SPECIAL CATEGORIES".
* Inject a brand new section card strictly titled: IV. PORTAL ACCESS & SECURITY.
* Apply a subtle slate or muted background to this specific card to visually separate it from academic demographic data.
* **Access Toggle:** Inject a segmented button group labeled "Student Portal Access". The two options must be strictly labeled: Active and Locked.
* **Password Control:** Inject an action button strictly labeled: Reset to Default Password. Place a small subtext below it reading: This will reset the student's portal password to their 12-digit LRN.

## 4. Master Learner Registry Data Table Update
Administrators must be able to see who is locked out without opening the side panel.
* Target the main data table in the Master Learner Registry (reference image_5cdcaa.jpg).
* Inject a new column between "SECTION" and "DATE ENROLLED" labeled strictly as: PORTAL STATUS.
* Display a small green "Active" pill or a red "Locked" pill for each learner.

## 5. UI Ergonomics for School Heads
* Ensure all toggle buttons and reset buttons have generous padding (minimum 44px touch targets) to accommodate older users operating on smaller screens or tablets.
* Ensure action buttons like "Reset to Default Password" utilize a confirmation modal before executing, asking: "Are you sure you want to reset this password?" to prevent accidental clicks.