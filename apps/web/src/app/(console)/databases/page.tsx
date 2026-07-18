import Link from 'next/link';
import styles from './db-index.module.css';

/* Card marks are typographic monograms in the console's mono face: this lane
   ships no icon library, and the anti-emoji policy bans pictographs. */
const DATABASES = [
  { space: 'movie_database', mark: 'MV', name: 'Movie database', desc: 'Personal film guide: recommendations, watch lists & Oscar predictions.' },
  { space: 'plant_database', mark: 'PL', name: 'Plant database', desc: 'Care guide across light, water, soil, toxicity and lifespan.' },
];

export default function DbIndexPage() {
  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <span className={styles.eyebrow}>Object model · Set views</span>
        <h1 className={styles.title}>Databases</h1>
      </header>
      <div className={styles.grid}>
        {DATABASES.map((d) => (
          <Link key={d.space} href={`/databases/${d.space}`} className={styles.card}>
            <span className={styles.cardMark} aria-hidden="true">{d.mark}</span>
            <span className={styles.cardName}>{d.name}</span>
            <span className={styles.cardDesc}>{d.desc}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
