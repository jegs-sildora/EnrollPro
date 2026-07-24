import crypto from 'crypto';
import bcryptjs from 'bcryptjs';

/**
 * Generates a random 6-digit numeric PIN and its hash.
 */
export const generatePortalPin = (): { raw: string; hash: string } => {
	const raw = String(crypto.randomInt(0, 999_999)).padStart(6, '0');
	const hash = bcryptjs.hashSync(raw, 10);
	return { raw, hash };
};

