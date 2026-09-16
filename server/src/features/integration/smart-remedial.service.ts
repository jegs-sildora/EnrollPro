import axios from "axios";
import { AppError } from "../../lib/AppError.js";

let warnedAboutMissingRegistrarToken = false;

export interface SmartRolloverBlockResponse {
  blocked: boolean;
  count?: number;
  students?: Array<{
    lrn: string;
    name: string;
    grade: string;
    pendingSubjects: string[];
  }>;
}

export function getPreviousSchoolYearLabel(schoolYear: string): string | null {
  const match = /^(\d{4})-(\d{4})$/.exec(schoolYear.trim());
  if (!match) return null;

  const startYear = Number.parseInt(match[1], 10);
  const endYear = Number.parseInt(match[2], 10);
  if (endYear !== startYear + 1) return null;

  return `${startYear - 1}-${endYear - 1}`;
}

export async function checkSmartRemedialRolloverBlock(schoolYear: string): Promise<SmartRolloverBlockResponse> {
  const baseUrl = process.env.SMART_API_BASE_URL?.trim();
  const smartToken = process.env.SMART_REGISTRAR_API_TOKEN?.trim();

  if (!baseUrl) {
    throw new AppError(500, "SMART API base URL is not configured.");
  }
  
  if (!smartToken) {
    if (process.env.NODE_ENV !== "production") {
      if (!warnedAboutMissingRegistrarToken) {
        console.warn(
          "[SMART remedial] Check skipped in development. SMART's registrar remedial route requires a SMART user JWT and does not accept the grade-sync service key.",
        );
        warnedAboutMissingRegistrarToken = true;
      }
      return { blocked: false };
    }
    throw new AppError(
      500,
      "SMART remedial verification is not configured. Set SMART_REGISTRAR_API_TOKEN or expose a service-authenticated remedial integration endpoint.",
    );
  }

  const cleanBaseUrl = baseUrl.replace(/\/$/, "");

  try {
    const response = await axios.get<SmartRolloverBlockResponse>(
      `${cleanBaseUrl}/api/registrar/remedial/rollover-block`,
      {
        params: { schoolYear },
        headers: {
          Authorization: `Bearer ${smartToken}`,
        },
        timeout: 10000,
      }
    );

    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      // 409 means it is blocked according to the contract
      return error.response.data as SmartRolloverBlockResponse;
    }
    
    if (process.env.NODE_ENV !== "production") {
      if (!warnedAboutMissingRegistrarToken) {
        console.warn(
          "[SMART remedial] SMART rejected or could not complete the registrar remedial check. The grade-sync service key is not used for this route.",
        );
        warnedAboutMissingRegistrarToken = true;
      }
      return { blocked: false };
    }
    // For other errors (like 502, network issues), we throw an error so the rollover doesn't silently proceed if SMART is down
    throw new AppError(502, "Failed to connect to SMART API to verify remedial records.");
  }
}
