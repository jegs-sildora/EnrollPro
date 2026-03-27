# Email System — Full Implementation Guide
## React Email · Nodemailer · SendPulse SMTP

**Document Version:** 1.0.0
**System:** School Admission, Enrollment & Information Management System
**Stack:** React Email · Nodemailer · SendPulse SMTP (Free — 12,000 emails/month)
**Runtime:** Node.js 22 LTS · Express.js 5.1 · TypeScript · Prisma 6

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [SendPulse Account Setup](#2-sendpulse-account-setup)
3. [Package Installation](#3-package-installation)
4. [Environment Variables](#4-environment-variables)
5. [Prisma — EmailLog Model](#5-prisma--emaillog-model)
6. [Nodemailer Transporter](#6-nodemailer-transporter)
7. [Email Templates — React Email](#7-email-templates--react-email)
   - 7.1 [Shared Layout Component](#71-shared-layout-component)
   - 7.2 [Application Received](#72-application-received)
   - 7.3 [F2F Application Recorded](#73-f2f-application-recorded)
   - 7.4 [Enrollment Confirmed](#74-enrollment-confirmed)
   - 7.5 [Application Rejected](#75-application-rejected)
   - 7.6 [SCP Exam Scheduled](#76-scp-exam-scheduled)
   - 7.7 [SCP Assessment Passed](#77-scp-assessment-passed)
   - 7.8 [SCP Assessment Failed](#78-scp-assessment-failed)
   - 7.9 [Account Welcome (Registrar)](#79-account-welcome-registrar)
8. [Mailer Service](#8-mailer-service)
9. [Controller Integration](#9-controller-integration)
10. [Email Log API](#10-email-log-api)
11. [Development Preview Server](#11-development-preview-server)
12. [File & Folder Structure](#12-file--folder-structure)
13. [Free Plan Limits & Considerations](#13-free-plan-limits--considerations)

---

## 1. Architecture Overview

```
Express Controller
      │
      ├── res.json(...)          ← HTTP response sent FIRST (never blocked by email)
      │
      └── setImmediate(async () => {
              │
              ├── render(ReactEmailTemplate)
              │       └── @react-email/render → HTML string
              │
              ├── transporter.sendMail(...)
              │       └── Nodemailer → SendPulse SMTP (smtp-pulse.com:465)
              │
              └── prisma.emailLog.create(...)
                      └── logs result for Admin Email Logs page
          })
```

**Three-library roles:**

| Library | Role |
|---|---|
| `@react-email/components` | Pre-built, email-client-safe UI components (replaces writing raw HTML tables) |
| `@react-email/render` | Converts React JSX → HTML string that Nodemailer can send |
| `nodemailer` | SMTP client — sends the HTML string through SendPulse's mail servers |

**Why `setImmediate`:**
All emails fire after the HTTP response is returned. The registrar gets instant feedback; a slow SMTP server or network hiccup never causes the API to time out. Failed emails are logged to the `EmailLog` table and can be retried from the Admin's Email Logs page.

---

## 2. SendPulse Account Setup

### 2.1 Create Account

1. Go to `sendpulse.com` → Sign up (free, no credit card)
2. Account goes through a short moderation review (typically a few hours)
3. Once approved, navigate to **Email → SMTP → Settings tab**

### 2.2 Get SMTP Credentials

```
Host     : smtp-pulse.com
Port     : 465   (SSL — recommended)
           587   (STARTTLS — alternative)
Login    : your registered SendPulse email address
Password : auto-generated SMTP password shown on the Settings tab
           (NOT your account login password — copy the dedicated SMTP one)
```

### 2.3 Verify Sender Email Address

1. Go to **Email → SMTP → Senders**
2. Click **Add Sender**
3. Enter the "From" email address (e.g., `noreply@yourschool.edu.ph`)
4. SendPulse sends a verification link to that address
5. Click the link — **no emails can be sent until the sender is verified**

### 2.4 Add Domain DNS Records (Recommended)

In your domain registrar's DNS settings, add the SPF, DKIM, and DMARC records that SendPulse provides. This ensures emails do not land in spam folders.

```
SPF    : TXT record → v=spf1 include:sendpulse.com ~all
DKIM   : provided by SendPulse after domain verification
DMARC  : TXT record → v=DMARC1; p=none; rua=mailto:dmarc@yourschool.edu.ph
```

If you do not have a custom domain yet, use a Gmail or school-issued address as the sender during development. Production should use a verified domain for deliverability.

---

## 3. Package Installation

```bash
# server/ package
pnpm add nodemailer @react-email/components @react-email/render
pnpm add -D @types/nodemailer tsx
```

**Why `tsx`:**
Node.js does not understand `.tsx` files (JSX syntax). The `tsx` package lets Node.js run TypeScript + JSX directly without a separate compile step. It is already in the project if you are using `tsx watch` for development.

Confirm your `server/package.json` dev script uses `tsx`:

```json
{
  "scripts": {
    "dev":   "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

---

## 4. Environment Variables

```bash
# server/.env
# ── SendPulse SMTP ───────────────────────────────────────────
SENDPULSE_SMTP_HOST=smtp-pulse.com
SENDPULSE_SMTP_PORT=465
SENDPULSE_SMTP_USER=your_registered_email@example.com
SENDPULSE_SMTP_PASS=your_sendpulse_smtp_password
EMAIL_FROM="School Name <noreply@yourschool.edu.ph>"

# ── App ──────────────────────────────────────────────────────
APP_URL=http://localhost:5173    # frontend URL — used in email links
```

```bash
# server/.env.example  (committed to git — no real values)
SENDPULSE_SMTP_HOST=smtp-pulse.com
SENDPULSE_SMTP_PORT=465
SENDPULSE_SMTP_USER=
SENDPULSE_SMTP_PASS=
EMAIL_FROM=
APP_URL=
```

---

## 5. Prisma — EmailLog Model

Add this model to `server/prisma/schema.prisma`. It powers the Admin's Email Logs page.

```prisma
model EmailLog {
  id          Int      @id @default(autoincrement())
  recipient   String                        // email address
  subject     String
  status      String                        // 'SENT' | 'FAILED'
  trigger     String                        // audit action type that caused this
  applicantId Int?                          // linked applicant (nullable for admin emails)
  error       String?                       // error message if status = 'FAILED'
  sentAt      DateTime @default(now())

  @@index([status])
  @@index([sentAt])
  @@index([applicantId])
}
```

Run the migration:

```bash
pnpm prisma migrate dev --name add_email_log
```

---

## 6. Nodemailer Transporter

```ts
// server/src/lib/mailer.ts
import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
  host:   process.env.SENDPULSE_SMTP_HOST,        // smtp-pulse.com
  port:   Number(process.env.SENDPULSE_SMTP_PORT), // 465
  secure: Number(process.env.SENDPULSE_SMTP_PORT) === 465, // true for SSL
  auth: {
    user: process.env.SENDPULSE_SMTP_USER,
    pass: process.env.SENDPULSE_SMTP_PASS,
  },
  // Increase timeout for slow connections
  connectionTimeout: 10_000,
  greetingTimeout:   5_000,
});

/**
 * Call once on server startup to confirm SMTP credentials are correct.
 * Logs success or failure — never throws (non-fatal).
 */
export async function verifyMailer(): Promise<void> {
  try {
    await transporter.verify();
    console.log('[Mailer] ✓ SendPulse SMTP connected successfully');
  } catch (err) {
    console.error('[Mailer] ✗ SMTP connection failed:', (err as Error).message);
    console.error('[Mailer] Check SENDPULSE_SMTP_USER and SENDPULSE_SMTP_PASS in .env');
  }
}
```

Call `verifyMailer()` in `server.ts` after the server starts listening:

```ts
// server/src/server.ts
import 'dotenv/config';
import app              from './app.js';
import { verifyMailer } from './lib/mailer.js';

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, async () => {
  console.log(`[Server] Running on port ${PORT}`);
  await verifyMailer();
});
```

---

## 7. Email Templates — React Email

Create the folder `server/src/emails/`. Each `.tsx` file is a React Email template.

---

### 7.1 Shared Layout Component

All templates use this shared layout to stay visually consistent.

```tsx
// server/src/emails/components/EmailLayout.tsx
import * as React from 'react';
import {
  Html, Head, Body, Container,
  Img, Text, Hr,
} from '@react-email/components';

interface Props {
  children:   React.ReactNode;
  schoolName: string;
  logoUrl?:   string;
  previewText?: string;
}

export function EmailLayout({ children, schoolName, logoUrl, previewText }: Props) {
  return (
    <Html lang="en">
      <Head />
      {/* Gmail preview text (shown in inbox before opening) */}
      {previewText && (
        <div style={{ display: 'none', maxHeight: 0, overflow: 'hidden' }}>
          {previewText}
        </div>
      )}
      <Body style={{
        backgroundColor: '#f9fafb',
        fontFamily:      '"Helvetica Neue", Helvetica, Arial, sans-serif',
        margin:          0,
        padding:         0,
      }}>
        <Container style={{
          maxWidth:   '560px',
          margin:     '32px auto',
          padding:    '24px',
          backgroundColor: '#ffffff',
          borderRadius:    '8px',
          border:      '1px solid #e5e7eb',
        }}>
          {/* School Header */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            {logoUrl && (
              <Img
                src={logoUrl}
                alt={schoolName}
                width={56}
                height={56}
                style={{ borderRadius: '50%', margin: '0 auto 8px' }}
              />
            )}
            <Text style={{
              fontSize:   '16px',
              fontWeight: 'bold',
              color:      '#111827',
              margin:     0,
            }}>
              {schoolName}
            </Text>
          </div>

          <Hr style={{ borderColor: '#e5e7eb', margin: '0 0 24px' }} />

          {/* Slot for template-specific content */}
          {children}

          {/* Footer */}
          <Hr style={{ borderColor: '#e5e7eb', margin: '24px 0 16px' }} />
          <Text style={{
            fontSize:  '11px',
            color:     '#9ca3af',
            textAlign: 'center',
            margin:    0,
          }}>
            {schoolName} · This is an automated message. Do not reply to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

---

### 7.2 Application Received

Sent when an applicant successfully submits the online admission form (`/apply`).

```tsx
// server/src/emails/ApplicationReceived.tsx
import * as React  from 'react';
import { Heading, Text, Section, Row, Column } from '@react-email/components';
import { EmailLayout } from './components/EmailLayout.js';

interface Props {
  learnerName:    string;
  gradeLevel:     string;
  trackingNumber: string;
  schoolName:     string;
  schoolYear:     string;
  logoUrl?:       string;
}

export function ApplicationReceived({
  learnerName, gradeLevel, trackingNumber,
  schoolName, schoolYear, logoUrl,
}: Props) {
  return (
    <EmailLayout
      schoolName={schoolName}
      logoUrl={logoUrl}
      previewText={`Application received for ${learnerName} — Tracking: ${trackingNumber}`}
    >
      <Heading style={{ fontSize: '18px', color: '#111827', margin: '0 0 8px' }}>
        Application Received
      </Heading>
      <Text style={{ color: '#374151', fontSize: '14px', margin: '0 0 16px' }}>
        Thank you! We have received the enrollment application for:
      </Text>

      <InfoCard rows={[
        ['Learner Name',    learnerName],
        ['Grade Level',     gradeLevel],
        ['School Year',     schoolYear],
        ['Tracking Number', trackingNumber],
      ]} />

      <Text style={{ color: '#374151', fontSize: '14px', margin: '16px 0 0' }}>
        The school registrar will review the application and notify you once a decision has been made.
        You may check your application status at any time using your tracking number.
      </Text>
      <Text style={{ color: '#374151', fontSize: '14px', margin: '8px 0 0' }}>
        Please keep your tracking number for reference: <strong>{trackingNumber}</strong>
      </Text>
    </EmailLayout>
  );
}
```

---

### 7.3 F2F Application Recorded

Sent when a registrar enters a walk-in application via `/f2f-admission` (only if the applicant provided an email address).

```tsx
// server/src/emails/F2FApplicationRecorded.tsx
import * as React  from 'react';
import { Heading, Text } from '@react-email/components';
import { EmailLayout }   from './components/EmailLayout.js';

interface Props {
  learnerName:    string;
  gradeLevel:     string;
  trackingNumber: string;
  schoolName:     string;
  schoolYear:     string;
  logoUrl?:       string;
}

export function F2FApplicationRecorded({
  learnerName, gradeLevel, trackingNumber,
  schoolName, schoolYear, logoUrl,
}: Props) {
  return (
    <EmailLayout
      schoolName={schoolName}
      logoUrl={logoUrl}
      previewText={`Walk-in application recorded — Tracking: ${trackingNumber}`}
    >
      <Heading style={{ fontSize: '18px', color: '#111827', margin: '0 0 8px' }}>
        Walk-in Application Recorded
      </Heading>
      <Text style={{ color: '#374151', fontSize: '14px', margin: '0 0 16px' }}>
        Your walk-in enrollment application has been recorded by the school registrar.
      </Text>

      <InfoCard rows={[
        ['Learner Name',    learnerName],
        ['Grade Level',     gradeLevel],
        ['School Year',     schoolYear],
        ['Tracking Number', trackingNumber],
        ['Channel',         'Walk-in (F2F)'],
      ]} />

      <Text style={{ color: '#374151', fontSize: '14px', margin: '16px 0 0' }}>
        The registrar will process your application and inform you of the next steps.
        You may also visit the school office to check your application status.
      </Text>
    </EmailLayout>
  );
}
```

---

### 7.4 Enrollment Confirmed

Sent when the registrar approves an application and assigns the learner to a section.

```tsx
// server/src/emails/EnrollmentConfirmed.tsx
import * as React  from 'react';
import { Heading, Text } from '@react-email/components';
import { EmailLayout }   from './components/EmailLayout.js';

interface Props {
  learnerName:    string;
  gradeLevel:     string;
  sectionName:    string;
  trackingNumber: string;
  schoolName:     string;
  schoolYear:     string;
  logoUrl?:       string;
}

export function EnrollmentConfirmed({
  learnerName, gradeLevel, sectionName,
  trackingNumber, schoolName, schoolYear, logoUrl,
}: Props) {
  return (
    <EmailLayout
      schoolName={schoolName}
      logoUrl={logoUrl}
      previewText={`Enrollment confirmed for ${learnerName} — ${gradeLevel} ${sectionName}`}
    >
      <Heading style={{ fontSize: '18px', color: '#16a34a', margin: '0 0 8px' }}>
        ✓ Enrollment Confirmed
      </Heading>
      <Text style={{ color: '#374151', fontSize: '14px', margin: '0 0 16px' }}>
        We are pleased to confirm that the following learner has been officially enrolled:
      </Text>

      <InfoCard rows={[
        ['Learner Name',    learnerName],
        ['Grade Level',     gradeLevel],
        ['Section',         sectionName],
        ['School Year',     schoolYear],
        ['Tracking Number', trackingNumber],
      ]} />

      <Text style={{ color: '#374151', fontSize: '14px', margin: '16px 0 0' }}>
        Please report to school on the first day of classes with the learner and the required documents.
      </Text>
    </EmailLayout>
  );
}
```

---

### 7.5 Application Rejected

Sent when the registrar rejects an application with an actionable reason.

```tsx
// server/src/emails/ApplicationRejected.tsx
import * as React  from 'react';
import { Heading, Text, Section } from '@react-email/components';
import { EmailLayout }            from './components/EmailLayout.js';

interface Props {
  learnerName:    string;
  trackingNumber: string;
  reason?:        string;
  schoolName:     string;
  logoUrl?:       string;
}

export function ApplicationRejected({
  learnerName, trackingNumber, reason, schoolName, logoUrl,
}: Props) {
  return (
    <EmailLayout
      schoolName={schoolName}
      logoUrl={logoUrl}
      previewText={`Update on your application #${trackingNumber}`}
    >
      <Heading style={{ fontSize: '18px', color: '#111827', margin: '0 0 8px' }}>
        Update on Your Application
      </Heading>
      <Text style={{ color: '#374151', fontSize: '14px', margin: '0 0 4px' }}>
        Tracking Number: <strong>{trackingNumber}</strong>
      </Text>
      <Text style={{ color: '#374151', fontSize: '14px', margin: '0 0 16px' }}>
        We regret to inform you that the application for <strong>{learnerName}</strong> was
        not processed due to the following reason:
      </Text>

      {reason && (
        <Section style={{
          backgroundColor: '#fef9c3',
          borderLeft:      '4px solid #eab308',
          borderRadius:    '4px',
          padding:         '12px 16px',
          margin:          '0 0 16px',
        }}>
          <Text style={{ color: '#713f12', fontSize: '14px', margin: 0 }}>
            {reason}
          </Text>
        </Section>
      )}

      <Text style={{ color: '#374151', fontSize: '14px', margin: '0' }}>
        If you believe this is an error or if the issue has been resolved, you may resubmit
        your application. You are welcome to visit the school registrar's office for assistance.
      </Text>
    </EmailLayout>
  );
}
```

---

### 7.6 SCP Exam Scheduled

Sent when the registrar schedules an entrance exam or audition for an SCP applicant.

```tsx
// server/src/emails/ExamScheduled.tsx
import * as React  from 'react';
import { Heading, Text } from '@react-email/components';
import { EmailLayout }   from './components/EmailLayout.js';

interface Props {
  learnerName:    string;
  programName:    string;
  examDate:       string;   // formatted: "February 22, 2027 (Saturday)"
  venue?:         string;
  trackingNumber: string;
  schoolName:     string;
  logoUrl?:       string;
}

export function ExamScheduled({
  learnerName, programName, examDate, venue,
  trackingNumber, schoolName, logoUrl,
}: Props) {
  return (
    <EmailLayout
      schoolName={schoolName}
      logoUrl={logoUrl}
      previewText={`Your ${programName} assessment is scheduled for ${examDate}`}
    >
      <Heading style={{ fontSize: '18px', color: '#111827', margin: '0 0 8px' }}>
        Assessment Schedule — {programName}
      </Heading>
      <Text style={{ color: '#374151', fontSize: '14px', margin: '0 0 16px' }}>
        This is to inform you that <strong>{learnerName}</strong> has been scheduled
        for the {programName} entrance assessment.
      </Text>

      <InfoCard rows={[
        ['Program',    programName],
        ['Date',       examDate],
        ...(venue ? [['Venue', venue] as [string, string]] : []),
        ['Tracking #', trackingNumber],
      ]} />

      <Text style={{ color: '#374151', fontSize: '14px', margin: '16px 0 0' }}>
        Please ensure the learner arrives at the venue at least <strong>30 minutes before</strong>
        the scheduled time. Bring two valid identification documents.
      </Text>
    </EmailLayout>
  );
}
```

---

### 7.7 SCP Assessment Passed

Sent when the registrar marks an SCP applicant as PASSED and assigns a section.

```tsx
// server/src/emails/ExamPassed.tsx
import * as React  from 'react';
import { Heading, Text } from '@react-email/components';
import { EmailLayout }   from './components/EmailLayout.js';

interface Props {
  learnerName:    string;
  programName:    string;
  gradeLevel:     string;
  sectionName:    string;
  trackingNumber: string;
  schoolName:     string;
  schoolYear:     string;
  logoUrl?:       string;
}

export function ExamPassed({
  learnerName, programName, gradeLevel, sectionName,
  trackingNumber, schoolName, schoolYear, logoUrl,
}: Props) {
  return (
    <EmailLayout
      schoolName={schoolName}
      logoUrl={logoUrl}
      previewText={`Congratulations! ${learnerName} passed the ${programName} assessment`}
    >
      <Heading style={{ fontSize: '18px', color: '#16a34a', margin: '0 0 8px' }}>
        🎉 Congratulations! Assessment Passed
      </Heading>
      <Text style={{ color: '#374151', fontSize: '14px', margin: '0 0 16px' }}>
        We are delighted to inform you that <strong>{learnerName}</strong> has
        successfully passed the {programName} entrance assessment and has been enrolled.
      </Text>

      <InfoCard rows={[
        ['Program',     programName],
        ['Grade Level', gradeLevel],
        ['Section',     sectionName],
        ['School Year', schoolYear],
        ['Tracking #',  trackingNumber],
      ]} />

      <Text style={{ color: '#374151', fontSize: '14px', margin: '16px 0 0' }}>
        Please report to school on the first day of classes with the required documents.
      </Text>
    </EmailLayout>
  );
}
```

---

### 7.8 SCP Assessment Failed

Sent when the registrar marks an SCP applicant as FAILED.

```tsx
// server/src/emails/ExamFailed.tsx
import * as React  from 'react';
import { Heading, Text, Section } from '@react-email/components';
import { EmailLayout }            from './components/EmailLayout.js';

interface Props {
  learnerName:        string;
  programName:        string;
  trackingNumber:     string;
  offeredRegular?:    boolean;
  schoolName:         string;
  logoUrl?:           string;
}

export function ExamFailed({
  learnerName, programName, trackingNumber,
  offeredRegular, schoolName, logoUrl,
}: Props) {
  return (
    <EmailLayout
      schoolName={schoolName}
      logoUrl={logoUrl}
      previewText={`Update on the ${programName} application for ${learnerName}`}
    >
      <Heading style={{ fontSize: '18px', color: '#111827', margin: '0 0 8px' }}>
        Update on {programName} Application
      </Heading>
      <Text style={{ color: '#374151', fontSize: '14px', margin: '0 0 4px' }}>
        Tracking Number: <strong>{trackingNumber}</strong>
      </Text>
      <Text style={{ color: '#374151', fontSize: '14px', margin: '0 0 16px' }}>
        We regret to inform you that <strong>{learnerName}</strong> was unable to meet
        the qualifying standards for the {programName} program this school year.
      </Text>

      {offeredRegular && (
        <Section style={{
          backgroundColor: '#eff6ff',
          borderLeft:      '4px solid #3b82f6',
          borderRadius:    '4px',
          padding:         '12px 16px',
          margin:          '0 0 16px',
        }}>
          <Text style={{ color: '#1e3a5f', fontSize: '14px', margin: 0 }}>
            The school has offered placement in a regular section. Please visit the
            Registrar's Office to confirm this arrangement.
          </Text>
        </Section>
      )}

      <Text style={{ color: '#374151', fontSize: '14px', margin: '0' }}>
        We encourage the learner and family to visit the Registrar's Office for guidance.
        All learners are welcome in the school's regular program.
      </Text>
    </EmailLayout>
  );
}
```

---

### 7.9 Account Welcome (Registrar)

Sent by the System Admin when a new Registrar account is created.

```tsx
// server/src/emails/AccountWelcome.tsx
import * as React  from 'react';
import { Heading, Text, Section, Link } from '@react-email/components';
import { EmailLayout }                  from './components/EmailLayout.js';

interface Props {
  name:         string;
  role:         string;     // "Registrar"
  tempPassword: string;
  loginUrl:     string;
  schoolName:   string;
  logoUrl?:     string;
}

export function AccountWelcome({
  name, role, tempPassword, loginUrl, schoolName, logoUrl,
}: Props) {
  return (
    <EmailLayout
      schoolName={schoolName}
      logoUrl={logoUrl}
      previewText={`Your ${schoolName} system account is ready`}
    >
      <Heading style={{ fontSize: '18px', color: '#111827', margin: '0 0 8px' }}>
        Welcome to {schoolName}
      </Heading>
      <Text style={{ color: '#374151', fontSize: '14px', margin: '0 0 16px' }}>
        Hello <strong>{name}</strong>, a system account has been created for you.
        Your role is <strong>{role}</strong>.
      </Text>

      <InfoCard rows={[
        ['Role',               role],
        ['Temporary Password', tempPassword],
      ]} />

      <Text style={{ color: '#374151', fontSize: '14px', margin: '16px 0 8px' }}>
        You will be required to change your password on first login.
      </Text>

      <Section style={{ textAlign: 'center', margin: '16px 0' }}>
        <Link
          href={loginUrl}
          style={{
            backgroundColor: '#111827',
            color:           '#ffffff',
            padding:         '10px 24px',
            borderRadius:    '6px',
            fontSize:        '14px',
            fontWeight:      'bold',
            textDecoration:  'none',
            display:         'inline-block',
          }}
        >
          Sign In to Your Account →
        </Link>
      </Section>

      <Text style={{ color: '#9ca3af', fontSize: '12px', margin: '0' }}>
        If you did not expect this email, please contact your school's System Administrator.
      </Text>
    </EmailLayout>
  );
}
```

---

### Shared InfoCard Helper

All templates above use an `InfoCard` component — a styled table of key-value rows. Add it to the layout file or a separate helpers file:

```tsx
// server/src/emails/components/InfoCard.tsx
import * as React        from 'react';
import { Section, Row, Column, Text } from '@react-email/components';

interface Props {
  rows: [string, string][];
}

export function InfoCard({ rows }: Props) {
  return (
    <Section style={{
      backgroundColor: '#f3f4f6',
      borderRadius:    '8px',
      padding:         '16px',
      margin:          '0 0 8px',
    }}>
      {rows.map(([label, value]) => (
        <Row key={label} style={{ marginBottom: '6px' }}>
          <Column style={{ width: '40%', verticalAlign: 'top' }}>
            <Text style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>
              {label}
            </Text>
          </Column>
          <Column style={{ verticalAlign: 'top' }}>
            <Text style={{ color: '#111827', fontSize: '13px', fontWeight: 'bold', margin: 0 }}>
              {value}
            </Text>
          </Column>
        </Row>
      ))}
    </Section>
  );
}
```

Import it in each template:
```tsx
import { InfoCard } from './components/InfoCard.js';
```

---

## 8. Mailer Service

The single source of truth for all email sending. Every controller imports from here — never directly from Nodemailer.

```ts
// server/src/services/mailerService.ts
import { render } from '@react-email/render';
import { transporter } from '../lib/mailer.js';
import { prisma }      from '../lib/prisma.js';

// Templates
import { ApplicationReceived }   from '../emails/ApplicationReceived.js';
import { F2FApplicationRecorded } from '../emails/F2FApplicationRecorded.js';
import { EnrollmentConfirmed }   from '../emails/EnrollmentConfirmed.js';
import { ApplicationRejected }   from '../emails/ApplicationRejected.js';
import { ExamScheduled }         from '../emails/ExamScheduled.js';
import { ExamPassed }            from '../emails/ExamPassed.js';
import { ExamFailed }            from '../emails/ExamFailed.js';
import { AccountWelcome }        from '../emails/AccountWelcome.js';

const FROM = process.env.EMAIL_FROM!;

// ── Internal send + log helper ────────────────────────────────────────────
async function sendAndLog(params: {
  to:          string;
  subject:     string;
  html:        string;
  trigger:     string;
  applicantId?: number;
}): Promise<void> {
  const { to, subject, html, trigger, applicantId } = params;

  try {
    await transporter.sendMail({ from: FROM, to, subject, html });

    await prisma.emailLog.create({
      data: { recipient: to, subject, status: 'SENT', trigger, applicantId },
    });

  } catch (err) {
    console.error(`[Mailer] Failed — trigger: ${trigger}, to: ${to}`, err);

    await prisma.emailLog.create({
      data: {
        recipient:  to,
        subject,
        status:     'FAILED',
        trigger,
        applicantId,
        error:      (err as Error).message,
      },
    });
  }
}

// ── 1. Online application received ───────────────────────────────────────
export async function sendApplicationReceived(params: {
  to:             string;
  learnerName:    string;
  gradeLevel:     string;
  trackingNumber: string;
  schoolName:     string;
  schoolYear:     string;
  logoUrl?:       string;
  applicantId?:   number;
}): Promise<void> {
  const html = await render(ApplicationReceived(params));
  await sendAndLog({
    to:          params.to,
    subject:     `Application Received — #${params.trackingNumber} · ${params.schoolName}`,
    html,
    trigger:     'APPLICATION_SUBMITTED',
    applicantId: params.applicantId,
  });
}

// ── 2. F2F walk-in application recorded ──────────────────────────────────
export async function sendF2FApplicationRecorded(params: {
  to:             string;
  learnerName:    string;
  gradeLevel:     string;
  trackingNumber: string;
  schoolName:     string;
  schoolYear:     string;
  logoUrl?:       string;
  applicantId?:   number;
}): Promise<void> {
  const html = await render(F2FApplicationRecorded(params));
  await sendAndLog({
    to:          params.to,
    subject:     `Your Walk-in Application Has Been Recorded — #${params.trackingNumber} · ${params.schoolName}`,
    html,
    trigger:     'F2F_APPLICATION_ENTERED',
    applicantId: params.applicantId,
  });
}

// ── 3. Enrollment confirmed ───────────────────────────────────────────────
export async function sendEnrollmentConfirmed(params: {
  to:             string;
  learnerName:    string;
  gradeLevel:     string;
  sectionName:    string;
  trackingNumber: string;
  schoolName:     string;
  schoolYear:     string;
  logoUrl?:       string;
  applicantId?:   number;
}): Promise<void> {
  const html = await render(EnrollmentConfirmed(params));
  await sendAndLog({
    to:          params.to,
    subject:     `Your Enrollment is Confirmed — ${params.schoolName}, SY ${params.schoolYear}`,
    html,
    trigger:     'APPLICATION_APPROVED',
    applicantId: params.applicantId,
  });
}

// ── 4. Application rejected ───────────────────────────────────────────────
export async function sendApplicationRejected(params: {
  to:             string;
  learnerName:    string;
  trackingNumber: string;
  reason?:        string;
  schoolName:     string;
  logoUrl?:       string;
  applicantId?:   number;
}): Promise<void> {
  const html = await render(ApplicationRejected(params));
  await sendAndLog({
    to:          params.to,
    subject:     `Update on Your Application to ${params.schoolName}`,
    html,
    trigger:     'APPLICATION_REJECTED',
    applicantId: params.applicantId,
  });
}

// ── 5. SCP exam scheduled ─────────────────────────────────────────────────
export async function sendExamScheduled(params: {
  to:             string;
  learnerName:    string;
  programName:    string;
  examDate:       string;
  venue?:         string;
  trackingNumber: string;
  schoolName:     string;
  logoUrl?:       string;
  applicantId?:   number;
}): Promise<void> {
  const html = await render(ExamScheduled(params));
  await sendAndLog({
    to:          params.to,
    subject:     `Your ${params.programName} Assessment Date — ${params.schoolName}`,
    html,
    trigger:     'EXAM_SCHEDULED',
    applicantId: params.applicantId,
  });
}

// ── 6. SCP assessment passed ──────────────────────────────────────────────
export async function sendExamPassed(params: {
  to:             string;
  learnerName:    string;
  programName:    string;
  gradeLevel:     string;
  sectionName:    string;
  trackingNumber: string;
  schoolName:     string;
  schoolYear:     string;
  logoUrl?:       string;
  applicantId?:   number;
}): Promise<void> {
  const html = await render(ExamPassed(params));
  await sendAndLog({
    to:          params.to,
    subject:     `Congratulations! You Passed the ${params.programName} Assessment — ${params.schoolName}`,
    html,
    trigger:     'APPLICATION_PASSED',
    applicantId: params.applicantId,
  });
}

// ── 7. SCP assessment failed ──────────────────────────────────────────────
export async function sendExamFailed(params: {
  to:              string;
  learnerName:     string;
  programName:     string;
  trackingNumber:  string;
  offeredRegular?: boolean;
  schoolName:      string;
  logoUrl?:        string;
  applicantId?:    number;
}): Promise<void> {
  const html = await render(ExamFailed(params));
  await sendAndLog({
    to:          params.to,
    subject:     `Update on Your ${params.programName} Application — ${params.schoolName}`,
    html,
    trigger:     'APPLICATION_FAILED',
    applicantId: params.applicantId,
  });
}

// ── 8. New registrar account welcome ─────────────────────────────────────
export async function sendAccountWelcome(params: {
  to:           string;
  name:         string;
  role:         string;
  tempPassword: string;
  loginUrl:     string;
  schoolName:   string;
  logoUrl?:     string;
}): Promise<void> {
  const html = await render(AccountWelcome(params));
  await sendAndLog({
    to:      params.to,
    subject: `Welcome to ${params.schoolName} — Your System Account Details`,
    html,
    trigger: 'ADMIN_USER_CREATED',
  });
}
```

---

## 9. Controller Integration

### Online Admission — `store`

```ts
// server/src/controllers/applicationController.ts
import * as mailer from '../services/mailerService.js';

export async function store(req: Request, res: Response) {
  const applicant = await applicationService.create(req.body);

  res.status(201).json({ trackingNumber: applicant.trackingNumber });

  setImmediate(async () => {
    if (!applicant.emailAddress) return;
    await mailer.sendApplicationReceived({
      to:             applicant.emailAddress,
      learnerName:    `${applicant.lastName}, ${applicant.firstName}`,
      gradeLevel:     applicant.gradeLevel.name,
      trackingNumber: applicant.trackingNumber,
      schoolName:     settings.schoolName,
      schoolYear:     activeYear.yearLabel,
      logoUrl:        settings.logoUrl ?? undefined,
      applicantId:    applicant.id,
    });
  });
}
```

### F2F Walk-in — `storeF2F`

```ts
export async function storeF2F(req: Request, res: Response) {
  const applicant = await applicationService.createF2F(req.body, req.user!.userId);

  res.status(201).json({ trackingNumber: applicant.trackingNumber });

  setImmediate(async () => {
    if (!applicant.emailAddress) return; // optional for F2F
    await mailer.sendF2FApplicationRecorded({
      to:             applicant.emailAddress,
      learnerName:    `${applicant.lastName}, ${applicant.firstName}`,
      gradeLevel:     applicant.gradeLevel.name,
      trackingNumber: applicant.trackingNumber,
      schoolName:     settings.schoolName,
      schoolYear:     activeYear.yearLabel,
      logoUrl:        settings.logoUrl ?? undefined,
      applicantId:    applicant.id,
    });
  });
}
```

### Approve (Enrollment Confirmed)

```ts
export async function approve(req: Request, res: Response) {
  const { applicant, section, gradeLevel } = await enrollmentService.approve(
    Number(req.params.id),
    req.body.sectionId,
    req.user!.userId,
  );

  res.status(200).json({ message: 'Approved' });

  setImmediate(async () => {
    if (!applicant.emailAddress) return;
    await mailer.sendEnrollmentConfirmed({
      to:             applicant.emailAddress,
      learnerName:    `${applicant.lastName}, ${applicant.firstName}`,
      gradeLevel:     gradeLevel.name,
      sectionName:    section.name,
      trackingNumber: applicant.trackingNumber,
      schoolName:     settings.schoolName,
      schoolYear:     activeYear.yearLabel,
      logoUrl:        settings.logoUrl ?? undefined,
      applicantId:    applicant.id,
    });
  });
}
```

### Reject

```ts
export async function reject(req: Request, res: Response) {
  const { applicant } = await applicationService.reject(
    Number(req.params.id),
    req.body.rejectionReason,
  );

  res.status(200).json({ message: 'Rejected' });

  setImmediate(async () => {
    if (!applicant.emailAddress) return;
    await mailer.sendApplicationRejected({
      to:             applicant.emailAddress,
      learnerName:    `${applicant.lastName}, ${applicant.firstName}`,
      trackingNumber: applicant.trackingNumber,
      reason:         req.body.rejectionReason,
      schoolName:     settings.schoolName,
      logoUrl:        settings.logoUrl ?? undefined,
      applicantId:    applicant.id,
    });
  });
}
```

### SCP — Schedule Exam

```ts
export async function scheduleExam(req: Request, res: Response) {
  const applicant = await scpService.scheduleExam(Number(req.params.id), req.body);

  res.status(200).json({ message: 'Exam scheduled' });

  setImmediate(async () => {
    if (!applicant.emailAddress) return;
    await mailer.sendExamScheduled({
      to:             applicant.emailAddress,
      learnerName:    `${applicant.lastName}, ${applicant.firstName}`,
      programName:    applicant.scpProgramCode!,
      examDate:       formatDate(applicant.examDate!),
      venue:          req.body.venue,
      trackingNumber: applicant.trackingNumber,
      schoolName:     settings.schoolName,
      logoUrl:        settings.logoUrl ?? undefined,
      applicantId:    applicant.id,
    });
  });
}
```

### New Registrar Account

```ts
// server/src/controllers/adminUserController.ts
export async function store(req: Request, res: Response) {
  const { name, email } = req.body;
  const tempPassword = generateTempPassword();
  const user = await adminService.createUser({ name, email, tempPassword });

  res.status(201).json({ id: user.id });

  setImmediate(async () => {
    await mailer.sendAccountWelcome({
      to:           email,
      name,
      role:         'Registrar',
      tempPassword,
      loginUrl:     `${process.env.APP_URL}/login`,
      schoolName:   settings.schoolName,
      logoUrl:      settings.logoUrl ?? undefined,
    });
  });
}
```

---

## 10. Email Log API

The Admin's Email Logs page (`/admin/email-logs`) reads from the `EmailLog` table.

```ts
// server/src/routes/admin.routes.ts
router.get('/email-logs', authenticate, authorize('SYSTEM_ADMIN'), emailLogCtrl.index);
router.post('/email-logs/:id/retry', authenticate, authorize('SYSTEM_ADMIN'), emailLogCtrl.retry);
```

```ts
// server/src/controllers/adminEmailLogController.ts
import * as mailer from '../services/mailerService.js';

export async function index(req: Request, res: Response) {
  const { status, startDate, endDate, page = '1', limit = '20' } = req.query;

  const where = {
    ...(status    ? { status: String(status) }        : {}),
    ...(startDate ? { sentAt: { gte: new Date(String(startDate)) } } : {}),
    ...(endDate   ? { sentAt: { lte: new Date(String(endDate)) } }   : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      skip:    (Number(page) - 1) * Number(limit),
      take:    Number(limit),
    }),
    prisma.emailLog.count({ where }),
  ]);

  res.json({ logs, total, page: Number(page), limit: Number(limit) });
}

export async function retry(req: Request, res: Response) {
  const log = await prisma.emailLog.findUnique({
    where: { id: Number(req.params.id) },
  });

  if (!log) return res.status(404).json({ message: 'Email log not found' });
  if (log.status === 'SENT') return res.status(400).json({ message: 'Email already delivered' });

  // Re-fetch the latest applicant data and resend
  // The trigger string tells us which function to call
  // This is a simplified retry — production can map triggers to functions
  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM!,
      to:      log.recipient,
      subject: log.subject,
      html:    '<p>Retry — original HTML not stored. Please regenerate from applicant record.</p>',
    });

    await prisma.emailLog.update({
      where: { id: log.id },
      data:  { status: 'SENT', error: null },
    });

    await prisma.auditLog.create({
      data: {
        userId:      req.user!.userId,
        actionType:  'EMAIL_RETRY_TRIGGERED',
        description: `Admin retried email to ${log.recipient} (trigger: ${log.trigger})`,
        ipAddress:   req.ip ?? '0.0.0.0',
      },
    });

    res.json({ message: 'Retry sent' });
  } catch (err) {
    res.status(500).json({ message: 'Retry failed', error: (err as Error).message });
  }
}
```

> **Production improvement:** Store the rendered HTML in the `EmailLog` table so retries can resend the exact original email. Add an `html TEXT?` column to `EmailLog` and populate it in `sendAndLog()`.

---

## 11. Development Preview Server

React Email has a built-in browser preview — see exactly how each template looks before sending a real email.

```bash
# Install once globally
pnpm add -g react-email

# Start the preview server pointed at your emails folder
email dev --dir server/src/emails --port 4000
```

Open `http://localhost:4000` to see all templates with live reload. Switch between desktop and mobile viewport, and test dark mode.

To preview with real data, export a preview function from each template:

```tsx
// server/src/emails/EnrollmentConfirmed.tsx — add at the bottom

export function EnrollmentConfirmedPreview() {
  return (
    <EnrollmentConfirmed
      learnerName="DELA CRUZ, Juan Reyes"
      gradeLevel="Grade 7"
      sectionName="Rizal"
      trackingNumber="APP-2026-00055"
      schoolName="Your School Name"
      schoolYear="2026–2027"
    />
  );
}
```

The preview server automatically picks up any exported component.

---

## 12. File & Folder Structure

```
server/
├── src/
│   ├── emails/
│   │   ├── components/
│   │   │   ├── EmailLayout.tsx        ← shared wrapper (logo, header, footer)
│   │   │   └── InfoCard.tsx           ← shared key-value table component
│   │   ├── ApplicationReceived.tsx
│   │   ├── F2FApplicationRecorded.tsx
│   │   ├── EnrollmentConfirmed.tsx
│   │   ├── ApplicationRejected.tsx
│   │   ├── ExamScheduled.tsx
│   │   ├── ExamPassed.tsx
│   │   ├── ExamFailed.tsx
│   │   └── AccountWelcome.tsx
│   │
│   ├── lib/
│   │   ├── mailer.ts                  ← Nodemailer transporter + verifyMailer()
│   │   └── prisma.ts
│   │
│   ├── services/
│   │   └── mailerService.ts           ← all send* functions + sendAndLog()
│   │
│   ├── controllers/
│   │   ├── applicationController.ts   ← calls mailerService via setImmediate
│   │   ├── adminUserController.ts
│   │   └── adminEmailLogController.ts ← Email Logs page + retry endpoint
│   │
│   └── server.ts                      ← calls verifyMailer() on startup
│
├── prisma/
│   └── schema.prisma                  ← includes EmailLog model
│
└── .env                               ← SENDPULSE_* credentials
```

---

## 13. Free Plan Limits & Considerations

| Limit | Value | Impact on This System |
|---|---|---|
| Monthly emails | 12,000 | ~900 max per enrollment season — well within limit |
| Hourly rate | 50 emails/hour | Fine for one-at-a-time transactional triggers |
| Daily limit | No explicit daily cap beyond hourly | Non-issue for this system |
| Sender verification | Required before sending | Do this in Step 2 before deploying |
| Attachment size | Varies | Not used in this system |

**The 50 emails/hour limit is the only real constraint.** For transactional enrollment emails (one per applicant event), you will never hit it. The only scenario that could approach it is if the registrar processes 50+ applications within a single hour — which is unlikely but possible on the first day of Phase 1. In that case, the emails queue and go out over the next hour rather than failing.

If you ever need to send a bulk announcement to all applicants, split the sends with a delay:

```ts
// Example: send to 200 applicants with a 1.2-second gap (50/hour = 1/72sec, so 1.2s is safe)
for (const applicant of applicants) {
  await mailer.sendSomeEmail({ to: applicant.email, ... });
  await new Promise(resolve => setTimeout(resolve, 1200));
}
```

For normal transactional use, `setImmediate` with no delay is perfectly fine.

---

*Document v1.0.0*
*System: School Admission, Enrollment & Information Management System*
*Email Stack: React Email · Nodemailer · SendPulse SMTP (Free — 12,000/month)*
*Triggers: Application Received · F2F Recorded · Enrollment Confirmed · Rejected · Exam Scheduled · Exam Passed · Exam Failed · Account Welcome*
