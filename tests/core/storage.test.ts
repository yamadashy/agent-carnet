import { existsSync } from 'node:fs';
import { mkdir, stat, utimes, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { init } from '../../src/core/init.js';
import { storageRoot, trashRoot } from '../../src/core/paths.js';
import { moveToTrash, readCarnet, trashEntryTime } from '../../src/core/storage.js';
import { makeTmpCwd } from '../helpers/tmp.js';

async function writeFileAt(abs: string, content: string): Promise<void> {
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, content, 'utf-8');
}

describe('storage trash helpers', () => {
  let tmp: ReturnType<typeof makeTmpCwd>;

  beforeEach(async () => {
    tmp = makeTmpCwd();
    await init(tmp.cwd);
  });
  afterEach(() => tmp.cleanup());

  it('moveToTrash stamps trashed_at into the moved frontmatter', async () => {
    await writeFileAt(
      resolve(storageRoot(tmp.cwd), 'deps/a.md'),
      '---\nsummary: s\nagent: a\ncreated: 2026-01-01\nupdated: 2026-01-01\n---\nbody\n',
    );
    await moveToTrash(tmp.cwd, 'deps/a.md', new Date(Date.UTC(2026, 4, 4)));
    const c = await readCarnet(resolve(trashRoot(tmp.cwd), 'deps/a.md'), 'deps/a.md');
    expect(c.frontmatter.trashed_at).toBe('2026-05-04');
  });

  it('moveToTrash touches mtime when the frontmatter cannot be parsed', async () => {
    // Unterminated quote — gray-matter (js-yaml) throws, so no stamp is written.
    await writeFileAt(resolve(storageRoot(tmp.cwd), 'deps/bad.md'), '---\nsummary: "unterminated\n---\nbody\n');
    const when = new Date(Date.UTC(2026, 4, 4));
    const dest = await moveToTrash(tmp.cwd, 'deps/bad.md', when);
    expect(existsSync(dest)).toBe(true);
    const m = await stat(dest);
    expect(m.mtime.getTime()).toBe(when.getTime());
  });

  it('trashEntryTime prefers a quoted trashed_at stamp', async () => {
    const abs = resolve(trashRoot(tmp.cwd), 'deps/q.md');
    await writeFileAt(
      abs,
      "---\nsummary: s\nagent: a\ncreated: 2026-01-01\nupdated: 2026-01-01\ntrashed_at: '2026-05-04'\n---\nbody\n",
    );
    expect(await trashEntryTime(abs, 'deps/q.md')).toEqual(new Date(Date.UTC(2026, 4, 4)));
  });

  it('trashEntryTime reads an unquoted trashed_at parsed as a Date by gray-matter', async () => {
    const abs = resolve(trashRoot(tmp.cwd), 'deps/d.md');
    await writeFileAt(
      abs,
      '---\nsummary: s\nagent: a\ncreated: 2026-01-01\nupdated: 2026-01-01\ntrashed_at: 2026-05-04\n---\nbody\n',
    );
    expect(await trashEntryTime(abs, 'deps/d.md')).toEqual(new Date(Date.UTC(2026, 4, 4)));
  });

  it('trashEntryTime falls back to mtime when no trashed_at is present', async () => {
    const abs = resolve(trashRoot(tmp.cwd), 'deps/legacy.md');
    await writeFileAt(abs, '---\nsummary: s\nagent: a\ncreated: 2026-01-01\nupdated: 2026-01-01\n---\nbody\n');
    const when = new Date(Date.UTC(2026, 3, 1));
    await utimes(abs, when, when);
    expect((await trashEntryTime(abs, 'deps/legacy.md')).getTime()).toBe(when.getTime());
  });
});
