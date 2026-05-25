/**
 * notificationService.ts
 *
 * Asynchronous notification dispatcher for EnrollPro lifecycle events.
 *
 * Current transport: structured console logging (fire-and-forget).
 * To add real email/SMS: wire in nodemailer or an SMS gateway in the
 * `_dispatch` function below and set SMTP_HOST / SMTP_PORT / etc. in .env.
 */

// ─── Payload Types ───────────────────────────────────────────────────────────

export interface IntakeReceiptPayload {
  /** Internal application ID */
  applicationId: number;
  /** Full name of the learner */
  learnerName: string;
  /** Learner's LRN (may be null for pending-LRN learners) */
  lrn: string | null;
  /** Guardian name for addressing the notification */
  guardianName: string | null;
  /** Guardian contact number (SMS target) */
  contactNumber: string | null;
  /** Guardian email (email target) */
  email: string | null;
  /** School year label, e.g. "2026-2027" */
  schoolYearLabel: string;
  /** ISO timestamp of when intake was finalized */
  finalizedAt: string;
}

export interface OfficialEnrollmentPayload {
  /** Internal application ID */
  applicationId: number;
  /** Full name of the learner */
  learnerName: string;
  /** Learner's LRN */
  lrn: string | null;
  /** Guardian name */
  guardianName: string | null;
  /** Guardian contact number */
  contactNumber: string | null;
  /** Guardian email */
  email: string | null;
  /** Assigned section name, e.g. "Einstein" */
  sectionName: string;
  /** Class adviser full name */
  adviserName: string | null;
  /** School year label */
  schoolYearLabel: string;
  /** Grade level name, e.g. "Grade 7" */
  gradeLevelName: string;
  /** Deep link to download the printable Section Assignment Slip */
  assignmentSlipUrl: string | null;
  /** ISO timestamp of enrollment */
  enrolledAt: string;
}

// ─── Internal Dispatch ───────────────────────────────────────────────────────

type NotificationEvent = "INTAKE_RECEIPT" | "OFFICIAL_ENROLLMENT";

interface DispatchPayload {
  event: NotificationEvent;
  channel: "EMAIL" | "SMS";
  recipient: string;
  subject: string;
  body: string;
  metadata: Record<string, unknown>;
}

/**
 * Central fire-and-forget dispatcher.
 * Replace `console.log` block with real transport (nodemailer / SMS API) when ready.
 */
async function _dispatch(payload: DispatchPayload): Promise<void> {
  // --- REAL TRANSPORT STUB ---
  // If SMTP_HOST is configured, use nodemailer here.
  // If SMS_API_KEY is configured, use your SMS gateway here.
  // ---
  const timestamp = new Date().toISOString();
  console.log(
    JSON.stringify({
      level: "NOTIFICATION",
      timestamp,
      event: payload.event,
      channel: payload.channel,
      recipient: payload.recipient,
      subject: payload.subject,
      body: payload.body,
      metadata: payload.metadata,
    }),
  );
}

// ─── Event A: Intake Receipt Confirmation ────────────────────────────────────

/**
 * Fires when the Intake Desk finalizes a learner's physical document check
 * and saves height/weight, queuing them for automated batch sectioning.
 *
 * Fire-and-forget — call without `await` to avoid blocking the HTTP response.
 */
