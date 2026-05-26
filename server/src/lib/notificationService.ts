/**
 * Notification Service — stub implementation.
 *
 * Both functions are fire-and-forget (callers use `.catch()`).
 * Replace the bodies with real email/SMS sending once an SMTP
 * or messaging provider is configured.
 */

export interface IntakeReceiptPayload {
  applicationId: number;
  learnerName: string;
  lrn: string | null;
  guardianName: string | null;
  contactNumber: string | null;
  email: string | null;
  schoolYearLabel: string;
  finalizedAt: string;
}

export interface OfficialEnrollmentPayload {
  applicationId: number;
  learnerName: string;
  lrn: string | null;
  guardianName: string | null;
  contactNumber: string | null;
  email: string | null;
  sectionName: string;
  adviserName: string | null;
  schoolYearLabel: string;
  gradeLevelName: string;
  assignmentSlipUrl: string | null;
  enrolledAt: string;
}

/**
 * Event A — fired when an intake application is finalized and
 * the learner is queued for batch sectioning.
 */
export async function fireIntakeReceiptNotification(
  payload: IntakeReceiptPayload,
): Promise<void> {
  console.info(
    "[Notification] Intake receipt — applicationId:",
    payload.applicationId,
    "learner:",
    payload.learnerName,
  );
  // TODO: send email/SMS via configured provider
}

/**
 * Event B — fired after batch sectioning commits and learners
 * receive their official section assignment.
 */
export async function fireOfficialEnrollmentNotification(
  payload: OfficialEnrollmentPayload,
): Promise<void> {
  console.info(
    "[Notification] Official enrollment — applicationId:",
    payload.applicationId,
    "section:",
    payload.sectionName,
  );
  // TODO: send email/SMS via configured provider
}
