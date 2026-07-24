# Personnel And SF7

Last reviewed: 2026-07-24

## Personnel Directory

The Personnel Directory manages faculty and staff identity, employee number, contact details, portal role, service status, official position, department, adviserships, and school-form profile information.

Service-aware labels must use plain wording such as Active Personnel, On Leave, Transferred, Retired or Resigned, and Inactive.

## Advisership

Section advisership is school-year scoped. A section has at most one active adviser assignment. Handover preserves the prior assignment status instead of rewriting history. Adviser changes invalidate both section and personnel views through SSE.

## SF7 Profile

SF7 fields include:

- undergraduate and postgraduate degree
- major and minor specialization
- nature of appointment
- funding source
- administrative remarks
- Indigenous Peoples community or ethnic group, when declared

## Teaching Schedule

`TeacherSchedulePeriod` stores the EnrollPro SF7 reporting snapshot for a school year. Each row contains day, start time, end time, subject, and section. Weekly teaching minutes are calculated from valid time ranges.

ATLAS remains the live schedule and teaching-load source of truth. EnrollPro may synchronize published ATLAS assignments into the SF7 snapshot using employee ID.

## SF7 Actions

The Personnel Directory provides:

- Upload SF7 Roster
- Download Blank Template
- Export Compliance Report

Upload uses a preview before commit. The blank template and compliance export use the official workbook at `server/templates/School Form 7 (SF7) School Personnel Assignment List and Basic Profile.xlsx`. The exporter fills the template tiles without replacing its official structure.

The export combines personnel profile, appointment, funding, qualifications, advisership, ancillary assignments, synchronized schedule periods, weekly minutes, school metadata, and incumbent counts. Missing optional values remain blank.

## Access

Personnel changes and SF7 actions require the roles enforced by the mounted teacher, SF7, and export routers. Integration keys do not grant staff UI permissions.

