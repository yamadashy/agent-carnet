import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readConfig } from '../../src/core/config.js';
import { CarnetError } from '../../src/core/errors.js';
import { init } from '../../src/core/init.js';
import { save } from '../../src/core/save.js';
import { used } from '../../src/core/used.js';
import { makeTmpCwd } from '../helpers/tmp.js';

describe('used', () => {
  let tmp: ReturnType<typeof makeTmpCwd>;
  const config = readConfig({});

  beforeEach(async () => {
    tmp = makeTmpCwd();
    await init(tmp.cwd);
  });
  afterEach(() => tmp.cleanup());

  it('bumps last_used to today and increments use_count from 0 to 1', async () => {
    await save(
      tmp.cwd,
      config,
      { path: 'deps/iconv', summary: 's', agent: 'a', body: 'body' },
      new Date(Date.UTC(2026, 0, 1)),
    );
    const r = await used(tmp.cwd, 'deps/iconv', new Date(Date.UTC(2026, 4, 4)));
    expect(r.lastUsed).toBe('2026-05-04');
    expect(r.useCount).toBe(1);
    const onDisk = readFileSync(r.absPath, 'utf-8');
    expect(onDisk).toMatch(/last_used: ['"]?2026-05-04['"]?/);
    expect(onDisk).toMatch(/use_count: 1/);
    // Body must be preserved verbatim — used does not read or rewrite content.
    expect(onDisk).toContain('body');
    // updated must NOT be touched — usage is separate from content modification.
    expect(onDisk).toMatch(/updated: ['"]?2026-01-01['"]?/);
  });

  it('keeps incrementing on repeated calls (no short-circuit on same day)', async () => {
    await save(
      tmp.cwd,
      config,
      { path: 'deps/iconv', summary: 's', agent: 'a', body: '' },
      new Date(Date.UTC(2026, 4, 4)),
    );
    const r1 = await used(tmp.cwd, 'deps/iconv', new Date(Date.UTC(2026, 4, 4)));
    expect(r1.useCount).toBe(1);
    const r2 = await used(tmp.cwd, 'deps/iconv', new Date(Date.UTC(2026, 4, 4)));
    expect(r2.useCount).toBe(2);
    const r3 = await used(tmp.cwd, 'deps/iconv', new Date(Date.UTC(2026, 4, 4)));
    expect(r3.useCount).toBe(3);
  });

  it('throws not_found for missing carnet', async () => {
    await expect(used(tmp.cwd, 'deps/missing')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('rejects path traversal', async () => {
    await expect(used(tmp.cwd, '../etc/passwd')).rejects.toThrow(CarnetError);
  });
});
