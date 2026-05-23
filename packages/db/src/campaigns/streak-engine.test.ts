/**
 * Invariant tests for the streak engine.
 *
 * The riskiest single test is the retroactive-undo case (BUILD-PLAN exit
 * criterion): Lia has streak=4. She undoes day 3 on day 5. The next
 * evaluation MUST derive streak=0 from the freshly-modified history,
 * NOT carry forward the cached 4. That's why the engine re-derives from
 * task_completion + long_term_progress every call; the cache is just
 * for fast reads in UI.
 *
 * The tests use a fixed reference date so date arithmetic is deterministic.
 * Each test inserts task_completion rows for specific dates relative to
 * the campaign window, then asserts what the engine produces.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupTestDb,
  seedBaseFixtures,
  type TestDbHandle,
  type SeedHandles,
} from '../test-utils/index';
import { evaluateStreak } from './streak-engine';

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

interface CampaignOpts {
  targetDays?: number;
  freezesAllowed?: number;
  startDate?: string;
  endDate?: string;
  perDayThreshold?: number | null;
  feedingTemplateIds?: string[];
}

async function makeStreakCampaign(opts: CampaignOpts = {}): Promise<string> {
  const r = await harness.pool.query<{ id: string }>(
    `INSERT INTO campaign (
       household_id, title_he, title_en, kind, start_date, end_date,
       bonus_coins, streak_target_days, streak_freezes_allowed,
       streak_per_day_threshold
     ) VALUES (
       $1, 'מסע רצף', 'Streak quest', 'streak', $2::date, $3::date,
       $4, $5, $6, $7
     )
     RETURNING id`,
    [
      ids.householdId,
      opts.startDate ?? '2026-05-01',
      opts.endDate ?? '2026-05-10',
      50,
      opts.targetDays ?? 5,
      opts.freezesAllowed ?? 0,
      opts.perDayThreshold ?? null,
    ],
  );
  const campaignId = r.rows[0]!.id;

  const feedingTemplateIds = opts.feedingTemplateIds ?? [ids.taskDailyId];
  for (const tid of feedingTemplateIds) {
    await harness.pool.query(
      `INSERT INTO campaign_feeding_task (campaign_id, template_id)
       VALUES ($1, $2)`,
      [campaignId, tid],
    );
  }

  // Enroll Lia (the default kid for these tests). Yael unused unless a test
  // explicitly enrolls her.
  await harness.pool.query(
    `INSERT INTO campaign_enrollment (household_id, campaign_id, kid_id)
     VALUES ($1, $2, $3)`,
    [ids.householdId, campaignId, ids.liaId],
  );

  return campaignId;
}

/** Insert a task_completion row dated to the given YYYY-MM-DD. */
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

/** Mark a previously-recorded completion as undone — the retroactive case. */
async function undoCompletion(completionId: string): Promise<void> {
  await harness.pool.query(
    `UPDATE task_completion SET undone_at = now() WHERE id = $1`,
    [completionId],
  );
}

