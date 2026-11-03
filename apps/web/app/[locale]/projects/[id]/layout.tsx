import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Workbench } from '../../../../components/workbench';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return (
    <Workbench id={id} locale={locale}>
      {children}
    </Workbench>
  );
}
