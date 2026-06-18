# MODULE: Edit Learner Data Form - Conditional Logic & Data Integrity
**Tech Stack:** React, Tailwind CSS, React Hook Form (or similar)
**Context:** The current "Update Learner Profile" form lacks specific data points required by DepEd SF1 and suffers from disconnected contact information. We must restructure the sections, implement conditional rendering, and enforce strict inputs.

## AGENT INSTRUCTIONS
Execute the following form logic and DOM restructuring.

### Task 1: Personal Information Refinements (`image_0dd05b.png`)
*   **Action 1 (Extension Dropdown):** Change the `EXTENSION` field from a text `<input>` to a `<select>` dropdown.
    *   *Options:* `None`, `Jr.`, `Sr.`, `II`, `III`, `IV`, `V`.
*   **Action 2 (Contact Info Relocation):** Remove the `CONTACT INFORMATION` sub-section from the Personal Info block. The Learner's Email can stay here, but the `PRIMARY CONTACT NO.` must be deleted and moved to the Family section.

### Task 2: Family & Emergency Contacts (`image_0dd03f.png`)
*   **Action 1 (Parent Contact Fields):** For Mother, Father, and Guardian, expand their rows to include a Contact Number input next to their Name inputs.
    *   *Implementation Example:* `<div className="grid grid-cols-4 gap-3">` -> 3 columns for First/Middle/Last Name, 1 column for Contact Number.
*   **Action 2 (Primary Emergency Selector):** At the top or bottom of the `II. FAMILY INFORMATION` section, add a new required dropdown.
    *   *Label:* `Primary Emergency Contact *`
    *   *Options:* `Mother`, `Father`, `Guardian`.

### Task 3: Conditional IP Community Input (`image_0dcd95.png`)
*   **Action:** Implement conditional rendering linked to the state of the `IP COMMUNITY` dropdown.
*   **Implementation Logic:**
```jsx
    
    <div>
      <Label>IP Community</Label>
      <Select onChange="{(e)" value="{isIp}"> setIsIp(e.target.value)}>
        <option value="NO">NO</option>
        <option value="YES">YES</option>
      </Select>
    </div>

    
    {isIp === 'YES' && (
      <div className="animate-in fade-in slide-in-from-top-2">
        <Label>Specify IP Community *</Label>
        <Input placeholder="e.g., Ati, Sulodnon, Mangyan" required/>
      </div>
    )}
    ```

### Task 4: Inject Missing SF1 Fields
*   **Action:** In `III. BACKGROUND & SPECIAL CATEGORIES`, add two new required text inputs (or standardized dropdowns if your database has them pre-populated).
    *   *Field 1:* `Mother Tongue *` (e.g., Hiligaynon, Cebuano, Tagalog)
    *   *Field 2:* `Religion *` (e.g., Roman Catholic, Islam, INC)