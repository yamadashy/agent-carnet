import { existsSync } from 'node:fs';
import { utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readConfig } from '../../src/core/config.js';
import { init } from '../../src/core/init.js';
import { storageRoot, trashRoot } from '../../src/core/paths.js';
import { prune } from '../../src/core/prune.js';
import { save } from '../../src/core/save.js';
import { makeTmpCwd } from '../helpers/tmp.js';

describe('prune', () => {
  let tmp: ReturnType<typeof makeTmpCwd>;
  const config = readConfig({});

  beforeEach(async () => {
    tmp = makeTmpCwd();
    await init(tmp.cwd);
  });
  afterEach(() => tmp.cleanup());

  it('moves expired carnets to .trash/', async () => {
    await save(
      tmp.cwd,
      config,
      { path: 'deps/old', summary: 's', agent: 'a', body: '' },
      new Date(Date.UTC(2026, 0, 1)),
    );
    const report = await prune(tmp.cwd, config, {}, new Date(Date.UTC(2026, 4, 4)));
    expect(report.movedToTrash).toEqual(['deps/old.md']);
    expect(existsSync(join(storageRoot(tmp.cwd), 'deps/old.md'))).toBe(false);
    expect(existsSync(join(trashRoot(tmp.cwd), 'deps/old.md'))).toBe(true);
  });

  it('respects keep:true', async () => {
    await save(
      tmp.cwd,
      config,
      { path: 'deps/keep', summary: 's', agent: 'a', body: '', keep: true },
      new Date(Date.UTC(2026, 0, 1)),
    );
    const report = await prune(tmp.cwd, config, {}, new Date(Date.UTC(2026, 4, 4)));
    expect(report.movedToTrash).toEqual([]);
  });

  it('respects --dry-run', async () => {
    await save(
      tmp.cwd,
      config,
      { path: 'deps/old', summary: 's', agent: 'a', body: '' },
      new Date(Date.UTC(2026, 0, 1)),
    );
    const report = await prune(tmp.cwd, config, { dryRun: true }, new Date(Date.UTC(2026, 4, 4)));
    expect(report.movedToTrash).toEqual(['deps/old.md']);
    expect(existsSync(join(storageRoot(tmp.cwd), 'deps/old.md'))).toBe(true);
  });

  it('hard-deletes from .trash/ after TTL when --include-trash', async () => {
    await save(
      tmp.cwd,
      config,
      { path: 'deps/old', summary: 's', agent: 'a', body: '' },
      new Date(Date.UTC(2026, 0, 1)),
    );
    await prune(tmp.cwd, config, {}, new Date(Date.UTC(2026, 4, 4)));
    const trashFile = join(trashRoot(tmp.cwd), 'deps/old.md');
    // Backdate the trash file's mtime so it looks ancient.
    const old = new Date(Date.UTC(2026, 0, 1));
    await utimes(trashFile, old, old);
    const report = await prune(tmp.cwd, config, { includeTrash: true }, new Date(Date.UTC(2026, 4, 4)));
    expect(report.hardDeleted).toEqual(['deps/old.md']);
    expect(existsSync(trashFile)).toBe(false);
  });
});
