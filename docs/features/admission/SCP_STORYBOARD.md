Storyboard — SCP STE Verify & Schedule Exam
Grade 7 · Online Application · Documents Submitted

The Setup Before the Button Is Clicked
Who   : Registrar (Cruz, Regina)
Where : /applications/admission — slide-over panel open
        OR /applications/admission/53 — full detail page
Record: REYES, Pedro Manuel · Grade 7 · STE · Status: ● PENDING
        Channel: Online · Submitted: Feb 3, 2026
        Physical documents already presented at the window:
          ✓ SF9 Grade 6 (signed by elementary school head)
          ✓ PSA Birth Certificate (original)

Scene 1 — Registrar Opens the Application
The registrar is working through the Admission inbox. Pedro's application row shows:
053 │ Reyes, Pedro M. │ 112233445566 │ Grade 7 │ STE │ ● PENDING │ [View]
Registrar clicks [View]. The slide-over panel opens on the right:
╔══════════════════════════════════════════════════════════════════╗
║ APPLICATION DETAIL                                  [✕ Close]  ║
║ #APP-2026-00053 · Online · Feb 3, 2026                          ║
╠══════════════════════════════════════════════════════════════════╣
║ REYES, Pedro Manuel                          ● PENDING          ║
║ Grade 7  ·  ⚡ STE — Science, Technology & Engineering           ║
║ LRN: 112233445566  ·  Age: 12                                   ║
╠══════════════════════════════════════════════════════════════════╣
║ ▸ Personal Info   ▸ Guardian   ▸ Prev. School   ▸ Class.        ║
╠══════════════════════════════════════════════════════════════════╣
║ ⚡ STE ASSESSMENT                                               ║
║ Type: Written Entrance Exam (EXAM_ONLY)                         ║
║ Exam Date:    Not yet scheduled                                 ║
║ Exam Score:   —                                                 ║
║ Result:       —                                                 ║
╠══════════════════════════════════════════════════════════════════╣
║ STATUS TIMELINE                                                 ║
║ ● Feb 3, 2026  Application Submitted (Online)                   ║
╠══════════════════════════════════════════════════════════════════╣
║ [ View Full Details ↗ ]                                         ║
╠══════════════════════════════════════════════════════════════════╣
║  [ 📅 Verify & Schedule Exam ]    [ ✗ Reject Application ]      ║
╚══════════════════════════════════════════════════════════════════╝

Scene 2 — Document Verification at the Counter (Physical)
Before touching the button, the registrar performs the physical verification. Pedro's parent has presented documents at the window.
Documents the registrar checks:
DocumentCheckRegistrar ActionSF9 (Grade 6 Report Card)Signed by elementary school head · Shows Grade 6 completionVerify signature · Note school name and general averagePSA Birth CertificateOriginal · LRN matches the SF9Verify authenticity · Note PSA reference number
The registrar cross-references the name on the documents against REYES, Pedro Manuel shown in the panel. Everything matches.

Policy note (DO 017, s. 2025): Documents at this stage are verified, not yet permanently collected. Physical collection of originals happens in Phase 2 (June). The registrar may retain the SF9 now or note its details and return it.


Scene 3 — Registrar Clicks "Verify & Schedule Exam"
The registrar clicks the button. The Schedule Assessment dialog opens as a shadcn/ui Dialog over the panel (or over the full-page detail if using that view):
┌──────────────────────────────────────────────────────────────────────┐
│  Schedule Assessment                                      [✕]        │
│  REYES, Pedro Manuel  ·  Grade 7  ·  STE                             │
│  ─────────────────────────────────────────────────────────────────   │
│  ✓ Documents Verified                                                │
│    SF9 (Grade 6 Report Card) and PSA Birth Certificate               │
│    have been checked and filed.                                      │
│                                                                      │
│  Assessment Type: Written Entrance Exam (EXAM_ONLY)                  │
│  ─────────────────────────────────────────────────────────────────   │
│  Exam Date  *                                                        │
│  [ ____ / ____ / ______   📅 ]                                        │
│                                                                      │
│  Venue  (optional)                                                   │
│  [ _____________________________________ ]                            │
│                                                                      │
│  Notes  (optional)                                                   │
│  [ _____________________________________ ]                            │
│                                                                      │
│  ⓘ A confirmation email will be sent to the parent/guardian          │
│    at reyes.maria@gmail.com with the exam schedule.                  │
│                                                                      │
│          [ Cancel ]              [ Schedule Exam ]                   │
└──────────────────────────────────────────────────────────────────────┘
Key details of the dialog:

