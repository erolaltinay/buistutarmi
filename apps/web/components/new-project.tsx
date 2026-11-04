'use client';
// "Kendi analizini başlat": sektör ve başlangıç örneği seçilir, proje bu cihazda oluşturulur.
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '../i18n/navigation';
import { track } from '../lib/analytics';
import { currencyOptions, otherCountries } from '../lib/generic';
import { createBlankProject, createProject } from '../lib/project';

const OTHER = '__other';

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
  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('');
  const locale = useLocale();

  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        const doc =
          sample === OTHER ? createBlankProject(sector, country, currency) : createProject(sector, sample);
        track('project_created', { sector, mode: sample === OTHER ? 'generic' : 'sample' });
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
            <option value={OTHER}>{t('otherCountry')}</option>
          </select>
        </label>
        {sample === OTHER && (
          <>
            <label className="field">
              <span>{t('country')}</span>
              <select
                required
                data-testid="country-select"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                <option value="">{t('choose')}</option>
                {otherCountries(locale).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('currency')}</span>
              <select
                required
                data-testid="currency-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="">{t('choose')}</option>
                {currencyOptions(locale).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
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
