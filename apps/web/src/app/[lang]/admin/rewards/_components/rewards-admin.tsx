/**
 * Rewards admin list — client shell adding filtering, bulk actions, and image
 * thumbnails on top of the reward catalog (Lily's request).
 *
 *   - Filter chips: All / No image / No description / Hidden — quick triage of
 *     rewards that are missing things.
 *   - Bulk select (per-row checkbox + select-all) → a sticky action bar to
 *     Show / Hide / Add points / Archive / Restore the selected rewards in one
 *     shot (bulkUpdateRewardsAction).
 *   - Each row shows a tiny photo thumbnail when the reward has an uploaded
 *     image, so the admin can see at a glance which ones still need one.
 *
 * Selection + filter live in client state; the bulk mutation posts the chosen
 * ids to the server action, which re-scopes them to the household.
 */

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Dictionary } from '@reco/shared/i18n';
import { Coin } from '../../../../../components/coin';
import { RewardIcon } from '../../../../../components/reward-icon';
import {
  bulkUpdateRewardsAction,
  toggleArchiveRewardAction,
} from '../../../../../lib/admin-rewards/actions';

export interface RewardRow {
  id: string;
  title: string;
  coinCost: number;
  stockQuantity: number | null;
  maxPerKidPerDay: number | null;
  visibleToKids: boolean;
  archived: boolean;
  iconKey: string;
  color: string;
  imageUrl: string | null;
  hasDescription: boolean;
}

type Filter = 'all' | 'noImage' | 'noDescription' | 'hidden';

export function RewardsAdmin({
  lang,
  t,
  rows,
}: {
  lang: string;
  t: Dictionary;
  rows: RewardRow[];
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const matches = (r: RewardRow): boolean => {
    switch (filter) {
      case 'noImage':
        return r.imageUrl == null;
      case 'noDescription':
        return !r.hasDescription;
      case 'hidden':
        return !r.visibleToKids;
      default:
        return true;
    }
  };

  const visibleRows = useMemo(() => rows.filter(matches), [rows, filter]);
  const active = visibleRows.filter((r) => !r.archived);
  const archived = visibleRows.filter((r) => r.archived);

  const visibleIds = visibleRows.map((r) => r.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...visibleIds]);
    });

  const selectedIds = [...selected];

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: t.admin.filterAll },
    { key: 'noImage', label: t.admin.filterNoImage },
    { key: 'noDescription', label: t.admin.filterNoDescription },
    { key: 'hidden', label: t.admin.filterHidden },
  ];

  const renderRow = (r: RewardRow) => {
    const isSel = selected.has(r.id);
    return (
      <li
        key={r.id}
        className={`bg-card rounded-2xl shadow-card border p-4 ${
          isSel ? 'border-pink' : 'border-rule'
        } ${r.archived ? 'opacity-50' : ''}`}
      >
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isSel}
            onChange={() => toggle(r.id)}
            aria-label={r.title}
            className="mt-1 w-4 h-4 accent-pink shrink-0"
          />
          {/* Thumbnail when the reward has a photo; else the icon fallback. */}
          {r.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={r.imageUrl}
              alt=""
              className="w-12 h-12 rounded-xl object-cover border border-rule shrink-0"
            />
          ) : (
            <RewardIcon iconKey={r.iconKey} color={r.color} title={r.title} size={48} />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-ink break-words leading-snug">{r.title}</p>
            <p className="text-xs text-ink-soft mt-1 break-words">
              {r.stockQuantity === null
                ? t.admin.stockUnlimited
                : `${t.admin.stockQuantity.split(' (')[0]}: ${r.stockQuantity}`}
              {r.maxPerKidPerDay !== null && (
                <span> · {r.maxPerKidPerDay} {t.redeem.perDayLimit}</span>
              )}
              {!r.imageUrl && (
                <span className="ms-2 inline-block text-[10px] uppercase tracking-wider text-ink-faded">
                  {t.admin.noImage}
                </span>
              )}
              {!r.visibleToKids && (
                <span className="ms-2 inline-block text-[10px] uppercase tracking-wider text-pink-dark">
                  hidden
                </span>
              )}
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-pale text-[#7A5D10] text-xs font-bold num">
            <Coin size={14} />
            <span dir="ltr">{r.coinCost}</span>
          </span>
        </div>
        <div className="flex justify-end items-center gap-4 mt-3 pt-3 border-t border-rule">
          <Link href={`/${lang}/admin/rewards/${r.id}/edit`} className="btn-admin-ghost">
            {t.common.edit}
          </Link>
          <form action={toggleArchiveRewardAction}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="lang" value={lang} />
            <button type="submit" className="btn-admin-ghost">
              {r.archived ? t.admin.unarchive : t.admin.archive}
            </button>
          </form>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const on = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              data-on={on}
              className="chip-admin"
            >
              {f.label}
            </button>
          );
        })}
        <button type="button" onClick={toggleAll} className="chip-admin ms-auto">
          {t.admin.bulkSelectAll}
        </button>
      </div>

      {/* Bulk action bar — only when something is selected */}
      {selectedIds.length > 0 && (
        <form
          action={bulkUpdateRewardsAction}
          className="sticky top-2 z-10 bg-card rounded-2xl border border-rule shadow-card p-3 flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="lang" value={lang} />
          {selectedIds.map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}
          <span className="num text-sm font-bold text-ink me-1" dir="ltr">
            {selectedIds.length}
          </span>
          <span className="text-sm text-ink-soft me-2">{t.admin.bulkSelected}</span>

          <button name="op" value="show" className="chip-admin">
            {t.admin.bulkShow}
          </button>
          <button name="op" value="hide" className="chip-admin">
            {t.admin.bulkHide}
          </button>

          <span className="inline-flex items-center gap-1">
            <input
              type="number"
              name="amount"
              defaultValue={5}
              className="w-16 px-2 py-1.5 rounded-lg border border-rule text-xs num text-center"
              dir="ltr"
              aria-label={t.admin.bulkAddPoints}
            />
            <button name="op" value="addPoints" className="chip-admin">
              {t.admin.bulkAddPoints}
            </button>
          </span>

          <button name="op" value="archive" className="chip-admin">
            {t.admin.bulkArchiveSel}
          </button>
          <button name="op" value="unarchive" className="chip-admin">
            {t.admin.bulkUnarchiveSel}
          </button>

          <button type="button" onClick={() => setSelected(new Set())} className="btn-admin-ghost ms-auto">
            {t.admin.bulkClear}
          </button>
        </form>
      )}

      {visibleRows.length === 0 ? (
        <div className="bg-card rounded-2xl border border-rule p-8 text-center">
          <p className="text-ink-soft">—</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section className="space-y-3">
              <SectionHeader label={t.admin.sectionActive} count={active.length} />
              <ul className="space-y-3">{active.map(renderRow)}</ul>
            </section>
          )}
          {archived.length > 0 && (
            <section className="space-y-3">
              <SectionHeader label={t.admin.sectionArchived} count={archived.length} />
              <ul className="space-y-3">{archived.map(renderRow)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-wider text-ink-soft px-1">
      {label}{' '}
      <span className="num text-ink-faded" dir="ltr">
        ({count})
      </span>
    </h2>
  );
}
