import { describe, expect, it } from 'vitest';
import { CarnetError } from '../../src/core/errors.js';
import { exitCodeFor, formatErrorHuman, formatErrorJson, toErrorShape } from '../../src/output/error.js';

describe('error formatting', () => {
  it('toErrorShape from CarnetError', () => {
    const s = toErrorShape(new CarnetError('not_found', 'gone', 'try again'));
    expect(s).toEqual({ code: 'not_found', message: 'gone', hint: 'try again' });
  });
  it('toErrorShape from generic Error', () => {
    const s = toErrorShape(new Error('boom'));
    expect(s.code).toBe('internal_error');
    expect(s.message).toBe('boom');
  });
  it('toErrorShape from non-Error', () => {
    expect(toErrorShape('string-thrown').message).toBe('string-thrown');
  });
  it('formatErrorHuman includes hint', () => {
    const out = formatErrorHuman({ code: 'validation_error', message: 'bad', hint: 'fix' }, false);
    expect(out).toContain('error: validation_error');
    expect(out).toContain('hint: fix');
  });
  it('formatErrorHuman with color', () => {
    const out = formatErrorHuman({ code: 'validation_error', message: 'bad' }, true);
    expect(out).toContain('validation_error');
  });
  it('formatErrorJson roundtrips', () => {
    const obj = JSON.parse(formatErrorJson({ code: 'conflict', message: 'exists' }));
    expect(obj.ok).toBe(false);
    expect(obj.error.code).toBe('conflict');
  });
  it('exitCodeFor mapping', () => {
    expect(exitCodeFor('validation_error')).toBe(2);
    expect(exitCodeFor('frontmatter_error')).toBe(2);
    expect(exitCodeFor('not_found')).toBe(3);
    expect(exitCodeFor('conflict')).toBe(4);
    expect(exitCodeFor('internal_error')).toBe(1);
  });
});
