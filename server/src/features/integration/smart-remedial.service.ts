import axios from "axios";
import { AppError } from "../../lib/AppError.js";

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

export async function checkSmartRemedialRolloverBlock(schoolYear: string): Promise<SmartRolloverBlockResponse> {
  const baseUrl = process.env.SMART_API_BASE_URL?.trim();
  const smartToken = process.env.SMART_API_KEY?.trim();

  if (!baseUrl) {
    return { blocked: false };
  }
  
  if (!smartToken) {
    throw new AppError(500, "SMART bearer token is not configured.");
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
    
    // For other errors (like 502, network issues), we throw an error so the rollover doesn't silently proceed if SMART is down
    throw new AppError(502, "Failed to connect to SMART API to verify remedial records.");
  }
}
