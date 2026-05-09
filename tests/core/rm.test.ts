import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readConfig } from '../../src/core/config.js';
import { CarnetError } from '../../src/core/errors.js';
import { init } from '../../src/core/init.js';
import { remove } from '../../src/core/rm.js';
import { save } from '../../src/core/save.js';
import { makeTmpCwd } from '../helpers/tmp.js';

describe('rm', () => {
  let tmp: ReturnType<typeof makeTmpCwd>;
  const config = readConfig({});

  beforeEach(async () => {
    tmp = makeTmpCwd();
    await init(tmp.cwd);
  });
  afterEach(() => tmp.cleanup());

  it('moves the carnet to .trash/ by default', async () => {
    await save(tmp.cwd, config, { path: 'deps/a', summary: 's', agent: 'a', body: '' });
    const r = await remove(tmp.cwd, 'deps/a');
    expect(r.trashed).toBe(true);
    expect(existsSync(join(tmp.cwd, '.carnet/deps/a.md'))).toBe(false);
    expect(existsSync(join(tmp.cwd, '.carnet/.trash/deps/a.md'))).toBe(true);
  });

  it('hard-deletes when --hard is set', async () => {
    await save(tmp.cwd, config, { path: 'deps/a', summary: 's', agent: 'a', body: '' });
    const r = await remove(tmp.cwd, 'deps/a', { hard: true });
    expect(r.trashed).toBe(false);
    expect(existsSync(join(tmp.cwd, '.carnet/deps/a.md'))).toBe(false);
    expect(existsSync(join(tmp.cwd, '.carnet/.trash/deps/a.md'))).toBe(false);
  });

  it('throws not_found for missing carnet', async () => {
    await expect(remove(tmp.cwd, 'deps/missing')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('rejects path traversal', async () => {
    await expect(remove(tmp.cwd, '../etc/passwd')).rejects.toThrow(CarnetError);
  });
});
