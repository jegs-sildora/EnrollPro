# SYSTEM DIRECTIVE: Transition, Confirmation, and Sectioning Routing (v122.0)

**Context Persona:** Act as a Senior GovTech Enterprise Architect. Your standard is high data-density, high-security, offline-first administrative software. The transition between academic years must use plain, everyday language and mirror real-world school enrollment steps. Strictly obey markdown formatting and completely avoid using any prohibited punctuation marks in your output.

**Core Mandate:** When the administrator starts a new school year, the system must smoothly transition returning students through a strict three-phase pipeline: the Historical Archive, the Confirmation Waiting Room, and finally, the Class Sectioning Dispatch. 

Execute the following five plain-English system behaviors:

## 1. The Safety Check
The system must refuse to start a new year if the old year is not finished.
* The system must check all grades to ensure every single student record is locked and finished for the year.
* If any record is still open, stop the process and show a simple error message telling the user exactly which class needs to be finished first.

## 2. Clearing the Slate
The system must start the new year with an empty official roster.
* When the new year starts, the main Total Official Enrollment number on the dashboard must reset to exactly 0.
* All old class lists and section assignments must be completely cleared.

## 3. Moving Students to the Waiting Room
The system must hold returning students until they physically confirm they are coming back.
* Grade 10 students who finished are marked as Completers and removed from the active incoming lists.
* All students who passed, conditionally passed, or were retained must be moved directly into the Pending Confirmations list on the Continuing Learners page.
* While they are in this pending list, they do not count toward the official enrollment yet, and they cannot be placed in a new class yet.

## 4. The Confirmation Step
The staff must manually verify what happens to each returning student.
* If the staff confirms the student is returning, two things happen instantly: the student is added to the Total Official Enrollment tally, and they are immediately routed to the Sectioning and SF1 Prep page.
* If the student is moving to a different school, the staff marks them as a Transfer Request, which moves them to the transfer list and keeps them out of the active enrollment count.

## 5. The Class Assignment Step
The system must queue confirmed students for official classroom placement.
* Once a student is confirmed, they must appear in the Unassigned Learners list under the Section Assignment tab for their specific grade level.
* From this list, the Registrar can manually select students and assign them to a classroom.
* Alternatively, the Registrar can utilize the Auto-Distribute tool, allowing the system to algorithmically divide the unassigned students into the available sections to ensure evenly balanced classrooms based on gender and general average.