"✓ Documents Verified" is a read-only display, not a checkbox. Clicking "Schedule Exam" is the registrar's implicit attestation that they physically verified the documents. The system does not ask for a separate confirmation because the act of scheduling is the confirmation.
Assessment Type is read-only — auto-populated from ScpProgram.assessmentType. For STE it is EXAM_ONLY (written entrance exam). The registrar cannot change this — it is configured by the System Admin under SCP settings.
Exam Date is required. The date is announced by the Schools Division Office (SDO) — the registrar enters the SDO-published date.
Venue is optional. If the SDO specifies a venue, the registrar enters it.
The parent email is shown so the registrar can confirm an email will be sent.


Scene 4 — Registrar Fills the Dialog
The SDO has announced the STE entrance exam for February 22, 2027 at the school's Science Laboratory.
┌──────────────────────────────────────────────────────────────────────┐
│  Schedule Assessment                                      [✕]        │
│  REYES, Pedro Manuel  ·  Grade 7  ·  STE                             │
│  ─────────────────────────────────────────────────────────────────   │
│  ✓ Documents Verified                                                │
│    SF9 (Grade 6 Report Card) and PSA Birth Certificate               │
│    have been checked and filed.                                      │
│                                                                      │
│  Assessment Type: Written Entrance Exam (EXAM_ONLY)                  │
│  ─────────────────────────────────────────────────────────────────   │
│  Exam Date  *                                                        │
│  [ February 22, 2027   📅 ]  ← Saturday — SDO-announced date        │
│                                                                      │
│  Venue  (optional)                                                   │
│  [ Science Laboratory — Main Building               ]                │
│                                                                      │
│  Notes  (optional)                                                   │
│  [ Bring 2 pencils and a non-programmable calculator ]               │
│                                                                      │
│  ⓘ A confirmation email will be sent to the parent/guardian          │
│    at reyes.maria@gmail.com with the exam schedule.                  │
│                                                                      │
│          [ Cancel ]          [ Schedule Exam ]                       │
└──────────────────────────────────────────────────────────────────────┘
Registrar clicks [ Schedule Exam ].

Scene 5 — What the System Does (Behind the Scenes)
PATCH /api/applications/53/schedule-exam
Authorization: Bearer <JWT — Cruz, Regina>
Body: {
  examDate: "2027-02-22",
  venue:    "Science Laboratory — Main Building",
  notes:    "Bring 2 pencils and a non-programmable calculator"
}

Server:
  1. Validates: status must be PENDING, applicantType must be SCP
  2. Updates Applicant #53:
       status          → EXAM_SCHEDULED
       examDate        → 2027-02-22
       examVenue       → "Science Laboratory — Main Building"
       examNotes       → "Bring 2 pencils..."
       assessmentType  → "EXAM_ONLY"  (already set from ScpConfig)
  3. Creates AuditLog:
       actionType:  "EXAM_SCHEDULED"
       description: "Registrar Cruz scheduled WRITTEN_EXAM for
                     REYES, Pedro Manuel on Feb 22, 2027"
       userId:      Cruz.id
       subjectId:   53 (applicant ID)
  4. Returns 200 OK

  5. setImmediate(() => {
       sendExamScheduled({
         to:             "reyes.maria@gmail.com",
         learnerName:    "REYES, Pedro Manuel",
         programName:    "Science, Technology & Engineering (STE)",
         examDate:       "February 22, 2027 (Saturday)",
         venue:          "Science Laboratory — Main Building",
         trackingNumber: "APP-2026-00053",
         schoolName:     SchoolSettings.schoolName,   ← never hardcoded
       })
     })
     ← email fires AFTER the HTTP response — API never blocks

