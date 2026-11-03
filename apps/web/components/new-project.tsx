'use client';
// "Kendi analizini başlat": sektör ve başlangıç örneği seçilir, proje bu cihazda oluşturulur.
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '../i18n/navigation';
import { createProject } from '../lib/project';

export interface SectorOption {
  id: string;
  name: string;
  samples: { id: string; label: string }[];
}

export function NewProject({ sectors }: { sectors: SectorOption[] }) {
  const t = useTranslations('home');
  const router = useRouter();
  const [sector, setSector] = useState(sectors[0]?.id ?? '');
  const samples = sectors.find((s) => s.id === sector)?.samples ?? [];
  const [sample, setSample] = useState(samples[0]?.id ?? '');

  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        const doc = createProject(sector, sample);
        router.push(`/projects/${doc.id}/finance`);
      }}
    >
      <h2>{t('newTitle')}</h2>
      <p className="hint">{t('newHint')}</p>
      <div className="fields">
        <label className="field">
          <span>{t('sector')}</span>
          <select
            data-testid="sector-select"
            value={sector}
            onChange={(e) => {
              setSector(e.target.value);
              setSample(sectors.find((s) => s.id === e.target.value)?.samples[0]?.id ?? '');
            }}
          >
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('sample')}</span>
          <select data-testid="sample-select" value={sample} onChange={(e) => setSample(e.target.value)}>
            {samples.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="btnrow" style={{ marginTop: 14 }}>
        <button className="solid" type="submit" data-testid="start">
          {t('start')}
        </button>
      </div>
      <p className="note" style={{ marginTop: 10 }}>
        {t('localNote')}
      </p>
    </form>
  );
}
