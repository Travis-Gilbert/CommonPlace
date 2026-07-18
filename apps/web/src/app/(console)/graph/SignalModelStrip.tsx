'use client';

import { useEffect, useState } from 'react';
import {
  fetchHarnessSignalModels,
  type HarnessSignalModel,
} from '@/lib/theorem-signal-models';
import styles from './graph.module.css';

export function SignalModelStrip() {
  const [models, setModels] = useState<HarnessSignalModel[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    void fetchHarnessSignalModels()
      .then((next) => {
        if (!active) return;
        setModels(next);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <aside className={styles.signalModels} aria-label="Learned tenant models">
      <div className={styles.signalModelsHead}>
        <span>Learned models</span>
        <small>{status === 'loading' ? 'Reading…' : String(models.length) + ' active'}</small>
      </div>
      {status === 'error' && <div className={styles.signalModelEmpty}>Learning registry unavailable</div>}
      {status === 'ready' && models.length === 0 && (
        <div className={styles.signalModelEmpty}>No promoted tenant model yet</div>
      )}
      {models.slice(0, 4).map((model) => (
        <article key={model.id} className={styles.signalModel} title={model.reason}>
          <strong>{consumerLabel(model.consumer)}</strong>
          <code>{model.version}</code>
          <span>{model.signalCount} signals</span>
          <span>{percent(model.weightedPrecision)} precision</span>
          <span>{percent(model.calibrationError)} calibration</span>
        </article>
      ))}
    </aside>
  );
}

function consumerLabel(consumer: string): string {
  return consumer.replaceAll('_', ' ').replace(':', ' · ');
}

function percent(value: number): string {
  return String(Math.round(value * 100)) + '%';
}
