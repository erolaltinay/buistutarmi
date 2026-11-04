import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['@bitm/engine', '@bitm/archetypes', '@bitm/pdf'],
  // PDF dizgisi Node'da çalışır; font dosyaları dağıtıma dahil edilir (/api/report).
  serverExternalPackages: ['@react-pdf/renderer'],
  outputFileTracingIncludes: { '/api/report': ['../../packages/pdf/fonts/*'] },
};

export default withNextIntl(nextConfig);
