import parseDuration from 'parse-duration';
import { CarnetError } from './errors.js';

/** Format a Date as YYYY-MM-DD in UTC. We deliberately ignore timezone offsets
 * so two agents in different zones produce stable dates for the same instant. */
export function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function today(now: Date = new Date()): string {
  return formatDate(now);
}

/** Parse a YYYY-MM-DD string into a Date at UTC midnight. */
export function parseDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) {
    throw new CarnetError('frontmatter_error', `invalid date "${s}"`, 'expected YYYY-MM-DD');
  }
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/**
 * Parse a lifespan string into milliseconds. Accepts the human-friendly forms
 * documented in the spec: `30d`, `90d`, `1y`, etc. The literal `never` is
 * special-cased and signals "no expiry".
 */
export function parseLifespan(input: string): number | 'never' {
  if (input === 'never') return 'never';
  const ms = parseDuration(input);
  if (ms === null || Number.isNaN(ms) || ms <= 0) {
    throw new CarnetError('validation_error', `invalid lifespan "${input}"`, 'example: 30d, 90d, 1y, never');
  }
  return ms;
}

/**
 * Compute the expiry date of a carnet given its `updated` date and effective
 * lifespan (per-carnet override, falling back to the env-var default).
 *
 * Returns `null` for `lifespan: never` or `keep: true`.
 */
export function expiryDate(
  updated: string,
  lifespan: string | undefined,
  keep: boolean | undefined,
  defaultLifespan: string,
): Date | null {
  if (keep) return null;
  const effective = lifespan ?? defaultLifespan;
  const ms = parseLifespan(effective);
  if (ms === 'never') return null;
  const u = parseDate(updated);
  return new Date(u.getTime() + ms);
}

/** Days remaining until expiry. Negative = already expired. */
export function daysUntil(target: Date, from: Date = new Date()): number {
  return Math.floor((target.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}
