/**
 * Kid notifications surface (Lily's Fix 12b shell).
 *
 * Shows every bell-channel `notification_event` row targeting this kid,
 * newest first, separated into "unread" (state='pending') and "earlier"
 * (state='sent'). Each row gets a localized headline based on event_kind.
 *
 * Phase 8 will:
 *   - Add the actual WhatsApp dispatcher tick.
 *   - Add bell-polling endpoint for live counts.
 *   - Add per-task-assignment reminders.
 *   - Add quiet hours + rate limits.
 *
 * For now the bell already works end-to-end: Phase 7's hooks write the
 * events, this page reads them, the "mark all read" action flips state.
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, notificationEvent, kid as kidTable } from '@reco/db';
import { isNull } from 'drizzle-orm';
import { markAllReadAction } from '../../../lib/notifications/actions';
import { getKidAttention, type KidTaskItem } from '../../../lib/notifications/kid-attention';
import { BottomNav } from '../_components/bottom-nav';
import { Avatar } from '../../../components/avatar';
import { arrowBack } from '../../../lib/rtl';

export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  eventKind: string;
  state: string;
  createdAt: Date;
}

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  const hdrs = await headers();
  const principal = hdrs.get('x-reco-principal');
  if (principal !== 'kid') redirect(`/${lang}`);
  const kidId = hdrs.get('x-reco-kid-id');
  if (!kidId) redirect(`/${lang}/pick`);

  const db = getDb();
  const kRows = await db
    .select({
      name: kidTable.name,
      color: kidTable.color,
      avatarKey: kidTable.avatarKey,
      householdId: kidTable.householdId,
    })
    .from(kidTable)
    .where(and(eq(kidTable.id, kidId), isNull(kidTable.archivedAt)))
    .limit(1);
  const k = kRows[0];
  if (!k) redirect(`/${lang}/pick`);

  // Live "needs you" items — same source as the bell badge, so the list here
  // matches the number the kid tapped (Lily: "align the display with reality").
  const attention = await getKidAttention(kidId, k.householdId, lang as 'he' | 'en');

  const rows: Row[] = (
    await db
      .select({
        id: notificationEvent.id,
        eventKind: notificationEvent.eventKind,
        state: notificationEvent.state,
        createdAt: notificationEvent.createdAt,
      })
      .from(notificationEvent)
      .where(
        and(
          eq(notificationEvent.recipientKidId, kidId),
          eq(notificationEvent.channel, 'bell'),
        ),
      )
      .orderBy(desc(notificationEvent.createdAt))
      .limit(100)
  ).map((r) => ({
    id: r.id,
    eventKind: r.eventKind,
    state: r.state,
    createdAt: r.createdAt,
  }));

  const unread = rows.filter((r) => r.state === 'pending');
  const earlier = rows.filter((r) => r.state !== 'pending');

  const dateFmt = new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem',
  });

  return (
    <>
    <main className="min-h-screen bg-bg pb-28">
      <header
        className="px-5 pb-3 flex items-center justify-between"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <a
          href={`/${lang}/`}
          className="text-sm text-ink-soft underline-offset-4 hover:underline"
        >
          {arrowBack(lang as 'he' | 'en')} {t.common.back}
        </a>
        <div className="flex items-center gap-2">
          <Avatar name={k.name} color={k.color} avatarKey={k.avatarKey} size={32} />
          <h1 className="text-base font-bold text-ink">{t.notifications.title}</h1>
        </div>
        <span className="w-12" aria-hidden />
      </header>

      {/* Action-needed — the live items the bell badge counts (pending tasks,
          denials, an active message). Tapping any goes home where they live. */}
      {(attention.tasks.length > 0 || attention.popup) && (
        <section className="mx-5 mt-4">
          <h2 className="text-xs uppercase tracking-wider text-pink-dark font-bold mb-2">
            {t.notifications.actionNeeded}
          </h2>
          <ul className="space-y-2">
            {attention.tasks.map((task) => (
              <ActionRow
                key={task.assignmentId}
                href={`/${lang}/`}
                label={taskKindLabel(task.kind, t)}
                detail={task.title}
              />
            ))}
            {attention.popup && (
              <ActionRow
                href={`/${lang}/`}
                label={t.notifications.newMessage}
                detail={attention.popup.title ?? attention.popup.body}
              />
            )}
          </ul>
        </section>
      )}

      {rows.length === 0 && attention.tasks.length === 0 && !attention.popup ? (
        <section className="mx-5 mt-8 bg-card rounded-2xl border border-rule p-8 text-center">
          <p className="font-bold text-ink">{t.notifications.empty}</p>
          <p className="text-sm text-ink-soft mt-1">{t.notifications.emptyHint}</p>
        </section>
      ) : (
        <>
          {unread.length > 0 && (
            <section className="mx-5 mt-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs uppercase tracking-wider text-pink-dark font-bold">
                  {unread.length}
                </h2>
                <form action={markAllReadAction}>
                  <button
                    type="submit"
                    className="text-xs text-pink-dark underline-offset-4 hover:underline font-bold"
                  >
                    {t.notifications.markAllRead}
                  </button>
                </form>
              </div>
              <ul className="space-y-2">
                {unread.map((r) => (
                  <EventRow key={r.id} row={r} t={t} dateFmt={dateFmt} unread />
                ))}
              </ul>
            </section>
          )}
          {earlier.length > 0 && (
            <section className="mx-5 mt-6">
              <h2 className="text-xs uppercase tracking-wider text-ink-faded font-bold mb-2">
                {earlier.length}
              </h2>
              <ul className="space-y-2">
                {earlier.map((r) => (
                  <EventRow key={r.id} row={r} t={t} dateFmt={dateFmt} unread={false} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
    <BottomNav lang={lang as 'he' | 'en'} t={t} />
    </>
  );
}

function taskKindLabel(kind: KidTaskItem['kind'], t: ReturnType<typeof getDictionary>): string {
  switch (kind) {
    case 'denied':
      return t.notifications.taskDenied;
    case 'needsPhoto':
      return t.notifications.taskNeedsPhoto;
    default:
      return t.notifications.taskTodo;
  }
}

/** A tappable "needs you" row (task or message) linking back to the home
 *  surface where the kid can actually act on it. */
function ActionRow({
  href,
  label,
  detail,
}: {
  href: string;
  label: string;
  detail: string;
}) {
  return (
    <li>
      <a
        href={href}
        className="rounded-2xl border border-pink-pale bg-pink-soft p-3 flex items-center justify-between gap-3 hover:-translate-y-px transition"
      >
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">{label}</p>
          <p className="text-xs text-ink-soft truncate" dir="auto">{detail}</p>
        </div>
        <span className="text-pink-dark shrink-0" aria-hidden="true">›</span>
      </a>
    </li>
  );
}

function eventLabel(eventKind: string, t: ReturnType<typeof getDictionary>): string {
  switch (eventKind) {
    case 'campaign_completed':
      return t.notifications.campaignCompleted;
    case 'sibling_badge_earned':
      return t.notifications.siblingBadge;
    case 'streak_broken':
      return t.notifications.streakBroken;
    case 'streak_freeze_used':
      return t.notifications.streakFreezeUsed;
    case 'submission_approved':
      return t.notifications.submissionApproved;
    case 'submission_denied':
      return t.notifications.submissionDenied;
    case 'redemption_received':
      return t.notifications.redemptionReceived;
    case 'redemption_refunded':
      return t.notifications.redemptionRefunded;
    case 'admin_wallet_adjustment':
      return t.notifications.adminWalletAdjustment;
    default:
      return eventKind;
  }
}

function EventRow({
  row,
  t,
  dateFmt,
  unread,
}: {
  row: Row;
  t: ReturnType<typeof getDictionary>;
  dateFmt: Intl.DateTimeFormat;
  unread: boolean;
}) {
  return (
    <li
      className={`rounded-2xl border p-3 flex items-center justify-between gap-3 ${
        unread ? 'bg-pink-soft border-pink-pale' : 'bg-card border-rule'
      }`}
    >
      <p className={`text-sm ${unread ? 'font-bold text-ink' : 'text-ink-soft'} truncate`}>
        {eventLabel(row.eventKind, t)}
      </p>
      <span className="text-[11px] text-ink-faded num shrink-0" dir="ltr">
        {dateFmt.format(new Date(row.createdAt))}
      </span>
    </li>
  );
}
