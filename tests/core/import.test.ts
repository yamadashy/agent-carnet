import { mkdirSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CarnetError } from '../../src/core/errors.js';
import { importFrom } from '../../src/core/import.js';
import { storageRoot } from '../../src/core/paths.js';
import { makeTmpCwd } from '../helpers/tmp.js';

describe('importFrom', () => {
  let tmp: ReturnType<typeof makeTmpCwd>;
  beforeEach(() => {
    tmp = makeTmpCwd();
  });
  afterEach(() => tmp.cleanup());

  it('migrates skill memories with status -> tag', async () => {
    const src = join(tmp.cwd, 'memories', 'deps');
    mkdirSync(src, { recursive: true });
    writeFileSync(
      join(src, 'iconv.md'),
      `---
summary: iconv issue
created: 2026-01-01
updated: 2026-01-05
status: open
tags:
  - compat
related:
  - src/foo.ts
---
Body content here.
`,
      'utf-8',
    );

    const report = await importFrom(tmp.cwd, 'memories');
    expect(report.imported).toEqual(['deps/iconv.md']);

    const out = await readFile(join(storageRoot(tmp.cwd), 'deps/iconv.md'), 'utf-8');
    expect(out).toContain('summary: iconv issue');
    expect(out).toContain('status:open');
    expect(out).toContain('agent: imported');
    expect(out).toContain('Body content here.');
  });

  it('skips files without summary', async () => {
    const src = join(tmp.cwd, 'memories');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'broken.md'), '---\nfoo: bar\n---\nbody\n');
    const r = await importFrom(tmp.cwd, 'memories');
    expect(r.skipped).toEqual(['broken.md']);
  });

  it('throws not_found when source missing', async () => {
    await expect(importFrom(tmp.cwd, 'no-such-dir')).rejects.toBeInstanceOf(CarnetError);
  });

  it('respects dry-run', async () => {
    const src = join(tmp.cwd, 'memories');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'a.md'), '---\nsummary: hello\n---\nbody\n');
    const r = await importFrom(tmp.cwd, 'memories', { dryRun: true });
    expect(r.imported).toEqual(['a.md']);
    // dry-run should NOT write to .agent-carnet/
    await expect(readFile(join(storageRoot(tmp.cwd), 'a.md'), 'utf-8')).rejects.toThrow();
  });
});
