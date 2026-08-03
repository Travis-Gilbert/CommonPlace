// SOURCING: node:net isIP for family detection; the loopback classification
// itself is hand-rolled. `ip.isLoopback` and `ipaddr.js`'s range() both model
// this, but adding a dependency to this server to classify one configured bind
// string is not a trade worth making: the input is an operator-set host, not
// arbitrary network data, and the whole rule is two families wide.
//
// SPEC-COMMONPLACE-OPENWORK-FORK-1.0: the dev-log sink is a development
// affordance that OW5 ships inside a container image, which is exactly the
// deployment where "development only" stops being self-enforcing.

import { isIP } from "node:net";

/**
 * The opt-in that lets an operator run the sink on a routable bind.
 *
 * Named for what it does rather than as a generic "force" flag, because the
 * thing being enabled is genuinely dangerous and the variable name is the last
 * documentation an operator reads before setting it.
 */
export const DEV_LOG_ALLOW_REMOTE_VAR = "OPENWORK_DEV_LOG_ALLOW_REMOTE";

/**
 * True when a bind address reaches only the local machine.
 *
 * The unspecified addresses (0.0.0.0, ::) are deliberately not loopback: they
 * bind every interface, which is the case this exists to catch. An empty host
 * is treated the same way, because a server that did not say where it binds
 * has not said it binds narrowly.
 */
export function isLoopbackBind(host: string): boolean {
  const trimmed = host.trim().replace(/^\[|\]$/g, "");
  if (!trimmed) return false;
  if (trimmed === "localhost") return true;

  const family = isIP(trimmed);
  if (family === 6) {
    // ::1 in any of its written forms, and the v4-mapped loopback that some
    // stacks hand back for a 127.x connection.
    if (trimmed === "::1" || /^(?:0*:)+0*1$/.test(trimmed)) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(trimmed);
    return mapped ? isLoopbackBind(mapped[1]!) : false;
  }
  if (family === 4) {
    // The whole 127.0.0.0/8 block, not just 127.0.0.1.
    return trimmed.startsWith("127.");
  }
  // A hostname that is not "localhost" resolves somewhere this cannot see.
  return false;
}

/**
 * Whether the unauthenticated dev-log sink may serve on this bind.
 *
 * The sink writes caller-supplied lines to a file on the workspace volume and
 * takes no credential, because it has to work before a client has finished
 * wiring tokens. That is defensible on a loopback bind, where reaching the
 * port already means being on the machine. It is not defensible on a routable
 * one, and OW5's container binds 0.0.0.0 by necessity, so the honest default
 * is to refuse there.
 *
 * Bind rather than peer address, deliberately: this server sits behind a
 * console proxy in the deployment that matters, so a peer check would read the
 * proxy's address (or a forwarded-for header the proxy's client can write) and
 * call every remote caller local. The bind is a property of this process that
 * no request can influence.
 *
 * The escape hatch stays because a deliberately exposed sink is a real
 * development setup: a dev container on a LAN, or a browser on the host
 * driving a daemon in a VM.
 */
export function devLogSinkAllowedOnBind(
  host: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  if (isLoopbackBind(host)) return true;
  return environment[DEV_LOG_ALLOW_REMOTE_VAR]?.trim() === "1";
}
