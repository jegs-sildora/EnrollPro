# DepEd JHS Personnel Majors & Specializations Data Dictionary
**Target System:** EnrollPro: Academic Institution's Digital Platform
**Module:** Personnel Directory (School Form 7 Profile)
**Component:** Searchable Dropdown for Major/Specialization and Minor Fields[cite: 9]

---

## 1. Context & UX Strategy
Transitioning the Major and Minor fields from free-text inputs to searchable dropdowns is a crucial UX decision that eliminates dirty data and ensures clean, standardized personnel reporting for DepEd School Form 7 (SF7)[cite: 9]. By mirroring the structured dropdowns already utilized for Bachelor's and Postgraduate degrees[cite: 8, 10], this implementation maintains UI consistency and improves database queryability.

---

## 2. LLM / Database Engineer Prompt
Use the following prompt to generate the exact programmatic structure (JSON/SQL) for the dropdown component:

> **Act as a DepEd Human Resources Data Specialist.** 
> Generate a comprehensive, categorized list of academic Majors, Minors, and Specializations for public school teachers in the Philippines, specifically tailored for Junior High School (Grades 7–10) personnel reporting (SF7).
>
> Format the output as a JSON array of objects suitable for a React/Vue searchable select component: 
> `[{ "label": "Mathematics", "value": "MATHEMATICS", "category": "Core Subjects" }]`
>
> Ensure the dataset strictly aligns with the Philippine Professional Standards for Teachers (PPST) and DepEd hiring guidelines. Include the following categories:
> 1. **Core Education Majors (BSED/BEED):** English, Filipino, Mathematics, Science, Araling Panlipunan, Edukasyon sa Pagpapakatao (EsP).
> 2. **MAPEH:** General MAPEH, plus individual components (Music, Arts, Physical Education, Health).
> 3. **TLE / TVL Tracks:** Home Economics (HE), Agri-Fishery Arts (AFA), Industrial Arts (IA), Information and Communications Technology (ICT).
> 4. **Special Needs:** Special Education (SPED).
> 5. **Common Non-Education Majors (AB/BS with CPE units):** Psychology, Biology, Chemistry, Physics, History, Political Science, Computer Science, Accountancy.
> 6. **Postgraduate Specializations (MAEd/MAT/PhD/EdD):** Educational Management, Educational Leadership, Curriculum and Instruction, Administration and Supervision.

---

## 3. Recommended DepEd JHS Specialization Dataset
This curated list reflects real-world majors and specializations found in DepEd JHS deployments, ready for database seeding or frontend hardcoding.

### Core Academic Subjects
* English
* Filipino
* Mathematics
* General Science
* Biology
* Chemistry
* Physics
* Physical Sciences
* Araling Panlipunan / Social Studies
* Edukasyon sa Pagpapakatao (EsP) / Values Education

### MAPEH (Music, Arts, Physical Education, and Health)
* MAPEH (General)
* Music Education
* Art Education
* Physical Education
* Health Education

### TLE (Technology and Livelihood Education)
* TLE (General)
* Home Economics (HE)
* Agri-Fishery Arts (AFA)
* Industrial Arts (IA)
* Information and Communications Technology (ICT)
* Computer Education

### Specialized & Inclusive Education
* Special Education (SPED)
* Early Childhood Education
* Reading / Literacy Education

### Common Allied Degrees (For AB/BS Graduates with CPE)
* Psychology
* History
* Political Science
* Economics
* Philosophy
* Sociology
* Information Technology / Computer Science
* Accountancy / Financial Management
* Mass Communication / Journalism

### Postgraduate Specializations (For MAEd / EdD / PhD)
* Educational Management
* Educational Leadership
* Curriculum and Instruction
* Administration and Supervision
* Guidance and Counseling
* Educational Technology
* Measurement and Evaluation

---

## 4. UX Implementation Notes
* **Fuzzy Search Configuration:** Configure the searchable dropdown filter to execute a `contains` match rather than a strict `starts with` match. This accommodates various university naming conventions (e.g., allowing a user typing "Social" to instantly find "Araling Panlipunan / Social Studies").
* **Fallback Option:** Include an `Other (Please Specify)` option that triggers a conditional free-text input field. This acts as a catch-all for rare or highly specific legacy degrees not covered by the standard DepEd taxonomy.
* **Component Reuse:** Utilize the exact same dataset array for both the "Major/Specialization" and "Minor" dropdowns to maintain data consistency across the SF7 schema[cite: 9].