/**
 * Kid redemption tracker — client shell.
 *
 * Pending rows live in their own list at the top with mint accents
 * (BRANDBOOK §2: mint = positive expectation, here "your treat is on the
 * way"). Resolved rows live in a quieter list below, with cancelled/refunded
 * rows getting the pink-soft container + parent's reason inline.
 *
 * The "got it!" button uses kidMarkReceivedAction; on success the row hides
 * itself locally so the kid sees instant feedback even before
 * revalidatePath ships a fresh render.
 */

'use client';

import { useActionState, useEffect, useState } from 'react';
import type { Dictionary } from '@reco/shared/i18n';
import {
  kidMarkReceivedAction,
  type MarkReceivedState,
} from '../../../../../lib/redeem/actions';
import { Coin } from '../../../../../components/coin';
import { BottomNav } from '../../../_components/bottom-nav';
import { Avatar } from '../../../../../components/avatar';
import { arrowBack } from '../../../../../lib/rtl';

export interface HistoryRedemption {
  id: string;
  titleHe: string;
  titleEn: string;
  coinCost: number;
  status: 'pending_delivery' | 'received' | 'cancelled' | 'refunded';
  redeemedAt: string;
  receivedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  refundedAt: string | null;
  refundReason: string | null;
}

interface Props {
  lang: 'he' | 'en';
  t: Dictionary;
  kidName: string;
  kidColor: string;
  kidAvatarKey: string | null;
  balance: number;
  items: HistoryRedemption[];
  shopHref: string;
}

export function History(props: Props) {
  const { lang, t, kidName, kidColor, kidAvatarKey, balance, items, shopHref } = props;
  const pending = items.filter((r) => r.status === 'pending_delivery');
  const resolved = items.filter((r) => r.status !== 'pending_delivery');

  return (
    <>
    <main className="min-h-screen bg-bg pb-28">
      <header className="px-5 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={kidName} color={kidColor} avatarKey={kidAvatarKey} size={48} />
          <h1 className="text-2xl font-bold text-ink">{t.redeem.historyLink}</h1>
        </div>
        <a
          href={shopHref}
          className="text-xs text-pink-dark font-bold hover:underline"
        >
          {arrowBack(lang)} {t.redeem.title}
        </a>
      </header>

      <section className="mx-5 mt-2">
        <div className="bg-card rounded-2xl shadow-card px-4 py-3 flex items-center gap-2">
          <Coin size={22} />
          <span className="text-2xl font-extrabold text-ink num" dir="ltr">
            {balance}
          </span>
          <span className="text-xs text-ink-soft">{t.wallet.coins}</span>
        </div>
      </section>

      {pending.length > 0 && (
        <section className="mx-5 mt-6">
          <h2 className="text-base font-bold text-ink mb-3">
            {t.redeem.pendingTitle}
          </h2>
          <ul className="space-y-3">
            {pending.map((r) => (
              <PendingRow key={r.id} item={r} lang={lang} t={t} />
            ))}
          </ul>
        </section>
      )}

      <section className="mx-5 mt-6">
        <h2 className="text-base font-bold text-ink mb-3">
          {t.redeem.receivedTitle}
        </h2>
        {resolved.length === 0 && pending.length === 0 ? (
          <div className="bg-card rounded-2xl border border-rule p-6 text-center">
            <p className="font-bold text-ink">{t.redeem.historyEmpty}</p>
            <p className="text-sm text-ink-soft mt-1">{t.redeem.historyEmptyHint}</p>
          </div>
        ) : resolved.length === 0 ? (
          <p className="text-sm text-ink-soft">{t.redeem.historyEmptyHint}</p>
        ) : (
          <ul className="space-y-2">
            {resolved.map((r) => (
              <ResolvedRow key={r.id} item={r} lang={lang} t={t} />
            ))}
          </ul>
        )}
      </section>
    </main>
    <BottomNav lang={lang} t={t} />
    </>
  );
}

function PendingRow({
  item,
  lang,
  t,
}: {
  item: HistoryRedemption;
  lang: 'he' | 'en';
  t: Dictionary;
}) {
  const title = lang === 'he' ? item.titleHe : item.titleEn;
  const [state, action, pending] = useActionState<
    MarkReceivedState | undefined,
    FormData
  >(kidMarkReceivedAction, undefined);

  // Optimistic hide once the server confirms.
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (state?.ok === true) setHidden(true);
  }, [state]);
  if (hidden) return null;

  return (
    <li className="bg-mint-soft rounded-2xl border border-mint-pale shadow-card p-4 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-bold text-ink text-[15px] truncate">{title}</p>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
          <Coin size={14} />
          <span className="num" dir="ltr">
            {item.coinCost}
          </span>
          <span>· {fmtRel(item.redeemedAt, lang)}</span>
        </div>
        {state?.ok === false && (
          <p className="text-xs text-pink-dark mt-1">{t.redeem.redeemError}</p>
        )}
      </div>
      <form action={action}>
        <input type="hidden" name="redemptionId" value={item.id} />
        <button
          type="submit"
          disabled={pending}
          className="bg-mint-dark text-card font-bold rounded-full py-2 px-4 text-xs transition hover:-translate-y-px active:translate-y-0 disabled:opacity-60"
        >
          {pending ? '…' : t.redeem.gotIt}
        </button>
      </form>
    </li>
  );
}

function ResolvedRow({
  item,
  lang,
  t,
}: {
  item: HistoryRedemption;
  lang: 'he' | 'en';
  t: Dictionary;
}) {
  const title = lang === 'he' ? item.titleHe : item.titleEn;
  const containerClass =
    item.status === 'received'
      ? 'bg-card border-rule'
      : 'bg-pink-soft border-pink-pale';
  const statusLabel =
    item.status === 'received'
      ? `${t.redeem.receivedAt}: ${fmtRel(item.receivedAt ?? item.redeemedAt, lang)}`
      : item.status === 'cancelled'
        ? t.redeem.cancelled
        : t.redeem.refunded;
  const reason =
    item.status === 'cancelled'
      ? item.cancelReason
      : item.status === 'refunded'
        ? item.refundReason
        : null;
  const reasonLabel =
    item.status === 'cancelled'
      ? t.redeem.cancelReasonLabel
      : item.status === 'refunded'
        ? t.redeem.refundReasonLabel
        : null;

  return (
    <li className={`rounded-2xl border p-3 ${containerClass}`}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-ink text-sm truncate">{title}</p>
          <p className="text-[11px] text-ink-soft mt-0.5">{statusLabel}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-bold text-ink-soft num">
          <Coin size={14} />
          <span dir="ltr">{item.coinCost}</span>
        </span>
      </div>
      {reason && (
        <p className="text-xs text-ink mt-2 leading-snug bg-card rounded-xl p-2 border border-rule">
          <span className="text-ink-soft me-1">{reasonLabel}:</span>
          {reason}
        </p>
      )}
    </li>
  );
}

function fmtRel(iso: string, lang: 'he' | 'en'): string {
  // Coarse relative formatter: "today", "yesterday", or absolute date.
  // The home page shows everything in Asia/Jerusalem; we render here in
  // the browser locale because the kid is on the device, and Intl handles
  // both Hebrew + English. Fine-grained relative times will arrive in
  // Phase 9's polish pass.
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return lang === 'he' ? 'עכשיו' : 'just now';
  if (diffMin < 60) return lang === 'he' ? `לפני ${diffMin} ד׳` : `${diffMin}m ago`;
  const fmt = new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return fmt.format(d);
}
