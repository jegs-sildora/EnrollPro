/**
 * Simplified WHO 2007 Growth Reference for 5-19 years
 * In a real application, this would be a full LMS table (Lambda-Mu-Sigma)
 * or a detailed Z-score lookup table for each month of age.
 * 
 * For this implementation, we use simplified thresholds for BMI-for-age (BAZ)
 * and Height-for-age (HAZ).
 */

export const WHO_BAZ_THRESHOLDS = {
  // BMI-for-age Z-score thresholds
  SEVERELY_WASTED: -3,
  WASTED: -2,
  NORMAL_MAX: 1,
  OVERWEIGHT: 2,
  OBESE: 3,
};

export const WHO_HAZ_THRESHOLDS = {
  // Height-for-age Z-score thresholds
  SEVERELY_STUNTED: -3,
  STUNTED: -2,
  NORMAL_MAX: 3,
  TALL: 3,
};

// Simplified "Normal" values for age and sex to calculate approximate Z-scores
// Median BMI and Height for ages 5-19 (simplified)
export const WHO_MEDIANS: Record<string, { age: number; maleBmi: number; femaleBmi: number; maleHeight: number; femaleHeight: number }> = {
  "5": { age: 5, maleBmi: 15.3, femaleBmi: 15.2, maleHeight: 110.0, femaleHeight: 109.4 },
  "6": { age: 6, maleBmi: 15.3, femaleBmi: 15.3, maleHeight: 116.0, femaleHeight: 115.1 },
  "7": { age: 7, maleBmi: 15.4, femaleBmi: 15.4, maleHeight: 121.7, femaleHeight: 120.8 },
  "8": { age: 8, maleBmi: 15.7, femaleBmi: 15.7, maleHeight: 127.3, femaleHeight: 126.4 },
  "9": { age: 9, maleBmi: 16.0, femaleBmi: 16.1, maleHeight: 132.6, femaleHeight: 132.2 },
  "10": { age: 10, maleBmi: 16.6, femaleBmi: 16.6, maleHeight: 137.8, femaleHeight: 138.6 },
  "11": { age: 11, maleBmi: 17.2, femaleBmi: 17.4, maleHeight: 143.1, femaleHeight: 145.0 },
  "12": { age: 12, maleBmi: 17.9, femaleBmi: 18.2, maleHeight: 149.1, femaleHeight: 151.2 },
  "13": { age: 13, maleBmi: 18.8, femaleBmi: 19.1, maleHeight: 156.0, femaleHeight: 156.7 },
  "14": { age: 14, maleBmi: 19.6, femaleBmi: 19.9, maleHeight: 163.2, femaleHeight: 160.4 },
  "15": { age: 15, maleBmi: 20.4, femaleBmi: 20.6, maleHeight: 169.0, femaleHeight: 162.1 },
  "16": { age: 16, maleBmi: 21.1, femaleBmi: 21.2, maleHeight: 172.9, femaleHeight: 163.1 },
  "17": { age: 17, maleBmi: 21.8, femaleBmi: 21.7, maleHeight: 175.4, femaleHeight: 163.6 },
  "18": { age: 18, maleBmi: 22.4, femaleBmi: 22.0, maleHeight: 176.8, femaleHeight: 163.9 },
  "19": { age: 19, maleBmi: 23.0, femaleBmi: 22.4, maleHeight: 177.3, femaleHeight: 164.1 },
};
