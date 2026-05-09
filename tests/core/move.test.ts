import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readConfig } from '../../src/core/config.js';
import { CarnetError } from '../../src/core/errors.js';
import { init } from '../../src/core/init.js';
import { move } from '../../src/core/move.js';
import { save } from '../../src/core/save.js';
import { makeTmpCwd } from '../helpers/tmp.js';

describe('move', () => {
  let tmp: ReturnType<typeof makeTmpCwd>;
  const config = readConfig({});

  beforeEach(async () => {
    tmp = makeTmpCwd();
    await init(tmp.cwd);
  });
  afterEach(() => tmp.cleanup());

  it('moves to a full destination path', async () => {
    await save(tmp.cwd, config, { path: 'deps/iconv', summary: 's', agent: 'a', body: 'b' });
    const r = await move(tmp.cwd, 'deps/iconv', 'archive/iconv-old');
    expect(r.fromRel).toBe('deps/iconv.md');
    expect(r.toRel).toBe('archive/iconv-old.md');
    expect(existsSync(join(tmp.cwd, '.carnet/deps/iconv.md'))).toBe(false);
    expect(existsSync(join(tmp.cwd, '.carnet/archive/iconv-old.md'))).toBe(true);
    // Frontmatter preserved as-is — created/updated unchanged.
    expect(readFileSync(r.toAbs, 'utf-8')).toContain('summary: s');
  });

  it('keeps source filename when destination ends with /', async () => {
    await save(tmp.cwd, config, { path: 'deps/iconv', summary: 's', agent: 'a', body: '' });
    const r = await move(tmp.cwd, 'deps/iconv', 'archive/');
    expect(r.toRel).toBe('archive/iconv.md');
  });

  it('creates intermediate directories', async () => {
    await save(tmp.cwd, config, { path: 'deps/iconv', summary: 's', agent: 'a', body: '' });
    const r = await move(tmp.cwd, 'deps/iconv', 'archive/old/iconv');
    expect(r.toRel).toBe('archive/old/iconv.md');
    expect(existsSync(r.toAbs)).toBe(true);
  });

  it('throws not_found when source missing', async () => {
    await expect(move(tmp.cwd, 'deps/missing', 'archive/')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('throws conflict when destination exists', async () => {
    await save(tmp.cwd, config, { path: 'deps/a', summary: 's', agent: 'a', body: '' });
    await save(tmp.cwd, config, { path: 'archive/a', summary: 's', agent: 'a', body: '' });
    await expect(move(tmp.cwd, 'deps/a', 'archive/a')).rejects.toMatchObject({ code: 'conflict' });
  });

  it('overwrites destination when --update is passed', async () => {
    await save(tmp.cwd, config, { path: 'deps/a', summary: 'src', agent: 'a', body: 'src-body' });
    await save(tmp.cwd, config, { path: 'archive/a', summary: 'dst', agent: 'a', body: 'dst-body' });
    await move(tmp.cwd, 'deps/a', 'archive/a', { update: true });
    expect(existsSync(join(tmp.cwd, '.carnet/deps/a.md'))).toBe(false);
    expect(readFileSync(join(tmp.cwd, '.carnet/archive/a.md'), 'utf-8')).toContain('summary: src');
  });

  it('rejects path traversal in either argument', async () => {
    await save(tmp.cwd, config, { path: 'deps/a', summary: 's', agent: 'a', body: '' });
    await expect(move(tmp.cwd, '../escape', 'archive/')).rejects.toThrow(CarnetError);
    await expect(move(tmp.cwd, 'deps/a', '../escape/me')).rejects.toThrow(CarnetError);
  });

  it('rejects move-to-self', async () => {
    await save(tmp.cwd, config, { path: 'deps/a', summary: 's', agent: 'a', body: '' });
    await expect(move(tmp.cwd, 'deps/a', 'deps/a')).rejects.toMatchObject({ code: 'validation_error' });
  });
});
