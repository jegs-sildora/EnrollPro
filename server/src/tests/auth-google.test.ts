import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import {
  resetGoogleIdTokenVerifierForTests,
  setGoogleIdTokenVerifierForTests,
} from "../features/auth/auth.controller.js";

type ApiResult = {
  status: number;
  body: any;
  headers: Headers;
};

function asHeaders(initHeaders?: HeadersInit): Headers {
  const headers = new Headers(initHeaders);
  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }
  return headers;
}

async function requestJson(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<ApiResult> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: asHeaders(init?.headers),
  });

  const text = await response.text();
  let body: any = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return {
    status: response.status,
    body,
    headers: response.headers,
  };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function runTests(): Promise<void> {
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const invitedEmail = `oauth-invited-${seed}@deped.gov.ph`;

  const previousGoogleClientId = process.env.GOOGLE_CLIENT_ID;
  const previousAllowedDomains = process.env.ALLOWED_GOOGLE_DOMAINS;
  const previousAllowedEmails = process.env.ALLOWED_GOOGLE_EMAILS;

  let invitedUserId: number | null = null;
  let server: Server | null = null;

  try {
    process.env.GOOGLE_CLIENT_ID =
      process.env.GOOGLE_CLIENT_ID ||
      "test-google-client-id.apps.googleusercontent.com";
    process.env.ALLOWED_GOOGLE_DOMAINS = "deped.gov.ph";
    process.env.ALLOWED_GOOGLE_EMAILS = "";

    const invitedUser = await prisma.user.create({
      data: {
        firstName: "OAuth",
        lastName: "Invitee",
        email: invitedEmail,
        password: "not-used-for-google-login",
        role: "HEAD_REGISTRAR",
        sex: "MALE",
      },
    });
    invitedUserId = invitedUser.id;

    setGoogleIdTokenVerifierForTests(async (credential) => {
      if (credential === "invited-first" || credential === "invited-return") {
        return {
          sub: "google-sub-1",
          email: invitedEmail,
          emailVerified: true,
          hd: "deped.gov.ph",
        };
      }

      if (credential === "blocked-domain") {
        return {
          sub: "google-sub-blocked",
          email: `blocked-${seed}@gmail.com`,
          emailVerified: true,
          hd: "gmail.com",
        };
      }

      if (credential === "unknown-user") {
        return {
          sub: "google-sub-unknown",
          email: `unknown-${seed}@deped.gov.ph`,
          emailVerified: true,
          hd: "deped.gov.ph",
        };
      }

      throw new Error("Unknown test credential");
    });

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");

    const address = server.address();
    assert.ok(
      address && typeof address !== "string",
      "Test server did not bind to a TCP port",
    );

    const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

    const firstTimeLogin = await requestJson(baseUrl, "/api/auth/google", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential: "invited-first" }),
    });
    assert.equal(firstTimeLogin.status, 200);
    assert.equal(firstTimeLogin.body?.user?.email, invitedEmail);
    assert.equal(typeof firstTimeLogin.body?.token, "string");

    const cookieHeader = firstTimeLogin.headers.get("set-cookie") || "";
    assert.ok(cookieHeader.includes("HttpOnly"));
    assert.ok(cookieHeader.includes("SameSite=Lax"));

    const accountAfterFirst = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: "google-sub-1",
        },
      },
    });
    assert.ok(
      accountAfterFirst,
      "Expected account to be created on first login",
    );
    const firstUpdatedAt = accountAfterFirst.updatedAt.getTime();

    const returningLogin = await requestJson(baseUrl, "/api/auth/google", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential: "invited-return" }),
    });
    assert.equal(returningLogin.status, 200);
    assert.equal(returningLogin.body?.user?.email, invitedEmail);

    const accountAfterReturn = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: "google-sub-1",
        },
      },
    });
    assert.ok(accountAfterReturn, "Expected linked account to remain present");
    assert.equal(accountAfterReturn.userId, invitedUser.id);
    assert.ok(
      accountAfterReturn.updatedAt.getTime() >= firstUpdatedAt,
      "Expected returning login to update account token metadata",
    );

    const accountCount = await prisma.account.count({
      where: {
        provider: "google",
        providerAccountId: "google-sub-1",
      },
    });
    assert.equal(
      accountCount,
      1,
      "Expected account upsert behavior to avoid duplicates",
    );

    const restrictedLogin = await requestJson(baseUrl, "/api/auth/google", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential: "blocked-domain" }),
    });
    assert.equal(restrictedLogin.status, 403);
    assert.equal(restrictedLogin.body?.code, "DOMAIN_RESTRICTED");

    const unknownUserLogin = await requestJson(baseUrl, "/api/auth/google", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential: "unknown-user" }),
    });
    assert.equal(unknownUserLogin.status, 403);
    assert.equal(unknownUserLogin.body?.code, "INVITE_REQUIRED");

    console.log("Google auth integration tests passed.");
  } catch (error) {
    console.error("Google auth integration tests failed:", error);
    process.exitCode = 1;
  } finally {
    if (server) {
      await closeServer(server);
    }

    resetGoogleIdTokenVerifierForTests();

    process.env.GOOGLE_CLIENT_ID = previousGoogleClientId;
    process.env.ALLOWED_GOOGLE_DOMAINS = previousAllowedDomains;
    process.env.ALLOWED_GOOGLE_EMAILS = previousAllowedEmails;

    await prisma.account.deleteMany({
      where: {
        provider: "google",
        providerAccountId: {
          in: ["google-sub-1", "google-sub-blocked", "google-sub-unknown"],
        },
      },
    });

    if (invitedUserId) {
      await prisma.user.deleteMany({ where: { id: invitedUserId } });
    }

    await prisma.$disconnect();
  }
}

void runTests();
