// Karar özeti İP-1.3'te gelir; o zamana kadar proje Finans ekranıyla açılır.
import { redirect } from 'next/navigation';

export default async function ProjectPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  redirect(`/${locale}/projects/${id}/finance`);
}
