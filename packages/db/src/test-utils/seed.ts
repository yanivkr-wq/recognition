/**
 * Fixed-ID seed helpers for the test harness.
 *
 * These build the minimal graph the Phase 3 ledger tests need: one household,
 * one parent user (for admin_credit/admin_debit invariants), two kids (Lia +
 * Yael) so cross-kid isolation tests are trivial, and a small task palette
 * (one daily, one daily-with-evidence, one long-term). UUIDs are deterministic
 * so assertions can reference them as literals.
 */

import { eq } from 'drizzle-orm';
import type { TestDbHandle } from './test-db';
import {
  household,
  user,
  kid,
  taskTemplate,
  taskAssignment,
} from '../schema/index';

export const IDS = {
  household: '99999999-9999-9999-9999-999999999901',
  parent: '99999999-9999-9999-9999-999999999911',
  kidLia: '99999999-9999-9999-9999-999999999921',
  kidYael: '99999999-9999-9999-9999-999999999922',
  taskDaily: '99999999-9999-9999-9999-999999999931',
  taskEvidence: '99999999-9999-9999-9999-999999999932',
  taskLongTerm: '99999999-9999-9999-9999-999999999933',
  assignmentLiaDaily: '99999999-9999-9999-9999-999999999941',
  assignmentLiaEvidence: '99999999-9999-9999-9999-999999999942',
  assignmentLiaLongTerm: '99999999-9999-9999-9999-999999999943',
  assignmentYaelDaily: '99999999-9999-9999-9999-999999999944',
} as const;

// Argon2id placeholder — well-formed but never verifies. Tests don't exercise
// PIN/password verification; that's covered by the kid-auth/auth.config tests.
const ARGON2_NEVER_VERIFIES =
  '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export interface SeedHandles {
  householdId: string;
  parentId: string;
  liaId: string;
  yaelId: string;
  taskDailyId: string;
  taskEvidenceId: string;
  taskLongTermId: string;
  assignmentLiaDailyId: string;
  assignmentLiaEvidenceId: string;
  assignmentLiaLongTermId: string;
  assignmentYaelDailyId: string;
}

export async function seedBaseFixtures(handle: TestDbHandle): Promise<SeedHandles> {
  const { db } = handle;

  await db.insert(household).values({
    id: IDS.household,
    name: 'Test Household',
    tz: 'Asia/Jerusalem',
    localeDefault: 'he',
  });

  await db.insert(user).values({
    id: IDS.parent,
    householdId: IDS.household,
    email: 'parent@test.local',
    passwordHash: ARGON2_NEVER_VERIFIES,
    name: 'Test Parent',
    role: 'admin',
  });

  await db.insert(kid).values([
    {
      id: IDS.kidLia,
      householdId: IDS.household,
      name: 'Lia',
      slug: 'lia',
      color: '#FF9F7A',
      pinHash: ARGON2_NEVER_VERIFIES,
    },
    {
      id: IDS.kidYael,
      householdId: IDS.household,
      name: 'Yael',
      slug: 'yael',
      color: '#6EC9F4',
      pinHash: ARGON2_NEVER_VERIFIES,
    },
  ]);

  await db.insert(taskTemplate).values([
    {
      id: IDS.taskDaily,
      householdId: IDS.household,
      kind: 'daily',
      titleHe: 'משימה יומית',
      titleEn: 'Daily task',
      iconKey: 'ic-bed',
      coinValue: 5,
      measureAmount: 5,
      evidenceRequired: false,
    },
    {
      id: IDS.taskEvidence,
      householdId: IDS.household,
      kind: 'daily',
      titleHe: 'משימה עם הוכחה',
      titleEn: 'Daily task with evidence',
      iconKey: 'ic-homework',
      coinValue: 20,
      evidenceRequired: true,
    },
    {
      id: IDS.taskLongTerm,
      householdId: IDS.household,
      kind: 'long_term',
      titleHe: 'קריאה',
      titleEn: 'Read a book',
      iconKey: 'ic-book',
      coinValue: 0,
      evidenceRequired: false,
      longTermUnitLabelHe: 'עמודים',
      longTermUnitLabelEn: 'pages',
      longTermPerUnitCoins: 1,
      longTermGoalQuantity: 100,
      longTermBonusOnComplete: 50,
    },
  ]);

  await db.insert(taskAssignment).values([
    {
      id: IDS.assignmentLiaDaily,
      householdId: IDS.household,
      templateId: IDS.taskDaily,
      kidId: IDS.kidLia,
    },
    {
      id: IDS.assignmentLiaEvidence,
      householdId: IDS.household,
      templateId: IDS.taskEvidence,
      kidId: IDS.kidLia,
    },
    {
      id: IDS.assignmentLiaLongTerm,
      householdId: IDS.household,
      templateId: IDS.taskLongTerm,
      kidId: IDS.kidLia,
    },
    {
      id: IDS.assignmentYaelDaily,
      householdId: IDS.household,
      templateId: IDS.taskDaily,
      kidId: IDS.kidYael,
    },
  ]);

  return {
    householdId: IDS.household,
    parentId: IDS.parent,
    liaId: IDS.kidLia,
    yaelId: IDS.kidYael,
    taskDailyId: IDS.taskDaily,
    taskEvidenceId: IDS.taskEvidence,
    taskLongTermId: IDS.taskLongTerm,
    assignmentLiaDailyId: IDS.assignmentLiaDaily,
    assignmentLiaEvidenceId: IDS.assignmentLiaEvidence,
    assignmentLiaLongTermId: IDS.assignmentLiaLongTerm,
    assignmentYaelDailyId: IDS.assignmentYaelDaily,
  };
}

/** Helpful for assertions: SUM(amount) over a kid's ledger. */
export async function ledgerSum(handle: TestDbHandle, kidId: string): Promise<number> {
  const res = await handle.pool.query<{ sum: string | null }>(
    `SELECT COALESCE(SUM(amount), 0)::text AS sum FROM ledger_entry WHERE kid_id = $1`,
    [kidId],
  );
  return Number(res.rows[0]?.sum ?? 0);
}

/** Display-balance formula matches the wallet UI (clamp at 0). */
export async function displayBalance(handle: TestDbHandle, kidId: string): Promise<number> {
  return Math.max(0, await ledgerSum(handle, kidId));
}

void eq; // re-exported so callers can `import { eq } from '@reco/db'` later if needed
