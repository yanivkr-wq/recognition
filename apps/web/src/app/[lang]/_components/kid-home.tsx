/**
 * Kid home — top wallet card + today's task list.
 *
 * Client component so the wallet number can pulse on coin events from
 * child TaskCards. The server component (page.tsx) does the actual data
 * fetch + first paint; we just rehydrate with the initial values and
 * subscribe to balance updates.
 */

'use client';

import { useEffect, useState } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import { TaskCard, type TaskCardStatus } from './task-card';
import {
  LongTermTaskCard,
  type TodaysProgressEntry,
} from './long-term-task-card';
import { Coin } from '../../../components/coin';
import { getIcon } from '../../../components/icon-library';
import { celebrate } from '../../../lib/celebrate';
import { BottomNav } from './bottom-nav';
import { Avatar } from '../../../components/avatar';
import { arrowForward } from '../../../lib/rtl';

export interface KidHomeTask {
  assignmentId: string;
  completionId: string | null;
  status: TaskCardStatus;
  titleHe: string;
  titleEn: string;
  iconKey: string;
  color: string;
  coinValue: number;
  evidenceRequired: boolean;
  denyReason: string | null;
  /** Optional 'HH:MM:SS' deadline in household tz. The kid card renders a
   *  countdown when set and the status is 'todo'; the page-level server
   *  query already flipped status to 'locked' if it's past the deadline. */
  deadlineTime: string | null;
}

export interface KidHomeLongTermTask {
  assignmentId: string;
  titleHe: string;
  titleEn: string;
  iconKey: string;
  color: string;
  perUnitCoins: number;
  goalQuantity: number;
  bonusOnComplete: number | null;
  unitLabelHe: string;
  unitLabelEn: string;
  currentTotal: number;
  completed: boolean;
  todaysEntries: TodaysProgressEntry[];
}

interface Props {
  lang: 'he' | 'en';
  t: Dictionary;
  kidName: string;
  kidColor: string;
  initialBalance: number;
  tasks: KidHomeTask[];
  longTermTasks: KidHomeLongTermTask[];
  logoutUrl: string;
  walletHref: string;
  shopHref: string;
  campaignsHref: string;
  badgesHref: string;
  notificationsHref: string;
  unreadCount: number;
  avatarKey: string | null;
  avatarHref: string;
}

