import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { v4 as uuidv4 } from "uuid";
import PDFDocument from "pdfkit";
import bcrypt from "bcryptjs";
import { Ecosystem, SyncStatus, ApplicationStatus, Prisma } from "../../generated/prisma/index.js";

// In-memory job queue for this prototype
interface SyncJob {
  id: string;
  total: number;
  processed: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  results: Array<{ id: number; type: string; success: boolean; error?: string }>;
  createdAt: Date;
}

const syncJobs = new Map<string, SyncJob>();

/**
 * Get sync status for all entities (Learners, Teachers, Users)
 */
export async function getEcosystemSyncStatus(req: Request, res: Response): Promise<void> {
  const type = req.query.type as string || "LEARNER"; // LEARNER, TEACHER, USER
  const gradeLevelId = req.query.gradeLevelId ? parseInt(req.query.gradeLevelId as string) : undefined;
  const search = req.query.search as string;
  const statusFilter = req.query.status as string;
  
  const page = req.query.page ? parseInt(req.query.page as string) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const skip = (page - 1) * limit;

  try {
    if (type === "LEARNER") {
      const where: Prisma.LearnerWhereInput = {
        enrollmentApplications: {
          some: {
            status: { in: [ApplicationStatus.ENROLLED, ApplicationStatus.OFFICIALLY_ENROLLED] },
            ...(gradeLevelId ? { gradeLevelId } : {})
          }
        }
      };

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { lrn: { contains: search, mode: "insensitive" } }
        ];
      }

      if (statusFilter && statusFilter !== "all") {
        where.ecosystemSyncStatuses = {
          some: {
            status: statusFilter.toUpperCase() as SyncStatus
          }
        };
      }

      const [total, learners] = await Promise.all([
        prisma.learner.count({ where }),
        prisma.learner.findMany({
          where,
          include: {
            ecosystemSyncStatuses: true,
            enrollmentApplications: {
              where: { status: { in: [ApplicationStatus.ENROLLED, ApplicationStatus.OFFICIALLY_ENROLLED] } },
              include: {
                gradeLevel: true,
                enrollmentRecord: {
                  include: {
                    section: true
                  }
                }
              },
              take: 1
            }
          },
          orderBy: { lastName: "asc" },
          skip,
          take: limit
        })
      ]);

      const data = learners.map(l => ({
        id: l.id,
        name: `${l.lastName}, ${l.firstName}`,
        identifier: l.lrn,
        type: "LEARNER",
        grade: l.enrollmentApplications[0]?.gradeLevel?.name,
        section: l.enrollmentApplications[0]?.enrollmentRecord?.section?.name,
        syncStatuses: l.ecosystemSyncStatuses
      }));

      // Calculate pending/failed count for delta sync (total across all records)
      const ecosystems: Ecosystem[] = [Ecosystem.SMART, Ecosystem.AIMS];
      const pendingCount = await prisma.learner.count({
        where: {
          enrollmentApplications: { some: { status: { in: [ApplicationStatus.ENROLLED, ApplicationStatus.OFFICIALLY_ENROLLED] } } },
          OR: ecosystems.map(e => ({
            NOT: {
              ecosystemSyncStatuses: {
                some: { ecosystem: e, status: SyncStatus.SYNCED }
              }
            }
          }))
        }
      });

      res.json({
        data,
        meta: { 
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          pendingCount 
        }
      });
    } else if (type === "TEACHER") {
      const where: Prisma.TeacherWhereInput = {};

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { employeeId: { contains: search, mode: "insensitive" } }
        ];
      }

      if (statusFilter && statusFilter !== "all") {
        where.ecosystemSyncStatuses = {
          some: {
            status: statusFilter.toUpperCase() as SyncStatus
          }
        };
      }

      const [total, teachers] = await Promise.all([
        prisma.teacher.count({ where }),
        prisma.teacher.findMany({
          where,
          include: {
            ecosystemSyncStatuses: true
          },
          orderBy: { lastName: "asc" },
          skip,
          take: limit
        })
      ]);

      const data = teachers.map(t => ({
        id: t.id,
        name: `${t.lastName}, ${t.firstName}`,
        identifier: t.employeeId,
        type: "TEACHER",
        syncStatuses: t.ecosystemSyncStatuses
      }));

      const ecosystems: Ecosystem[] = [Ecosystem.ATLAS, Ecosystem.SMART, Ecosystem.AIMS];
      const pendingCount = await prisma.teacher.count({
        where: {
          OR: ecosystems.map(e => ({
            NOT: {
              ecosystemSyncStatuses: {
                some: { ecosystem: e, status: SyncStatus.SYNCED }
              }
            }
          }))
        }
      });

      res.json({
        data,
        meta: { 
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          pendingCount 
        }
      });
    } else {
      res.status(400).json({ error: "Invalid type" });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Trigger sync for selected entities
 */
export async function triggerSync(req: Request, res: Response): Promise<void> {
  const { ids, type, deltaOnly } = req.body; // ids: number[], type: 'LEARNER' | 'TEACHER', deltaOnly: boolean
  
  let targetIds = ids;

  if (deltaOnly) {
    const ecosystems: Ecosystem[] = type === "LEARNER" 
      ? [Ecosystem.SMART, Ecosystem.AIMS] 
      : [Ecosystem.ATLAS, Ecosystem.SMART, Ecosystem.AIMS];

    if (type === "LEARNER") {
      const learners = await prisma.learner.findMany({
        where: {
          enrollmentApplications: { some: { status: { in: [ApplicationStatus.ENROLLED, ApplicationStatus.OFFICIALLY_ENROLLED] } } },
          OR: ecosystems.map(e => ({
            NOT: {
              ecosystemSyncStatuses: {
                some: { ecosystem: e, status: SyncStatus.SYNCED }
              }
            }
          }))
        },
        select: { id: true }
      });
      targetIds = learners.map(l => l.id);
    } else if (type === "TEACHER") {
      const teachers = await prisma.teacher.findMany({
        where: {
          OR: ecosystems.map(e => ({
            NOT: {
              ecosystemSyncStatuses: {
                some: { ecosystem: e, status: SyncStatus.SYNCED }
              }
            }
          }))
        },
        select: { id: true }
      });
      targetIds = teachers.map(t => t.id);
    }
  }

  if (!targetIds || !Array.isArray(targetIds) || targetIds.length === 0) {
    res.status(400).json({ error: "No records to sync" });
    return;
  }

  const jobId = uuidv4();
  const job: SyncJob = {
    id: jobId,
    total: targetIds.length * (type === "LEARNER" ? 2 : 3),
    processed: 0,
    status: "PENDING",
    results: [],
    createdAt: new Date()
  };

  syncJobs.set(jobId, job);

  // Background processing
  processSyncJob(job, targetIds, type).catch(console.error);

  res.json({ data: { jobId, count: targetIds.length } });
}

async function processSyncJob(job: SyncJob, ids: number[], type: string) {
  job.status = "PROCESSING";
  
  const ecosystems: Ecosystem[] = [Ecosystem.ATLAS, Ecosystem.SMART, Ecosystem.AIMS];

  for (const id of ids) {
    for (const ecosystem of ecosystems) {
      // Skip ATLAS for Learners (as per spec)
      if (type === "LEARNER" && ecosystem === Ecosystem.ATLAS) {
        job.processed++;
        continue;
      }

      try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 100));

        // Update database
        const syncData = {
          status: SyncStatus.SYNCED,
          lastSyncedAt: new Date(),
          externalId: `EXT-${ecosystem}-${id}`
        };

        if (type === "LEARNER") {
          await prisma.ecosystemSyncStatus.upsert({
            where: { learnerId_ecosystem: { learnerId: id, ecosystem } },
            update: syncData,
            create: { ...syncData, learnerId: id, ecosystem }
          });
        } else if (type === "TEACHER") {
          await prisma.ecosystemSyncStatus.upsert({
            where: { teacherId_ecosystem: { teacherId: id, ecosystem } },
            update: syncData,
            create: { ...syncData, teacherId: id, ecosystem }
          });
        }

        job.results.push({ id, type, success: true });
      } catch (error: any) {
        job.results.push({ id, type, success: false, error: error.message });
      }
      
      job.processed++;
    }
  }

  job.status = "COMPLETED";
}