export async function fireIntakeReceiptNotification(
  payload: IntakeReceiptPayload,
): Promise<void> {
  const subject = `[EnrollPro] Enrollment Intake Confirmed – ${payload.learnerName}`;

  const body =
    `Dear ${payload.guardianName ?? "Parent/Guardian"},\n\n` +
    `This is to confirm that the physical documents of your learner, ` +
    `${payload.learnerName}${payload.lrn ? ` (LRN: ${payload.lrn})` : ""}, ` +
    `have been verified by the Registrar's Office on ${new Date(payload.finalizedAt).toLocaleDateString("en-PH")}.\n\n` +
    `Your learner has been placed in the queue for automated batch sectioning ` +
    `for School Year ${payload.schoolYearLabel}. ` +
    `You will receive another notification once a section has been assigned.\n\n` +
    `Thank you,\nEnrollPro – Registrar's Office`;

  const dispatches: Promise<void>[] = [];

  if (payload.email) {
    dispatches.push(
      _dispatch({
        event: "INTAKE_RECEIPT",
        channel: "EMAIL",
        recipient: payload.email,
        subject,
        body,
        metadata: {
          applicationId: payload.applicationId,
          lrn: payload.lrn,
          schoolYearLabel: payload.schoolYearLabel,
        },
      }),
    );
  }

  if (payload.contactNumber) {
    const smsBody =
      `EnrollPro: Documents verified for ${payload.learnerName}. ` +
      `Queued for batch sectioning (SY ${payload.schoolYearLabel}). ` +
      `Await section assignment notice.`;

    dispatches.push(
      _dispatch({
        event: "INTAKE_RECEIPT",
        channel: "SMS",
        recipient: payload.contactNumber,
        subject,
        body: smsBody,
        metadata: { applicationId: payload.applicationId },
      }),
    );
  }

  await Promise.allSettled(dispatches);
}

// ─── Event B: Official Enrollment Notice ─────────────────────────────────────

/**
 * Fires when batch sectioning is committed and the learner is officially enrolled.
 * Includes section name, class adviser, and a slip download link.
 *
 * Fire-and-forget — call without `await` to avoid blocking the HTTP response.
 */
export async function fireOfficialEnrollmentNotification(
  payload: OfficialEnrollmentPayload,
): Promise<void> {
  const subject =
    `[EnrollPro] Official Enrollment Notice – ` +
    `${payload.learnerName} | ${payload.sectionName}`;

  const slipLine = payload.assignmentSlipUrl
    ? `\nDownload your Section Assignment Slip: ${payload.assignmentSlipUrl}`
    : "";

  const body =
    `Dear ${payload.guardianName ?? "Parent/Guardian"},\n\n` +
    `We are pleased to inform you that ${payload.learnerName}` +
    `${payload.lrn ? ` (LRN: ${payload.lrn})` : ""} ` +
    `is now officially enrolled for School Year ${payload.schoolYearLabel}.\n\n` +
    `Section: ${payload.sectionName}\n` +
    `Grade Level: ${payload.gradeLevelName}\n` +
    `Class Adviser: ${payload.adviserName ?? "To be announced"}\n` +
    `Enrolled on: ${new Date(payload.enrolledAt).toLocaleDateString("en-PH")}` +
    slipLine +
    `\n\nThank you,\nEnrollPro – Registrar's Office`;

  const dispatches: Promise<void>[] = [];

  if (payload.email) {
    dispatches.push(
      _dispatch({
        event: "OFFICIAL_ENROLLMENT",
        channel: "EMAIL",
        recipient: payload.email,
        subject,
        body,
        metadata: {
          applicationId: payload.applicationId,
          sectionName: payload.sectionName,
          adviserName: payload.adviserName,
          schoolYearLabel: payload.schoolYearLabel,
        },
      }),
    );
  }

  if (payload.contactNumber) {
    const smsBody =
      `EnrollPro: ${payload.learnerName} officially enrolled! ` +
      `Section: ${payload.sectionName}, ` +
      `Adviser: ${payload.adviserName ?? "TBA"}. ` +
      `SY ${payload.schoolYearLabel}.` +
      (payload.assignmentSlipUrl
        ? ` Slip: ${payload.assignmentSlipUrl}`
        : "");

    dispatches.push(
      _dispatch({
        event: "OFFICIAL_ENROLLMENT",
        channel: "SMS",
        recipient: payload.contactNumber,
        subject,
        body: smsBody,
        metadata: { applicationId: payload.applicationId },
      }),
    );
  }

  await Promise.allSettled(dispatches);
}
