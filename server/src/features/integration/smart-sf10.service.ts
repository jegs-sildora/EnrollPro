import axios from "axios";
import { AppError } from "../../lib/AppError.js";

const SMART_TRANSPORT_ATTEMPTS = 3;

function isRetryableSmartTransportError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }
  const status = error.response?.status;
  const code = error.code ?? "";
  return (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    ["ECONNREFUSED", "ETIMEDOUT", "ECONNABORTED", "ENOTFOUND", "ERR_NETWORK"].includes(code) ||
    error.message.toLowerCase().includes("timeout")
  );
}

export interface SmartSf10Record {
  schoolYear: string;
  gradeLevel: string;
  section: string;
  subjectGrades: Array<{
    subjectCode: string;
    subjectName: string;
    T1?: number | null;
    T2?: number | null;
    T3?: number | null;
    Q1?: number | null;
    Q2?: number | null;
    Q3?: number | null;
    Q4?: number | null;
    final?: number | null;
    remarks?: string | null;
  }>;
  generalAverage: number | null;
  honors: string | null;
  promotionStatus: string | null;
  remedialClasses?: Array<{
    learningAreas: string;
    finalRating: number | string;
    remedialClassMark?: number | string;
    conductedFrom?: string;
    conductedTo?: string;
    status: string;
    outcome?: string;
  }>;
}

export interface SmartSf10Response {
  success: boolean;
  student: {
    id: string;
    lrn: string;
    firstName: string;
    lastName: string;
  };
  schoolRecords: SmartSf10Record[];
}

export async function fetchSmartSf10ByLrn(lrn: string): Promise<SmartSf10Record[]> {
  let typedResponse: SmartSf10Response;

  try {
    let rawResponse: unknown;
    const baseUrl = process.env.SMART_API_BASE_URL?.trim();

    if (!baseUrl) {
      throw new Error("SMART is not configured.");
    }
    const smartToken = process.env.SMART_API_KEY?.trim();
    if (!smartToken) {
      throw new Error("SMART bearer token is not configured.");
    }
    const cleanBaseUrl = baseUrl.replace(/\/$/, "");
    let responseData: unknown;
    let responseReceived = false;
    let lastTransportError: unknown = null;

    for (let attempt = 1; attempt <= SMART_TRANSPORT_ATTEMPTS; attempt += 1) {
      try {
        const response = await axios.get<unknown>(
          `${cleanBaseUrl}/api/integration/students/${encodeURIComponent(lrn)}/sf10-grades`,
          {
            headers: { 'X-EnrollPro-API-Key': smartToken },
            timeout: 10_000,
          }
        );
        responseData = response.data;
        responseReceived = true;
        break;
      } catch (error: unknown) {
        lastTransportError = error;
        if (!isRetryableSmartTransportError(error) || attempt === SMART_TRANSPORT_ATTEMPTS) {
          throw error;
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 400 * attempt));
      }
    }

    if (!responseReceived) {
      throw lastTransportError ?? new Error("SMART did not return a response.");
    }
    
    rawResponse = responseData;
    typedResponse = rawResponse as SmartSf10Response;

    if (!typedResponse || typeof typedResponse !== 'object' || !typedResponse.success) {
      throw new Error("SMART returned an unsuccessful response or invalid data for SF10 grades.");
    }
  } catch (error: unknown) {
    throw new AppError(502, "SMART API is unreachable or returned invalid data.");
  }

  return typedResponse.schoolRecords || [];
}
