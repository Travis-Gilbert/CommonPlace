import { describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";

import {
  ACTIVE_WORKSPACE_COOKIE,
  decodeConsoleSessionClaims,
  readConsoleSession,
  readCookie,
  resolveConsoleSessionSecret,
} from "./console-session.js";

// Cookies produced by the console's own encoder
// (apps/console/src/lib/server/active-workspace.ts, encodeActiveWorkspaceClaims)
// with expiresAt pinned to 2100-01-01 so the fixtures do not rot.
const FIXTURE_SECRET = "commonplace-openwork-fork-ow4-contract-fixture-secret";

// Minted before the scope field existed, and deliberately kept that way: it is
// the only artifact in either app that proves what an in-flight cookie does
// after the field is added.
const FIXTURE_COOKIE =
  "eyJ2ZXJzaW9uIjoxLCJzdWJqZWN0IjoidXNlcjp0cmF2aXMiLCJ3b3Jrc3BhY2VJZCI6IndzXzAxIiwid29ya3NwYWNlU2x1ZyI6ImNvbW1vbnBsYWNlIiwidGVuYW50IjoiVHJhdmlzLUdpbGJlcnQiLCJzY29wZVJlZiI6IndvcmtzcGFjZTp3c18wMSIsImV4cGlyZXNBdCI6NDEwMjQ0NDgwMH0"
  + ".3UzwRaS_obhgQ-N_eyGlfNDYJh91DeZNbCWmyzZE3sA";

// The current shape, carrying an owner scope.
const FIXTURE_COOKIE_OWNER =
  "eyJ2ZXJzaW9uIjoxLCJzdWJqZWN0IjoidXNlcjphZG1pbiIsIndvcmtzcGFjZUlkIjoid3NfMDEiLCJ3b3Jrc3BhY2VTbHVnIjoiY29tbW9ucGxhY2UiLCJ0ZW5hbnQiOiJUcmF2aXMtR2lsYmVydCIsInNjb3BlUmVmIjoid29ya3NwYWNlOndzXzAxIiwic2NvcGUiOiJvd25lciIsImV4cGlyZXNBdCI6NDEwMjQ0NDgwMH0"
  + ".VR3P4yim79U-WYkj_h2qoYk7TBAAgdOTv7qbW_UAD-g";

function requestWithCookie(cookie: string | null): Request {
  return new Request("http://workspace.local/session", {
    headers: cookie === null ? {} : { cookie: `${ACTIVE_WORKSPACE_COOKIE}=${cookie}` },
  });
}

describe("console session wire contract", () => {
  // This is the drift alarm. The signing half lives in a different app, so if
  // the console changes its payload shape, its domain separator, or its digest
  // encoding, nothing else in this package would fail.
  it("accepts a cookie minted by the console encoder", () => {
    const claims = decodeConsoleSessionClaims(FIXTURE_COOKIE_OWNER, FIXTURE_SECRET);
    expect(claims).toEqual({
      version: 1,
      subject: "user:admin",
      workspaceId: "ws_01",
      workspaceSlug: "commonplace",
      tenant: "Travis-Gilbert",
      scopeRef: "workspace:ws_01",
      scope: "owner",
      expiresAt: 4102444800,
    });
  });

  it("reads a cookie minted before scopes as a collaborator", () => {
    // The migration boundary, held by an artifact that cannot be regenerated
    // into agreement with the new code: this cookie was signed by the encoder
    // as it stood before the field existed. Collaborator is what the daemon
    // granted every console session then. Reading it as owner would hand the
    // token-minting and workspace-deletion routes to every cookie already in
    // a browser when this deployed.
    const claims = decodeConsoleSessionClaims(FIXTURE_COOKIE, FIXTURE_SECRET);
    expect(claims?.subject).toBe("user:travis");
    expect(claims?.scope).toBe("collaborator");
  });

  it("rejects a scope outside the daemon vocabulary", () => {
    // Signed correctly, with a value this side does not know. That is a
    // deployment mismatch, and quietly reading it as the lowest scope would
    // hide it behind a permissions bug report.
    const payload = Buffer.from(JSON.stringify({
      version: 1,
      subject: "user:admin",
      workspaceId: "ws_01",
      workspaceSlug: "commonplace",
      tenant: "Travis-Gilbert",
      scopeRef: "workspace:ws_01",
      scope: "superuser",
      expiresAt: 4102444800,
    })).toString("base64url");
    const signature = createHmac("sha256", FIXTURE_SECRET)
      .update("commonplace-active-workspace-v1\0")
      .update(payload)
      .digest("base64url");
    expect(decodeConsoleSessionClaims(`${payload}.${signature}`, FIXTURE_SECRET)).toBeNull();
  });

  it("round-trips against the console's live encoder", async () => {
    // The specifier is built at runtime so tsc does not try to pull a file
    // from another app's rootDir into this project's program. Bun resolves it
    // normally, which is where this test actually runs.
    const consoleEncoder = ["..", "..", "console/src/lib/server/active-workspace.ts"].join("/");
    let encode: ((input: Record<string, string>, secret: string) => string) | null = null;
    try {
      const consoleModule = await import(consoleEncoder) as {
        encodeActiveWorkspaceClaims: (input: Record<string, string>, secret: string) => string;
      };
      encode = consoleModule.encodeActiveWorkspaceClaims;
    } catch {
      // The console app is not always present in a workspace-only checkout.
      // The frozen fixture above still pins the contract; this case only loses
      // the live half of the alarm.
      return;
    }

    const cookie = encode!(
      {
        subject: "user:live",
        workspaceId: "ws_live",
        workspaceSlug: "live",
        tenant: "Travis-Gilbert",
        scopeRef: "workspace:ws_live",
        scope: "viewer",
      },
      FIXTURE_SECRET,
    );
    const claims = decodeConsoleSessionClaims(cookie, FIXTURE_SECRET);
    expect(claims?.subject).toBe("user:live");
    expect(claims?.tenant).toBe("Travis-Gilbert");
    // The live half of the alarm now covers the scope too, which is the field
    // that decides what this session may do.
    expect(claims?.scope).toBe("viewer");
  });
});

describe("console session rejection", () => {
  it("rejects a tampered payload under the same signature", () => {
    const [payload, signature] = FIXTURE_COOKIE.split(".");
    const forged = JSON.parse(Buffer.from(payload!, "base64url").toString("utf8"));
    forged.tenant = "someone-else";
    const swapped = `${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${signature}`;
    expect(decodeConsoleSessionClaims(swapped, FIXTURE_SECRET)).toBeNull();
  });

  it("rejects a cookie signed with a different secret", () => {
    const other = "a-different-secret-of-more-than-32-characters";
    expect(decodeConsoleSessionClaims(FIXTURE_COOKIE, other)).toBeNull();
  });

  it("rejects an expired cookie", () => {
    const afterExpiry = 4102444801 * 1000;
    expect(decodeConsoleSessionClaims(FIXTURE_COOKIE, FIXTURE_SECRET, afterExpiry)).toBeNull();
  });

  it("rejects malformed shapes without throwing", () => {
    for (const value of ["", ".", "a.b.c", "notbase64.notbase64", FIXTURE_COOKIE.slice(0, -1)]) {
      expect(decodeConsoleSessionClaims(value, FIXTURE_SECRET)).toBeNull();
    }
  });
});

describe("console session configuration", () => {
  it("treats absent, short, and placeholder secrets as unconfigured", () => {
    expect(resolveConsoleSessionSecret({})).toBeNull();
    expect(resolveConsoleSessionSecret({ COMMONPLACE_ACTIVE_WORKSPACE_SECRET: "  " })).toBeNull();
    expect(resolveConsoleSessionSecret({ COMMONPLACE_ACTIVE_WORKSPACE_SECRET: "short" })).toBeNull();
    expect(
      resolveConsoleSessionSecret({ COMMONPLACE_ACTIVE_WORKSPACE_SECRET: "change-me" }),
    ).toBeNull();
    expect(
      resolveConsoleSessionSecret({ COMMONPLACE_ACTIVE_WORKSPACE_SECRET: FIXTURE_SECRET }),
    ).toBe(FIXTURE_SECRET);
  });

  it("reads no session when no console secret is configured", () => {
    expect(readConsoleSession(requestWithCookie(FIXTURE_COOKIE), {})).toBeNull();
  });

  it("reads the session when the secret and cookie are both present", () => {
    const claims = readConsoleSession(requestWithCookie(FIXTURE_COOKIE), {
      COMMONPLACE_ACTIVE_WORKSPACE_SECRET: FIXTURE_SECRET,
    });
    expect(claims?.workspaceSlug).toBe("commonplace");
  });

  it("reads no session when the request carries no cookie", () => {
    expect(
      readConsoleSession(requestWithCookie(null), {
        COMMONPLACE_ACTIVE_WORKSPACE_SECRET: FIXTURE_SECRET,
      }),
    ).toBeNull();
  });
});

describe("cookie parsing", () => {
  it("finds the named cookie among others", () => {
    const header = `other=1; ${ACTIVE_WORKSPACE_COOKIE}=value; trailing=2`;
    expect(readCookie(header, ACTIVE_WORKSPACE_COOKIE)).toBe("value");
  });

  it("keeps everything after the first equals sign", () => {
    // The current encoding has no "=", but a padded base64 value would, and
    // truncating at the second "=" would corrupt the signature.
    expect(readCookie(`${ACTIVE_WORKSPACE_COOKIE}=a.b==`, ACTIVE_WORKSPACE_COOKIE)).toBe("a.b==");
  });

  it("does not match a cookie whose name merely ends with the target", () => {
    expect(readCookie(`not_${ACTIVE_WORKSPACE_COOKIE}=value`, ACTIVE_WORKSPACE_COOKIE)).toBeNull();
  });

  it("returns null for absent headers and empty values", () => {
    expect(readCookie(null, ACTIVE_WORKSPACE_COOKIE)).toBeNull();
    expect(readCookie(`${ACTIVE_WORKSPACE_COOKIE}=`, ACTIVE_WORKSPACE_COOKIE)).toBeNull();
  });
});

describe("console session workspace binding", () => {
  // The escalation this guards is real: a daemon can serve several workspaces
  // (--workspace is repeatable) and handlers resolve :id against the whole
  // configured set, so an owner-scoped console actor would reach every one.
  //
  // A first fix compared claims.workspaceId against the route :id. It was
  // wrong twice: the ids are different namespaces (this daemon derives
  // ws_<hash-of-path>, the console mints its own), and :id is not always a
  // workspace, so POST /approvals/:id was rejected too. The binding now lives
  // in server.ts consoleSessionActor and keys off deployment shape instead.
  it("carries the signed workspace for auditing", () => {
    const claims = decodeConsoleSessionClaims(FIXTURE_COOKIE, FIXTURE_SECRET);
    expect(claims?.workspaceId).toBe("ws_01");
    expect(claims?.subject).toBe("user:travis");
  });

  it("keeps the claim available to callers that need to attribute an action", () => {
    const claims = readConsoleSession(requestWithCookie(FIXTURE_COOKIE), {
      COMMONPLACE_ACTIVE_WORKSPACE_SECRET: FIXTURE_SECRET,
    });
    expect(claims?.workspaceId).toBe("ws_01");
    expect(claims?.tenant).toBe("Travis-Gilbert");
  });
});
