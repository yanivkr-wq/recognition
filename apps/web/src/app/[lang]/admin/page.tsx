/**
 * Admin landing → the Insights dashboard (Lily: "make insights the main admin
 * page"). The full section directory now lives behind the "More" tab in the
 * bottom nav (/admin/menu); the day-to-day tabs sit in the nav itself.
 */

import { redirect } from 'next/navigation';

export default async function AdminHome({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  redirect(`/${lang}/admin/insights`);
}
