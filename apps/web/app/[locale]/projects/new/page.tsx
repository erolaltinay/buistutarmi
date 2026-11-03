// Hızlı mod sihirbazı. Video linkleri `?sector=<id>` taşır (STRATEGY §4); bilinmeyen sektör yok sayılır.
import { sectors } from '@bitm/archetypes';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { QuickWizard } from '../../../../components/quick-wizard';
import { Logo } from '../../../../components/workbench';
import { Link } from '../../../../i18n/navigation';

export default async function NewProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sector?: string | string[] }>;
}) {
  const { locale } = await params;
  const { sector } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('quick');
  const tApp = await getTranslations('app');
  const paramSector = typeof sector === 'string' && sectors[sector] ? sector : null;

  return (
    <main className="wrap home">
      <Link href="/" className="brand">
        <Logo />
        <div>
          <p className="brand-name">{tApp('name')}</p>
          <p className="brand-sub">{t('title')}</p>
        </div>
      </Link>
      <p className="tagline">{t('lead')}</p>
      <QuickWizard locale={locale} paramSector={paramSector} />
      <p className="disclaimer" role="note">
        {tApp('disclaimer')}
      </p>
    </main>
  );
}
