import { Sex } from "../../src/generated/prisma/index.js";

const FILIPINO_MALE_FIRST_NAMES = [
  "JUAN MIGUEL", "JOSE GABRIEL", "MARK ANGELO", "CARLO MIGUEL",
  "JOHN PAOLO", "MIGUEL ANDRE", "JOSHUA LUIS", "PAOLO BENJAMIN",
  "ANGELO RAFAEL", "CHRISTIAN PAUL", "JEROME ANTONIO", "NATHANIEL JOSE",
  "GABRIEL ENZO", "VINCENT LORENZO", "DANIEL MARTIN", "FRANCIS MIGUEL",
];

const FILIPINO_FEMALE_FIRST_NAMES = [
  "MARIA ANGELA", "ANNA PATRICIA", "CAMILLE JOY", "MARY GRACE",
  "JANELLA MARIE", "SOFIA ISABEL", "ANGELICA MAE", "BEATRIZ ANNE",
  "CLARISSE JOY", "DANIELA ROSE", "ELAINE MARIE", "FRANCESCA MAE",
  "GABRIELA LUZ", "HANNAH THERESE", "ISABELLA JOY", "KATRINA MAE",
];

const FILIPINO_SURNAMES = [
  "SANTOS", "REYES", "CRUZ", "GARCIA", "MENDOZA", "BAUTISTA",
  "NAVARRO", "RAMOS", "FLORES", "AQUINO", "CASTILLO", "DELA CRUZ",
  "VILLANUEVA", "FERNANDEZ", "DE LEON", "MERCADO", "SALAZAR",
  "VALDEZ", "AGUILAR", "DOMINGO",
];

export interface FilipinoName {
  firstName: string;
  middleName: string;
  lastName: string;
}

export function getFilipinoName(sex: Sex, index: number): FilipinoName {
  const firstNames = sex === Sex.MALE ? FILIPINO_MALE_FIRST_NAMES : FILIPINO_FEMALE_FIRST_NAMES;
  return {
    firstName: firstNames[index % firstNames.length],
    middleName: FILIPINO_SURNAMES[(index * 2 + 3) % FILIPINO_SURNAMES.length],
    lastName: FILIPINO_SURNAMES[(index * 3 + 1) % FILIPINO_SURNAMES.length],
  };
}

export function getFilipinoParentName(sex: Sex, index: number): FilipinoName {
  return getFilipinoName(sex, index + 7);
}

export function createLRNGenerator(year: number) {
  // Use the year to create a unique 12-digit LRN base.
  // e.g. year = 2026 -> 202600000000
  let lrnCounter = year * 100000000;
  return function generateLRN(): string {
    return (lrnCounter++).toString();
  };
}
