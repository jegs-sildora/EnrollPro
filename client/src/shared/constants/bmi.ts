import { WHO_BAZ_THRESHOLDS, WHO_HAZ_THRESHOLDS, WHO_MEDIANS } from "../constants/whoGrowthReference";

export interface BmiResult {
  bmi: number;
  category: string;
  color: string;
}

export interface HfaResult {
  category: string;
  color: string;
}

/**
 * Computes BMI and nutritional status classification
 * Formula: BMI = weightKg / ((heightCm / 100) ^ 2)
 */
export function computeBmi(weightKg: number, heightCm: number, ageYears: number, sex: "Male" | "Female"): BmiResult {
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const roundedBmi = Math.round(bmi * 10) / 10;

  // For school-age children (5-19), we use BAZ (BMI-for-age Z-score)
  // This is a simplified Z-score approximation
  const ageStr = Math.max(5, Math.min(19, Math.floor(ageYears))).toString();
  const medianBmi = sex === "Male" ? WHO_MEDIANS[ageStr].maleBmi : WHO_MEDIANS[ageStr].femaleBmi;
  
  // Very rough Z-score approximation: (Value - Median) / SD
  // Assuming a simplified SD of 2.0 for BMI
  const baz = (bmi - medianBmi) / 2.0;

  let category = "Normal";
  let color = "green";

  if (baz < WHO_BAZ_THRESHOLDS.SEVERELY_WASTED) {
    category = "Severely Wasted";
    color = "red";
  } else if (baz < WHO_BAZ_THRESHOLDS.WASTED) {
    category = "Wasted";
    color = "orange";
  } else if (baz > WHO_BAZ_THRESHOLDS.OBESE) {
    category = "Obese";
    color = "red";
  } else if (baz > WHO_BAZ_THRESHOLDS.OVERWEIGHT) {
    category = "Overweight";
    color = "orange";
  }

  return { bmi: roundedBmi, category, color };
}

/**
 * Computes Height-for-Age (HFA) classification
 */
export function computeHfa(heightCm: number, ageYears: number, sex: "Male" | "Female"): HfaResult {
  const ageStr = Math.max(5, Math.min(19, Math.floor(ageYears))).toString();
  const medianHeight = sex === "Male" ? WHO_MEDIANS[ageStr].maleHeight : WHO_MEDIANS[ageStr].femaleHeight;
  
  // Very rough Z-score approximation: (Value - Median) / SD
  // Assuming a simplified SD of 6.0 for Height
  const haz = (heightCm - medianHeight) / 6.0;

  let category = "Normal";
  let color = "green";

  if (haz < WHO_HAZ_THRESHOLDS.SEVERELY_STUNTED) {
    category = "Severely Stunted";
    color = "red";
  } else if (haz < WHO_HAZ_THRESHOLDS.STUNTED) {
    category = "Stunted";
    color = "orange";
  } else if (haz > WHO_HAZ_THRESHOLDS.TALL) {
    category = "Tall";
    color = "blue";
  }

  return { category, color };
}