export function KidHome(props: Props) {
  const {
    lang,
    t,
    kidName,
    kidColor,
    initialBalance,
    tasks,
    longTermTasks,
    logoutUrl,
    walletHref,
    shopHref,
    campaignsHref,
    badgesHref,
    notificationsHref,
    unreadCount,
    avatarKey,
    avatarHref,
  } = props;
  const Bell = getIcon('ic-bell')?.Component;
  const [balance, setBalance] = useState<number>(initialBalance);
  const [pulse, setPulse] = useState<boolean>(false);

  // Sync local balance with the server's freshly-rendered initialBalance
  // after every revalidatePath (task complete, undo, redeem, joker, etc.).
  // Without this, the wallet hero stays stuck on the value it was
  // initialized with because useState ignores subsequent prop changes.
  useEffect(() => {
    setBalance(initialBalance);
  }, [initialBalance]);

  // Pulse animation when balance changes (BRANDBOOK §9.3 "earn coins" pattern).
  useEffect(() => {
    if (balance === initialBalance) return;
    setPulse(true);
    const id = setTimeout(() => setPulse(false), 400);
    return () => clearTimeout(id);
  }, [balance, initialBalance]);

  return (
    <>
    <main className="min-h-screen bg-bg pb-28">
      {/* Top bar — avatar placeholder + switch-user */}
      <header className="px-5 pt-12 pb-3 flex items-center justify-between">
        <a href={avatarHref} className="flex items-center gap-3 group">
          <Avatar name={kidName} color={kidColor} avatarKey={avatarKey} size={48} />
          <h1 className="text-2xl font-bold text-ink group-hover:underline underline-offset-4">
            {kidName}
          </h1>
        </a>
        <div className="flex items-center gap-3">
          {/* Fix 12b: bell icon — count chip when there are unread events.
              Tap → /notifications. Real bell rendering of events sits on
              that page. Phase 8 will wire the polling + mark-read flow. */}
          <a
            href={notificationsHref}
            className="relative w-9 h-9 rounded-full bg-card border border-rule flex items-center justify-center text-ink hover:border-pink-pale transition"
            aria-label="התראות"
          >
            {Bell && <Bell size={18} />}
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full bg-pink text-card text-[10px] font-bold leading-none flex items-center justify-center num"
                dir="ltr"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </a>
          <form action={logoutUrl} method="POST">
            <button
              type="submit"
              className="text-xs text-ink-soft underline-offset-4 hover:underline"
            >
              {t.home.switchUser}
            </button>
          </form>
        </div>
      </header>

      {/* Wallet hero card */}
      <section className="mx-5">
        <a
          href={walletHref}
          className="block bg-card rounded-3xl shadow-card p-5 transition active:scale-[0.99]"
        >
          <p className="text-xs uppercase tracking-wider text-ink-soft">
            {t.wallet.myBalance}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <Coin size={36} />
            <span
              className={`text-5xl font-extrabold text-ink num transition-transform ${
                pulse ? 'scale-110' : 'scale-100'
              }`}
              style={{ transitionDuration: '200ms' }}
              dir="ltr"
            >
              {balance}
            </span>
            <span className="text-sm text-ink-soft self-end pb-2">
              {t.wallet.coins}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-ink-faded">
            {t.wallet.history} {arrowForward(lang)}
          </p>
        </a>
        <a
          href={shopHref}
          className="mt-3 flex items-center justify-center gap-2 bg-pink text-card font-bold rounded-full py-3 text-center shadow-cta-pink transition active:scale-[0.99]"
        >
          {(() => {
            const Gift = getIcon('rw-gift')?.Component;
            return Gift ? <Gift size={20} /> : null;
          })()}
          <span>{t.home.shopLink}</span>
          <span aria-hidden>{arrowForward(lang)}</span>
        </a>
        {/* Campaigns + badges + wallet links live in the bottom nav now
            (Fix 7). The shop CTA stays here because it's the loudest
            "spend coins" action and the wallet hero is the natural launch
            point for it. */}
      </section>

      {/* Today's tasks — split into active vs completed (Fix 2). Done tasks
          drop to a separate, calmer section so the active list isn't visually
          cluttered. The kid still has a clear path to undo via the bigger
          button on the done card. */}
      {tasks.length === 0 ? (
        <section className="mx-5 mt-8">
          <h2 className="text-base font-bold text-ink mb-3">{t.home.todaysTasks}</h2>
          <div className="bg-card rounded-2xl border border-rule p-6 text-center">
            <p className="font-bold text-ink">{t.home.noTasks}</p>
            <p className="text-sm text-ink-soft mt-1">{t.home.noTasksHint}</p>
          </div>
        </section>
      ) : (
        <>
          {(() => {
            const active = tasks.filter((t) => t.status !== 'done');
            const done = tasks.filter((t) => t.status === 'done');
            // Fix 4a: when the LAST active card is completed, fire a "big"
            // confetti burst on top of the per-card "small" one. The task
            // card's own onLastActive callback fires after a successful
            // completion — we only kick the big burst if this completion
            // dropped active.length to 0.
            const fireMilestone = () => {
              if (active.length === 1) {
                void celebrate({ intensity: 'big' });
              }
            };
            return (
              <>
                <section className="mx-5 mt-8">
                  <h2 className="text-base font-bold text-ink mb-3 flex items-center gap-2">
                    {(() => {
                      const Sparkle = getIcon('ic-sparkle')?.Component;
                      return Sparkle ? <Sparkle size={18} /> : null;
                    })()}
                    {active.length > 0 ? t.home.activeTasks : t.home.todaysTasks}
                  </h2>
                  {active.length === 0 ? (
                    <div className="bg-mint-soft border border-mint-pale rounded-2xl p-6 text-center flex flex-col items-center gap-2">
                      {(() => {
                        const Party = getIcon('ic-party')?.Component;
                        return Party ? (
                          <span className="text-mint-dark">
                            <Party size={28} />
                          </span>
                        ) : null;
                      })()}
                      <p className="font-bold text-mint-dark">כל הכבוד! סיימת הכל</p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {active.map((task) => (
                        <TaskCard
                          key={task.assignmentId}
                          {...task}
                          lang={lang}
                          t={t}
                          onBalance={setBalance}
                          onLastActive={fireMilestone}
                        />
                      ))}
                    </ul>
                  )}
                </section>
                {done.length > 0 && (
                  <section className="mx-5 mt-6">
                    <h2 className="text-sm font-bold text-mint-dark mb-2 opacity-80 flex items-center gap-2">
                      {(() => {
                        const Check = getIcon('ic-check-circle')?.Component;
                        return Check ? <Check size={16} /> : null;
                      })()}
                      {t.home.completedTasks}
                    </h2>
                    <ul className="space-y-2">
                      {done.map((task) => (
                        <TaskCard
                          key={task.assignmentId}
                          {...task}
                          lang={lang}
                          t={t}
                          onBalance={setBalance}
                        />
                      ))}
                    </ul>
                  </section>
                )}
              </>
            );
          })()}
        </>
      )}

      {/* Long-term goals — rendered iff there's at least one assigned */}
      {longTermTasks.length > 0 && (
        <section className="mx-5 mt-8">
          <h2 className="text-base font-bold text-ink mb-3">{t.longTerm.sectionTitle}</h2>
          <ul className="space-y-3">
            {longTermTasks.map((task) => (
              <LongTermTaskCard
                key={task.assignmentId}
                {...task}
                lang={lang}
                t={t}
                onBalance={setBalance}
              />
            ))}
          </ul>
        </section>
      )}
    </main>
    {/* Fixed-position bottom nav sits as a sibling so it isn't constrained
        by the scrolling main's overflow context. */}
    <BottomNav lang={lang} t={t} />
    </>
  );
}
