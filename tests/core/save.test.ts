import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readConfig } from '../../src/core/config.js';
import { CarnetError } from '../../src/core/errors.js';
import { init } from '../../src/core/init.js';
import { save } from '../../src/core/save.js';
import { makeTmpCwd } from '../helpers/tmp.js';

describe('save', () => {
  let tmp: ReturnType<typeof makeTmpCwd>;
  const config = readConfig({});

  beforeEach(async () => {
    tmp = makeTmpCwd();
    await init(tmp.cwd);
  });
  afterEach(() => tmp.cleanup());

  it('creates a new carnet with required fields', async () => {
    const r = await save(tmp.cwd, config, {
      path: 'deps/iconv',
      summary: 'iconv issue',
      agent: 'claude-code',
      body: 'hello',
    });
    expect(r.created).toBe(true);
    expect(r.carnet.relPath).toBe('deps/iconv.md');
    const onDisk = readFileSync(r.carnet.absPath, 'utf-8');
    expect(onDisk).toContain('summary: iconv issue');
    expect(onDisk).toContain('hello');
  });

  it('rejects missing summary', async () => {
    await expect(
      save(tmp.cwd, config, { path: 'deps/iconv', summary: '', agent: 'claude-code', body: '' }),
    ).rejects.toThrow(/summary/);
  });

  it('rejects missing agent', async () => {
    await expect(save(tmp.cwd, config, { path: 'deps/iconv', summary: 'hi', agent: '', body: '' })).rejects.toThrow(
      /agent/,
    );
  });

  it('rejects path traversal', async () => {
    await expect(save(tmp.cwd, config, { path: '../escape/me', summary: 'x', agent: 'a', body: '' })).rejects.toThrow(
      CarnetError,
    );
  });

  it('returns conflict when file exists without --update', async () => {
    await save(tmp.cwd, config, { path: 'deps/iconv', summary: 's', agent: 'a', body: '' });
    await expect(
      save(tmp.cwd, config, { path: 'deps/iconv', summary: 's2', agent: 'a', body: '' }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('preserves created date when --update is passed', async () => {
    const r1 = await save(
      tmp.cwd,
      config,
      { path: 'deps/iconv', summary: 's', agent: 'a', body: 'first' },
      new Date(Date.UTC(2026, 0, 1)),
    );
    const r2 = await save(
      tmp.cwd,
      config,
      { path: 'deps/iconv', summary: 's2', agent: 'a', body: 'second', update: true },
      new Date(Date.UTC(2026, 4, 4)),
    );
    expect(r2.carnet.frontmatter.created).toBe(r1.carnet.frontmatter.created);
    expect(r2.carnet.frontmatter.updated).toBe('2026-05-04');
  });

  it('honors keep flag', async () => {
    const r = await save(tmp.cwd, config, {
      path: 'deps/iconv',
      summary: 's',
      agent: 'a',
      body: '',
      keep: true,
    });
    expect(r.expires).toBeNull();
    expect(r.carnet.frontmatter.keep).toBe(true);
  });

  it('parses lifespan override', async () => {
    const r = await save(
      tmp.cwd,
      config,
      { path: 'deps/iconv', summary: 's', agent: 'a', body: '', lifespan: '7d' },
      new Date(Date.UTC(2026, 4, 4)),
    );
    expect(r.expires).toBe('2026-05-11');
  });
});
