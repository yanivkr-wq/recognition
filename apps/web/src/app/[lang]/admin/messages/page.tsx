/**
 * Admin · player messages.
 *
 * Compose a popup message for one player or all players, with a date window,
 * and see/manage the messages already sent. The kid sees an active,
 * non-dismissed message as a popup on their home (see player-message-popup).
 */

import { redirect } from 'next/navigation';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, getPool, kid as kidTable, playerMessage } from '@reco/db';
import { auth } from '../../../../auth';
import { archivePlayerMessageAction } from '../../../../lib/player-messages/actions';
import { MessageComposeForm } from './_components/message-compose-form';

export const dynamic = 'force-dynamic';

export default async function AdminMessagesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);
  const householdId = session.user.householdId;

  const db = getDb();
  const [kids, messages, dateRes] = await Promise.all([
    db
      .select({ id: kidTable.id, name: kidTable.name, color: kidTable.color })
      .from(kidTable)
      .where(and(eq(kidTable.householdId, householdId), isNull(kidTable.archivedAt)))
      .orderBy(asc(kidTable.name)),
    db
      .select({
        id: playerMessage.id,
        kidId: playerMessage.kidId,
        title: playerMessage.title,
        body: playerMessage.body,
        startDate: playerMessage.startDate,
        endDate: playerMessage.endDate,
      })
      .from(playerMessage)
      .where(and(eq(playerMessage.householdId, householdId), isNull(playerMessage.archivedAt)))
      .orderBy(desc(playerMessage.createdAt)),
    getPool().query<{ today: string; week: string }>(
      `SELECT (now() AT TIME ZONE 'Asia/Jerusalem')::date::text AS today,
              ((now() AT TIME ZONE 'Asia/Jerusalem')::date + 7)::text AS week`,
    ),
  ]);
  const today = dateRes.rows[0]!.today;
  const week = dateRes.rows[0]!.week;
  const kidName = new Map(kids.map((k) => [k.id, k.name]));

  function statusLabel(start: string, end: string): string {
    if (today < start) return t.playerMsg.statusScheduled;
    if (today > end) return t.playerMsg.statusExpired;
    return t.playerMsg.statusActive;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{t.playerMsg.heading}</h1>

      <MessageComposeForm
        lang={lang as 'he' | 'en'}
        t={t}
        kids={kids}
        defaultStart={today}
        defaultEnd={week}
      />

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-soft px-1">
          {t.playerMsg.listHeading}
        </h2>
        {messages.length === 0 ? (
          <div className="bg-card rounded-2xl border border-rule p-6 text-center">
            <p className="text-ink-soft">{t.playerMsg.empty}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li key={m.id} className="bg-card rounded-2xl shadow-card border border-rule p-4 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="inline-block px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold bg-lavender-pale text-lavender-dark">
                      {m.kidId ? kidName.get(m.kidId) ?? '—' : t.playerMsg.targetAll}
                    </span>
                    <span className="inline-block px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold bg-bg text-ink-soft border border-rule">
                      {statusLabel(m.startDate, m.endDate)}
                    </span>
                  </div>
                  <span className="text-[11px] text-ink-faded num" dir="ltr">
                    {m.startDate} → {m.endDate}
                  </span>
                </div>
                {m.title && <p className="font-bold text-ink text-sm">{m.title}</p>}
                <p className="text-sm text-ink whitespace-pre-wrap" dir="auto">
                  {m.body}
                </p>
                <form action={archivePlayerMessageAction} className="pt-1">
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="lang" value={lang} />
                  <button
                    type="submit"
                    className="text-xs text-ink-soft underline-offset-2 hover:underline"
                  >
                    {t.playerMsg.archive}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
