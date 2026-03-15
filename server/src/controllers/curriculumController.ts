import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { auditLog } from '../services/auditLogger.js';

// ─── Grade Levels ─────────────────────────────────────────

export async function listGradeLevels(req: Request, res: Response): Promise<void> {
  const ayId = parseInt(req.params.ayId as string);
  const gradeLevels = await prisma.gradeLevel.findMany({
    where: { academicYearId: ayId },
    orderBy: { displayOrder: 'asc' },
    include: {
      sections: {
        include: { _count: { select: { enrollments: true } } },
      },
    },
  });
  res.json({ gradeLevels });
}

export async function createGradeLevel(req: Request, res: Response): Promise<void> {
  const ayId = parseInt(req.params.ayId as string);
  const { name, displayOrder } = req.body;

  if (!name) {
    res.status(400).json({ message: 'Name is required' });
    return;
  }

  const count = await prisma.gradeLevel.count({ where: { academicYearId: ayId } });

  const gl = await prisma.gradeLevel.create({
    data: {
      name,
      displayOrder: displayOrder ?? count + 1,
      academicYearId: ayId,
    },
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: 'GRADE_LEVEL_CREATED',
    description: `Created grade level "${name}"`,
    subjectType: 'GradeLevel',
    subjectId: gl.id,
    req,
  });

  res.status(201).json({ gradeLevel: gl });
}

export async function updateGradeLevel(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);
  const { name, displayOrder } = req.body;

  const gl = await prisma.gradeLevel.findUnique({ where: { id } });
  if (!gl) {
    res.status(404).json({ message: 'Grade level not found' });
    return;
  }

  const updated = await prisma.gradeLevel.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(displayOrder !== undefined ? { displayOrder } : {}),
    },
  });

  res.json({ gradeLevel: updated });
}

export async function deleteGradeLevel(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);

  const gl = await prisma.gradeLevel.findUnique({
    where: { id },
    include: { _count: { select: { sections: true, applicants: true } } },
  });

  if (!gl) {
    res.status(404).json({ message: 'Grade level not found' });
    return;
  }

  if (gl._count.applicants > 0) {
    res.status(400).json({ message: 'Cannot delete a grade level with existing applicants' });
    return;
  }

  await prisma.gradeLevel.delete({ where: { id } });

  await auditLog({
    userId: req.user!.userId,
    actionType: 'GRADE_LEVEL_DELETED',
    description: `Deleted grade level "${gl.name}"`,
    subjectType: 'GradeLevel',
    subjectId: id,
    req,
  });

  res.json({ message: 'Grade level deleted' });
}

// ─── Strands ──────────────────────────────────────────────

export async function listStrands(req: Request, res: Response): Promise<void> {
  const ayId = parseInt(req.params.ayId as string);
  const strands = await prisma.strand.findMany({
    where: { academicYearId: ayId },
    orderBy: { name: 'asc' },
  });
  res.json({ strands });
}

export async function createStrand(req: Request, res: Response): Promise<void> {
  const ayId = parseInt(req.params.ayId as string);
  const { name, applicableGradeLevelIds, curriculumType, track } = req.body;

  if (!name) {
    res.status(400).json({ message: 'Name is required' });
    return;
  }

  const strand = await prisma.strand.create({
    data: {
      name,
      applicableGradeLevelIds: applicableGradeLevelIds ?? [],
      academicYearId: ayId,
      curriculumType: curriculumType || 'OLD_STRAND',
      track: track || null,
    },
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: 'STRAND_CREATED',
    description: `Created strand "${name}"`,
    subjectType: 'Strand',
    subjectId: strand.id,
    req,
  });

  res.status(201).json({ strand });
}

export async function updateStrand(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);
  const { name, applicableGradeLevelIds, curriculumType, track } = req.body;

  const strand = await prisma.strand.findUnique({ where: { id } });
  if (!strand) {
    res.status(404).json({ message: 'Strand not found' });
    return;
  }

  const updated = await prisma.strand.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(applicableGradeLevelIds !== undefined ? { applicableGradeLevelIds } : {}),
      ...(curriculumType !== undefined ? { curriculumType } : {}),
      ...(track !== undefined ? { track } : {}),
    },
  });

  res.json({ strand: updated });
}

