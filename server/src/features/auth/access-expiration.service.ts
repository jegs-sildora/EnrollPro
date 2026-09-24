import { prisma } from "../../lib/prisma.js";

interface AccessExpirationRecord {
  id: number;
  isActive: boolean;
  accessExpirationDate: Date | null;
}

export function isContractAccessExpired(
  accessExpirationDate: Date | null,
  now = new Date(),
): boolean {
  return accessExpirationDate !== null && accessExpirationDate.getTime() < now.getTime();
}

export async function blockExpiredContractAccess(
  user: AccessExpirationRecord,
): Promise<boolean> {
  if (!isContractAccessExpired(user.accessExpirationDate)) {
    return false;
  }

  if (user.isActive) {
    await prisma.user.updateMany({
      where: { id: user.id, isActive: true },
      data: { isActive: false },
    });
  }

  return true;
}
