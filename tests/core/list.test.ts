import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readConfig } from '../../src/core/config.js';
import { init } from '../../src/core/init.js';
import { list } from '../../src/core/list.js';
import { save } from '../../src/core/save.js';
import { makeTmpCwd } from '../helpers/tmp.js';

describe('list', () => {
  let tmp: ReturnType<typeof makeTmpCwd>;
  const config = readConfig({});

  beforeEach(async () => {
    tmp = makeTmpCwd();
    await init(tmp.cwd);
    await save(
      tmp.cwd,
      config,
      { path: 'deps/iconv', summary: 'iconv', agent: 'a', body: '', tags: ['esm'] },
      new Date(Date.UTC(2026, 4, 1)),
    );
    await save(
      tmp.cwd,
      config,
      { path: 'deps/zlib', summary: 'zlib', agent: 'a', body: '' },
      new Date(Date.UTC(2026, 4, 4)),
    );
    await save(
      tmp.cwd,
      config,
      { path: 'misc/note', summary: 'misc', agent: 'a', body: '' },
      new Date(Date.UTC(2026, 4, 3)),
    );
  });
  afterEach(() => tmp.cleanup());

  it('returns all carnets sorted by updated desc', async () => {
    const entries = await list(tmp.cwd, config);
    expect(entries.map((e) => e.carnet.relPath)).toEqual(['deps/zlib.md', 'misc/note.md', 'deps/iconv.md']);
  });

  it('filters by category', async () => {
    const entries = await list(tmp.cwd, config, { category: 'deps' });
    expect(entries.every((e) => e.carnet.relPath.startsWith('deps/'))).toBe(true);
    expect(entries.length).toBe(2);
  });

  it('filters by tags (AND)', async () => {
    const entries = await list(tmp.cwd, config, { tags: ['esm'] });
    expect(entries.length).toBe(1);
    expect(entries[0].carnet.relPath).toBe('deps/iconv.md');
  });

  it('limits to recent N', async () => {
    const entries = await list(tmp.cwd, config, { recent: 2 });
    expect(entries.length).toBe(2);
  });

  it('sorts by name', async () => {
    const entries = await list(tmp.cwd, config, { sort: 'name' });
    expect(entries[0].carnet.relPath.localeCompare(entries[1].carnet.relPath)).toBeLessThanOrEqual(0);
  });
});
