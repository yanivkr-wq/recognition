/**
 * Celebrate helper — fires canvas-confetti for delight moments (Lily's Fix 4a).
 *
 * The library is browser-only, so we dynamically import it at call time —
 * server components never pull it into their bundle. Three intensities tune
 * the moment:
 *   - `small`  — one task completion. Quick burst near where the kid tapped.
 *   - `medium` — single redeem / freeze used / earning a badge.
 *   - `big`    — milestone: finished all tasks for the day, or finished a
 *                campaign (Phase 7 fan-out can wire this on `completedNow`).
 *
 * Reduced-motion + no-window guards keep this safe for SSR + accessibility.
 */

'use client';

type Intensity = 'small' | 'medium' | 'big';

interface CelebrateOpts {
  intensity?: Intensity;
  /** Origin override (0..1 fraction of viewport). Default y=0.6 keeps the
   *  burst above the bottom nav / fold so the kid sees it. */
  origin?: { x?: number; y?: number };
}

export async function celebrate(opts: CelebrateOpts = {}): Promise<void> {
  if (typeof window === 'undefined') return;
  // Respect prefers-reduced-motion.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const intensity: Intensity = opts.intensity ?? 'small';
  const origin = { x: opts.origin?.x ?? 0.5, y: opts.origin?.y ?? 0.6 };

  const { default: confetti } = await import('canvas-confetti');

  const palette = ['#FF6B9D', '#FFD75E', '#7CE0B5', '#6EC9F4', '#B59FE5', '#FF9F7A'];

  if (intensity === 'big') {
    // Two side bursts that converge — kid-app birthday vibe.
    const end = Date.now() + 900;
    const fire = () => {
      confetti({
        particleCount: 80,
        spread: 70,
        startVelocity: 55,
        origin: { x: 0.1, y: 0.7 },
        angle: 60,
        colors: palette,
      });
      confetti({
        particleCount: 80,
        spread: 70,
        startVelocity: 55,
        origin: { x: 0.9, y: 0.7 },
        angle: 120,
        colors: palette,
      });
      if (Date.now() < end) requestAnimationFrame(fire);
    };
    fire();
    return;
  }
  if (intensity === 'medium') {
    confetti({
      particleCount: 80,
      spread: 75,
      origin,
      colors: palette,
      startVelocity: 38,
    });
    return;
  }
  // small
  confetti({
    particleCount: 40,
    spread: 55,
    origin,
    colors: palette,
    startVelocity: 30,
  });
}
