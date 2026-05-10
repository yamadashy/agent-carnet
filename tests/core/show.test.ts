import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readConfig } from '../../src/core/config.js';
import { CarnetError } from '../../src/core/errors.js';
import { init } from '../../src/core/init.js';
import { save } from '../../src/core/save.js';
import { show } from '../../src/core/show.js';
import { makeTmpCwd } from '../helpers/tmp.js';

describe('show', () => {
  let tmp: ReturnType<typeof makeTmpCwd>;
  const config = readConfig({});

  beforeEach(async () => {
    tmp = makeTmpCwd();
    await init(tmp.cwd);
  });
  afterEach(() => tmp.cleanup());

  it('throws not_found for missing path', async () => {
    await expect(show(tmp.cwd, 'deps/missing')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('bumps last_used by default but leaves updated alone', async () => {
    await save(
      tmp.cwd,
      config,
      { path: 'deps/iconv', summary: 's', agent: 'a', body: '' },
      new Date(Date.UTC(2026, 0, 1)),
    );
    const c = await show(tmp.cwd, 'deps/iconv', {}, new Date(Date.UTC(2026, 4, 4)));
    expect(c.frontmatter.last_used).toBe('2026-05-04');
    // updated tracks content modification only — show must not bump it.
    expect(c.frontmatter.updated).toBe('2026-01-01');
    // show is a weak signal — it does not increment use_count.
    expect(c.frontmatter.use_count).toBe(0);
  });

  it('respects --no-touch (does not bump last_used)', async () => {
    await save(
      tmp.cwd,
      config,
      { path: 'deps/iconv', summary: 's', agent: 'a', body: '' },
      new Date(Date.UTC(2026, 0, 1)),
    );
    const c = await show(tmp.cwd, 'deps/iconv', { noTouch: true }, new Date(Date.UTC(2026, 4, 4)));
    expect(c.frontmatter.last_used).toBe('2026-01-01');
    expect(c.frontmatter.updated).toBe('2026-01-01');
  });

  it('rejects path traversal', async () => {
    await expect(show(tmp.cwd, '../etc/passwd')).rejects.toThrow(CarnetError);
  });
});
