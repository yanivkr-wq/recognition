/**
 * Kids list — admin surface.
 *
 * One card per active kid: a big avatar pip (the kid's chosen face + accent
 * color), name, live wallet balance, then a grid of icon-labeled action
 * chips — Edit / Tasks / PIN / Devices / Ledger / Joker. The icons make the
 * actions scannable at a glance on a phone (Lily's "more with icons" ask).
 *
 * Wallet balance is the derived ledger view (GREATEST(0, SUM(amount))) per
 * SCHEMA.md §7 — never a stored counter — fetched in one grouped query.
 */

import Link from 'next/link';
import { eq, isNull, and } from 'drizzle-orm';
import { getDictionary, type Locale } from '@reco/shared/i18n';
import { getDb, getPool, kid as kidTable } from '@reco/db';
import { auth } from '../../../../auth';
import { redirect } from 'next/navigation';
import { Avatar } from '../../../../components/avatar';
import { Coin } from '../../../../components/coin';

export const dynamic = 'force-dynamic';

export default async function AdminKidsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDictionary(lang as Locale);
  const session = await auth();
  if (!session?.user) redirect(`/${lang}/login`);

  const kids = await getDb()
    .select({
      id: kidTable.id,
      name: kidTable.name,
      slug: kidTable.slug,
      color: kidTable.color,
      avatarKey: kidTable.avatarKey,
    })
    .from(kidTable)
    .where(
      and(eq(kidTable.householdId, session.user.householdId), isNull(kidTable.archivedAt)),
    )
    .orderBy(kidTable.createdAt);

  // Wallet balances in one grouped query (derived view, never stored).
  const balanceByKid = new Map<string, number>();
  if (kids.length > 0) {
    const res = await getPool().query<{ kid_id: string; balance: string }>(
      `SELECT kid_id, GREATEST(0, COALESCE(SUM(amount), 0))::text AS balance
         FROM ledger_entry
        WHERE kid_id = ANY($1::uuid[])
        GROUP BY kid_id`,
      [kids.map((k) => k.id)],
    );
    for (const row of res.rows) balanceByKid.set(row.kid_id, Number(row.balance));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{t.admin.kids}</h1>

      <ul className="space-y-4">
        {kids.map((k) => (
          <li key={k.id} className="bg-card rounded-3xl shadow-card border border-rule p-4 space-y-4">
            {/* Identity row — avatar + name + wallet balance. */}
            <div className="flex items-center gap-3">
              <Avatar name={k.name} color={k.color} avatarKey={k.avatarKey} size={56} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-ink text-lg truncate">{k.name}</p>
                <span className="inline-flex items-center gap-1 text-sm font-bold text-ink-soft num">
                  <Coin size={16} />
                  <span dir="ltr">{balanceByKid.get(k.id) ?? 0}</span>
                  <span className="font-medium text-ink-faded">{t.wallet.coins}</span>
                </span>
              </div>
            </div>

            {/* Action chips — icon stacked over label, 3-up on mobile. */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <ActionChip
                href={`/${lang}/admin/kids/${k.id}/edit`}
                label={t.common.edit}
                tone="pink"
                icon={<PencilIcon />}
              />
              <ActionChip
                href={`/${lang}/admin/kids/${k.id}/tasks`}
                label={t.admin.tasks}
                tone="lavender"
                icon={<ListIcon />}
              />
              <ActionChip
                href={`/${lang}/admin/kids/${k.id}/pin`}
                label={t.admin.setPin}
                tone="rose"
                icon={<LockIcon />}
              />
              <ActionChip
                href={`/${lang}/admin/kids/${k.id}/devices`}
                label={t.admin.devices}
                tone="sky"
                icon={<DeviceIcon />}
              />
              <ActionChip
                href={`/${lang}/admin/kids/${k.id}/ledger`}
                label={t.admin.ledger}
                tone="mint"
                icon={<ReceiptIcon />}
              />
              <ActionChip
                href={`/${lang}/admin/kids/${k.id}/wallet/adjust`}
                label={t.admin.joker}
                tone="yellow"
                icon={<WandIcon />}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TONES: Record<string, string> = {
  pink: 'bg-pink-pale text-pink-dark hover:bg-pink-soft',
  lavender: 'bg-lavender-pale text-lavender-dark hover:opacity-80',
  rose: 'bg-pink-soft text-pink-dark hover:bg-pink-pale',
  sky: 'bg-sky-pale text-sky-dark hover:bg-sky-soft',
  mint: 'bg-mint-pale text-mint-dark hover:bg-mint-soft',
  yellow: 'bg-yellow-pale text-[#7A5D10] hover:opacity-80',
};

function ActionChip({
  href,
  label,
  tone,
  icon,
}: {
  href: string;
  label: string;
  tone: keyof typeof TONES;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl py-3 px-2 text-[11px] font-bold text-center transition ${TONES[tone]}`}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="leading-tight">{label}</span>
    </Link>
  );
}

// ─── Action chip icons (20px stroke, currentColor) ─────────────────────────

function PencilIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M16.5 4.5l3 3L8 19l-4 1 1-4 11.5-11.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DeviceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="7" y="3" width="10" height="18" rx="2.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M11 18h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3h12v18l-3-1.5L12 21l-3-1.5L6 21V3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function WandIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 19l9-9M14.5 5.5l1 1M18 4l.01.01M19 9l1 1M9 4l.5 1.5L11 6l-1.5.5L9 8l-.5-1.5L7 6l1.5-.5L9 4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
