import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import {
  type Prisma,
  LearnerStatus,
  Role,
} from "../../generated/prisma/index.js";
import { getDesignationPool } from "@enrollpro/shared";

function getUniqueConstraintFields(error: unknown): string[] {
  if (!error || typeof error !== "object") return [];

  const prismaError = error as {
    code?: string;
    meta?: { target?: unknown };
  };

  if (prismaError.code !== "P2002") return [];

  const target = prismaError.meta?.target;
  if (Array.isArray(target)) return target.map((field) => String(field));
  if (typeof target === "string") return [target];

  return [];
}

export async function index(req: Request, res: Response) {
  try {
    const {
      role,
      isActive,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = "1",
      limit = "20",
      gradeLevelId,
      sectionId,
      learnerStatus,
      tab, // Support explicit tab parameter
    } = req.query;

    const pageNumber = Math.max(1, parseInt(String(page), 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(String(limit), 10) || 20),
    );
    const skip = (pageNumber - 1) * pageSize;

    const normalizedSearch = String(search ?? "").trim();
    const safeSortOrder = String(sortOrder) === "asc" ? "asc" : "desc";

    // Priority 1: Check if we are explicitly in Learner Mode
    const isLearnerMode =
      String(role).toUpperCase() === "LEARNER" || tab === "learners";

    if (isLearnerMode) {
      const learnerWhere: Prisma.LearnerWhereInput = {};

      if (learnerStatus && learnerStatus !== "all") {
        learnerWhere.status = String(learnerStatus) as LearnerStatus;
      }

      if (gradeLevelId && gradeLevelId !== "all") {
        learnerWhere.enrollmentApplications = {
          some: { gradeLevelId: parseInt(String(gradeLevelId), 10) },
        };
      }

      if (sectionId && sectionId !== "all") {
        learnerWhere.enrollmentApplications = {
          some: {
            enrollmentRecord: { sectionId: parseInt(String(sectionId), 10) },
          },
        };
      }

      if (normalizedSearch) {
        if (normalizedSearch.includes(",")) {
          const parts = normalizedSearch.split(",");
          const lastNamePart = parts[0].trim();
          const firstNameRaw = (parts[1] || "").trim();
          // Take only the first word to ignore middle initials (e.g. "RAMON R." → "RAMON")
          const firstNamePart = firstNameRaw.split(/\s+/)[0] || firstNameRaw;
          learnerWhere.AND = [
            { lastName: { contains: lastNamePart, mode: "insensitive" } },
            { firstName: { contains: firstNamePart, mode: "insensitive" } },
          ];
        } else {
          learnerWhere.OR = [
            { firstName: { contains: normalizedSearch, mode: "insensitive" } },
            { lastName: { contains: normalizedSearch, mode: "insensitive" } },
            { lrn: { contains: normalizedSearch, mode: "insensitive" } },
          ];
        }
      }

      const [learners, total] = await Promise.all([
        prisma.learner.findMany({
          where: learnerWhere,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                isActive: true,
                lastLoginAt: true,
              },
            },
            enrollmentApplications: {
              take: 1,
              orderBy: { createdAt: "desc" },
              include: {
                gradeLevel: true,
                enrollmentRecord: {
                  include: { section: true },
                },
              },
            },
          },
          orderBy: {
            lastName: safeSortOrder,
          },
          skip,
          take: pageSize,
        }),
        prisma.learner.count({ where: learnerWhere }),
      ]);

      // Map Learners to a User-compatible structure for the frontend
      const mappedUsers = learners.map((l) => {
        const currentApp = l.enrollmentApplications?.[0];
        return {
          id: l.user?.id || -l.id,
          firstName: l.firstName,
          lastName: l.lastName,
          middleName: l.middleName || null,
          suffix: l.extensionName || null,
          sex: l.sex,
          email: l.user?.email ?? "",
          role: "LEARNER",
          roles: ["LEARNER"],
          isActive: l.user?.isActive ?? false,
          lastLoginAt: l.user?.lastLoginAt || null,
          createdAt: l.createdAt.toISOString(),
          learnerProfile: {
            lrn: l.lrn,
            status: l.status,
            enrollmentApplications: l.enrollmentApplications.map((app) => ({
              gradeLevel: app.gradeLevel,
              enrollmentRecord: app.enrollmentRecord,
              portalPin: app.portalPin, // EXPOSE PORTAL PIN
              isPinPersonalized: !!app.portalPinChangedAt, // Add this
            })),
          },
        };
      });

      return res.json({
        users: mappedUsers,
        total,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        sortBy: "lastName",
        sortOrder: safeSortOrder,
      });
    }

    // Staff Mode: Query User table primarily
    const allowedSortFields = new Set([
      "lastName",
      "designation",
      "email",
      "roles",
      "isActive",
      "lastLoginAt",
      "createdAt",
    ]);
    const safeSortBy = allowedSortFields.has(String(sortBy))
      ? String(sortBy)
      : "createdAt";

    const where: Prisma.UserWhereInput = {};
    if (role && role !== "all") {
      const requestedRole = String(role).toUpperCase() as Role;
      if (requestedRole === "TEACHER") {
        where.roles = { hasSome: ["TEACHER", "CLASS_ADVISER"] };
      } else {
        where.roles = { has: requestedRole };
      }
    } else {
      // Exclude learners when fetching "all staff"
      where.roles = {
        hasSome: ["SYSTEM_ADMIN", "HEAD_REGISTRAR", "CLASS_ADVISER", "TEACHER", "MRF"],
      };
    }

    if (isActive !== undefined) where.isActive = String(isActive) === "true";

    if (normalizedSearch) {
      where.OR = [
        { firstName: { contains: normalizedSearch, mode: "insensitive" } },
        { lastName: { contains: normalizedSearch, mode: "insensitive" } },
        { email: { contains: normalizedSearch, mode: "insensitive" } },
        { employeeId: { contains: normalizedSearch, mode: "insensitive" } },
        { designation: { contains: normalizedSearch, mode: "insensitive" } },
        { mobileNumber: { contains: normalizedSearch, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          suffix: true,
          sex: true,
          employeeId: true,
          designation: true,
          mobileNumber: true,
          email: true,
          roles: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          createdBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { [safeSortBy]: safeSortOrder },
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      total,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      sortBy: safeSortBy,
      sortOrder: safeSortOrder,
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
}

export async function store(req: Request, res: Response) {
  try {
    const {
      firstName,
      lastName,
      middleName,
      suffix,
      sex,
      employeeId,
      designation,
      mobileNumber,
      email,
      password,
      roles,
      mustChangePassword = true,
      department,
      accountName,
    } = req.body;

    // Normalize empty strings to null for optional unique/nullable fields
    const cleanEmployeeId = employeeId?.trim() || null;
    const cleanDeptCode = department
      ? String(department).trim().toUpperCase()
      : null;
    const cleanMiddleName = middleName?.trim() || null;
    const cleanSuffix = suffix?.trim() || null;
    const cleanDesignation = designation?.trim() || null;
    const cleanMobileNumber = mobileNumber?.trim() || null;
    const cleanEmail = email?.trim() || null;
    const cleanAccountName = accountName?.trim() || null;

    if (cleanDesignation && roles && Array.isArray(roles)) {
      const allowedPool = getDesignationPool(roles);
      if (allowedPool.length > 0 && !allowedPool.includes(cleanDesignation.toUpperCase())) {
        return res.status(400).json({
          message: "Invalid Plantilla position for the provided roles. Bypassed UI restriction detected.",
          field: "designation",
          code: "INVALID_DESIGNATION_FOR_ROLE",
        });
      }
    }

    // Pre-check for unique conflicts before attempting the insert.
    // The users table has 3 unique constraints (email, employee_id, account_name).
    // PostgreSQL may fire any of them; catching by constraint name is fragile,
    // so we detect conflicts explicitly here to return clear 409 errors.
    const orClauses: object[] = [];
    if (cleanEmail) orClauses.push({ email: cleanEmail });
    if (cleanEmployeeId) {
      orClauses.push({ employeeId: cleanEmployeeId });
    }
    const finalAccountName = cleanAccountName || cleanEmployeeId || null;
    if (finalAccountName) {
      orClauses.push({ accountName: finalAccountName });
    }
    if (orClauses.length > 0) {
      const existing = await prisma.user.findFirst({
        where: { OR: orClauses },
        select: { email: true, employeeId: true, accountName: true },
      });
      if (existing) {
        if (cleanEmail && existing.email === cleanEmail) {
          return res.status(409).json({
            message: "Email address is already in use by another account.",
            field: "email",
            code: "DUPLICATE_EMAIL",
          });
        }
        return res.status(409).json({
          message: "Employee ID is already in use by another account.",
          field: "employeeId",
          code: "DUPLICATE_EMPLOYEE_ID",
        });
      }
    }

    const hashed = await bcrypt.hash(password, 12);



    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          middleName: cleanMiddleName,
          suffix: cleanSuffix,
          sex: (sex as "MALE" | "FEMALE") ?? "FEMALE",
          employeeId: cleanEmployeeId,
          accountName: finalAccountName,
          designation: cleanDesignation,
          mobileNumber: cleanMobileNumber,
          email: cleanEmail,
          password: hashed,
          roles,
          mustChangePassword,
          createdById: req.user!.userId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          roles: true,
          isActive: true,
          mustChangePassword: true,
          sex: true,
        },
      });

      const isStaffRole = roles && Array.isArray(roles) && !roles.includes("LEARNER");

      if (isStaffRole && cleanEmployeeId) {
        const teacherEmail =
          cleanEmail || `${cleanEmployeeId}@noemail.deped.local`;
        await tx.teacher.upsert({
          where: { employeeId: cleanEmployeeId },
          create: {
            employeeId: cleanEmployeeId,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            middleName: cleanMiddleName,
            sex: (sex as "MALE" | "FEMALE") ?? "FEMALE",
            email: teacherEmail,
            contactNumber: cleanMobileNumber,
            designation: cleanDesignation,
            isActive: true,
            user: { connect: { id: created.id } },
            ...(cleanDeptCode
              ? { department: { connect: { code: cleanDeptCode } } }
              : {}),
          },
          update: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            middleName: cleanMiddleName,
            sex: (sex as "MALE" | "FEMALE") ?? "FEMALE",
            email: teacherEmail,
            contactNumber: cleanMobileNumber,
            designation: cleanDesignation,
            isActive: true,
            user: { connect: { id: created.id } },
            ...(cleanDeptCode
              ? { department: { connect: { code: cleanDeptCode } } }
              : {}),
          },
        });
      }

      return created;
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "ADMIN_USER_CREATED",
      description: `Admin created account: ${lastName}, ${firstName} (${roles.join(', ')})`,
      subjectType: "User",
      recordId: user.id,
      req,
    });

    res.status(201).json(user);
  } catch (error: unknown) {
    console.error("[admin/users store] Error:", error);
    const uniqueFields = getUniqueConstraintFields(error);
    if (uniqueFields.some((field) => field.toLowerCase().includes("email"))) {
      return res.status(409).json({
        message: "Email address is already in use by another account.",
        field: "email",
        code: "DUPLICATE_EMAIL",
      });
    }
    if (
      uniqueFields.some(
        (field) =>
          field.toLowerCase().includes("employee") ||
          field.toLowerCase().includes("account_name"),
      )
    ) {
      return res.status(409).json({
        message: "Employee ID is already in use by another account.",
        field: "employeeId",
        code: "DUPLICATE_EMPLOYEE_ID",
      });
    }

    const errMsg =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    res.status(500).json({ message: errMsg });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const {
      firstName,
      lastName,
      middleName,
      suffix,
      sex,
      employeeId,
      designation,
      mobileNumber,
      email,
      roles,
      department,
      accountName,
      isActive,
      password,
    } = req.body;
    const userId = parseInt(String(req.params.id));

    let targetUser = await prisma.user.findUnique({ where: { id: userId } });

    if (!targetUser && userId < 0) {
      const learnerId = Math.abs(userId);
      const learner = await prisma.learner.findUnique({
        where: { id: learnerId },
        select: {
          id: true, firstName: true, lastName: true,
          middleName: true, extensionName: true, sex: true, lrn: true,
        },
      });
      if (!learner) return res.status(404).json({ message: "Learner not found" });

      const generatedPassword = password || "DepEd2026!";
      const hashedPw = await bcrypt.hash(generatedPassword, 12);

      targetUser = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            firstName: firstName || learner.firstName,
            lastName: lastName || learner.lastName,
            middleName: middleName || learner.middleName,
            suffix: suffix || learner.extensionName,
            sex: sex || learner.sex,
            password: hashedPw,
            roles: roles || ["LEARNER"],
            isActive: isActive !== undefined ? isActive : false,
            mustChangePassword: true,
            createdById: req.user!.userId,
          },
        });

        await tx.learner.update({
          where: { id: learnerId },
          data: { userId: created.id },
        });

        return created;
      });
    }

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const cleanDeptCode = department
      ? String(department).trim().toUpperCase()
      : null;

    const effectiveRoles = roles || targetUser.roles;

    if (designation && effectiveRoles && Array.isArray(effectiveRoles)) {
      const allowedPool = getDesignationPool(effectiveRoles);
      if (allowedPool.length > 0 && !allowedPool.includes(designation.trim().toUpperCase())) {
        return res.status(400).json({
          message: "Invalid Plantilla position for the provided roles. Bypassed UI restriction detected.",
          field: "designation",
          code: "INVALID_DESIGNATION_FOR_ROLE",
        });
      }
    }

    const hashed = password ? await bcrypt.hash(password, 12) : undefined;

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetUser.id },
        data: {
          firstName,
          lastName,
          middleName,
          suffix,
          ...(sex !== undefined &&
            sex !== null && { sex: sex as "MALE" | "FEMALE" }),
          employeeId,
          accountName: accountName || employeeId || null,
          designation,
          mobileNumber,
          email,
          ...(roles ? { roles } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
          ...(hashed ? { password: hashed, mustChangePassword: true } : {}),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          email: true,
          mobileNumber: true,
          designation: true,
          roles: true,
          isActive: true,
          sex: true,
        },
      });

      const isStaffRole = effectiveRoles && Array.isArray(effectiveRoles) && !effectiveRoles.includes("LEARNER");
      const effectiveEmployeeId = employeeId || targetUser.employeeId;

      if (isStaffRole && effectiveEmployeeId) {
        const teacherEmail =
          updated.email || `${effectiveEmployeeId}@noemail.deped.local`;
        await tx.teacher.upsert({
          where: { employeeId: effectiveEmployeeId },
          create: {
            employeeId: effectiveEmployeeId,
            firstName: updated.firstName,
            lastName: updated.lastName,
            middleName: updated.middleName,
            sex: updated.sex as "MALE" | "FEMALE",
            email: teacherEmail,
            contactNumber: updated.mobileNumber,
            designation: updated.designation,
            isActive: true,
            user: { connect: { id: updated.id } },
            ...(cleanDeptCode
              ? { department: { connect: { code: cleanDeptCode } } }
              : {}),
          },
          update: {
            firstName: updated.firstName,
            lastName: updated.lastName,
            middleName: updated.middleName,
            sex: updated.sex as "MALE" | "FEMALE",
            email: teacherEmail,
            contactNumber: updated.mobileNumber,
            designation: updated.designation,
            ...(isActive !== undefined ? { isActive } : {}),
            user: { connect: { id: updated.id } },
            ...(cleanDeptCode
              ? { department: { connect: { code: cleanDeptCode } } }
              : {}),
          },
        });
      }

      if (targetUser.roles.includes("LEARNER")) {
        await tx.learner.updateMany({
          where: { userId: updated.id },
          data: {
            firstName,
            lastName,
            middleName: middleName || null,
            sex:
              (sex as "MALE" | "FEMALE") ?? (updated.sex as "MALE" | "FEMALE"),
          },
        });
      }

      return updated;
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "ADMIN_USER_UPDATED",
      description: `Admin updated account: ${targetUser.lastName}, ${targetUser.firstName}`,
      subjectType: "User",
      recordId: targetUser.id,
      req,
    });

    res.json(user);
  } catch (error: unknown) {
    console.error("[admin/users update] Error:", error);
    const uniqueFields = getUniqueConstraintFields(error);
    if (uniqueFields.some((field) => field.toLowerCase().includes("email"))) {
      return res.status(409).json({
        message: "Email address is already in use by another account.",
        field: "email",
        code: "DUPLICATE_EMAIL",
      });
    }
    if (
      uniqueFields.some((field) => field.toLowerCase().includes("employee"))
    ) {
      return res.status(409).json({
        message: "Employee ID is already in use by another account.",
        field: "employeeId",
        code: "DUPLICATE_EMPLOYEE_ID",
      });
    }

    const errMsg =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    res.status(500).json({ message: errMsg });
  }
}

