import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Recursively converts all string values in an object to uppercase and trims them.
 * Useful for ensuring uniform data entry in the database.
 */
export function toUpperCaseRecursive<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(v => toUpperCaseRecursive(v)) as unknown as T;
  } else if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = toUpperCaseRecursive((obj as any)[key]);
    }
    return newObj as T;
  } else if (typeof obj === 'string') {
    return obj.trim().toUpperCase() as unknown as T;
  }
  return obj;
}
