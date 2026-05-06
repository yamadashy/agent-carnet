import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readConfig } from '../../src/core/config.js';
import { init } from '../../src/core/init.js';
import { list } from '../../src/core/list.js';
import { save } from '../../src/core/save.js';
import { makeTmpCwd } from '../helpers/tmp.js';

describe('list --expiring', () => {
  let tmp: ReturnType<typeof makeTmpCwd>;
  const config = readConfig({});

  beforeEach(async () => {
    tmp = makeTmpCwd();
    await init(tmp.cwd);
  });
  afterEach(() => tmp.cleanup());

  it('returns only carnets expiring within the window', async () => {
    // soon: lifespan 5d, updated today -> expires in 5d (within 7d window)
    await save(
      tmp.cwd,
      config,
      { path: 'a/soon', summary: 's', agent: 'a', body: '', lifespan: '5d' },
      new Date(Date.UTC(2026, 4, 1)),
    );
    // far: lifespan 365d -> well outside window
    await save(
      tmp.cwd,
      config,
      { path: 'a/far', summary: 'f', agent: 'a', body: '', lifespan: '365d' },
      new Date(Date.UTC(2026, 4, 1)),
    );
    // kept: keep:true -> excluded
    await save(
      tmp.cwd,
      config,
      { path: 'a/keep', summary: 'k', agent: 'a', body: '', keep: true },
      new Date(Date.UTC(2026, 4, 1)),
    );
    const r = await list(tmp.cwd, config, { expiring: '7d' }, new Date(Date.UTC(2026, 4, 1)));
    expect(r.map((e) => e.carnet.relPath).sort()).toEqual(['a/soon.md']);
  });
});
