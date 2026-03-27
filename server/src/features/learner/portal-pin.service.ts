import crypto from "crypto";
import bcryptjs from "bcryptjs";

/**
 * Generates a random 6-digit numeric PIN and its hash.
 */
export const generatePortalPin = (): { raw: string; hash: string } => {
  const raw = String(crypto.randomInt(0, 999_999)).padStart(6, '0');
  const hash = bcryptjs.hashSync(raw, 10);
  return { raw, hash };
};

/**
 * Hashes a PIN for storage in the database (if needed separately).
 */
export const hashPin = async (pin: string): Promise<string> => {
  return bcryptjs.hash(pin, 10);
};

/**
 * Verifies a PIN against a hashed PIN.
 */
export const verifyPin = async (pin: string, hash: string): Promise<boolean> => {
  return bcryptjs.compare(pin, hash);
};