Scene 6 — Dialog Closes, Panel Updates
The dialog closes. The slide-over panel updates in place without closing or navigating away:
╔══════════════════════════════════════════════════════════════════╗
║ APPLICATION DETAIL                                  [✕ Close]  ║
║ #APP-2026-00053 · Online · Feb 3, 2026                          ║
╠══════════════════════════════════════════════════════════════════╣
║ REYES, Pedro Manuel                     ⏳ EXAM_SCHEDULED        ║
║ Grade 7  ·  ⚡ STE — Science, Technology & Engineering           ║
║ LRN: 112233445566  ·  Age: 12                                   ║
╠══════════════════════════════════════════════════════════════════╣
║ ⚡ STE ASSESSMENT                                               ║
║ Type: Written Entrance Exam (EXAM_ONLY)                         ║
║ Exam Date:    February 22, 2027 (Saturday)                      ║
║ Venue:        Science Laboratory — Main Building                ║
║ Exam Score:   —  (exam not yet taken)                           ║
║ Result:       —                                                 ║
╠══════════════════════════════════════════════════════════════════╣
║ STATUS TIMELINE                                                 ║
║ ● Feb 5, 2026  Exam Scheduled                                   ║
║                Cruz, Regina · Feb 22, 2027                      ║
║ ● Feb 3, 2026  Application Submitted (Online)                   ║
╠══════════════════════════════════════════════════════════════════╣
║ [ View Full Details ↗ ]                                         ║
╠══════════════════════════════════════════════════════════════════╣
║  [ 📝 Record Assessment Result ]                                 ║
╚══════════════════════════════════════════════════════════════════╝
What changed:

Status badge: ● PENDING → ⏳ EXAM_SCHEDULED
STE Assessment block: now shows exam date and venue
Status timeline: new entry added at the top
Action button: [ 📅 Verify & Schedule Exam ] replaced by [ 📝 Record Assessment Result ]

Toast notification appears at the bottom of the screen:
✓  Exam Scheduled
   REYES, Pedro Manuel  ·  STE
   February 22, 2027 — Science Laboratory

Scene 7 — The Row in the Inbox Updates
In the background, the application row in the Admission list updates:
BEFORE:
053 │ Reyes, Pedro M. │ 112233445566 │ Grade 7 │ STE │ ● PENDING       │ [View]

AFTER:
053 │ Reyes, Pedro M. │ 112233445566 │ Grade 7 │ STE │ ⏳ EXAM_SCHEDULED│ [View]
The PENDING (14) badge in the sidebar decreases by 1:
├─ 📝  Admission    (13)   ← was 14

Scene 8 — The Email Sent to the Parent
A few seconds after the dialog closes, the parent receives this email:
Subject: Your STE Entrance Exam — [School Name]

Dear Ms. Reyes,

This is to inform you that REYES, Pedro Manuel has been
cleared to take the STE entrance examination.

  Program       : Science, Technology & Engineering (STE)
  Exam Date     : February 22, 2027 (Saturday)
  Venue         : Science Laboratory — Main Building
  Tracking #    : APP-2026-00053

Please ensure your child arrives at the venue at least
30 minutes before the scheduled time.

Additional reminders:
  • Bring 2 pencils and a non-programmable calculator
  • Bring one (1) valid ID (school ID or PSA Birth Certificate)

[School Name]
This is an automated message. Do not reply to this email.
The school name in the subject and body comes from SchoolSettings.schoolName — never hardcoded.

Scene 9 — Full Picture of What Happened in One Action
BEFORE                              AFTER
──────────────────────────────────────────────────────────────────
Status         PENDING              EXAM_SCHEDULED
Exam Date      null                 2027-02-22
Exam Venue     null                 "Science Laboratory — Main..."
Action Button  Verify & Schedule    Record Assessment Result
Sidebar count  Admission (14)       Admission (13)
AuditLog       —                    EXAM_SCHEDULED entry written
Email          —                    Sent to reyes.maria@gmail.com

What Comes Next (After This Scene)
The registrar does nothing further for this application until exam day passes. On or after February 22, 2027:

Registrar opens Pedro's record (still in Admission inbox, ⏳ EXAM_SCHEDULED)
Clicks [ 📝 Record Assessment Result ]
Enters the score (e.g., 87.5) — system shows live cut-off comparison
Clicks [ Save Result ] → status → 📋 EXAM_TAKEN
Then clicks [ ✅ Mark as Passed ] or [ ❌ Mark as Failed ]
If Passed → Section Assignment dialog opens → STE-A section → ✓ APPROVED
If Failed → Offer Regular Section or Reject dialog