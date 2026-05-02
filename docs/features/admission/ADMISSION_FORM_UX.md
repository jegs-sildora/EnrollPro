# Early Registration & Enrollment Form: UX Specification (JHS All-SCP)

**Document Version:** 5.0.0
**Institution:** Enriqueta Montilla de Esteban Memorial High School
**Framework:** JHS Master Blueprint

---

## 1. Dynamic Form Routing

The system delivers different form experiences based on the user's category and the active calendar phase.

### 1.1 Phase 1 UX: The Early Registration Form (Jan – May)

- **Target:** Incoming Grade 7.
- **Dynamic Gates:**
  - If a learner selects any SCP (STE, SPA, SPS, SPJ, SPFL, SPTVE):
    - System reveals the **Grade 6 Q1/Q2 Average** field.
    - **Validation:** Instant destructive red block if `< 85.00`.
    - Message: ` Minimum 85% average required for special curricular programs.`
  - If **SPS** is selected:
    - Reveal "Sport Category" dropdown and "Awards Upload" field.
  - If **SPA** is selected:
    - Reveal "Arts Specialization" dropdown.

### 1.2 Phase 2 UX: Official Enrollment (July)

- **Pathway 1 (New G7 / Transferees):** Full 10-step BEEF.
- **Pathway 2 (Returning G8-10):** Simplified confirmation screen. pre-filled with existing SIMS data.
- **Phase 2 Validation:**
  - Mandatory input for **Final General Average**.
  - Mandatory toggle for **Promoted Status** (Success Green/Warning Amber).

---

## 2. Status Tracking UX

Applicants can track their progress through the Gates without logging in:

- **Status: Pending Assessment:** Shows Gate 2 assessment schedule.
- **Status: [SCP]\_Qualified:** Congratulations banner + Phase 2 reporting instructions.
- **Status: Pre-Registered (BEC):** Slot reservation confirmation.

---

## 3. Compliance Banners

- **No Collection:** Persistent footer on all forms: `Enrollment is free. No fees are required for registration or sectioning per DO 19, s. 2008.`
- **Grace Period Alert:** For `TEMPORARILY_ENROLLED` learners: ` Your enrollment is temporary. Submit your original SF9/PSA by October 31 to finalize.`

---

_Document v5.0.0_
_Institution: Enriqueta Montilla de Esteban Memorial High School_
_Subject: UX Strategy for the JHS Multi-SCP Sorting Engine_
