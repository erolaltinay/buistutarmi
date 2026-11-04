import type { Metadata } from 'next';
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { AttributionCapture } from '../../components/attribution';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { isLocale, routing } from '../../i18n/routing';
import '../globals.css';

// Prototipin yazı tipleri; Türkçe karakterler için latin-ext.
const display = Archivo({
  subsets: ['latin', 'latin-ext'],
  weight: ['700', '900'],
  variable: '--font-display',
});
const body = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
});
const mono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600'],
  variable: '--font-mono',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'app' });
  return { title: t('name'), description: t('tagline') };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  return (
    <html lang={locale} className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <NextIntlClientProvider>
          <AttributionCapture />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