export async function deleteStrand(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);

  const strand = await prisma.strand.findUnique({
    where: { id },
    include: { _count: { select: { applicants: true } } },
  });

  if (!strand) {
    res.status(404).json({ message: 'Strand not found' });
    return;
  }

  if (strand._count.applicants > 0) {
    res.status(400).json({ message: 'Cannot delete a strand with existing applicants' });
    return;
  }

  await prisma.strand.delete({ where: { id } });

  await auditLog({
    userId: req.user!.userId,
    actionType: 'STRAND_DELETED',
    description: `Deleted strand "${strand.name}"`,
    subjectType: 'Strand',
    subjectId: id,
    req,
  });

  res.json({ message: 'Strand deleted' });
}

// ─── Strand-to-Grade Matrix ───────────────────────────────

export async function updateStrandMatrix(req: Request, res: Response): Promise<void> {
  const ayId = parseInt(req.params.ayId as string);
  const { matrix } = req.body;

  if (!Array.isArray(matrix)) {
    res.status(400).json({ message: 'Matrix must be an array' });
    return;
  }

  try {
    // Update all strands in a transaction
    await prisma.$transaction(
      matrix.map((item: { strandId: number; gradeLevelIds: number[] }) =>
        prisma.strand.update({
          where: { id: item.strandId },
          data: { applicableGradeLevelIds: item.gradeLevelIds },
        })
      )
    );

    // Fetch updated strands
    const strands = await prisma.strand.findMany({
      where: { academicYearId: ayId },
      orderBy: { name: 'asc' },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: 'STRAND_MATRIX_UPDATED',
      description: `Updated strand-to-grade matrix for academic year ${ayId}`,
      subjectType: 'AcademicYear',
      subjectId: ayId,
      req,
    });

    res.json({ strands });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update strand matrix' });
  }
}

// ─── SCP Configs ──────────────────────────────────────────

export async function listScpConfigs(req: Request, res: Response): Promise<void> {
  const ayId = parseInt(req.params.ayId as string);
  const scpConfigs = await prisma.scpConfig.findMany({
    where: { academicYearId: ayId },
  });
  res.json({ scpConfigs });
}

export async function updateScpConfigs(req: Request, res: Response): Promise<void> {
  const ayId = parseInt(req.params.ayId as string);
  const { scpConfigs } = req.body;

  if (!Array.isArray(scpConfigs)) {
    res.status(400).json({ message: 'scpConfigs must be an array' });
    return;
  }

  try {
    const updatedConfigs = await prisma.$transaction(
      scpConfigs.map((config: any) => {
        const { id, scpType, isOffered, cutoffScore, examDate, artFields, languages, sportsList, notes } = config;
        
        if (id) {
          return prisma.scpConfig.update({
            where: { id },
            data: {
              isOffered: isOffered ?? false,
              cutoffScore: cutoffScore ?? null,
              examDate: examDate ? new Date(examDate) : null,
              artFields: artFields ?? [],
              languages: languages ?? [],
              sportsList: sportsList ?? [],
              notes: notes ?? null
            }
          });
        } else {
          return prisma.scpConfig.create({
            data: {
              academicYearId: ayId,
              scpType,
              isOffered: isOffered ?? false,
              cutoffScore: cutoffScore ?? null,
              examDate: examDate ? new Date(examDate) : null,
              artFields: artFields ?? [],
              languages: languages ?? [],
              sportsList: sportsList ?? [],
              notes: notes ?? null
            }
          });
        }
      })
    );

    await auditLog({
      userId: req.user!.userId,
      actionType: 'SCP_CONFIG_UPDATED',
      description: `Updated SCP configurations for academic year ${ayId}`,
      subjectType: 'AcademicYear',
      subjectId: ayId,
      req,
    });

    res.json({ scpConfigs: updatedConfigs });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update SCP configs', error: error.message });
  }
}


