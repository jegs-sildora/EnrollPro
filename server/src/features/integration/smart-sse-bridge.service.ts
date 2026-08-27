import {
  smartSyncNotificationSchema,
  type SmartSyncNotification,
} from "@enrollpro/shared";
import { prisma } from "../../lib/prisma.js";
import { broadcastRealtimeInvalidation } from "../../lib/sse.js";
import { syncFinalSmartSectionOutcomes } from "./smart-eosy.service.js";

const INITIAL_RECONNECT_DELAY_MS = 2_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const CONNECTION_TIMEOUT_MS = 10_000;
const MAX_CONNECTION_ATTEMPTS = 3;
const SMART_GRADE_EVENT_TYPES = new Set([
  "GRADE_OUTCOMES_UPDATED",
  "SECTION_OUTCOMES_PUBLISHED",
  "SECTION_SYNC_COMPLETE",
  "SYNC_COMPLETE",
]);
const SMART_TOKEN_PLACEHOLDER_PATTERNS = [
  /^server_only_/i,
  /^your[_-]/i,
  /^replace[_-]/i,
  /^change[_-]?me/i,
  /^example[_-]/i,
];

interface SmartConnectionConfig {
  baseUrl: string;
  token: string;
}

interface ResolvedSection {
  id: number;
  schoolYearId: number;
  name: string;
}

export type SmartSseConnectionState =
  | "DISABLED"
  | "CONNECTING"
  | "CONNECTED"
  | "UNAVAILABLE"
  | "AUTHENTICATION_FAILED"
  | "PAUSED";

export interface SmartSseBridgeStatus {
  state: SmartSseConnectionState;
  connectionAttempts: number;
  lastConnectedAt: string | null;
  lastEventAt: string | null;
}

function getSectionKey(section: ResolvedSection): string {
  return `${section.schoolYearId}:${section.id}`;
}

function getNotificationSectionReference(
  notification: SmartSyncNotification,
): number | string {
  return notification.sectionId ?? notification.sectionName ?? "";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown SMART bridge error";
}

function getSmartConnectionConfig(): SmartConnectionConfig | null {
  const baseUrl = process.env.SMART_API_BASE_URL?.trim();
  const token = process.env.SMART_API_KEY?.trim();

  if (!baseUrl) {
    console.warn("[SMART SSE] Bridge disabled. SMART_API_BASE_URL is not configured.");
    return null;
  }
  if (!token) {
    console.warn("[SMART SSE] Bridge disabled. SMART_API_KEY is not configured.");
    return null;
  }
  if (SMART_TOKEN_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(token))) {
    console.warn(
      "[SMART SSE] Bridge disabled. Configure the valid SMART-issued Bearer token in server/.env.",
    );
    return null;
  }

  return { baseUrl, token };
}

class SmartSseBridge {
  private abortController: AbortController | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
  private connectionFailures = 0;
  private exhausted = false;
  private stopped = true;
  private connectionState: SmartSseConnectionState = "DISABLED";
  private lastConnectedAt: string | null = null;
  private lastEventAt: string | null = null;
  private readonly pending = new Map<string, SmartSyncNotification>();
  private readonly running = new Set<string>();

  public start(): void {
    if (!getSmartConnectionConfig()) {
      this.connectionState = "DISABLED";
      return;
    }

    if (!this.stopped) {
      return;
    }

    this.connectionFailures = 0;
    this.exhausted = false;
    this.reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
    this.stopped = false;
    this.connectionState = "CONNECTING";
    void this.connect();
  }

