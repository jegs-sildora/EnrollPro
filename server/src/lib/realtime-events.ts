import type { RealtimeInvalidationTopic } from "@enrollpro/shared";
import { broadcastRealtimeInvalidation } from "./sse.js";

interface DomainInvalidationOptions {
  topics: RealtimeInvalidationTopic[];
  schoolYearId?: number | null;
  teacherIds?: number[];
  sectionIds?: number[];
  learnerIds?: number[];
}

export function broadcastDomainInvalidation({
  topics,
  schoolYearId,
  teacherIds,
  sectionIds,
  learnerIds,
}: DomainInvalidationOptions): void {
  broadcastRealtimeInvalidation({
    topics: Array.from(new Set(topics)),
    schoolYearId,
    teacherIds,
    sectionIds,
    learnerIds,
  });
}

export function broadcastEnrollmentInvalidation(
  schoolYearId?: number | null,
  learnerIds?: number[],
): void {
  broadcastDomainInvalidation({
    topics: [
      "enrollment:pending-verifications",
      "enrollment:applications",
      "sectioning:pool",
      "students:list",
      "dashboard:summary",
    ],
    schoolYearId,
    learnerIds,
  });
}

export function broadcastBosyInvalidation(
  schoolYearId?: number | null,
  learnerIds?: number[],
): void {
  broadcastDomainInvalidation({
    topics: [
      "bosy:queue",
      "bosy:readiness",
      "sectioning:pool",
      "students:list",
      "dashboard:summary",
    ],
    schoolYearId,
    learnerIds,
  });
}

export function broadcastStudentInvalidation(
  schoolYearId?: number | null,
  learnerIds?: number[],
): void {
  broadcastDomainInvalidation({
    topics: [
      "students:list",
      "students:detail",
      "sectioning:pool",
      "homerooms:sections",
      "dashboard:summary",
    ],
    schoolYearId,
    learnerIds,
  });
}

export function broadcastEosyInvalidation(
  schoolYearId?: number | null,
  sectionIds?: number[],
  learnerIds?: number[],
): void {
  broadcastDomainInvalidation({
    topics: [
      "eosy:sections",
      "eosy:records",
      "teacher:advisory",
      "homerooms:sections",
      "students:list",
      "students:detail",
      "dashboard:summary",
    ],
    schoolYearId,
    sectionIds,
    learnerIds,
  });
}

export function broadcastSchoolYearInvalidation(
  schoolYearId?: number | null,
): void {
  broadcastDomainInvalidation({
    topics: [
      "school-years:list",
      "settings:public",
      "dashboard:summary",
      "bosy:queue",
      "bosy:readiness",
      "homerooms:sections",
      "sectioning:sections",
      "sectioning:pool",
      "students:list",
      "teachers:list",
      "eosy:sections",
      "eosy:records",
      "integration:hub",
    ],
    schoolYearId,
  });
}