async function recordProgress(
  kidId: string,
  assignmentId: string,
  dateYmd: string,
  quantity: number,
): Promise<string> {
  const r = await harness.pool.query<{ id: string }>(
    `INSERT INTO long_term_progress (
       household_id, assignment_id, kid_id, progress_date, quantity,
       logged_at, approval_status
     ) VALUES (
       $1, $2, $3, $4::date, $5,
       ($4::date + time '12:00')::timestamptz, 'auto_approved'
     )
     RETURNING id`,
    [ids.householdId, assignmentId, kidId, dateYmd, quantity],
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

// ──────────────────────────────────────────────────────────────────────────────
// Baseline + happy path
// ──────────────────────────────────────────────────────────────────────────────

describe('evaluateStreak — baseline', () => {
  it('returns streak=0 when there are no completions', async () => {
    const cid = await makeStreakCampaign();
    const r = await withConnection((c) =>
      evaluateStreak(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-05-05' }),
    );
    expect(r.currentStreak).toBe(0);
    expect(r.completedNow).toBe(false);
    expect(r.brokeNow).toBe(false);
  });

  it('returns streak=0 when asOfDate is before campaign start_date', async () => {
    const cid = await makeStreakCampaign({ startDate: '2026-05-01' });
    await recordCompletion(ids.liaId, ids.assignmentLiaDailyId, '2026-05-01');
    const r = await withConnection((c) =>
      evaluateStreak(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-04-30' }),
    );
    expect(r.currentStreak).toBe(0);
  });

  it('returns streak=N for N consecutive active days from start', async () => {
    const cid = await makeStreakCampaign();
    await recordCompletion(ids.liaId, ids.assignmentLiaDailyId, '2026-05-01');
    await recordCompletion(ids.liaId, ids.assignmentLiaDailyId, '2026-05-02');
    await recordCompletion(ids.liaId, ids.assignmentLiaDailyId, '2026-05-03');

    const r = await withConnection((c) =>
      evaluateStreak(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-05-03' }),
    );
    expect(r.currentStreak).toBe(3);
    expect(r.completedNow).toBe(false); // target = 5
  });

  it('flips completedNow when streak crosses target_days', async () => {
    const cid = await makeStreakCampaign({ targetDays: 5 });
    for (const d of ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05']) {
      await recordCompletion(ids.liaId, ids.assignmentLiaDailyId, d);
    }
    const r = await withConnection((c) =>
      evaluateStreak(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-05-05' }),
    );
    expect(r.currentStreak).toBe(5);
    expect(r.completedNow).toBe(true);
  });

  it('completedNow is false when enrollment is already completed', async () => {
    const cid = await makeStreakCampaign({ targetDays: 5 });
    for (const d of ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05']) {
      await recordCompletion(ids.liaId, ids.assignmentLiaDailyId, d);
    }
    await harness.pool.query(
      `UPDATE campaign_enrollment SET completed_at = now()
       WHERE campaign_id = $1 AND kid_id = $2`,
      [cid, ids.liaId],
    );
    const r = await withConnection((c) =>
      evaluateStreak(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-05-05' }),
    );
    expect(r.currentStreak).toBe(5);
    expect(r.completedNow).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Freeze handling
// ──────────────────────────────────────────────────────────────────────────────

describe('evaluateStreak — freeze handling', () => {
  it('uses a freeze to bridge one missing day', async () => {
    const cid = await makeStreakCampaign({ freezesAllowed: 1, targetDays: 5 });
    for (const d of ['2026-05-01', '2026-05-02', /* miss day 3 */, '2026-05-04', '2026-05-05']) {
      if (d) await recordCompletion(ids.liaId, ids.assignmentLiaDailyId, d);
    }
    const r = await withConnection((c) =>
      evaluateStreak(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-05-05' }),
    );
    expect(r.currentStreak).toBe(5);
    expect(r.freezesUsed).toBe(1);
    expect(r.completedNow).toBe(true);
  });

  it('breaks when two days missed but only one freeze allowed', async () => {
    const cid = await makeStreakCampaign({ freezesAllowed: 1, targetDays: 5 });
    await recordCompletion(ids.liaId, ids.assignmentLiaDailyId, '2026-05-01');
    // miss days 2 and 3
    await recordCompletion(ids.liaId, ids.assignmentLiaDailyId, '2026-05-04');
    await recordCompletion(ids.liaId, ids.assignmentLiaDailyId, '2026-05-05');
    const r = await withConnection((c) =>
      evaluateStreak(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-05-05' }),
    );
    expect(r.currentStreak).toBe(0);
    expect(r.brokeNow).toBe(true);
  });

  it('uses two freezes when allowed', async () => {
    const cid = await makeStreakCampaign({ freezesAllowed: 2, targetDays: 5 });
    await recordCompletion(ids.liaId, ids.assignmentLiaDailyId, '2026-05-01');
    // miss days 2 and 3
    await recordCompletion(ids.liaId, ids.assignmentLiaDailyId, '2026-05-04');
    await recordCompletion(ids.liaId, ids.assignmentLiaDailyId, '2026-05-05');
    const r = await withConnection((c) =>
      evaluateStreak(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-05-05' }),
    );
    expect(r.currentStreak).toBe(5);
    expect(r.freezesUsed).toBe(2);
    expect(r.completedNow).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// The big one: retroactive undo (BUILD-PLAN exit criterion)
// ──────────────────────────────────────────────────────────────────────────────

describe('evaluateStreak — retroactive undo', () => {
  it('streak drops to 0 when a mid-chain day is undone with no freezes', async () => {
    // Setup: Lia completed days 1-5. asOf day 5 → streak = 5.
    const cid = await makeStreakCampaign({ freezesAllowed: 0, targetDays: 5 });
    let day3CompletionId = '';
    for (const d of ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05']) {
      const id = await recordCompletion(ids.liaId, ids.assignmentLiaDailyId, d);
      if (d === '2026-05-03') day3CompletionId = id;
    }
    const before = await withConnection((c) =>
      evaluateStreak(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-05-05' }),
    );
    expect(before.currentStreak).toBe(5);
    expect(before.completedNow).toBe(true);

    // Retroactive undo of day 3.
    await undoCompletion(day3CompletionId);

    // Next evaluation MUST derive from the freshly-mutated history.
    const after = await withConnection((c) =>
      evaluateStreak(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-05-05' }),
    );
    expect(after.currentStreak).toBe(0);
    expect(after.brokeNow).toBe(true);
    expect(after.completedNow).toBe(false);
  });

  it('streak stays intact when retroactive undo is bridged by a freeze', async () => {
    const cid = await makeStreakCampaign({ freezesAllowed: 1, targetDays: 5 });
    let day3CompletionId = '';
    for (const d of ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05']) {
      const id = await recordCompletion(ids.liaId, ids.assignmentLiaDailyId, d);
      if (d === '2026-05-03') day3CompletionId = id;
    }
    await undoCompletion(day3CompletionId);
    const r = await withConnection((c) =>
      evaluateStreak(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-05-05' }),
    );
    expect(r.currentStreak).toBe(5);
    expect(r.freezesUsed).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Today missing + late starts
// ──────────────────────────────────────────────────────────────────────────────

describe('evaluateStreak — edge cases', () => {
  it('today missing without freeze breaks the streak', async () => {
    const cid = await makeStreakCampaign({ freezesAllowed: 0 });
    for (const d of ['2026-05-01', '2026-05-02']) {
      await recordCompletion(ids.liaId, ids.assignmentLiaDailyId, d);
    }
    const r = await withConnection((c) =>
      evaluateStreak(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-05-03' }),
    );
    expect(r.currentStreak).toBe(0);
    expect(r.brokeNow).toBe(true);
  });

  it('kid who started late has streak starting from first active day', async () => {
    const cid = await makeStreakCampaign({
      startDate: '2026-05-01',
      endDate: '2026-05-10',
      freezesAllowed: 0,
    });
    // Kid first active on day 3, then 4, 5.
    for (const d of ['2026-05-03', '2026-05-04', '2026-05-05']) {
      await recordCompletion(ids.liaId, ids.assignmentLiaDailyId, d);
    }
    const r = await withConnection((c) =>
      evaluateStreak(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-05-05' }),
    );
    expect(r.currentStreak).toBe(3);
    expect(r.brokeNow).toBe(false);
  });

  it('asOfDate past end_date clamps to end_date', async () => {
    const cid = await makeStreakCampaign({
      startDate: '2026-05-01',
      endDate: '2026-05-03',
      targetDays: 3,
    });
    for (const d of ['2026-05-01', '2026-05-02', '2026-05-03']) {
      await recordCompletion(ids.liaId, ids.assignmentLiaDailyId, d);
    }
    const r = await withConnection((c) =>
      evaluateStreak(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-05-30' }),
    );
    expect(r.currentStreak).toBe(3);
    expect(r.completedNow).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Long-term feeding tasks + per-day threshold
// ──────────────────────────────────────────────────────────────────────────────

describe('evaluateStreak — long-term feeding tasks', () => {
  it('counts a day active when long-term progress quantity meets per_day_threshold', async () => {
    const cid = await makeStreakCampaign({
      perDayThreshold: 3,
      feedingTemplateIds: [ids.taskLongTermId],
      targetDays: 3,
    });
    // Day 1: 5 pages (>= 3) → active.
    await recordProgress(ids.liaId, ids.assignmentLiaLongTermId, '2026-05-01', 5);
    // Day 2: 3 pages (>= 3) → active.
    await recordProgress(ids.liaId, ids.assignmentLiaLongTermId, '2026-05-02', 3);
    // Day 3: 2 pages (< 3) → NOT active.
    await recordProgress(ids.liaId, ids.assignmentLiaLongTermId, '2026-05-03', 2);
    const r = await withConnection((c) =>
      evaluateStreak(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-05-03' }),
    );
    expect(r.currentStreak).toBe(0); // day 3 missed
    expect(r.brokeNow).toBe(true);
  });

  it('treats any progress as active when per_day_threshold is null', async () => {
    const cid = await makeStreakCampaign({
      perDayThreshold: null,
      feedingTemplateIds: [ids.taskLongTermId],
      targetDays: 3,
    });
    await recordProgress(ids.liaId, ids.assignmentLiaLongTermId, '2026-05-01', 1);
    await recordProgress(ids.liaId, ids.assignmentLiaLongTermId, '2026-05-02', 1);
    await recordProgress(ids.liaId, ids.assignmentLiaLongTermId, '2026-05-03', 1);
    const r = await withConnection((c) =>
      evaluateStreak(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-05-03' }),
    );
    expect(r.currentStreak).toBe(3);
    expect(r.completedNow).toBe(true);
  });

  it('mixes daily + long-term feeding tasks (any qualifying activity counts that day)', async () => {
    const cid = await makeStreakCampaign({
      feedingTemplateIds: [ids.taskDailyId, ids.taskLongTermId],
      targetDays: 3,
    });
    // Day 1: daily completion only.
    await recordCompletion(ids.liaId, ids.assignmentLiaDailyId, '2026-05-01');
    // Day 2: long-term progress only.
    await recordProgress(ids.liaId, ids.assignmentLiaLongTermId, '2026-05-02', 5);
    // Day 3: both (overlapping is fine).
    await recordCompletion(ids.liaId, ids.assignmentLiaDailyId, '2026-05-03');
    await recordProgress(ids.liaId, ids.assignmentLiaLongTermId, '2026-05-03', 1);
    const r = await withConnection((c) =>
      evaluateStreak(c, { kidId: ids.liaId, campaignId: cid, asOfDate: '2026-05-03' }),
    );
    expect(r.currentStreak).toBe(3);
    expect(r.completedNow).toBe(true);
  });
});