  public stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.abortController?.abort();
    this.abortController = null;
    this.pending.clear();
    this.running.clear();
  }

  public retryAfterManualSync(): void {
    if (!this.stopped && !this.exhausted) {
      return;
    }

    this.stop();
    this.start();
  }

  public getStatus(): SmartSseBridgeStatus {
    return {
      state: this.connectionState,
      connectionAttempts: this.connectionFailures,
      lastConnectedAt: this.lastConnectedAt,
      lastEventAt: this.lastEventAt,
    };
  }

  private async connect(): Promise<void> {
    if (this.stopped) {
      return;
    }

    const config = getSmartConnectionConfig();
    if (!config) {
      return;
    }

    const controller = new AbortController();
    this.abortController = controller;
    const connectionTimeout = setTimeout(
      () => controller.abort(),
      CONNECTION_TIMEOUT_MS,
    );
    try {
      const response = await fetch(
        `${config.baseUrl.replace(/\/$/, "")}/api/integration/sync/stream`,
        {
          headers: {
            Accept: "text/event-stream",
            Authorization: `Bearer ${config.token}`,
          },
          signal: controller.signal,
        },
      );
      clearTimeout(connectionTimeout);

      if (response.status === 401 || response.status === 403) {
        this.exhausted = true;
        this.stopped = true;
        this.connectionState = "AUTHENTICATION_FAILED";
        console.error(
          `[SMART SSE] Authentication rejected by SMART (HTTP ${response.status}). Configure the valid SMART-issued Bearer token in server/.env.`,
        );
        return;
      }

      if (!response.ok || !response.body) {
        throw new Error(`SMART SSE connection returned HTTP ${response.status}.`);
      }

      this.connectionFailures = 0;
      this.reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
      this.connectionState = "CONNECTED";
      this.lastConnectedAt = new Date().toISOString();
      await this.readStream(response.body);
    } catch (error: unknown) {
      if (!this.stopped && !controller.signal.aborted) {
        console.warn(`[SMART SSE] Connection unavailable: ${getErrorMessage(error)}`);
      }
    } finally {
      clearTimeout(connectionTimeout);
      if (this.abortController === controller) {
        this.abortController = null;
      }
      if (!this.stopped) {
        this.connectionState = "UNAVAILABLE";
        this.connectionFailures += 1;
        if (this.connectionFailures >= MAX_CONNECTION_ATTEMPTS) {
          this.exhausted = true;
          this.stopped = true;
          this.connectionState = "PAUSED";
          console.warn(
            "[SMART SSE] Retry limit reached after 3 attempts. Automatic retries are paused until Sync SMART is clicked.",
          );
        } else {
          this.connectionState = "CONNECTING";
          this.scheduleReconnect();
        }
      }
    }
  }

  private async readStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (!this.stopped) {
        const result = await reader.read();
        if (result.done) {
          return;
        }

        buffer += decoder.decode(result.value, { stream: true });
        const messages = buffer.split(/\r?\n\r?\n/);
        buffer = messages.pop() ?? "";

        for (const message of messages) {
          const data = message
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n");
          if (data) {
            this.handleRawNotification(data);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private handleRawNotification(rawData: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawData) as unknown;
    } catch {
      console.warn("[SMART SSE] Ignored a non-JSON notification.");
      return;
    }

    const notification = smartSyncNotificationSchema.safeParse(parsed);
    if (!notification.success) {
      console.warn("[SMART SSE] Ignored an unscoped or invalid notification.");
      return;
    }

    if (!SMART_GRADE_EVENT_TYPES.has(notification.data.type)) {
      return;
    }

    this.lastEventAt = notification.data.timestamp;

    void this.enqueue(notification.data);
  }

  private async enqueue(notification: SmartSyncNotification): Promise<void> {
    const section = await this.resolveSection(notification);
    if (!section) {
      console.warn(
        `[SMART SSE] No EnrollPro section matched SMART reference ${String(
          getNotificationSectionReference(notification),
        )} for ${notification.schoolYear}.`,
      );
      return;
    }

    const key = getSectionKey(section);
    this.pending.set(key, notification);
    if (!this.running.has(key)) {
      void this.drain(key);
    }
  }

  private async drain(key: string): Promise<void> {
    const notification = this.pending.get(key);
    if (!notification || this.running.has(key) || this.stopped) {
      return;
    }

    this.pending.delete(key);
    this.running.add(key);
    try {
      const section = await this.resolveSection(notification);
      if (!section) {
        return;
      }

      const result = await syncFinalSmartSectionOutcomes(section.id);
      broadcastRealtimeInvalidation({
        topics: [
          "eosy:records",
          "eosy:sections",
          "students:list",
          "students:detail",
          "dashboard:summary",
          "integration:hub",
        ],
        schoolYearId: result.schoolYearId,
        sectionIds: [result.sectionId],
        learnerIds: result.learnerIds,
        smartRevision: notification.revision ?? null,
        smartEventAt: notification.timestamp,
        emittedAt: new Date().toISOString(),
      });
    } catch (error: unknown) {
      console.warn(`[SMART SSE] Automatic section sync failed: ${getErrorMessage(error)}`);
    } finally {
      this.running.delete(key);
      if (this.pending.has(key) && !this.stopped) {
        void this.drain(key);
      }
    }
  }

  private async resolveSection(
    notification: SmartSyncNotification,
  ): Promise<ResolvedSection | null> {
    const reference = getNotificationSectionReference(notification);
    const numericReference =
      typeof reference === "number"
        ? reference
        : /^\d+$/.test(reference)
          ? Number(reference)
          : null;

    const byId = numericReference
      ? await prisma.section.findFirst({
          where: {
            id: numericReference,
            schoolYear: { yearLabel: notification.schoolYear },
          },
          select: { id: true, schoolYearId: true, name: true },
        })
      : null;

    const sectionName =
      notification.sectionName ??
      (typeof reference === "string" && numericReference === null
        ? reference
        : undefined);
    const byName = sectionName
      ? await prisma.section.findFirst({
          where: {
            name: sectionName,
            schoolYear: { yearLabel: notification.schoolYear },
          },
          select: { id: true, schoolYearId: true, name: true },
        })
      : null;

    if (byId && byName && byId.id !== byName.id) {
      console.warn("[SMART SSE] Section identifier and name do not match.");
      return null;
    }

    return byId ?? byName;
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) {
      return;
    }

    const delay = this.reconnectDelayMs;
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }
}

let smartSseBridge: SmartSseBridge | null = null;

export function startSmartSseBridge(): void {
  if (!smartSseBridge) {
    smartSseBridge = new SmartSseBridge();
  }
  smartSseBridge.start();
}

export function stopSmartSseBridge(): void {
  smartSseBridge?.stop();
  smartSseBridge = null;
}

export function retrySmartSseBridgeAfterManualSync(): void {
  if (!smartSseBridge) {
    smartSseBridge = new SmartSseBridge();
  }
  smartSseBridge.retryAfterManualSync();
}

export function getSmartSseBridgeStatus(): SmartSseBridgeStatus {
  if (!smartSseBridge) {
    return {
      state: "DISABLED",
      connectionAttempts: 0,
      lastConnectedAt: null,
      lastEventAt: null,
    };
  }
  return smartSseBridge.getStatus();
}
