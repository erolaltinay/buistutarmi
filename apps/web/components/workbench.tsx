'use client';
// Analiz çalışma alanı: projeyi yükler, her değişiklikte motoru anında çalıştırır, 1 sn sonra kaydeder.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslations } from 'next-intl';
import { analyze, type AnalysisResult, type EngineArchetype, type LocationFlag } from '@bitm/engine';
import {
  engineArchetype,
  engineCountry,
  getCountry,
  getSector,
  sectorChecklist,
  type ChecklistItem,
  type Country,
  type Sector,
} from '@bitm/archetypes';
import { Link, usePathname } from '../i18n/navigation';
import { changedGroups } from '../lib/confidence';
import { makeFormat, type Format } from '../lib/format';
import { langOf, type Lang } from '../lib/labels';
import { loadProject, projectFromSample, saveProject, type ProjectDoc } from '../lib/project';

export const AUTOSAVE_MS = 1000;
export const TABS = ['summary', 'finance', 'area', 'location', 'pricing', 'storefront', 'compare'] as const;

export interface WorkbenchValue {
  doc: ProjectDoc;
  /**
   * Taslak üzerinde değişiklik yapar; sonuç anında yeniden hesaplanır. Değişen girdi grupları
   * kullanıcı verisi olarak işaretlenir (`track: false` hariç).
   */
  update: (recipe: (draft: ProjectDoc) => void, opts?: { track?: boolean }) => void;
  result: AnalysisResult;
  sector: Sector;
  archetype: EngineArchetype;
  country: Country;
  checklist: ChecklistItem[];
  fmt: Format;
  lang: Lang;
  /** Kapasite kullanan (hizmet / karma) arketip. */
  isService: boolean;
  flagLabel: (flag: LocationFlag) => string;
}

const Ctx = createContext<WorkbenchValue | null>(null);

export function useWorkbench(): WorkbenchValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWorkbench Workbench içinde kullanılmalı');
  return v;
}

type Save = 'idle' | 'saving' | 'saved';

export function Workbench({ id, locale, children }: { id: string; locale: string; children: ReactNode }) {
  const t = useTranslations('wb');
  const tApp = useTranslations('app');
  const [doc, setDoc] = useState<ProjectDoc | null | undefined>(undefined);
  const [save, setSave] = useState<Save>('idle');
  const dirty = useRef(false);

  useEffect(() => setDoc(loadProject(id)), [id]);

  useEffect(() => {
    if (!doc || !dirty.current) return;
    setSave('saving');
    const timer = setTimeout(() => {
      saveProject(doc);
      dirty.current = false;
      setSave('saved');
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [doc]);

  const update = useCallback<WorkbenchValue['update']>((recipe, opts) => {
    setDoc((cur) => {
      if (!cur) return cur;
      const next = structuredClone(cur);
      recipe(next);
      if (opts?.track !== false) {
        const changed = changedGroups(cur.input, next.input);
        if (changed.length)
          next.sources = { ...next.sources, ...Object.fromEntries(changed.map((g) => [g, 'user'])) };
      }
      next.updatedAt = new Date().toISOString();
      dirty.current = true;
      return next;
    });
  }, []);

  if (doc === undefined) return <p className="wrap note">{t('loading')}</p>;
  if (doc === null)
    return (
      <div className="wrap">
        <p>{t('notFound')}</p>
        <Link href="/">{t('backHome')}</Link>
      </div>
    );

  return (
    <Loaded doc={doc} update={update} locale={locale}>
      <div className="notice">
        <span>{t('sampleNote')}</span>
        <div className="btnrow">
          <span className="note" role="status" data-testid="save-status">
            {save === 'saving' ? t('saving') : save === 'saved' ? t('saved') : ''}
          </span>
          <button
            className="ghost"
            type="button"
            onClick={() => {
              if (!window.confirm(t('resetConfirm'))) return;
              const fresh = projectFromSample(doc.sector, doc.sample, doc.id);
              update(
                (d) => {
                  // Kayıtlı adaylar ayrı tutulur; örneğe dönmek onları silmez (prototip).
                  fresh.candidates = d.candidates;
                  for (const k of Object.keys(d)) delete (d as Partial<ProjectDoc>)[k as keyof ProjectDoc];
                  Object.assign(d, fresh);
                },
                { track: false },
              );
            }}
          >
            {t('reset')}
          </button>
        </div>
      </div>
      {children}
      <footer className="disclaimer" role="note">
        {tApp('disclaimer')}
      </footer>
    </Loaded>
  );
}

function Loaded({
  doc,
  update,
  locale,
  children,
}: {
  doc: ProjectDoc;
  update: WorkbenchValue['update'];
  locale: string;
  children: ReactNode;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const lang = langOf(locale);
  const sector = getSector(doc.sector);
  const archetype = useMemo(() => engineArchetype(doc.sector), [doc.sector]);
  const checklist = useMemo(() => sectorChecklist(sector), [sector]);
  const country = getCountry(doc.country);
  const result = useMemo(
    () => analyze(doc.input, archetype, engineCountry(doc.country, doc.input.cur)),
    [doc.input, doc.country, archetype],
  );
  const fmt = useMemo(() => makeFormat(locale, doc.input.cur), [locale, doc.input.cur]);
  const flagLabel = useCallback(
    (flag: LocationFlag) =>
      flag.kind === 'checklist'
        ? (checklist.find((i) => i.k === flag.key)?.flag?.[lang] ?? flag.key)
        : t(`result.flag.${flag.kind}`),
    [checklist, lang, t],
  );
  const value: WorkbenchValue = {
    doc,
    update,
    result,
    sector,
    archetype,
    country,
    checklist,
    fmt,
    lang,
    isService: sector.model !== 'product',
    flagLabel,
  };
  const base = `/projects/${doc.id}`;

  return (
    <Ctx.Provider value={value}>
      <div className="wrap">
        <header className="top">
          <Link href="/" className="brand">
            <Logo />
            <div>
              <p className="brand-name">{t('app.name')}</p>
              <p className="brand-sub">
                {sector.name[lang]} · {doc.input.area} · {doc.input.cur}
              </p>
            </div>
          </Link>
          <nav className="seg" aria-label="Language">
            {(['tr', 'en'] as const).map((l) => (
              <Link key={l} href={pathname} locale={l} aria-current={l === locale ? 'true' : undefined}>
                {l.toUpperCase()}
              </Link>
            ))}
          </nav>
        </header>
        <nav className="tabs" aria-label={t('app.name')}>
          {TABS.map((tab) => {
            const href = tab === 'summary' ? base : `${base}/${tab}`;
            return (
              <Link key={tab} href={href} aria-current={pathname === href ? 'page' : undefined}>
                {t(`wb.tabs.${tab}`)}
              </Link>
            );
          })}
        </nav>
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function Logo() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className="logo">
      <circle cx="60" cy="60" r="60" fill="#1B1E3B" />
      <path
        d="M40 48a19 19 0 1 1 21 19L60 77"
        fill="none"
        stroke="#F6A821"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M60 85 72 101 60 95 48 101Z" fill="#F6A821" />
    </svg>
  );
}
