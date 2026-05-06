import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readConfig } from '../../src/core/config.js';
import { find } from '../../src/core/find.js';
import { init } from '../../src/core/init.js';
import { list } from '../../src/core/list.js';
import { storageRoot, trashRoot } from '../../src/core/paths.js';
import { prune } from '../../src/core/prune.js';
import { save } from '../../src/core/save.js';
import { show } from '../../src/core/show.js';
import { makeTmpCwd } from '../helpers/tmp.js';

describe('round-trip', () => {
  let tmp: ReturnType<typeof makeTmpCwd>;
  const config = readConfig({});
  beforeEach(() => {
    tmp = makeTmpCwd();
  });
  afterEach(() => tmp.cleanup());

  it('init -> save -> list -> find -> show -> prune', async () => {
    await init(tmp.cwd);
    await save(
      tmp.cwd,
      config,
      { path: 'deps/iconv', summary: 'iconv', agent: 'claude-code', body: 'body text', tags: ['esm'] },
      new Date(Date.UTC(2026, 0, 1)),
    );
    const entries = await list(tmp.cwd, config);
    expect(entries.length).toBe(1);
    const hits = await find(tmp.cwd, 'iconv');
    expect(hits.length).toBe(1);
    const c = await show(tmp.cwd, 'deps/iconv', {}, new Date(Date.UTC(2026, 4, 4)));
    expect(c.body).toContain('body text');
    expect(c.frontmatter.updated).toBe('2026-05-04');
    // After show bumps updated to 2026-05-04, pruning at the same date should
    // NOT expire it (lifespan default 30d, so safe until ~2026-06-03).
    let r = await prune(tmp.cwd, config, {}, new Date(Date.UTC(2026, 4, 4)));
    expect(r.movedToTrash).toEqual([]);
    // Pruning far in the future expires it.
    r = await prune(tmp.cwd, config, {}, new Date(Date.UTC(2027, 4, 4)));
    expect(r.movedToTrash).toEqual(['deps/iconv.md']);
    expect(existsSync(join(storageRoot(tmp.cwd), 'deps/iconv.md'))).toBe(false);
    expect(existsSync(join(trashRoot(tmp.cwd), 'deps/iconv.md'))).toBe(true);
  });
});
