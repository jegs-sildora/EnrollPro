MODULE: "Add Personnel" Intake Form - Data Architecture & Logic
Context: The user is clicking "+ Add Personnel" to register a new employee into the DepEd school database.
Agent Constraint: DO NOT generate raw HTML, JSX, or Tailwind classes. Inherit all styling from the existing EnrollPro component library (Inputs, Selects, Cards, Modals). Implement ONLY the state logic, validation, and layout grouping described below.

Section 1: The Layout Strategy (Vertical Stepper or Grouped Cards)
Instruction: Do not render a single massive column of inputs. Organize the form into three distinct, visually separated cards or accordion sections:

Basic Identity

DepEd Professional Data

Contact & Emergency.

Section 2: Group 1 - Basic Identity
Fields Required:

First Name, Middle Name, Last Name (Standard text inputs)

Name Extension (Dropdown: None, Jr., Sr., II, III)

Sex at Birth (Dropdown: Male, Female)

Date of Birth (Date picker)

Validation Rule: First and Last name are strictly required. Prevent numeric characters in name fields.

Section 3: Group 2 - DepEd Professional Data (The Core)
Fields Required:

Personnel Type (Dropdown: Teaching, Non-Teaching). Crucial for conditional logic below.

DepEd Employee ID (Numeric input). Validation: Must be exactly 7 digits.

Plantilla Item Number (Text input).

Plantilla Position / Rank (Dropdown: Teacher I, Teacher II, Master Teacher I, Admin Asst II, etc.)

Employment Status (Dropdown: Regular Permanent, Substitute, Contract of Service, Local School Board)

Conditional Logic Rule 1 (Teaching Only): If Personnel Type is set to "Teaching", dynamically reveal two new required fields:

PRC License Number (Numeric, 7 digits)

Major / Specialization (Text input, e.g., "Mathematics", "English")

Conditional Logic Rule 2 (Non-Teaching Only): If Personnel Type is set to "Non-Teaching", hide the PRC fields and reveal:

Functional Assignment (Dropdown: Registrar, Disbursing Officer, Utility, Security, etc.)

Section 4: Group 3 - Contact & System Access
Fields Required:

Primary Contact Number (Numeric input). Validation: 11 digits, must start with '09'.

DepEd Email Address (Email input). Validation: Regex strict validation ending in @deped.gov.ph to ensure official communication channels are used.

System Role / Access Level (Dropdown: None, Teacher Portal, System Admin, HR Admin). Note: Explain that assigning a role here will automatically send an enrollment invite to their DepEd email.

Section 5: The Footer Actions
Instruction: The footer of the form must have two clear actions.

Cancel (Ghost/Outline style, prompts a "Discard changes?" warning if fields are dirty).

Save & Register Personnel (Primary solid style, disabled until all required fields pass validation).