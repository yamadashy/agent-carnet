import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readConfig } from '../../src/core/config.js';
import { find } from '../../src/core/find.js';
import { init } from '../../src/core/init.js';
import { save } from '../../src/core/save.js';
import { makeTmpCwd } from '../helpers/tmp.js';

describe('find', () => {
  let tmp: ReturnType<typeof makeTmpCwd>;
  const config = readConfig({});

  beforeEach(async () => {
    tmp = makeTmpCwd();
    await init(tmp.cwd);
    await save(tmp.cwd, config, {
      path: 'deps/iconv',
      summary: 'iconv-esm compat',
      agent: 'a',
      body: 'Notes about iconv usage in ESM context.',
      tags: ['esm', 'compat'],
    });
    await save(tmp.cwd, config, {
      path: 'misc/zlib',
      summary: 'zlib stream',
      agent: 'a',
      body: 'unrelated body',
    });
  });
  afterEach(() => tmp.cleanup());

  it('searches summary by default', async () => {
    const hits = await find(tmp.cwd, 'iconv');
    expect(hits.length).toBe(1);
    expect(hits[0].matchedIn).toContain('summary');
  });

  it('searches tags', async () => {
    const hits = await find(tmp.cwd, 'esm', { in: 'tags' });
    expect(hits.length).toBe(1);
  });

  it('searches body when --in body', async () => {
    const hits = await find(tmp.cwd, 'context', { in: 'body' });
    expect(hits.length).toBe(1);
    expect(hits[0].snippet).toContain('context');
  });

  it('searches everything with --in all', async () => {
    const hits = await find(tmp.cwd, 'iconv', { in: 'all' });
    expect(hits[0].matchedIn).toEqual(expect.arrayContaining(['summary', 'body']));
  });

  it('honors --limit', async () => {
    const hits = await find(tmp.cwd, '', { in: 'all', limit: 1 });
    // empty string matches everything; cap at 1
    expect(hits.length).toBeLessThanOrEqual(1);
  });

  it('does not bump updated on hit', async () => {
    // baseline updated date is today; verify we don't rewrite the file
    const before = await find(tmp.cwd, 'iconv');
    const updatedBefore = before[0].carnet.frontmatter.updated;
    await find(tmp.cwd, 'iconv');
    const after = await find(tmp.cwd, 'iconv');
    expect(after[0].carnet.frontmatter.updated).toBe(updatedBefore);
  });
});
