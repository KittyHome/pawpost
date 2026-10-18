/**
 * Automatic campaign brakes. A cold campaign that bounces or annoys people
 * damages the sender's domain for months, so we stop early and let a human look.
 */

export interface HealthThresholds {
  /** Don't judge rates until at least this many emails have gone out. */
  minSample: number;
  maxBounceRate: number;
  maxUnsubscribeRate: number;
}

export const DEFAULT_HEALTH_THRESHOLDS: HealthThresholds = {
  minSample: 25,
  // Mailbox providers and ESPs treat >2% hard bounces as a list-quality problem.
  maxBounceRate: 0.02,
  // High opt-out rates precede spam complaints, which we can't observe directly.
  maxUnsubscribeRate: 0.05,
};

export interface CampaignCounters {
  sent: number;
  bounced: number;
  unsubscribed: number;
}

export type HealthVerdict = { ok: true } | { ok: false; reason: string };

export function evaluateCampaignHealth(
  counters: CampaignCounters,
  thresholds: HealthThresholds = DEFAULT_HEALTH_THRESHOLDS,
): HealthVerdict {
  if (counters.sent < thresholds.minSample) return { ok: true };

  const bounceRate = counters.bounced / counters.sent;
  if (bounceRate > thresholds.maxBounceRate) {
    return {
      ok: false,
      reason: `Bounce rate ${formatRate(bounceRate)} is above ${formatRate(thresholds.maxBounceRate)}. Verify the list before resuming.`,
    };
  }

  const unsubscribeRate = counters.unsubscribed / counters.sent;
  if (unsubscribeRate > thresholds.maxUnsubscribeRate) {
    return {
      ok: false,
      reason: `Unsubscribe rate ${formatRate(unsubscribeRate)} is above ${formatRate(thresholds.maxUnsubscribeRate)}. Review targeting and copy before resuming.`,
    };
  }

  return { ok: true };
}

export function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}
