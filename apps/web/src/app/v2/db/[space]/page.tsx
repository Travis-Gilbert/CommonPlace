"use client";

import { use, useEffect, useState } from "react";
import { DatabaseView } from "@/lib/block-view/DatabaseView";
import type { ObjectGraph } from "@/lib/block-view/database/model";

export default function DbSpacePage({ params }: { params: Promise<{ space: string }> }) {
  const { space } = use(params);
  const [graph, setGraph] = useState<ObjectGraph | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/v2/db/${space}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((g: ObjectGraph & { error?: string }) => {
        if (!live) return;
        if (g.error) setError(g.error);
        else setGraph(g);
      })
      .catch((e) => live && setError(String(e)));
    return () => {
      live = false;
    };
  }, [space]);

  return (
    <div className="porcelain">
      {error ? (
        <div style={{ padding: 40, fontFamily: "var(--font-mono)", color: "var(--ink-dim)" }}>Failed to load: {error}</div>
      ) : graph ? (
        <DatabaseView graph={graph} />
      ) : (
        <div style={{ padding: 40, fontFamily: "var(--font-mono)", color: "var(--ink-faint)" }}>Loading…</div>
      )}
    </div>
  );
}
