import { describe, expect, it } from "bun:test";

import { DEV_LOG_ALLOW_REMOTE_VAR, devLogSinkAllowedOnBind, isLoopbackBind } from "./dev-log-sink.js";

describe("isLoopbackBind", () => {
  it("admits the loopback addresses", () => {
    for (const host of ["127.0.0.1", "127.1.2.3", "::1", "0:0:0:0:0:0:0:1", "localhost", "[::1]"]) {
      expect(isLoopbackBind(host)).toBe(true);
    }
  });

  it("admits the whole 127.0.0.0/8 block, not just .0.1", () => {
    // A daemon on 127.0.0.53 is as local as one on 127.0.0.1; treating only
    // the canonical address as loopback would refuse a legitimate setup.
    expect(isLoopbackBind("127.0.0.53")).toBe(true);
  });

  it("refuses the unspecified addresses that bind every interface", () => {
    // The case the whole rule exists for: OW5's container binds 0.0.0.0.
    expect(isLoopbackBind("0.0.0.0")).toBe(false);
    expect(isLoopbackBind("::")).toBe(false);
  });

  it("refuses routable addresses and hostnames", () => {
    for (const host of ["10.0.0.4", "192.168.1.20", "203.0.113.7", "2001:db8::1", "workspace.internal", ""]) {
      expect(isLoopbackBind(host)).toBe(false);
    }
  });

  it("does not mistake a prefix for the loopback block", () => {
    // "127" as a leading digit run is not the same as the 127/8 block.
    expect(isLoopbackBind("12.7.0.1")).toBe(false);
    expect(isLoopbackBind("1270.0.0.1")).toBe(false);
  });

  it("reads a v4-mapped loopback as loopback", () => {
    expect(isLoopbackBind("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopbackBind("::ffff:10.0.0.1")).toBe(false);
  });
});

describe("devLogSinkAllowedOnBind", () => {
  it("allows the sink on loopback", () => {
    expect(devLogSinkAllowedOnBind("127.0.0.1", {})).toBe(true);
  });

  it("refuses the sink on a routable bind", () => {
    // The finding: an unauthenticated writer to the workspace filesystem,
    // reachable from the network.
    expect(devLogSinkAllowedOnBind("0.0.0.0", {})).toBe(false);
  });

  it("honours an explicit opt-in", () => {
    expect(devLogSinkAllowedOnBind("0.0.0.0", { [DEV_LOG_ALLOW_REMOTE_VAR]: "1" })).toBe(true);
  });

  it("treats anything but 1 as absent", () => {
    // "true", "yes", and an empty string are the values an operator sets by
    // guessing. Only the documented value opens an unauthenticated writer.
    for (const value of ["true", "yes", "0", "", " "]) {
      expect(devLogSinkAllowedOnBind("0.0.0.0", { [DEV_LOG_ALLOW_REMOTE_VAR]: value })).toBe(false);
    }
  });
});
