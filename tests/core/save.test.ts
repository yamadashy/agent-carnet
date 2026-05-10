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

  it('initializes last_used to today and use_count to 0 on first save', async () => {
    const r = await save(
      tmp.cwd,
      config,
      { path: 'deps/iconv', summary: 's', agent: 'a', body: '' },
      new Date(Date.UTC(2026, 4, 4)),
    );
    expect(r.carnet.frontmatter.last_used).toBe('2026-05-04');
    expect(r.carnet.frontmatter.use_count).toBe(0);
  });

  it('preserves use_count across --update (saving is not "use")', async () => {
    await save(
      tmp.cwd,
      config,
      { path: 'deps/iconv', summary: 's', agent: 'a', body: '' },
      new Date(Date.UTC(2026, 4, 4)),
    );
    // Bump the count manually to mimic prior `used` calls.
    const fs = await import('node:fs/promises');
    const file = `${tmp.cwd}/.carnet/deps/iconv.md`;
    let content = await fs.readFile(file, 'utf-8');
    content = content.replace(/use_count: 0/, 'use_count: 7');
    await fs.writeFile(file, content, 'utf-8');

    const r2 = await save(
      tmp.cwd,
      config,
      { path: 'deps/iconv', summary: 's2', agent: 'a', body: 'second', update: true },
      new Date(Date.UTC(2026, 5, 1)),
    );
    expect(r2.carnet.frontmatter.use_count).toBe(7);
    // last_used is bumped because save IS interaction with the note.
    expect(r2.carnet.frontmatter.last_used).toBe('2026-06-01');
    // updated tracks the content change.
    expect(r2.carnet.frontmatter.updated).toBe('2026-06-01');
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

  it('preserves user-supplied frontmatter (e.g. meta) on --update', async () => {
    // Create the carnet via the CLI to get the on-disk path, then overwrite
    // the file with a hand-built version that includes a `meta:` extension
    // namespace as a downstream tool / human / Obsidian plugin would.
    const created = await save(tmp.cwd, config, {
      path: 'vocab/staging-adapter',
      summary: 'staging adapter',
      agent: 'claude-code',
      body: 'definition body',
      tags: ['vocab'],
    });
    const fs = await import('node:fs/promises');
    const handBuilt = [
      '---',
      "summary: 'staging adapter'",
      "agent: 'claude-code'",
      "created: '2026-05-09'",
      "updated: '2026-05-09'",
      'tags:',
      '  - vocab',
      'meta:',
      '  vocab:',
      "    canonical: 'staging adapter'",
      '    aliases:',
      '      - proxy layer',
      '      - forward middleware',
      '---',
      '',
      'definition body',
      '',
    ].join('\n');
    await fs.writeFile(created.carnet.absPath, handBuilt, 'utf-8');

    // Now update via the CLI: meta and any other non-CLI-managed fields must
    // round-trip untouched.
    await save(tmp.cwd, config, {
      path: 'vocab/staging-adapter',
      summary: 'staging adapter — refined',
      agent: 'claude-code',
      body: 'updated definition',
      tags: ['vocab'],
      update: true,
    });

    const after = await fs.readFile(created.carnet.absPath, 'utf-8');
    expect(after).toContain('summary: staging adapter — refined');
    expect(after).toContain('vocab:');
    expect(after).toContain('canonical: staging adapter');
    expect(after).toContain('proxy layer');
    expect(after).toContain('forward middleware');
    expect(after).toContain('updated definition');
  });
});
