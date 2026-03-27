const MANILA_TIME_ZONE = "Asia/Manila";

function utcNoonDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0, 0));
}

function getDatePartsInTimeZone(date: Date, timeZone = MANILA_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const lookup = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
  };
}

export function normalizeDateToUtcNoon(date: Date): Date {
  const { year, month, day } = getDatePartsInTimeZone(date);
  return utcNoonDate(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function subDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export function firstMondayOfJune(year: number): Date {
  const june1 = utcNoonDate(year, 5, 1);
  if (june1.getUTCDay() === 1) return june1;
  let d = june1;
  while (d.getUTCDay() !== 1) {
    d = addDays(d, 1);
  }
  return d;
}

export function lastSaturdayOfJanuary(year: number): Date {
  const jan31 = utcNoonDate(year, 0, 31);
  if (jan31.getUTCDay() === 6) return jan31;
  let d = jan31;
  while (d.getUTCDay() !== 6) {
    d = subDays(d, 1);
  }
  return d;
}

export function lastFridayOfFebruary(year: number): Date {
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const febLast = utcNoonDate(year, 1, isLeapYear ? 29 : 28);
  if (febLast.getUTCDay() === 5) return febLast;
  let d = febLast;
  while (d.getUTCDay() !== 5) {
    d = subDays(d, 1);
  }
  return d;
}

export function deriveSchoolYearScheduleFromOpeningDate(
  classOpeningDate: Date,
  classEndTemplate?: Date,
) {
  const normalizedOpeningDate = normalizeDateToUtcNoon(classOpeningDate);
  const startYear = normalizedOpeningDate.getUTCFullYear();
  const endYear = startYear + 1;

  const normalizedClassEndTemplate = classEndTemplate
    ? normalizeDateToUtcNoon(classEndTemplate)
    : utcNoonDate(endYear, 2, 31);

  const classEndDate = utcNoonDate(
    endYear,
    normalizedClassEndTemplate.getUTCMonth(),
    normalizedClassEndTemplate.getUTCDate(),
  );

  const earlyRegOpenDate = lastSaturdayOfJanuary(startYear);
  const earlyRegCloseDate = lastFridayOfFebruary(startYear);
  const enrollOpenDate = subDays(normalizedOpeningDate, 7);
  const enrollCloseDate = subDays(normalizedOpeningDate, 1);

  return {
    yearLabel: `${startYear}-${endYear}`,
    classOpeningDate: normalizedOpeningDate,
    classEndDate,
    earlyRegOpenDate,
    earlyRegCloseDate,
    enrollOpenDate,
    enrollCloseDate,
  };
}

export function deriveNextSchoolYear(today: Date) {
  const { year: currentYear, month: currentMonth } =
    getDatePartsInTimeZone(today);
  const currentSchoolStartYear =
    currentMonth >= 6 ? currentYear : currentYear - 1;
  const nextStartYear = currentSchoolStartYear + 1;

  return deriveSchoolYearScheduleFromOpeningDate(
    firstMondayOfJune(nextStartYear),
    utcNoonDate(nextStartYear + 1, 2, 31),
  );
}