/**
 * Get job progress
 */
export async function getSyncJobProgress(req: Request, res: Response): Promise<void> {
  const jobId = req.params.jobId as string;
  const job = syncJobs.get(jobId);

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json({
    data: {
      id: job.id,
      progress: Math.round((job.processed / job.total) * 100),
      status: job.status,
      processed: job.processed,
      total: job.total
    }
  });
}

/**
 * Provision missing User accounts for Teachers
 */
export async function provisionTeacherAccounts(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const teachers = await prisma.teacher.findMany();
    const defaultPasswordHash = await bcrypt.hash("DepEd2026!", 10);
    
    let createdCount = 0;
    let skippedCount = 0;

    for (const teacher of teachers) {
      const existingUser = await prisma.user.findUnique({
        where: { employeeId: teacher.employeeId },
      });

      if (!existingUser) {
        await prisma.user.create({
          data: {
            firstName: teacher.firstName,
            lastName: teacher.lastName,
            middleName: teacher.middleName,
            email: teacher.email,
            employeeId: teacher.employeeId,
            password: defaultPasswordHash,
            role: "TEACHER",
            isActive: teacher.isActive,
            mustChangePassword: true,
          },
        });
        createdCount++;
      } else {
        skippedCount++;
      }
    }

    res.json({
      data: {
        createdCount,
        skippedCount,
        totalProcessed: teachers.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Generate PDF credential slips
 */
export async function printSectionCredentials(req: Request, res: Response): Promise<void> {
  const sectionId = req.params.sectionId as string;
  const sId = parseInt(sectionId);

  try {
    const section = await prisma.section.findUnique({
      where: { id: sId },
      include: {
        gradeLevel: true,
        schoolYear: true,
        enrollmentRecords: {
          include: {
            enrollmentApplication: {
              include: {
                learner: true
              }
            }
          }
        }
      }
    });

    if (!section) {
      res.status(404).json({ error: "Section not found" });
      return;
    }

    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const filename = `Credentials_${section.name}.pdf`;

    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/pdf');

    doc.pipe(res);

    // Grid layout: 3 columns, 5 rows per page = 15 slips per page
    // (Specification says 45 slips per document, maybe smaller?)
    // Let's do 3 columns x 5 rows for readability.
    const colWidth = 170;
    const rowHeight = 150;
    const cols = 3;
    const rowsPerPage = 5;

    section.enrollmentRecords.forEach((record, index) => {
      if (index > 0 && index % (cols * rowsPerPage) === 0) {
        doc.addPage();
      }

      const l = record.enrollmentApplication.learner;
      const pageIndex = index % (cols * rowsPerPage);
      const col = pageIndex % cols;
      const row = Math.floor(pageIndex / cols);

      const x = 30 + col * (colWidth + 10);
      const y = 30 + row * (rowHeight + 10);

      // Draw border
      doc.rect(x, y, colWidth, rowHeight).stroke();

      // Content
      doc.fontSize(10).font('Helvetica-Bold').text(l.lastName.toUpperCase() + ", " + l.firstName, x + 5, y + 10, { width: colWidth - 10, align: 'center' });
      doc.fontSize(8).font('Helvetica').text(`Section: ${section.name}`, x + 5, y + 25, { width: colWidth - 10, align: 'center' });
      
      doc.moveDown(1);
      doc.fontSize(7).text("PORTAL CREDENTIALS", x + 5, y + 45, { width: colWidth - 10, align: 'center' });
      doc.rect(x + 10, y + 55, colWidth - 20, 1).fill('#cccccc');

      doc.moveDown(2);
      doc.fontSize(8).font('Helvetica-Bold').text("Username:", x + 10, y + 65);
      doc.font('Helvetica').text(l.lrn || 'N/A', x + 60, y + 65);

      doc.font('Helvetica-Bold').text("Password:", x + 10, y + 80);
      const birthYear = l.birthdate.getFullYear();
      doc.font('Helvetica').text(`DepEd${birthYear}!`, x + 60, y + 80);

      doc.fontSize(7).font('Helvetica-Oblique').text("URL: portal.school.edu.ph", x + 5, y + 100, { width: colWidth - 10, align: 'center' });

      // Instructions
      doc.fontSize(6).font('Helvetica').text("Keep this slip safe. Change your password after first login.", x + 5, y + 120, { width: colWidth - 10, align: 'center' });
    });

    doc.end();

  } catch (error: any) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}
