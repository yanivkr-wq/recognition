/**
 * Admin landing — Phase 3 adds a two-card nav (kids + tasks).
 *
 * Phase 6 replaces this with the full admin home (approvals queue, redemption
 * tracker, audit feed). For now it's a deliberate redirect-target for any
 * `/[lang]/admin` hit so parents can self-navigate to the surfaces that
 * exist today.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { auth } from '../../../auth';

export default async function AdminHome({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{t.admin.title}</h1>
      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          href={`/${lang}/admin/approvals`}
          className="bg-card rounded-2xl shadow-card p-5 hover:-translate-y-px transition border border-rule"
        >
          <p className="text-lg font-bold text-ink">{t.admin.approvals}</p>
          <p className="text-sm text-ink-soft mt-1">{t.admin.approvalsHeading}</p>
        </Link>
        <Link
          href={`/${lang}/admin/kids`}
          className="bg-card rounded-2xl shadow-card p-5 hover:-translate-y-px transition border border-rule"
        >
          <p className="text-lg font-bold text-ink">{t.admin.kids}</p>
          <p className="text-sm text-ink-soft mt-1">
            {t.admin.setPin} · {t.admin.devices} · {t.admin.ledger}
          </p>
        </Link>
        <Link
          href={`/${lang}/admin/tasks`}
          className="bg-card rounded-2xl shadow-card p-5 hover:-translate-y-px transition border border-rule"
        >
          <p className="text-lg font-bold text-ink">{t.admin.tasksHeading}</p>
          <p className="text-sm text-ink-soft mt-1">
            {t.admin.newTask} · {t.admin.assignments}
          </p>
        </Link>
        <Link
          href={`/${lang}/admin/redemptions`}
          className="bg-card rounded-2xl shadow-card p-5 hover:-translate-y-px transition border border-rule"
        >
          <p className="text-lg font-bold text-ink">{t.admin.redemptions}</p>
          <p className="text-sm text-ink-soft mt-1">{t.admin.redemptionsHeading}</p>
        </Link>
        <Link
          href={`/${lang}/admin/rewards`}
          className="bg-card rounded-2xl shadow-card p-5 hover:-translate-y-px transition border border-rule"
        >
          <p className="text-lg font-bold text-ink">{t.admin.rewards}</p>
          <p className="text-sm text-ink-soft mt-1">{t.admin.rewardsHeading}</p>
        </Link>
        <Link
          href={`/${lang}/admin/campaigns`}
          className="bg-card rounded-2xl shadow-card p-5 hover:-translate-y-px transition border border-rule"
        >
          <p className="text-lg font-bold text-ink">{t.admin.campaigns}</p>
          <p className="text-sm text-ink-soft mt-1">{t.admin.campaignsHeading}</p>
        </Link>
        <Link
          href={`/${lang}/admin/badges`}
          className="bg-card rounded-2xl shadow-card p-5 hover:-translate-y-px transition border border-rule"
        >
          <p className="text-lg font-bold text-ink">{t.admin.badges}</p>
          <p className="text-sm text-ink-soft mt-1">{t.admin.badgesHeading}</p>
        </Link>
        <Link
          href={`/${lang}/admin/audit`}
          className="bg-card rounded-2xl shadow-card p-5 hover:-translate-y-px transition border border-rule"
        >
          <p className="text-lg font-bold text-ink">{t.admin.audit}</p>
          <p className="text-sm text-ink-soft mt-1">{t.admin.auditHeading}</p>
        </Link>
        <Link
          href={`/${lang}/admin/feedback`}
          className="bg-card rounded-2xl shadow-card p-5 hover:-translate-y-px transition border border-rule"
        >
          <p className="text-lg font-bold text-ink">{t.admin.feedback}</p>
          <p className="text-sm text-ink-soft mt-1">{t.feedback.heading}</p>
        </Link>
      </div>
    </div>
  );
}
