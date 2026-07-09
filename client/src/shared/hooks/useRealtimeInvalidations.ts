import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  REALTIME_INVALIDATION_TOPICS,
  type RealtimeInvalidationEvent,
  type RealtimeInvalidationTopic,
} from "@enrollpro/shared";
import { useAuthStore } from "@/store/auth.slice";

const STREAM_URL = `${(import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "")}/events/stream`;
const REALTIME_INVALIDATION_EVENT = "enrollpro:invalidate";

type QueryKeyPrefix = readonly unknown[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRealtimeTopic(value: unknown): value is RealtimeInvalidationTopic {
  return (
    typeof value === "string" &&
    REALTIME_INVALIDATION_TOPICS.includes(value as RealtimeInvalidationTopic)
  );
}

function parseInvalidationEvent(raw: string): RealtimeInvalidationEvent | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.type !== "invalidate") {
      return null;
    }

    const rawTopics = parsed.topics;
    if (!Array.isArray(rawTopics)) {
      return null;
    }

    const topics = rawTopics.filter(isRealtimeTopic);
    if (topics.length === 0) {
      return null;
    }

    return {
      type: "invalidate",
      topics,
      schoolYearId:
        typeof parsed.schoolYearId === "number" ? parsed.schoolYearId : null,
      teacherIds: Array.isArray(parsed.teacherIds)
        ? parsed.teacherIds.filter((id): id is number => typeof id === "number")
        : undefined,
      sectionIds: Array.isArray(parsed.sectionIds)
        ? parsed.sectionIds.filter((id): id is number => typeof id === "number")
        : undefined,
      learnerIds: Array.isArray(parsed.learnerIds)
        ? parsed.learnerIds.filter((id): id is number => typeof id === "number")
        : undefined,
      emittedAt:
        typeof parsed.emittedAt === "string"
          ? parsed.emittedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function queryKeyStartsWith(
  queryKey: readonly unknown[],
  prefix: QueryKeyPrefix,
): boolean {
  if (prefix.length > queryKey.length) {
    return false;
  }

  return prefix.every((part, index) => queryKey[index] === part);
}

function getInvalidationPrefixes(
  topics: RealtimeInvalidationTopic[],
): QueryKeyPrefix[] {
  const prefixes: QueryKeyPrefix[] = [];

  for (const topic of topics) {
    switch (topic) {
      case "school-years:list":
        prefixes.push(["school-years"]);
        prefixes.push(["schoolYear"]);
        prefixes.push(["settings", "grade-levels"]);
        break;
      case "enrollment:pending-verifications":
        prefixes.push(["enrollment", "pending-verifications"]);
        break;
      case "enrollment:applications":
        prefixes.push(["applications"]);
        prefixes.push(["enrollment"]);
        break;
      case "bosy:queue":
        prefixes.push(["bosy"]);
        break;
      case "bosy:readiness":
        prefixes.push(["bosy"]);
        break;
      case "students:list":
        prefixes.push(["students"]);
        break;
      case "students:detail":
        prefixes.push(["students"]);
        prefixes.push(["student"]);
        break;
      case "teachers:list":
        prefixes.push(["teachers", "list"]);
        break;
      case "teachers:detail":
        prefixes.push(["teachers"]);
        break;
      case "teacher:advisory":
        prefixes.push(["teacher", "advisory"]);
        break;
      case "homerooms:sections":
        prefixes.push(["homerooms", "sections"]);
        prefixes.push(["homerooms", "programs"]);
        break;
      case "homerooms:teachers":
        prefixes.push(["homerooms", "teachers"]);
        break;
      case "homerooms:adviser-candidates":
        prefixes.push(["homerooms", "adviser-candidates"]);
        break;
      case "sectioning:sections":
        prefixes.push(["sectioning", "sections"]);
        break;
      case "sectioning:pool":
        prefixes.push(["sectioning", "pool"]);
        break;
      case "eosy:sections":
        prefixes.push(["eosy"]);
        break;
      case "eosy:records":
        prefixes.push(["eosy"]);
        break;
      case "intake:listings":
        prefixes.push(["intake"]);
        prefixes.push(["enrollment-listings"]);
        break;
      case "reading-assessment:queue":
        prefixes.push(["reading-assessment"]);
        prefixes.push(["adviser"]);
        break;
      case "audit-logs:list":
        prefixes.push(["audit-logs"]);
        break;
      case "integration:hub":
        prefixes.push(["integration"]);
        break;
      case "system:health":
        prefixes.push(["system"]);
        prefixes.push(["admin", "system"]);
        break;
      case "dashboard:summary":
        prefixes.push(["dashboard"]);
        break;
      case "settings:public":
        prefixes.push(["settings", "public"]);
        prefixes.push(["settings", "programs"]);
        break;
    }
  }

  return prefixes;
}

export function useRealtimeInvalidations(): void {
  const queryClient = useQueryClient();
  const hasStaffSession = useAuthStore((state) => Boolean(state.user));

  useEffect(() => {
    if (!hasStaffSession) {
      return;
    }

    const eventSource = new EventSource(STREAM_URL, {
      withCredentials: true,
    });

    const handleInvalidation = (message: MessageEvent<string>) => {
      const payload = parseInvalidationEvent(message.data);
      if (!payload) {
        return;
      }

      const prefixes = getInvalidationPrefixes(payload.topics);
      if (prefixes.length > 0) {
        void queryClient.invalidateQueries({
          predicate: (query) =>
            prefixes.some((prefix) =>
              queryKeyStartsWith(query.queryKey, prefix),
            ),
        });
      }

      window.dispatchEvent(
        new CustomEvent<RealtimeInvalidationEvent>(REALTIME_INVALIDATION_EVENT, {
          detail: payload,
        }),
      );
    };

    eventSource.addEventListener("invalidate", handleInvalidation);
    eventSource.onmessage = handleInvalidation;

    return () => {
      eventSource.removeEventListener("invalidate", handleInvalidation);
      eventSource.close();
    };
  }, [hasStaffSession, queryClient]);
}

export {
  REALTIME_INVALIDATION_EVENT,
  type RealtimeInvalidationEvent,
  type RealtimeInvalidationTopic,
};
