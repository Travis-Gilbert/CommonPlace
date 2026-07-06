import Link from "next/link";
import styles from "@/lib/block-view/database.module.css";

const DATABASES = [
  { space: "movie_database", emoji: "🍿", name: "Movie Database", sub: "Films, watch lists & Oscar predictions." },
  { space: "plant_database", emoji: "🌿", name: "Plant Database", sub: "Care guide by type, light, water & toxicity." },
];

export default function DbIndexPage() {
  return (
    <div className="porcelain">
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.crumb}>Harness / Databases</div>
          <h1 className={styles.title}>Databases</h1>
          <p className={styles.sub}>Any object type, rendered from the object model — gallery, grid, list, or board.</p>
        </header>
        <div className={styles.indexGrid}>
          {DATABASES.map((d) => (
            <Link key={d.space} href={`/v2/db/${d.space}`} className={styles.indexCard}>
              <span className={styles.indexEmoji}>{d.emoji}</span>
              <span className={styles.indexName}>{d.name}</span>
              <span className={styles.sub}>{d.sub}</span>
              <span className={styles.indexMeta}>Set · object model</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
