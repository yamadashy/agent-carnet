import { readFileSync, statSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readConfig } from '../../src/core/config.js';
import { CarnetError } from '../../src/core/errors.js';
import { init } from '../../src/core/init.js';
import { save } from '../../src/core/save.js';
import { touch } from '../../src/core/touch.js';
import { makeTmpCwd } from '../helpers/tmp.js';

describe('touch', () => {
  let tmp: ReturnType<typeof makeTmpCwd>;
  const config = readConfig({});

  beforeEach(async () => {
    tmp = makeTmpCwd();
    await init(tmp.cwd);
  });
  afterEach(() => tmp.cleanup());

  it('bumps updated to today and reports changed', async () => {
    await save(
      tmp.cwd,
      config,
      { path: 'deps/iconv', summary: 's', agent: 'a', body: 'body' },
      new Date(Date.UTC(2026, 0, 1)),
    );
    const r = await touch(tmp.cwd, 'deps/iconv', new Date(Date.UTC(2026, 4, 4)));
    expect(r.updated).toBe('2026-05-04');
    expect(r.changed).toBe(true);
    const onDisk = readFileSync(r.absPath, 'utf-8');
    expect(onDisk).toMatch(/updated: ['"]?2026-05-04['"]?/);
    // Body must be preserved verbatim — touch does not read or rewrite content.
    expect(onDisk).toContain('body');
  });

  it('skips writing when updated is already today', async () => {
    await save(
      tmp.cwd,
      config,
      { path: 'deps/iconv', summary: 's', agent: 'a', body: '' },
      new Date(Date.UTC(2026, 4, 4)),
    );
    const before = statSync(`${tmp.cwd}/.agent-carnet/deps/iconv.md`).mtimeMs;
    await new Promise((resolve) => setTimeout(resolve, 10));
    const r = await touch(tmp.cwd, 'deps/iconv', new Date(Date.UTC(2026, 4, 4)));
    expect(r.changed).toBe(false);
    const after = statSync(`${tmp.cwd}/.agent-carnet/deps/iconv.md`).mtimeMs;
    expect(after).toBe(before);
  });

  it('throws not_found for missing carnet', async () => {
    await expect(touch(tmp.cwd, 'deps/missing')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('rejects path traversal', async () => {
    await expect(touch(tmp.cwd, '../etc/passwd')).rejects.toThrow(CarnetError);
  });
});
