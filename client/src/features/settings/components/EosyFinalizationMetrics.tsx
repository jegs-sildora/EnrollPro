import { useEffect, useState } from "react";
import { getRolloverReadiness, type RolloverReadinessPayload } from "../api/system.api";

export function EosyFinalizationMetrics() {
  const [readiness, setReadiness] = useState<RolloverReadinessPayload | null>(null);

  useEffect(() => {
    getRolloverReadiness()
      .then(setReadiness)
      .catch(() => { });
  }, []);

  if (!readiness) return null;

  if (!readiness.isEosyPhase) {
    return (
      <div className="text-base leading-tight text-gray-500 mt-4 border-t pt-4">
        System is in active operation. EOSY rollover diagnostics will become available during the closing phase.
      </div>
    );
  }

  const hasBlockers = readiness.blockers.length > 0;

  if (!hasBlockers) return null;

  return (
    <div className="bg-muted border border-gray-200 rounded-lg p-6 mb-6 shadow-sm w-full">
      <h3 className="text-gray-900 font-semibold text-lg border-b pb-3 mb-4">
        Classes to Finish Before Starting the New School Year
      </h3>
      <ul className="flex flex-col gap-3">
        {readiness.blockers.map((blocker) => (
          <li
            key={`${blocker.gradeLevel}-${blocker.sectionName}`}
            className="flex items-start text-base leading-tight text-amber-900"
          >
            <span>
              {blocker.gradeLevel} - {blocker.sectionName}:{" "}
              {blocker.unfinishedLearnerCount} unfinished learner record(s)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
