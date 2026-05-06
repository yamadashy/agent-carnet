import { describe, expect, it } from 'vitest';
import { CarnetError } from '../../src/core/errors.js';
import { categoryOf, normalizeCarnetPath, slugOf } from '../../src/core/paths.js';

describe('normalizeCarnetPath', () => {
  it('appends .md when missing', () => {
    expect(normalizeCarnetPath('deps/iconv')).toBe('deps/iconv.md');
  });
  it('keeps .md when present', () => {
    expect(normalizeCarnetPath('deps/iconv.md')).toBe('deps/iconv.md');
  });
  it('rejects single-segment paths', () => {
    expect(() => normalizeCarnetPath('iconv')).toThrow(CarnetError);
  });
  it('rejects path traversal', () => {
    expect(() => normalizeCarnetPath('deps/../etc/passwd')).toThrow(/traversal/);
    expect(() => normalizeCarnetPath('../escape/me')).toThrow(/traversal/);
  });
  it('rejects absolute paths', () => {
    expect(() => normalizeCarnetPath('/etc/passwd')).toThrow(/absolute/);
  });
  it('rejects Windows absolute paths', () => {
    expect(() => normalizeCarnetPath('C:/Windows/System32')).toThrow(/absolute/);
  });
  it('rejects empty input', () => {
    expect(() => normalizeCarnetPath('')).toThrow(CarnetError);
  });
  it('rejects forbidden characters', () => {
    expect(() => normalizeCarnetPath('deps/foo*bar')).toThrow(/invalid character/);
  });
  it('handles deep categories', () => {
    expect(normalizeCarnetPath('a/b/c/d')).toBe('a/b/c/d.md');
  });
});

describe('categoryOf / slugOf', () => {
  it('extracts category and slug', () => {
    expect(categoryOf('deps/iconv.md')).toBe('deps');
    expect(slugOf('deps/iconv.md')).toBe('iconv');
  });
  it('handles deep categories', () => {
    expect(categoryOf('deps/esm/iconv.md')).toBe('deps/esm');
    expect(slugOf('deps/esm/iconv.md')).toBe('iconv');
  });
});
