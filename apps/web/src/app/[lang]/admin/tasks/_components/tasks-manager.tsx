/**
 * Admin · tasks manager (client).
 *
 * One screen to see every task template, which kids each is assigned to
 * (active assignments shown as colored kid chips), filter the list, and run
 * bulk operations on a multi-select:
 *   - Archive / Unarchive
 *   - Edit (coin value and/or photo requirement; leave-the-rest semantics)
 *   - Assign to one or more kids (additive — never un-assigns)
 *
 * Filters (kid / kind / photo / status) are pure client-side over the full
 * list the server hands down, so toggling them is instant and never refetches.
 * Bulk actions post the selected templateIds through useActionState; on
 * success the selection clears and any open panel closes (keyed effect).
 *
 * Kind is deliberately absent from bulk edit: flipping daily↔long_term would
 * orphan existing completion / progress rows (mirrors the single-edit guard).
 */

'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Dictionary } from '@reco/shared/i18n';
import { Coin } from '../../../../../components/coin';
import { TaskIcon } from '../../../../../components/task-icon';
import {
  bulkArchiveTasksAction,
  bulkEditTasksAction,
  bulkAssignTemplatesToKidsAction,
  type BulkOpResult,
} from '../../../../../lib/admin-tasks/actions';

export interface ManagerKid {
  id: string;
  name: string;
  color: string;
}

export interface ManagerTask {
  id: string;
  titleHe: string;
  titleEn: string;
  iconKey: string;
  color: string;
  coinValue: number;
  kind: 'daily' | 'long_term';
  evidenceRequired: boolean;
  archived: boolean;
  assignedKids: ManagerKid[];
}

interface Props {
  lang: 'he' | 'en';
  t: Dictionary;
  tasks: ManagerTask[];
  kids: ManagerKid[];
}

type KindFilter = 'all' | 'daily' | 'long_term';
type EvidenceFilter = 'all' | 'yes' | 'no';
type StatusFilter = 'active' | 'archived' | 'all';
type Panel = null | 'edit' | 'assign';

