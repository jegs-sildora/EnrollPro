import { AppError } from "./AppError.js";

/**
 * Returns the authentication headers required to securely communicate with the ATLAS API.
 * @param requireAuth If true, an AppError is thrown when the ATLAS_API_KEY is unset.
 */
export function getAtlasHeaders(requireAuth = false): Record<string, string> {
  const key = process.env.ATLAS_API_KEY?.trim();
  
  if (requireAuth && !key) {
    throw new AppError(
      500,
      "ATLAS integration key (ATLAS_API_KEY) must be configured in server/.env.",
    );
  }

  return key ? { Authorization: `Bearer ${key}`, "X-Integration-Key": key } : {};
}
