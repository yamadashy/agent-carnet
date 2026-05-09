import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { init } from '../../src/core/init.js';
import { makeTmpCwd } from '../helpers/tmp.js';

describe('init', () => {
  let tmp: ReturnType<typeof makeTmpCwd>;
  beforeEach(() => {
    tmp = makeTmpCwd();
  });
  afterEach(() => tmp.cleanup());

  it('creates the storage directory', async () => {
    const r = await init(tmp.cwd);
    expect(existsSync(r.storageDir)).toBe(true);
    expect(r.created).toBe(true);
  });

  it('reports created=false when already present', async () => {
    await init(tmp.cwd);
    const r = await init(tmp.cwd);
    expect(r.created).toBe(false);
  });

  it('appends to .gitignore when requested', async () => {
    const r = await init(tmp.cwd, { gitignore: true });
    expect(r.gitignoreUpdated).toBe(true);
    const gi = readFileSync(join(tmp.cwd, '.gitignore'), 'utf-8');
    expect(gi).toContain('.carnet/');
  });

  it('does not duplicate the gitignore entry', async () => {
    writeFileSync(join(tmp.cwd, '.gitignore'), '.carnet/\n');
    const r = await init(tmp.cwd, { gitignore: true });
    expect(r.gitignoreUpdated).toBe(false);
  });
});