export async function deactivate(req: Request, res: Response) {
  try {
    const userId = parseInt(String(req.params.id));

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    if (targetUser.roles.includes("SYSTEM_ADMIN")) {
      return res.status(400).json({
        message:
          "SYSTEM_ADMIN accounts cannot be deactivated to prevent system lockout.",
      });
    }

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { isActive: false },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          roles: true,
          employeeId: true,
        },
      });

      if (updated.employeeId) {
        await tx.teacher.updateMany({
          where: { employeeId: updated.employeeId },
          data: { isActive: false },
        });
      }

      return updated;
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "ADMIN_USER_DEACTIVATED",
      description: `Admin deactivated account: ${user.lastName}, ${user.firstName} (${user.roles.join(', ')})`,
      subjectType: "User",
      recordId: userId,
      req,
    });

    res.json(user);
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
}

export async function reactivate(req: Request, res: Response) {
  try {
    const userId = parseInt(String(req.params.id));

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          roles: true,
          employeeId: true,
        },
      });

      if (updated.employeeId) {
        await tx.teacher.updateMany({
          where: { employeeId: updated.employeeId },
          data: { isActive: true },
        });
      }

      return updated;
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "ADMIN_USER_REACTIVATED",
      description: `Admin reactivated account: ${user.lastName}, ${user.firstName} (${user.roles.join(', ')})`,
      subjectType: "User",
      recordId: userId,
      req,
    });

    res.json(user);
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
}

