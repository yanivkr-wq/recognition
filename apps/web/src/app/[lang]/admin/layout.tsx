/**
 * Admin shell — wraps every /[lang]/admin/* page with a minimal top bar
 * (Reco wordmark + parent name + sign out).
 *
 * Middleware already gated this layout to parent sessions only. Phase 6
 * lands the full admin nav (tasks / rewards / campaigns / kids / approvals /
 * ledger / audit). For Phase 2 we only need kids + devices, so the nav is
 * just two links rendered by each child page as breadcrumbs.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { auth, signOut } from '../../../auth';
import { TasKidzLogo } from '../../../components/taskidz-logo';
import { getAdminNotificationCounts } from '../../../lib/admin/notifications';
import { AdminBell } from './_components/admin-bell';
import { AdminBottomNav } from './_components/admin-bottom-nav';

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);

  const counts = await getAdminNotificationCounts(session.user.householdId);

  return (
    <div className="min-h-screen bg-bg">
      <header className="bg-card border-b border-rule">
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <Link
            href={`/${lang}/admin`}
            className="flex items-center gap-3"
            aria-label="TasKidz admin"
          >
            <TasKidzLogo height={40} animated />
            <span className="text-sm text-ink-soft">·</span>
            <span className="text-sm text-ink-soft">{t.admin.title}</span>
          </Link>

          <div className="flex items-center gap-3 text-sm">
            <AdminBell
              lang={lang}
              initial={counts}
              labels={{
                notifications: t.admin.notifications,
                approvals: t.admin.approvals,
                redemptions: t.admin.redemptions,
                feedback: t.admin.feedback,
                allCaughtUp: t.admin.allCaughtUp,
              }}
            />
            <span className="text-ink-soft hidden sm:inline">{session.user.name}</span>
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: `/${lang}/login` });
              }}
            >
              <button
                type="submit"
                className="text-xs text-ink-soft underline-offset-4 hover:underline transition"
              >
                {t.admin.signOut}
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* pb-24 clears the fixed bottom nav. */}
      <div className="max-w-4xl mx-auto px-5 py-8 pb-24">{children}</div>

      <AdminBottomNav
        lang={lang}
        labels={{
          insights: t.admin.insights,
          approvals: t.admin.approvals,
          players: t.admin.kids,
          rewards: t.admin.rewards,
          more: t.admin.navMore,
        }}
      />
    </div>
  );
}
