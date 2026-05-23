/**
 * Invariant tests for the total engine.
 *
 * Coverage:
 *   - long-term progress sums correctly.
 *   - daily completions count 1-per-completion.
 *   - mixed feeding tasks sum their contributions.
 *   - undone rows excluded; pending rows excluded.
 *   - asOfDate clamps to end_date (Yael "incomplete" case lands when
 *     end_date passes without the engine ever returning completedNow).
 *   - completedNow doesn't re-fire after enrollment.completed_at set.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupTestDb,
  seedBaseFixtures,
  type TestDbHandle,
  type SeedHandles,
} from '../test-utils/index';
import { evaluateTotal } from './total-engine';

let harness: TestDbHandle;
let ids: SeedHandles;

beforeAll(async () => {
  harness = await setupTestDb();
});

beforeEach(async () => {
  await harness.truncate();
  ids = await seedBaseFixtures(harness);
});

afterAll(async () => {
  await harness.close();
});

interface TotalOpts {
  targetQuantity?: number;
  startDate?: string;
  endDate?: string;
  feedingTemplateIds?: string[];
}

async function makeTotalCampaign(opts: TotalOpts = {}): Promise<string> {
  const r = await harness.pool.query<{ id: string }>(
    `INSERT INTO campaign (
       household_id, title_he, title_en, kind, start_date, end_date,
       bonus_coins, total_target_quantity
     ) VALUES (
       $1, 'מסע צבירה', 'Total quest', 'total', $2::date, $3::date, $4, $5
     )
     RETURNING id`,
    [
      ids.householdId,
      opts.startDate ?? '2026-05-01',
      opts.endDate ?? '2026-07-01',
      30,
      opts.targetQuantity ?? 100,
    ],
  );
  const cid = r.rows[0]!.id;
  const feedingTemplateIds = opts.feedingTemplateIds ?? [ids.taskLongTermId];
  for (const tid of feedingTemplateIds) {
    await harness.pool.query(
      `INSERT INTO campaign_feeding_task (campaign_id, template_id)
       VALUES ($1, $2)`,
      [cid, tid],
    );
  }
  await harness.pool.query(
    `INSERT INTO campaign_enrollment (household_id, campaign_id, kid_id)
     VALUES ($1, $2, $3)`,
    [ids.householdId, cid, ids.liaId],
  );
  return cid;
}

async function recordProgress(
  kidId: string,
  assignmentId: string,
  dateYmd: string,
  quantity: number,
  opts: { undone?: boolean; approvalStatus?: 'auto_approved' | 'pending' } = {},
): Promise<string> {
  const r = await harness.pool.query<{ id: string }>(
    `INSERT INTO long_term_progress (
       household_id, assignment_id, kid_id, progress_date, quantity,
       logged_at, undone_at, approval_status
     ) VALUES (
       $1, $2, $3, $4::date, $5,
       ($4::date + time '12:00')::timestamptz,
       $6, $7
     )
     RETURNING id`,
    [
      ids.householdId,
      assignmentId,
      kidId,
      dateYmd,
      quantity,
      opts.undone ? new Date() : null,
      opts.approvalStatus ?? 'auto_approved',
    ],
  );
  return r.rows[0]!.id;
}

async function recordCompletion(
  kidId: string,
  assignmentId: string,
  dateYmd: string,
): Promise<string> {
  const r = await harness.pool.query<{ id: string }>(
    `INSERT INTO task_completion (
       household_id, assignment_id, kid_id, completion_date,
       completed_at, approval_status
     ) VALUES (
       $1, $2, $3, $4::date,
       ($4::date + time '12:00')::timestamptz, 'auto_approved'
     )
     RETURNING id`,
    [ids.householdId, assignmentId, kidId, dateYmd],
  );
  return r.rows[0]!.id;
}

async function withConnection<T>(fn: (c: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const c = await harness.pool.connect();
  try {
    return await fn(c);
  } finally {
    c.release();
  }
}

describe('evaluateTotal — long-term progress', () => {
  it('sums quantity across multiple log entries', async () => {
    const cid = await makeTotalCampaign({ targetQuantity: 100 });
    await recordProgress(ids.liaId, ids.assignmentLiaLongTermId, '2026-05-01', 30);
    await recordProgress(ids.liaId, ids.assignmentLiaLongTermId, '2026-05-15', 45);
    const r = await withConnection((c) =>
      evaluateTotal(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-05-20' }),
    );
    expect(r.currentTotal).toBe(75);
    expect(r.completedNow).toBe(false);
  });

  it('flips completedNow when total crosses the target', async () => {
    const cid = await makeTotalCampaign({ targetQuantity: 100 });
    await recordProgress(ids.liaId, ids.assignmentLiaLongTermId, '2026-05-01', 60);
    await recordProgress(ids.liaId, ids.assignmentLiaLongTermId, '2026-05-15', 45);
    const r = await withConnection((c) =>
      evaluateTotal(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-05-20' }),
    );
    expect(r.currentTotal).toBe(105);
    expect(r.completedNow).toBe(true);
  });

  it('excludes undone progress rows', async () => {
    const cid = await makeTotalCampaign({ targetQuantity: 100 });
    await recordProgress(ids.liaId, ids.assignmentLiaLongTermId, '2026-05-01', 60);
    await recordProgress(ids.liaId, ids.assignmentLiaLongTermId, '2026-05-15', 45, {
      undone: true,
    });
    const r = await withConnection((c) =>
      evaluateTotal(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-05-20' }),
    );
    expect(r.currentTotal).toBe(60);
    expect(r.completedNow).toBe(false);
  });

  it('excludes pending (not yet approved) rows', async () => {
    const cid = await makeTotalCampaign({ targetQuantity: 100 });
    await recordProgress(ids.liaId, ids.assignmentLiaLongTermId, '2026-05-01', 60, {
      approvalStatus: 'pending',
    });
    const r = await withConnection((c) =>
      evaluateTotal(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-05-20' }),
    );
    expect(r.currentTotal).toBe(0);
  });
});

describe('evaluateTotal — daily feeding tasks', () => {
  it('counts 1 unit per qualifying task_completion', async () => {
    const cid = await makeTotalCampaign({
      targetQuantity: 3,
      feedingTemplateIds: [ids.taskDailyId],
    });
    for (const d of ['2026-05-01', '2026-05-02', '2026-05-03']) {
      await recordCompletion(ids.liaId, ids.assignmentLiaDailyId, d);
    }
    const r = await withConnection((c) =>
      evaluateTotal(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-05-05' }),
    );
    expect(r.currentTotal).toBe(3);
    expect(r.completedNow).toBe(true);
  });
});

describe('evaluateTotal — mixed feeding tasks', () => {
  it('sums daily count + long-term quantity together', async () => {
    const cid = await makeTotalCampaign({
      targetQuantity: 10,
      feedingTemplateIds: [ids.taskDailyId, ids.taskLongTermId],
    });
    // Daily: 3 completions = 3 units.
    for (const d of ['2026-05-01', '2026-05-02', '2026-05-03']) {
      await recordCompletion(ids.liaId, ids.assignmentLiaDailyId, d);
    }
    // Long-term: 4 + 5 = 9 units.
    await recordProgress(ids.liaId, ids.assignmentLiaLongTermId, '2026-05-04', 4);
    await recordProgress(ids.liaId, ids.assignmentLiaLongTermId, '2026-05-05', 5);
    const r = await withConnection((c) =>
      evaluateTotal(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-05-05' }),
    );
    expect(r.currentTotal).toBe(12);
    expect(r.completedNow).toBe(true);
  });
});

describe('evaluateTotal — window clamping', () => {
  it('clamps asOfDate to end_date (Yael "incomplete" path)', async () => {
    const cid = await makeTotalCampaign({
      targetQuantity: 100,
      endDate: '2026-05-10',
    });
    // Only 40 pages by day 60.
    await recordProgress(ids.liaId, ids.assignmentLiaLongTermId, '2026-05-05', 40);
    const r = await withConnection((c) =>
      evaluateTotal(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-06-30' }),
    );
    expect(r.currentTotal).toBe(40);
    expect(r.completedNow).toBe(false);
  });
});

describe('evaluateTotal — already-completed enrollments', () => {
  it('does NOT re-fire completedNow after enrollment.completed_at is set', async () => {
    const cid = await makeTotalCampaign({ targetQuantity: 100 });
    await recordProgress(ids.liaId, ids.assignmentLiaLongTermId, '2026-05-01', 150);
    await harness.pool.query(
      `UPDATE campaign_enrollment SET completed_at = now()
       WHERE campaign_id = $1 AND kid_id = $2`,
      [cid, ids.liaId],
    );
    const r = await withConnection((c) =>
      evaluateTotal(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-05-10' }),
    );
    expect(r.currentTotal).toBe(150);
    expect(r.completedNow).toBe(false);
  });
});