export async function learnerResetPassword(req: Request, res: Response) {
  try {
    const { new_password_string } = req.body;
    const userId = parseInt(String(req.params.id));

    if (!new_password_string || typeof new_password_string !== "string" || new_password_string.length < 1) {
      res.status(400).json({ message: "new_password_string is required" });
      return;
    }

    const learner = await prisma.learner.findUnique({
      where: { userId },
      select: { id: true, firstName: true, lastName: true, lrn: true },
    });

    if (!learner) {
      res.status(404).json({ message: "Learner not found for this user" });
      return;
    }

    const hashed = await bcrypt.hash(new_password_string, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { password: hashed, mustChangePassword: true },
      }),
      prisma.schoolSetting.updateMany({
        data: { globalDefaultPassword: new_password_string },
      }),
    ]);

    await auditLog({
      userId: req.user!.userId,
      actionType: "ADMIN_PASSWORD_RESET",
      description: `Admin reset password for learner: ${learner.lastName}, ${learner.firstName} (LRN: ${learner.lrn}) and updated global default password`,
      subjectType: "Learner",
      recordId: learner.id,
      req,
    });

    res.json({ message: "Learner password reset and global default updated successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { newPassword, mustChangePassword = true } = req.body;
    const userId = parseInt(String(req.params.id));

    const password = newPassword || "DepEd2026!";
    const hashed = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { password: hashed, mustChangePassword: true },
      select: { id: true, firstName: true, lastName: true, roles: true },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "ADMIN_PASSWORD_RESET",
      description: `Admin reset password for: ${user.lastName}, ${user.firstName}`,
      subjectType: "User",
      recordId: userId,
      req,
    });

    res.json({ message: "Password reset successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
}

export async function metrics(_req: Request, res: Response) {
  try {
    const [totalActiveStaff, pendingUnverified, lockedDeactivated] =
      await Promise.all([
        prisma.user.count({
          where: {
            isActive: true,
            roles: { hasSome: ["SYSTEM_ADMIN", "HEAD_REGISTRAR", "CLASS_ADVISER", "TEACHER", "MRF"] },
          },
        }),
        prisma.user.count({
          where: {
            roles: { hasSome: ["SYSTEM_ADMIN", "HEAD_REGISTRAR", "CLASS_ADVISER", "TEACHER", "MRF"] },
            OR: [{ mustChangePassword: true }, { lastLoginAt: null }],
          },
        }),
        prisma.user.count({
          where: {
            isActive: false,
            roles: { hasSome: ["SYSTEM_ADMIN", "HEAD_REGISTRAR", "CLASS_ADVISER", "TEACHER", "MRF"] },
          },
        }),
      ]);

    res.json({
      totalActiveStaff,
      pendingUnverified,
      lockedDeactivated,
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
}
