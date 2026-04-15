# ENROLLPRO SYSTEM BLUEPRINT: SCP ADMISSION REQUIREMENTS & SYSTEM LOGIC
**Institution Context:** Hinigaran National High School (HNHS) / Standard DepEd Policies
**Applicability:** Incoming Grade 7 Learners (Phase 1: Early Registration & Screening)

---

## PART 1: LOCALIZED SCHOOL POLICIES (BASED ON HNHS PROMOTIONAL MATERIALS)
*These requirements are strictly localized based on Hinigaran National High School's officially published guidelines for SY 2026-2027.*

### 1. Science, Technology, and Engineering (STE)
*The most rigorous academic track, requiring a weighted algorithmic ranking.*

* **Application Window:** January 12 to March 4, 2026.
* **Grade Prerequisite:** An average rating of at least **85% specifically in English, Science, and Mathematics** (from 1st to 3rd Quarter of Grade 6).
* **Documentary Requirements:**
  1. Duly accomplished STE Application Form.
  2. 1x1 or 2x2 ID Picture with white background (2 pcs).
  3. Certified Photocopy of SF9 (School Report Card).
  4. Certified Photocopy of PSA Birth Certificate.
  5. Certificate of Good Moral Character.
  6. Medical Certificate.
  7. 1 pc. Long Plastic Envelope.
* **Assessment Schedule & Ranking Weights (Total 100%):**
  * Qualifying Exam (Scheduled: March 14, 2026) = **65%**
  * Face-to-Face Interview (Scheduled: March 21, 2026) = **15%**
  * Grade 6 Average = **20%**

### 2. Special Program in Sports (SPS)
*Focuses on athletic verification and has a slightly extended application window.*

* **Application Window:** January 31 to May 8, 2026.
* **Grade Prerequisite:** A **General Average** of at least **85%** on the latest SF9/Report Card.
* **Program Offerings:**
  * *Team Sports:* Athletics, Basketball, Sepak Takraw, Volleyball.
  * *Individual/Dual Sports:* Aerobic/Rhythmic Gymnastics, Arnis, Badminton, Swimming, Table Tennis.
* **Documentary Requirements:**
  1. Early Registration / Application Form.
  2. Clear copy of PSA Birth Certificate.
  3. SF9 / Report Card.
  4. **Awards / Certificates of Recognition in the chosen sport.**

### 3. Special Program in the Arts (SPA)
*The most streamlined initial application, explicitly deferring the entrance assessment to the enrollment phase.*

* **Target Audience:** Learners exhibiting skills in Music, Dance, Visual Arts, Media Arts, Theater, or Creative Writing.
* **Grade Prerequisite:** A **General Average** of at least **85%** on the Report Card.
* **Documentary Requirements:**
  1. Accomplished Application Form.
  2. SF9 / Report Card.
  3. PSA / Birth Certificate.
* **Assessment:** The Entrance Exam/Audition is explicitly given **during the enrollment phase** rather than during the early registration window.

---

## PART 2: STANDARD DEPED POLICIES FOR REMAINING PROGRAMS
*For the remaining SCPs not detailed in the HNHS promotional materials, the system will fall back to the standard Department of Education (DepEd) baseline guidelines.*

### 4. Special Program in Journalism (SPJ)
*Hones students in print, broadcast, and digital media communication.*

* **Grade Prerequisite:** A baseline grade of **85% or above specifically in English and Filipino**.
* **Documentary Requirements:**
  1. Accomplished Application Form.
  2. SF9 / Report Card.
  3. PSA Birth Certificate.
  4. **Portfolio of published works** from the elementary school paper (Highly Recommended).
* **Assessment:** Applicants take a Written Proficiency Examination (news writing, feature writing, etc.) and an oral interview/simulated broadcasting test.

### 5. Special Program in Foreign Language (SPFL)
*Equips students with a second foreign language (e.g., Spanish, French, Japanese) alongside English.*

* **Grade Prerequisite:** A high proficiency in **English (Minimum 85%)**.
* **Documentary Requirements:**
  1. Accomplished Application Form.
  2. SF9 / Report Card.
  3. PSA Birth Certificate.
* **Assessment:** Schools conduct a Language Aptitude Test to gauge cognitive ability for absorbing new grammar, followed by an oral interview.

### 6. Special Program in Technical-Vocational Education (SPTVE)
*Prepares highly skilled students for technical certifications (e.g., TESDA NC II).*

* **Grade Prerequisite:** General average cutoff is generally standard (e.g., passing marks), but students must show strong practical aptitude.
* **Documentary Requirements:**
  1. Accomplished Application Form.
  2. SF9 / Report Card.
  3. PSA Birth Certificate.
  4. **Certificate of Good Moral Character** (Strictly emphasized for handling school machinery).
* **Assessment:** Applicants undergo technical, spatial, and mechanical aptitude tests.

---

## PART 3: ENROLLPRO SYSTEM INTEGRATION LOGIC
To implement these complex rules into the React Frontend and Node.js Backend:

1. **Dynamic Grade Gates (Frontend):**
   * If `Program == 'STE'`, render inputs for `Math`, `Science`, and `English`. Calculate the average. If `< 85`, disable submission.
   * If `Program == 'SPS' || 'SPA'`, render a single input for `General Average`. If `< 85`, disable submission.
   * If `Program == 'SPJ'`, check `English` and `Filipino` grades.
   * If `Program == 'SPFL'`, check the `English` grade.

2. **Conditional Document Uploads (Frontend):**
   * Default Required: `SF9` and `PSA`.
   * Trigger `Medical_Certificate` and `Good_Moral` as REQUIRED if `Program == 'STE'` or `Program == 'SPTVE'`.
   * Trigger `Sports_Awards` as REQUIRED if `Program == 'SPS'`.
   * Trigger `Writing_Portfolio` as OPTIONAL/RECOMMENDED if `Program == 'SPJ'`.

3. **Algorithmic Ranking Engine (Backend):**
   * The database must store the specific HNHS algorithm for STE: `(ExamScore * 0.65) + (InterviewScore * 0.15) + (Grade6Average * 0.20)`.
   * The system will automatically rank applicants descending by this computed total to generate the list of accepted students for the April 18 publication date.