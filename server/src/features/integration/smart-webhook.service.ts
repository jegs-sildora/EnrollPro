import axios from "axios";
import type { RealtimeInvalidationTopic } from "@enrollpro/shared";

/**
 * Triggers the immediate background sync in SMART when EnrollPro data changes.
 * This is fired asynchronously to avoid blocking EnrollPro's main thread.
 * 
 * Target: POST /api/integration/enrollpro-webhook
 * Header: X-API-Key
 */
export async function triggerSmartWebhook(topics: RealtimeInvalidationTopic[]): Promise<void> {
  const baseUrl = process.env.SMART_API_BASE_URL?.trim();
  const apiKey = process.env.SMART_API_KEY?.trim();

  // Webhook is optional; only fire if SMART is fully configured.
  if (!baseUrl) {
    return;
  }

  try {
    await axios.post(
      `${baseUrl.replace(/\/$/, "")}/api/integration/enrollpro-webhook`,
      {
        topics,
        timestamp: new Date().toISOString(),
      },
      {
        headers: apiKey ? { "X-API-Key": apiKey } : undefined,
        timeout: 5000,
      }
    );
  } catch (error) {
    // We log the error but do not throw, as this is a background notification
    const message = axios.isAxiosError(error) ? error.message : error instanceof Error ? error.message : "Unknown error";
    console.warn(`Failed to trigger SMART webhook for topics [${topics.join(", ")}]: ${message}`);
  }
}