export function TasksManager({ lang, t, tasks, kids }: Props) {
  const [kidFilter, setKidFilter] = useState<string>('all');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [evidenceFilter, setEvidenceFilter] = useState<EvidenceFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<Panel>(null);

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      if (statusFilter === 'active' && task.archived) return false;
      if (statusFilter === 'archived' && !task.archived) return false;
      if (kindFilter !== 'all' && task.kind !== kindFilter) return false;
      if (evidenceFilter === 'yes' && !task.evidenceRequired) return false;
      if (evidenceFilter === 'no' && task.evidenceRequired) return false;
      if (kidFilter !== 'all' && !task.assignedKids.some((k) => k.id === kidFilter)) return false;
      return true;
    });
  }, [tasks, statusFilter, kindFilter, evidenceFilter, kidFilter]);

  // Keep selection within the currently-visible set so a hidden task can't be
  // silently mutated by a bulk action.
  const visibleIds = useMemo(() => new Set(filtered.map((task) => task.id)), [filtered]);
  const selectedVisible = useMemo(
    () => [...selected].filter((id) => visibleIds.has(id)),
    [selected, visibleIds],
  );
  const selectedCount = selectedVisible.length;

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectAllVisible = () => setSelected(new Set(filtered.map((task) => task.id)));
  const clearSelection = () => setSelected(new Set());

  const anyArchivedSelected = selectedVisible.some(
    (id) => tasks.find((task) => task.id === id)?.archived,
  );
  const anyActiveSelected = selectedVisible.some(
    (id) => !tasks.find((task) => task.id === id)?.archived,
  );

  return (
    <div className="space-y-5 pb-28">
      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-rule p-3 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
          {t.admin.filtersLabel}
        </p>

        {/* Kid filter — colored chips. */}
        <div className="flex flex-wrap gap-2">
          <FilterChip active={kidFilter === 'all'} onClick={() => setKidFilter('all')}>
            {t.admin.filterKidAll}
          </FilterChip>
          {kids.map((k) => (
            <FilterChip key={k.id} active={kidFilter === k.id} onClick={() => setKidFilter(k.id)}>
              <span
                className="inline-block w-2.5 h-2.5 rounded-full me-1.5 align-middle"
                style={{ backgroundColor: k.color }}
                aria-hidden="true"
              />
              {k.name}
            </FilterChip>
          ))}
        </div>

        {/* Kind + photo + status — compact segmented rows. */}
        <div className="flex flex-wrap gap-2">
          <FilterChip active={kindFilter === 'all'} onClick={() => setKindFilter('all')}>
            {t.admin.filterKindAll}
          </FilterChip>
          <FilterChip active={kindFilter === 'daily'} onClick={() => setKindFilter('daily')}>
            {t.admin.kindDaily}
          </FilterChip>
          <FilterChip active={kindFilter === 'long_term'} onClick={() => setKindFilter('long_term')}>
            {t.admin.kindLongTerm}
          </FilterChip>
          <span className="w-px bg-rule mx-1" aria-hidden="true" />
          <FilterChip active={evidenceFilter === 'all'} onClick={() => setEvidenceFilter('all')}>
            {t.admin.filterEvidenceAll}
          </FilterChip>
          <FilterChip active={evidenceFilter === 'yes'} onClick={() => setEvidenceFilter('yes')}>
            {t.admin.filterEvidenceYes}
          </FilterChip>
          <FilterChip active={evidenceFilter === 'no'} onClick={() => setEvidenceFilter('no')}>
            {t.admin.filterEvidenceNo}
          </FilterChip>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterChip active={statusFilter === 'active'} onClick={() => setStatusFilter('active')}>
            {t.admin.filterStatusActive}
          </FilterChip>
          <FilterChip
            active={statusFilter === 'archived'}
            onClick={() => setStatusFilter('archived')}
          >
            {t.admin.filterStatusArchived}
          </FilterChip>
          <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
            {t.admin.filterStatusAll}
          </FilterChip>
          <span className="flex-1" />
          <button
            type="button"
            onClick={selectAllVisible}
            className="btn-admin-ghost text-xs"
          >
            {t.admin.bulkAssignSelectAll}
          </button>
        </div>
      </div>

      {/* ── List ────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <p className="text-sm text-ink-soft bg-card rounded-2xl border border-rule p-6 text-center">
          {t.admin.noTasksMatch}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((task) => {
            const title = lang === 'he' ? task.titleHe : task.titleEn;
            const isSel = selected.has(task.id);
            return (
              <li
                key={task.id}
                className={`bg-card rounded-2xl shadow-card border p-4 space-y-3 transition ${
                  isSel ? 'border-pink ring-2 ring-pink-pale/50' : 'border-rule'
                } ${task.archived ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggleOne(task.id)}
                    aria-label={title}
                    className="w-5 h-5 accent-pink shrink-0 mt-0.5"
                  />
                  <TaskIcon iconKey={task.iconKey} color={task.color} title={title} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-ink leading-snug break-words">{title}</p>
                    <p className="text-xs text-ink-soft mt-0.5">
                      {task.kind === 'long_term' ? t.admin.kindLongTerm : t.admin.kindDaily}
                      {task.evidenceRequired && ` · ${t.admin.evidenceRequired}`}
                    </p>
                    {/* Assigned-kid chips. */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {task.assignedKids.length === 0 ? (
                        <span className="text-[11px] text-ink-faded">{t.admin.notAssigned}</span>
                      ) : (
                        task.assignedKids.map((k) => (
                          <span
                            key={k.id}
                            className="inline-flex items-center gap-1 rounded-full ps-1.5 pe-2 py-0.5 text-[11px] font-bold text-ink"
                            style={{ backgroundColor: `${k.color}33` }}
                          >
                            <span
                              className="inline-block w-2 h-2 rounded-full"
                              style={{ backgroundColor: k.color }}
                              aria-hidden="true"
                            />
                            {k.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-3 border-t border-rule/60">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-pale text-[#7A5D10] text-xs font-bold num">
                    <Coin size={14} />
                    <span dir="ltr">{task.coinValue}</span>
                  </span>
                  <Link
                    href={`/${lang}/admin/tasks/${task.id}/edit`}
                    className="btn-admin-ghost"
                  >
                    {t.common.edit}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Bulk action bar ─────────────────────────────────────────────── */}
      {selectedCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 bg-card border-t border-rule shadow-card">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-ink num">
              <span dir="ltr">{selectedCount}</span>{' '}
              <span className="text-ink-soft font-medium">{t.admin.bulkBarSelected}</span>
            </span>
            <span className="flex-1" />

            {anyActiveSelected && (
              <BulkArchiveButton
                ids={selectedVisible}
                archive
                label={t.admin.bulkArchiveAction}
                onDone={clearSelection}
                tone="ink"
              />
            )}
            {anyArchivedSelected && (
              <BulkArchiveButton
                ids={selectedVisible}
                archive={false}
                label={t.admin.bulkUnarchiveAction}
                onDone={clearSelection}
                tone="mint"
              />
            )}
            <button
              type="button"
              onClick={() => setPanel('edit')}
              className="btn-admin-secondary"
            >
              {t.admin.bulkEditAction}
            </button>
            <button
              type="button"
              onClick={() => setPanel('assign')}
              className="btn-admin"
            >
              {t.admin.bulkAssignAction}
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="btn-admin-ghost"
            >
              {t.admin.bulkClearSelection}
            </button>
          </div>
        </div>
      )}

      {/* ── Bulk edit panel ─────────────────────────────────────────────── */}
      {panel === 'edit' && (
        <BulkEditPanel
          t={t}
          ids={selectedVisible}
          onClose={() => setPanel(null)}
          onDone={() => {
            setPanel(null);
            clearSelection();
          }}
        />
      )}

      {/* ── Bulk assign panel ───────────────────────────────────────────── */}
      {panel === 'assign' && (
        <BulkAssignPanel
          t={t}
          ids={selectedVisible}
          kids={kids}
          onClose={() => setPanel(null)}
          onDone={() => {
            setPanel(null);
            clearSelection();
          }}
        />
      )}
    </div>
  );
}

// ─── Filter chip ────────────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-on={active}
      className="chip-admin"
    >
      {children}
    </button>
  );
}

// ─── Bulk archive button (its own form so the archive flag posts cleanly) ──

function BulkArchiveButton({
  ids,
  archive,
  label,
  onDone,
  tone,
}: {
  ids: string[];
  archive: boolean;
  label: string;
  onDone: () => void;
  tone: 'ink' | 'mint';
}) {
  const [state, action, pending] = useActionState<BulkOpResult | undefined, FormData>(
    bulkArchiveTasksAction,
    undefined,
  );
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action}>
      {ids.map((id) => (
        <input key={id} type="hidden" name="templateId" value={id} />
      ))}
      <input type="hidden" name="archive" value={archive ? '1' : '0'} />
      <button
        type="submit"
        disabled={pending}
        className={tone === 'mint' ? 'btn-admin-mint' : 'btn-admin-secondary'}
      >
        {pending ? '…' : label}
      </button>
    </form>
  );
}

