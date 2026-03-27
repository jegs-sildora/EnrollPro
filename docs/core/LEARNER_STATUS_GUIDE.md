# Learner Application & Enrollment Status Guide

This document outlines the significance of each status within the EnrollPro system, tracking a learner's journey from initial online application to final enrollment.

## 1. Intake & Screening Phase
Statuses in this phase signify the initial processing and verification of the application.

*   **SUBMITTED**: 
    *   **Significance**: The initial state. The parent or student has completed the online application form and received a tracking number.
    *   **Action**: Awaits registrar action to begin verification.
*   **UNDER_REVIEW**: 
    *   **Significance**: The Registrar has opened the application for the first time. 
    *   **Action**: Data and uploaded files are being cross-referenced with school requirements.
*   **FOR_REVISION**: 
    *   **Significance**: A fixable issue was found (e.g., a blurry document upload or a typo in the LRN).
    *   **Action**: The parent is notified to log back in and correct the specific field or file.
*   **ELIGIBLE**: 
    *   **Significance**: Basic screening and document verification are complete. The applicant meets the age and residency/grade requirements.
    *   **Action**: For Special Programs (SCP), this clears them for assessment; for Regular programs, this often leads directly to pre-registration.
*   **REJECTED**: 
    *   **Significance**: The application is denied (e.g., ineligible for the grade level or submitted fraudulent data). 
    *   **Action**: Final state; requires a reason for rejection.

## 2. Assessment Phase (Special Programs Only)
Specific to applicants for STE, SPA, SPS, SPJ, etc.

*   **ASSESSMENT_SCHEDULED** (UI Label: *Exam Scheduled*): 
    *   **Significance**: The documents are verified, and an exam, audition, or interview date has been set.
    *   **Action**: Applicant is expected to attend the assessment on the specified date and venue.
*   **ASSESSMENT_TAKEN**: 
    *   **Significance**: The applicant attended the assessment.
    *   **Action**: The system is awaiting the entry of the score and the final pass/fail verdict from the program coordinator.
*   **PASSED**: 
    *   **Significance**: The applicant met the cutoff score and specialized criteria for the Special Program.
    *   **Action**: Cleared for pre-registration in the specialized section.
*   **NOT_QUALIFIED**: 
    *   **Significance**: The applicant did not meet the specialized program criteria.
    *   **Action**: The Registrar may offer a Regular section or move the record back to Under Review for re-evaluation.

## 3. Pre-registration & Enrollment Phase
Signifies the transition from an "Applicant" to an "Incoming Student."

*   **PRE_REGISTERED** (UI Label: *Approved*): 
    *   **Significance**: **Phase 1 Complete.** The student is officially admitted to the school and has a reserved slot in a specific section.
    *   **Action**: Student must now perform the final enrollment steps (e.g., paying fees if applicable, submitting physical documents).
*   **TEMPORARILY_ENROLLED**: 
    *   **Significance**: A conditional state. The student is allowed to attend classes but is "Temporarily Enrolled" because they are missing one or more non-critical documents (e.g., PSA Birth Certificate original).
    *   **Action**: Requires "Marking as Enrolled" once documents are complete.
*   **ENROLLED**: 
    *   **Significance**: **Phase 2 Complete.** The final state. The student has met all requirements, submitted all documents, and is officially on the school roster for the academic year.
    *   **Action**: No further action needed in the admission workflow.

## 4. Administrative Statuses
*   **WITHDRAWN**: 
    *   **Significance**: The parent or student voluntarily cancelled their application or enrollment.
    *   **Action**: Final state; the slot is released to the pool.
