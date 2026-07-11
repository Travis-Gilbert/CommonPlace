import { NextResponse } from "next/server";
import { join } from "node:path";
import { importSpace } from "@/lib/block-view/anytype/import";
import { withSeeds } from "@/lib/block-view/database/seed";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["movie_database", "plant_database"]);
const EXPORTS = "src/lib/block-view/anytype/exports";

export async function GET(_req: Request, ctx: { params: Promise<{ space: string }> }) {
  const { space } = await ctx.params;
  if (!ALLOWED.has(space)) return NextResponse.json({ error: "unknown database" }, { status: 404 });
  try {
    const graph = withSeeds(importSpace(join(process.cwd(), EXPORTS, space), space));
    return NextResponse.json(graph);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
