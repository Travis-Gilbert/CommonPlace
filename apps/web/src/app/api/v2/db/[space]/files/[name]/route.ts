import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["movie_database", "plant_database"]);
const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

export async function GET(_req: Request, ctx: { params: Promise<{ space: string; name: string }> }) {
  const { space, name } = await ctx.params;
  if (!ALLOWED.has(space)) return new Response("not found", { status: 404 });
  const safe = basename(name);
  const p = join(process.cwd(), "src/lib/block-view/anytype/exports", space, "files", safe);
  if (!existsSync(p)) return new Response("not found", { status: 404 });
  const ext = safe.split(".").pop()?.toLowerCase() ?? "png";
  const body = readFileSync(p);
  return new Response(new Uint8Array(body), {
    headers: { "content-type": MIME[ext] ?? "application/octet-stream", "cache-control": "public, max-age=3600" },
  });
}