// ─── Bulk edit panel ──────────────────────────────────────────────────────

function BulkEditPanel({
  t,
  ids,
  onClose,
  onDone,
}: {
  t: Dictionary;
  ids: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<BulkOpResult | undefined, FormData>(
    bulkEditTasksAction,
    undefined,
  );
  const [setCoin, setSetCoin] = useState(false);
  const [setEvidence, setSetEvidence] = useState(false);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <Modal title={t.admin.bulkEditTitle} onClose={onClose}>
      <form action={action} className="space-y-4">
        {ids.map((id) => (
          <input key={id} type="hidden" name="templateId" value={id} />
        ))}

        {/* Coin value toggle + input. */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-bold text-ink">
            <input
              type="checkbox"
              name="setCoinValue"
              value="1"
              checked={setCoin}
              onChange={(e) => setSetCoin(e.currentTarget.checked)}
              className="w-4 h-4 accent-pink"
            />
            {t.admin.bulkEditCoinToggle}
          </label>
          {setCoin && (
            <input
              type="text"
              name="coinValue"
              inputMode="numeric"
              pattern="[0-9]+"
              dir="ltr"
              required
              placeholder={t.admin.coinValue}
              className="w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm text-ink num focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-pale transition"
            />
          )}
        </div>

        {/* Evidence toggle. */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-bold text-ink">
            <input
              type="checkbox"
              name="setEvidence"
              value="1"
              checked={setEvidence}
              onChange={(e) => setSetEvidence(e.currentTarget.checked)}
              className="w-4 h-4 accent-pink"
            />
            {t.admin.bulkEditEvidenceToggle}
          </label>
          {setEvidence && (
            <label className="flex items-center gap-2 text-sm text-ink ps-6">
              <input type="checkbox" name="evidenceValue" className="w-4 h-4 accent-pink" />
              {t.admin.bulkEditEvidenceOn}
            </label>
          )}
        </div>

        {!setCoin && !setEvidence && (
          <p className="text-xs text-ink-faded">{t.admin.bulkEditNothing}</p>
        )}
        {state?.ok === false && (
          <p className="text-xs text-pink-dark" role="alert">
            {t.admin.bulkAssignFailed}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || (!setCoin && !setEvidence)}
          className="btn-admin w-full"
        >
          {pending ? '…' : t.admin.bulkApply}
        </button>
      </form>
    </Modal>
  );
}

// ─── Bulk assign panel ────────────────────────────────────────────────────

function BulkAssignPanel({
  t,
  ids,
  kids,
  onClose,
  onDone,
}: {
  t: Dictionary;
  ids: string[];
  kids: ManagerKid[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<BulkOpResult | undefined, FormData>(
    bulkAssignTemplatesToKidsAction,
    undefined,
  );
  const [picked, setPicked] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Modal title={t.admin.bulkAssignTitle} onClose={onClose}>
      <form action={action} className="space-y-4">
        {ids.map((id) => (
          <input key={id} type="hidden" name="templateId" value={id} />
        ))}

        <ul className="space-y-2">
          {kids.map((k) => {
            const on = picked.has(k.id);
            return (
              <li key={k.id}>
                <label
                  className={`flex items-center gap-3 rounded-2xl border p-3 cursor-pointer transition ${
                    on ? 'border-pink-pale ring-2 ring-pink-pale/40' : 'border-rule hover:border-pink-pale/60'
                  }`}
                >
                  <input
                    type="checkbox"
                    name="assignKidId"
                    value={k.id}
                    checked={on}
                    onChange={() => toggle(k.id)}
                    className="w-5 h-5 accent-pink shrink-0"
                  />
                  <span
                    className="inline-block w-7 h-7 rounded-full"
                    style={{ backgroundColor: k.color }}
                    aria-hidden="true"
                  />
                  <span className="font-bold text-ink">{k.name}</span>
                </label>
              </li>
            );
          })}
        </ul>

        <p className="text-[11px] text-ink-soft leading-snug">{t.admin.bulkAssignAdditiveHint}</p>
        {state?.ok === false && (
          <p className="text-xs text-pink-dark" role="alert">
            {t.admin.bulkAssignFailed}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || picked.size === 0}
          className="btn-admin w-full"
        >
          {pending ? '…' : t.admin.bulkApply}
        </button>
      </form>
    </Modal>
  );
}

// ─── Shared modal shell ───────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="bg-card w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-card p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="×"
            className="text-ink-soft hover:text-ink text-xl leading-none px-2"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
