import { prisma } from "../lib/prisma.js";

export interface SearchStudentsParams {
  schoolYearId?: string | number;
  search?: string;
  gradeLevelId?: string | number;
  sectionId?: string | number;
  status?: string;
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: string;
}

export const searchStudents = async (params: SearchStudentsParams) => {
  const {
    schoolYearId,
    search = "",
    gradeLevelId,
    sectionId,
    status,
    page = "1",
    limit = "15",
    sortBy = "createdAt",
    sortOrder = "desc",
  } = params;

  const pageNum = typeof page === "string" ? parseInt(page, 10) : page;
  const limitNum = typeof limit === "string" ? parseInt(limit, 10) : limit;
  const skip = (pageNum - 1) * limitNum;

  // Build where clause
  const where: any = {};

  // Filter by school year (REQUIRED for data consistency)
  if (schoolYearId) {
    where.schoolYearId = typeof schoolYearId === "string" ? parseInt(schoolYearId, 10) : schoolYearId;
  }

  // Search by LRN or name
  if (search && typeof search === "string" && search.trim()) {
    where.OR = [
      { lrn: { contains: search.trim(), mode: "insensitive" } },
      { firstName: { contains: search.trim(), mode: "insensitive" } },
      { lastName: { contains: search.trim(), mode: "insensitive" } },
      { middleName: { contains: search.trim(), mode: "insensitive" } },
    ];
  }

  // Filter by grade level
  if (gradeLevelId) {
    where.gradeLevelId = typeof gradeLevelId === "string" ? parseInt(gradeLevelId, 10) : gradeLevelId;
  }

  // Filter by status
  if (status && typeof status === "string") {
    where.status = status;
  }

  // Filter by section (via enrollment)
  if (sectionId) {
    where.enrollment = {
      sectionId: typeof sectionId === "string" ? parseInt(sectionId, 10) : sectionId,
    };
  }

  // Build orderBy clause
  const orderBy: any = [];

  const sortField = sortBy as string;
  const order =
    (sortOrder as string).toLowerCase() === "asc" ? "asc" : "desc";

  // Map frontend sort fields to database fields
  switch (sortField) {
    case "lrn":
      orderBy.push({ lrn: order });
      break;
    case "lastName":
      orderBy.push({ lastName: order });
      orderBy.push({ firstName: order });
      break;
    case "gradeLevel":
      orderBy.push({ gradeLevel: { displayOrder: order } });
      break;
    case "section":
      orderBy.push({ enrollment: { section: { name: order } } });
      break;
    case "strand":
      orderBy.push({ strand: { name: order } });
      break;
    case "status":
      orderBy.push({ status: order });
      break;
    case "createdAt":
      orderBy.push({ createdAt: order });
      break;
    default:
      orderBy.push({ createdAt: "desc" });
  }

  // Get total count
  const total = await prisma.applicant.count({ where });

  // Get paginated results
  const applicants = await prisma.applicant.findMany({
    where,
    include: {
      gradeLevel: true,
      strand: true,
      enrollment: {
        include: {
          section: true,
        },
      },
    },
    orderBy,
    skip,
    take: limitNum,
  });

  return {
    applicants,
    total,
    pageNum,
    limitNum,
  };
};
