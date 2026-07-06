"use client";

/* Object detail — the 2001-page drawer: cover hero, title, type line, every
   resolved relation in a two-column list, description last. Rendered inside the
   .porcelain tree (not portalled) so tokens resolve. */

import { Fragment } from "react";
import styles from "../database.module.css";
import type { DbObject } from "../database/model";
import type { DbHost } from "../host/MemoryBlockHost";
import { RelationCell } from "./cells";
import { IconClose } from "./icons";

export function ObjectDetail({ object, host, onClose }: { object: DbObject; host: DbHost; onClose: () => void }) {
  const cells = Object.values(object.cells).filter((c) => c.key !== "description");
  const desc = object.cells["description"];
  return (
    <>
      <div className={styles.detailOverlay} onClick={onClose} />
      <button className={styles.close} onClick={onClose} aria-label="Close">
        <IconClose />
      </button>
      <div className={styles.detail} role="dialog" aria-label={object.title}>
        {object.cover ? <img className={styles.detailCover} src={object.cover.url} alt="" /> : <div className={styles.detailCoverEmpty} />}
        <div className={styles.detailBody}>
          <div className={styles.detailHead}>
            {object.emoji && <span className={styles.detailEmoji}>{object.emoji}</span>}
            <h2 className={styles.detailTitle}>{object.title}</h2>
          </div>
          <div className={styles.detailFeatured}>
            <span>{host.graph.type.emoji ?? ""} {host.graph.type.name}</span>
          </div>
          <div className={styles.detailDivider} />
          <div className={styles.detailGrid}>
            {cells.map((c) => (
              <Fragment key={c.key}>
                <div className={styles.detailKey}>{c.name}</div>
                <div className={styles.detailVal}>
                  <RelationCell cell={c} />
                </div>
              </Fragment>
            ))}
          </div>
          {desc && !desc.empty && (
            <>
              <div className={styles.detailDivider} />
              <p className={styles.detailDesc}>{desc.text}</p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
