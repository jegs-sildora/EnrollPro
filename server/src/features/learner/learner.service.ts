import bcrypt from "bcryptjs";

interface LearnerAccountStore {
  learner: {
    findUnique(args: {
      where: { id: number };
      select: { userId: true };
    }): Promise<{ userId: number | null } | null>;
    update(args: {
      where: { id: number };
      data: { userId: number };
    }): Promise<unknown>;
  };
  user: {
    findUnique(args: {
      where: { accountName: string };
      select: { id: true };
    }): Promise<{ id: number } | null>;
    update(args: {
      where: { id: number };
      data: { accountName: string };
    }): Promise<unknown>;
    create(args: {
      data: {
        firstName: string;
        lastName: string;
        accountName: string;
        password: string;
        roles: ["LEARNER"];
        mustChangePassword: false;
        sex: "MALE" | "FEMALE";
        isActive: true;
      };
      select: { id: true };
    }): Promise<{ id: number }>;
  };
}

/**
 * Ensures a Learner has a corresponding User record in the users table.
 * Uses LRN as accountName if available, otherwise falls back to a temporary format.
 * Default password is 'DepEd2026!' and must be changed on first login.
 */
export async function ensureLearnerUserAccount(
  tx: LearnerAccountStore,
  learner: {
    id: number;
    firstName: string;
    lastName: string;
    lrn: string | null;
    sex: "MALE" | "FEMALE";
  },
) {
  // 1. Check if user account already linked
  const existingLearner = await tx.learner.findUnique({
    where: { id: learner.id },
    select: { userId: true },
  });

  const desiredAccountName = learner.lrn ? `LRN-${learner.lrn}` : `LEARNER-${learner.id}`;

  if (existingLearner?.userId) {
    // If linked, ensure accountName is updated if LRN was recently assigned
    await tx.user.update({
      where: { id: existingLearner.userId },
      data: { accountName: desiredAccountName },
    });
    return existingLearner.userId;
  }

  // 2. Check if a User with the desired accountName already exists (might be unlinked)
  const existingUser = await tx.user.findUnique({
    where: { accountName: desiredAccountName },
    select: { id: true },
  });

  if (existingUser) {
    // Link existing user to learner
    await tx.learner.update({
      where: { id: learner.id },
      data: { userId: existingUser.id },
    });
    return existingUser.id;
  }

  // 3. Create new User account
  const defaultPasswordHash = await bcrypt.hash("DepEd2026!", 12);
  const newUser = await tx.user.create({
    data: {
      firstName: learner.firstName.trim(),
      lastName: learner.lastName.trim(),
      accountName: desiredAccountName,
      password: defaultPasswordHash,
      roles: ["LEARNER"],
      mustChangePassword: false,
      sex: (learner.sex as "MALE" | "FEMALE") || "FEMALE",
      isActive: true,
    },
    select: { id: true },
  });

  // 5. Link new user to learner
  await tx.learner.update({
    where: { id: learner.id },
    data: { userId: newUser.id },
  });

  return newUser.id;
}
