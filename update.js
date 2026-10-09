const fs = require('fs');
const file = 'c:/Users/Administrator/Documents/EnrollPro/shared/src/constants/index.ts';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
const before = lines.slice(0, 435).join('\n');
const after = lines.slice(657).join('\n');

const newValues = `export const DEPED_TEACHER_SPECIALIZATION_VALUES = [
  "ENGLISH",
  "FILIPINO",
  "MATHEMATICS",
  "GENERAL SCIENCE",
  "BIOLOGY",
  "CHEMISTRY",
  "PHYSICS",
  "PHYSICAL SCIENCES",
  "ARALING PANLIPUNAN",
  "ESP",
  "MAPEH",
  "MUSIC EDUCATION",
  "ART EDUCATION",
  "PHYSICAL EDUCATION",
  "HEALTH EDUCATION",
  "TLE",
  "HOME ECONOMICS",
  "AGRI-FISHERY ARTS",
  "INDUSTRIAL ARTS",
  "ICT",
  "COMPUTER EDUCATION",
  "SPED",
  "EARLY CHILDHOOD EDUCATION",
  "READING / LITERACY EDUCATION",
  "PSYCHOLOGY",
  "HISTORY",
  "POLITICAL SCIENCE",
  "ECONOMICS",
  "PHILOSOPHY",
  "SOCIOLOGY",
  "INFORMATION TECHNOLOGY",
  "ACCOUNTANCY",
  "MASS COMMUNICATION",
  "EDUCATIONAL MANAGEMENT",
  "EDUCATIONAL LEADERSHIP",
  "CURRICULUM AND INSTRUCTION",
  "ADMINISTRATION AND SUPERVISION",
  "GUIDANCE AND COUNSELING",
  "EDUCATIONAL TECHNOLOGY",
  "MEASUREMENT AND EVALUATION",
  "OTHER"
] as const;

export const DEPED_TEACHER_SPECIALIZATION_GROUPS = [
  {
    group: "Core Academic Subjects",
    options: [
      { value: "ENGLISH", label: "English" },
      { value: "FILIPINO", label: "Filipino" },
      { value: "MATHEMATICS", label: "Mathematics" },
      { value: "GENERAL SCIENCE", label: "General Science" },
      { value: "BIOLOGY", label: "Biology" },
      { value: "CHEMISTRY", label: "Chemistry" },
      { value: "PHYSICS", label: "Physics" },
      { value: "PHYSICAL SCIENCES", label: "Physical Sciences" },
      { value: "ARALING PANLIPUNAN", label: "Araling Panlipunan / Social Studies" },
      { value: "ESP", label: "Edukasyon sa Pagpapakatao (EsP) / Values Education" }
    ]
  },
  {
    group: "MAPEH (Music, Arts, Physical Education, and Health)",
    options: [
      { value: "MAPEH", label: "MAPEH (General)" },
      { value: "MUSIC EDUCATION", label: "Music Education" },
      { value: "ART EDUCATION", label: "Art Education" },
      { value: "PHYSICAL EDUCATION", label: "Physical Education" },
      { value: "HEALTH EDUCATION", label: "Health Education" }
    ]
  },
  {
    group: "TLE (Technology and Livelihood Education)",
    options: [
      { value: "TLE", label: "TLE (General)" },
      { value: "HOME ECONOMICS", label: "Home Economics (HE)" },
      { value: "AGRI-FISHERY ARTS", label: "Agri-Fishery Arts (AFA)" },
      { value: "INDUSTRIAL ARTS", label: "Industrial Arts (IA)" },
      { value: "ICT", label: "Information and Communications Technology (ICT)" },
      { value: "COMPUTER EDUCATION", label: "Computer Education" }
    ]
  },
  {
    group: "Specialized & Inclusive Education",
    options: [
      { value: "SPED", label: "Special Education (SPED)" },
      { value: "EARLY CHILDHOOD EDUCATION", label: "Early Childhood Education" },
      { value: "READING / LITERACY EDUCATION", label: "Reading / Literacy Education" }
    ]
  },
  {
    group: "Common Allied Degrees (For AB/BS Graduates with CPE)",
    options: [
      { value: "PSYCHOLOGY", label: "Psychology" },
      { value: "HISTORY", label: "History" },
      { value: "POLITICAL SCIENCE", label: "Political Science" },
      { value: "ECONOMICS", label: "Economics" },
      { value: "PHILOSOPHY", label: "Philosophy" },
      { value: "SOCIOLOGY", label: "Sociology" },
      { value: "INFORMATION TECHNOLOGY", label: "Information Technology / Computer Science" },
      { value: "ACCOUNTANCY", label: "Accountancy / Financial Management" },
      { value: "MASS COMMUNICATION", label: "Mass Communication / Journalism" }
    ]
  },
  {
    group: "Postgraduate Specializations (For MAEd / EdD / PhD)",
    options: [
      { value: "EDUCATIONAL MANAGEMENT", label: "Educational Management" },
      { value: "EDUCATIONAL LEADERSHIP", label: "Educational Leadership" },
      { value: "CURRICULUM AND INSTRUCTION", label: "Curriculum and Instruction" },
      { value: "ADMINISTRATION AND SUPERVISION", label: "Administration and Supervision" },
      { value: "GUIDANCE AND COUNSELING", label: "Guidance and Counseling" },
      { value: "EDUCATIONAL TECHNOLOGY", label: "Educational Technology" },
      { value: "MEASUREMENT AND EVALUATION", label: "Measurement and Evaluation" }
    ]
  },
  {
    group: "Other",
    options: [
      { value: "OTHER", label: "Other (Please Specify)" }
    ]
  }
];

export const DEPED_TEACHER_SPECIALIZATION_OPTIONS =
  DEPED_TEACHER_SPECIALIZATION_GROUPS.flatMap((g) => g.options);`;

fs.writeFileSync(file, before + '\n' + newValues + '\n' + after);
console.log('Success');
