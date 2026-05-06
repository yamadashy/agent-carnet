import { describe, expect, it } from 'vitest';
import { CarnetError } from '../../src/core/errors.js';
import { parseCsv, validateFrontmatter } from '../../src/core/validate.js';

describe('validateFrontmatter', () => {
  const ok = { summary: 's', agent: 'a', created: '2026-01-01', updated: '2026-01-01' };

  it('passes a minimal valid frontmatter', () => {
    expect(() => validateFrontmatter({ ...ok })).not.toThrow();
  });
  it('rejects non-array tags', () => {
    expect(() => validateFrontmatter({ ...ok, tags: 'not-an-array' as unknown as string[] })).toThrow(/tags/);
  });
  it('rejects non-array related', () => {
    expect(() => validateFrontmatter({ ...ok, related: 1 as unknown as string[] })).toThrow(/related/);
  });
  it('rejects non-boolean keep', () => {
    expect(() => validateFrontmatter({ ...ok, keep: 'yes' as unknown as boolean })).toThrow(/keep/);
  });
  it('rejects bad lifespan', () => {
    expect(() => validateFrontmatter({ ...ok, lifespan: 'asdf' })).toThrow(CarnetError);
  });
});

describe('parseCsv', () => {
  it('returns undefined for undefined', () => {
    expect(parseCsv(undefined)).toBeUndefined();
  });
  it('splits and trims', () => {
    expect(parseCsv('a, b ,c')).toEqual(['a', 'b', 'c']);
  });
  it('dedupes', () => {
    expect(parseCsv('a,a,b')).toEqual(['a', 'b']);
  });
  it('returns undefined for empty', () => {
    expect(parseCsv('')).toBeUndefined();
    expect(parseCsv(',,,')).toBeUndefined();
  });
});
