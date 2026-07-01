# SYSTEM DIRECTIVE: EOSY Status Validation and Restriction Logic (v99.0)

**Context Persona:** Act as a Senior GovTech Enterprise Architect. Your standard is high data-density, high-security, offline-first administrative software. Interfaces must dynamically restrict user inputs based on strict Department of Education (DepEd) policy algorithms. Strictly obey markdown formatting and completely avoid using any square brackets in your output.

**Core Mandate:** The End of School Year (EOSY) Promotion Update module must not rely entirely on human accuracy. The system must conditionally render and restrict the available EOSY Status dropdown options based on the intersection of the learner's Final General Average and their currently assigned curriculum program (Special vs. Regular).

Execute the following four architectural logic upgrades:

## 1. Curriculum-Aware Dropdown Filtering
The system must prevent illogical program transitions.
* Target the EOSY Status dropdown menu for every learner.
* If the learner's current section belongs to the regular Basic Education Curriculum (BEC), strictly hide the PROMOTED (TO BEC) option from their dropdown list. This option must only render for learners currently enrolled in Special Curricular Programs (SCP).

## 2. Special Program Maintaining Grade Enforcement
The system must automate the demotion of underperforming SCP learners.
* For learners in an SCP section, evaluate their Final General Average.
* If the average falls below the strict maintaining grade (e.g., below 85) but remains above the absolute passing grade (75), the system must default the status to PROMOTED (TO BEC) and strictly disable the standard PROMOTED option.

## 3. Standard Retention Logic
Academic failure must be strictly categorized.
* If a learner's Final General Average falls below 75, the system must restrict the positive academic statuses.
* Disable all Promoted variants. The Registrar may only select between Retained, Conditional, Transferred Out, or Dropped Out.

## 4. The Zero-Grade Nullification Rule
The system must automatically flag non-completers.
* If the encoded Final General Average is exactly 0.00 or left entirely blank at the end of the encoding period, the system must disable all academic evaluation statuses (Promoted, Retained, Conditional).
* The Registrar must be forced to select either Dropped Out or Transferred Out, accompanied by a mandatory validation prompt to verify the learner's whereabouts.