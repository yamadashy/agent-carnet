import { describe, expect, it } from 'vitest';
import {
  formatFindHuman,
  formatFindJson,
  formatListHuman,
  formatListJson,
  formatSaveHuman,
  formatSaveJson,
  formatShowHuman,
  formatShowJson,
} from '../../src/output/format.js';
import type { Carnet } from '../../src/types/index.js';

const sample: Carnet = {
  relPath: 'deps/iconv.md',
  absPath: '/abs/.carnet/deps/iconv.md',
  frontmatter: {
    summary: 'iconv',
    agent: 'a',
    created: '2026-01-01',
    updated: '2026-01-01',
    tags: ['esm'],
    related: ['src/foo.ts'],
    lifespan: '90d',
    keep: true,
  },
  body: 'body content',
};

describe('format', () => {
  it('list human handles empty', () => {
    expect(formatListHuman([], false)).toBe('no carnets found');
  });
  it('list human prints entries', () => {
    const out = formatListHuman([{ carnet: sample, expires: '2026-04-01' }], false);
    expect(out).toContain('deps/');
    expect(out).toContain('iconv');
  });
  it('list human supports color', () => {
    const out = formatListHuman([{ carnet: sample, expires: null }], true);
    expect(out).toContain('iconv');
  });
  it('list json roundtrips', () => {
    const obj = JSON.parse(formatListJson([{ carnet: sample, expires: null }]));
    expect(obj.entries[0].path).toBe('deps/iconv.md');
  });
  it('find human handles empty', () => {
    expect(formatFindHuman([], false)).toBe('no matches');
  });
  it('find human with snippet', () => {
    const out = formatFindHuman([{ carnet: sample, matchedIn: ['summary', 'body'], snippet: 'snip' }], false);
    expect(out).toContain('summary,body');
    expect(out).toContain('snip');
  });
  it('find human with color', () => {
    const out = formatFindHuman([{ carnet: sample, matchedIn: ['summary'] }], true);
    expect(out).toContain('iconv');
  });
  it('find json roundtrips', () => {
    const obj = JSON.parse(formatFindJson([{ carnet: sample, matchedIn: ['summary'], snippet: 's' }]));
    expect(obj.hits[0].matched_in).toEqual(['summary']);
  });
  it('show human with frontmatter', () => {
    const out = formatShowHuman(sample, true);
    expect(out).toContain('summary: iconv');
    expect(out).toContain('tags: esm');
    expect(out).toContain('lifespan: 90d');
    expect(out).toContain('keep: true');
    expect(out).toContain('body content');
  });
  it('show human body only', () => {
    expect(formatShowHuman(sample, false)).toBe('body content');
  });
  it('show json', () => {
    const obj = JSON.parse(formatShowJson(sample));
    expect(obj.body).toBe('body content');
  });
  it('save human', () => {
    const out = formatSaveHuman('deps/iconv.md', sample.frontmatter, '2026-04-01', false);
    expect(out).toContain('saved');
    expect(out).toContain('deps/iconv.md');
  });
  it('save human with color and never expiry', () => {
    const out = formatSaveHuman('deps/iconv.md', sample.frontmatter, null, true);
    expect(out).toContain('never');
  });
  it('save json', () => {
    const obj = JSON.parse(formatSaveJson('deps/iconv.md', '/abs/iconv.md', sample.frontmatter, '2026-04-01'));
    expect(obj.path).toBe('deps/iconv.md');
  });
});
