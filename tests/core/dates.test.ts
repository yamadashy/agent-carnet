import { describe, expect, it } from 'vitest';
import { daysUntil, expiryDate, formatDate, parseDate, parseLifespan, today } from '../../src/core/dates.js';
import { CarnetError } from '../../src/core/errors.js';

describe('formatDate / today', () => {
  it('formats a UTC date', () => {
    expect(formatDate(new Date(Date.UTC(2026, 0, 5)))).toBe('2026-01-05');
  });
  it('today() returns ISO date', () => {
    expect(today(new Date(Date.UTC(2026, 4, 4)))).toBe('2026-05-04');
  });
});

describe('parseDate', () => {
  it('parses YYYY-MM-DD', () => {
    expect(parseDate('2026-05-04').toISOString()).toBe('2026-05-04T00:00:00.000Z');
  });
  it('rejects garbage', () => {
    expect(() => parseDate('not-a-date')).toThrow(CarnetError);
  });
});

describe('parseLifespan', () => {
  it('parses durations into ms', () => {
    expect(parseLifespan('30d')).toBe(30 * 86400 * 1000);
  });
  it('handles "never"', () => {
    expect(parseLifespan('never')).toBe('never');
  });
  it('rejects invalid lifespans', () => {
    expect(() => parseLifespan('asdf')).toThrow(CarnetError);
    expect(() => parseLifespan('-5d')).toThrow(CarnetError);
  });
});

describe('expiryDate', () => {
  it('computes lifespan from updated date', () => {
    const e = expiryDate('2026-05-04', '30d', undefined, '30d');
    expect(e?.toISOString().slice(0, 10)).toBe('2026-06-03');
  });
  it('returns null for keep:true', () => {
    expect(expiryDate('2026-05-04', '30d', true, '30d')).toBeNull();
  });
  it('returns null for lifespan never', () => {
    expect(expiryDate('2026-05-04', 'never', undefined, '30d')).toBeNull();
  });
  it('falls back to default lifespan', () => {
    const e = expiryDate('2026-05-04', undefined, undefined, '7d');
    expect(e?.toISOString().slice(0, 10)).toBe('2026-05-11');
  });
});

describe('daysUntil', () => {
  it('returns negative for past dates', () => {
    expect(daysUntil(new Date('2020-01-01'), new Date('2026-05-04'))).toBeLessThan(0);
  });
});
