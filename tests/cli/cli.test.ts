import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run } from '../../src/cli/cli.js';
import { makeTmpCwd } from '../helpers/tmp.js';

interface CliCapture {
  stdout: string[];
  stderr: string[];
  exitCode: number | null;
}

/**
 * Drive the CLI with fixed argv + cwd and capture every console / process.exit
 * call so we can assert on user-visible output without actually killing the
 * test process. Mirrors the helper in pdfvision's cli.test.ts.
 */
async function captureRun(argv: string[], cwd: string, env?: Record<string, string>): Promise<CliCapture> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let exitCode: number | null = null;

  // Some prior test may have chdir'd into a tmp dir that's since been
  // rmSync'd. Don't try to restore to that — fall back to the project root.
  const fallbackCwd = process.env.INIT_CWD ?? import.meta.dirname.replace(/\/tests\/cli$/, '');
  let origCwd: string;
  try {
    origCwd = process.cwd();
  } catch {
    origCwd = fallbackCwd;
  }
  const origEnv = { ...process.env };
  process.chdir(cwd);
  if (env) {
    for (const [k, v] of Object.entries(env)) process.env[k] = v;
  }

  const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    stdout.push(args.map((a) => String(a)).join(' '));
  });
  const errSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    stderr.push(args.map((a) => String(a)).join(' '));
  });
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    exitCode = code ?? 0;
    throw new Error(`__cli_exit__${code ?? 0}`);
  }) as never);

  try {
    await run(argv);
  } catch (e) {
    if (!(e instanceof Error) || !e.message.startsWith('__cli_exit__')) throw e;
  } finally {
    logSpy.mockRestore();
    errSpy.mockRestore();
    exitSpy.mockRestore();
    try {
      process.chdir(origCwd);
    } catch {
      process.chdir(fallbackCwd);
    }
    process.env = origEnv;
  }

  return { stdout, stderr, exitCode };
}

describe('cli', () => {
  let tmp: ReturnType<typeof makeTmpCwd>;
  // Anchor cwd restoration to the project root so a tmp-dir cleanup never
  // strands process.cwd() at a deleted path.
  const projectRoot = import.meta.dirname.replace(/\/tests\/cli$/, '');

  beforeEach(() => {
    process.chdir(projectRoot);
    tmp = makeTmpCwd();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    process.chdir(projectRoot);
    tmp.cleanup();
  });

  it('prints help when no args are given', async () => {
    const r = await captureRun([], tmp.cwd);
    expect(r.stdout.join('\n')).toContain('Usage:');
    expect(r.exitCode).toBeNull();
  });

  it('prints version with --version', async () => {
    const r = await captureRun(['--version'], tmp.cwd);
    expect(r.stdout.join('\n')).toMatch(/\d+\.\d+\.\d+/);
  });

  it('init creates storage', async () => {
    const r = await captureRun(['init'], tmp.cwd);
    expect(r.exitCode).toBeNull();
    expect(r.stdout.join('\n')).toMatch(/initialized/);
  });

  it('save -> list -> find -> show round-trip', async () => {
    await captureRun(['init'], tmp.cwd);
    let r = await captureRun(
      ['save', 'deps/iconv', '--summary', 'iconv issue', '--agent', 'claude-code', '--body', 'hello body'],
      tmp.cwd,
    );
    expect(r.exitCode).toBeNull();
    expect(r.stdout.join('\n')).toMatch(/saved/);

    r = await captureRun(['list'], tmp.cwd);
    expect(r.stdout.join('\n')).toContain('iconv issue');

    r = await captureRun(['find', 'iconv'], tmp.cwd);
    expect(r.stdout.join('\n')).toContain('deps/iconv.md');

    r = await captureRun(['show', 'deps/iconv'], tmp.cwd);
    expect(r.stdout.join('\n')).toContain('hello body');
  });

  it('save without --summary errors with validation_error and exit 2', async () => {
    await captureRun(['init'], tmp.cwd);
    const r = await captureRun(['save', 'deps/iconv', '--agent', 'a'], tmp.cwd);
    expect(r.exitCode).toBe(2);
    expect(r.stderr.join('\n')).toContain('validation_error');
    expect(r.stderr.join('\n')).toMatch(/summary/);
  });

  it('save with conflict exits 4', async () => {
    await captureRun(['init'], tmp.cwd);
    await captureRun(['save', 'deps/iconv', '--summary', 's', '--agent', 'a'], tmp.cwd);
    const r = await captureRun(['save', 'deps/iconv', '--summary', 's', '--agent', 'a'], tmp.cwd);
    expect(r.exitCode).toBe(4);
    expect(r.stderr.join('\n')).toContain('conflict');
  });

  it('show on missing carnet exits 3', async () => {
    await captureRun(['init'], tmp.cwd);
    const r = await captureRun(['show', 'deps/missing'], tmp.cwd);
    expect(r.exitCode).toBe(3);
    expect(r.stderr.join('\n')).toContain('not_found');
  });

  it('JSON output for save is parseable', async () => {
    await captureRun(['init'], tmp.cwd);
    const r = await captureRun(['--json', 'save', 'deps/iconv', '--summary', 's', '--agent', 'a'], tmp.cwd);
    const obj = JSON.parse(r.stdout.join('\n'));
    expect(obj.ok).toBe(true);
    expect(obj.path).toBe('deps/iconv.md');
    expect(obj.frontmatter.summary).toBe('s');
  });

  it('JSON error output for missing carnet is parseable', async () => {
    await captureRun(['init'], tmp.cwd);
    const r = await captureRun(['--json', 'show', 'deps/missing'], tmp.cwd);
    const obj = JSON.parse(r.stderr.join('\n'));
    expect(obj.ok).toBe(false);
    expect(obj.error.code).toBe('not_found');
  });

  it('JSON output for list', async () => {
    await captureRun(['init'], tmp.cwd);
    await captureRun(['save', 'deps/a', '--summary', 'a', '--agent', 'a'], tmp.cwd);
    const r = await captureRun(['--json', 'list'], tmp.cwd);
    const obj = JSON.parse(r.stdout.join('\n'));
    expect(obj.ok).toBe(true);
    expect(Array.isArray(obj.entries)).toBe(true);
  });

  it('JSON output for find', async () => {
    await captureRun(['init'], tmp.cwd);
    await captureRun(['save', 'deps/a', '--summary', 'iconv', '--agent', 'a'], tmp.cwd);
    const r = await captureRun(['--json', 'find', 'iconv'], tmp.cwd);
    const obj = JSON.parse(r.stdout.join('\n'));
    expect(obj.ok).toBe(true);
    expect(obj.hits[0].path).toBe('deps/a.md');
  });

  it('JSON output for show', async () => {
    await captureRun(['init'], tmp.cwd);
    await captureRun(['save', 'deps/a', '--summary', 's', '--agent', 'a', '--body', 'hi'], tmp.cwd);
    const r = await captureRun(['--json', 'show', 'deps/a'], tmp.cwd);
    const obj = JSON.parse(r.stdout.join('\n'));
    expect(obj.ok).toBe(true);
    expect(obj.body).toContain('hi');
  });

  it('unknown command errors out', async () => {
    const r = await captureRun(['frobnicate'], tmp.cwd);
    expect(r.exitCode).toBe(2);
    expect(r.stderr.join('\n')).toContain('unknown command');
  });

  it('AGENT_CARNET_AUTO_PRUNE=false skips auto-prune', async () => {
    await captureRun(['init'], tmp.cwd);
    // Save an already-expired carnet by backdating updated.
    await captureRun(['save', 'deps/old', '--summary', 's', '--agent', 'a', '--lifespan', '1d'], tmp.cwd);
    // Backdate the file's updated field so it would normally prune.
    const file = join(tmp.cwd, '.carnet/deps/old.md');
    const fs = await import('node:fs/promises');
    let content = await fs.readFile(file, 'utf-8');
    content = content.replace(/updated: [^\n]+/, 'updated: 2020-01-01');
    await fs.writeFile(file, content, 'utf-8');
    // With auto-prune disabled, the file should still be there after a CLI call.
    await captureRun(['list'], tmp.cwd, { AGENT_CARNET_AUTO_PRUNE: 'false' });
    const fs2 = await import('node:fs');
    expect(fs2.existsSync(file)).toBe(true);
  });

  it('auto-prune moves expired carnets on next invocation', async () => {
    await captureRun(['init'], tmp.cwd);
    await captureRun(['save', 'deps/old', '--summary', 's', '--agent', 'a', '--lifespan', '1d'], tmp.cwd);
    const file = join(tmp.cwd, '.carnet/deps/old.md');
    const fs = await import('node:fs/promises');
    let content = await fs.readFile(file, 'utf-8');
    content = content.replace(/updated: [^\n]+/, 'updated: 2020-01-01');
    await fs.writeFile(file, content, 'utf-8');
    await captureRun(['list'], tmp.cwd);
    const fs2 = await import('node:fs');
    expect(fs2.existsSync(file)).toBe(false);
    expect(fs2.existsSync(join(tmp.cwd, '.carnet/.trash/deps/old.md'))).toBe(true);
  });

  it('touch bumps updated and emits the updated date', async () => {
    await captureRun(['init'], tmp.cwd);
    await captureRun(['save', 'deps/x', '--summary', 's', '--agent', 'a', '--body', 'body'], tmp.cwd);
    // Backdate so we can prove the bump happened.
    const file = join(tmp.cwd, '.carnet/deps/x.md');
    const fs = await import('node:fs/promises');
    let content = await fs.readFile(file, 'utf-8');
    content = content.replace(/updated: [^\n]+/, 'updated: 2020-01-01');
    await fs.writeFile(file, content, 'utf-8');

    // Disable auto-prune — the backdate above would otherwise sweep the file
    // before touch ever runs.
    const r = await captureRun(['touch', 'deps/x', '--no-auto-prune'], tmp.cwd);
    expect(r.exitCode).toBeNull();
    expect(r.stdout.join('\n')).toMatch(/touched: deps\/x.md/);

    const after = await fs.readFile(file, 'utf-8');
    expect(after).not.toMatch(/updated: 2020-01-01/);
    // Body must be preserved.
    expect(after).toContain('body');
  });

  it('touch on missing carnet exits 3', async () => {
    await captureRun(['init'], tmp.cwd);
    const r = await captureRun(['touch', 'deps/missing'], tmp.cwd);
    expect(r.exitCode).toBe(3);
    expect(r.stderr.join('\n')).toContain('not_found');
  });

  it('touch JSON output shape', async () => {
    await captureRun(['init'], tmp.cwd);
    await captureRun(['save', 'deps/x', '--summary', 's', '--agent', 'a'], tmp.cwd);
    const r = await captureRun(['--json', 'touch', 'deps/x'], tmp.cwd);
    const obj = JSON.parse(r.stdout.join('\n'));
    expect(obj.ok).toBe(true);
    expect(obj.path).toBe('deps/x.md');
    expect(typeof obj.updated).toBe('string');
  });

  it('move relocates a carnet (full destination)', async () => {
    await captureRun(['init'], tmp.cwd);
    await captureRun(['save', 'deps/x', '--summary', 's', '--agent', 'a'], tmp.cwd);
    const r = await captureRun(['move', 'deps/x', 'archive/x'], tmp.cwd);
    expect(r.exitCode).toBeNull();
    expect(r.stdout.join('\n')).toContain('moved: deps/x.md -> archive/x.md');
    const fs = await import('node:fs');
    expect(fs.existsSync(join(tmp.cwd, '.carnet/deps/x.md'))).toBe(false);
    expect(fs.existsSync(join(tmp.cwd, '.carnet/archive/x.md'))).toBe(true);
  });

  it('move with trailing slash keeps source filename', async () => {
    await captureRun(['init'], tmp.cwd);
    await captureRun(['save', 'deps/x', '--summary', 's', '--agent', 'a'], tmp.cwd);
    const r = await captureRun(['--json', 'move', 'deps/x', 'archive/'], tmp.cwd);
    const obj = JSON.parse(r.stdout.join('\n'));
    expect(obj.ok).toBe(true);
    expect(obj.from).toBe('deps/x.md');
    expect(obj.to).toBe('archive/x.md');
  });

  it('move conflict exits 4 and --update overrides', async () => {
    await captureRun(['init'], tmp.cwd);
    await captureRun(['save', 'deps/x', '--summary', 's', '--agent', 'a'], tmp.cwd);
    await captureRun(['save', 'archive/x', '--summary', 's', '--agent', 'a'], tmp.cwd);
    const conflict = await captureRun(['move', 'deps/x', 'archive/x'], tmp.cwd);
    expect(conflict.exitCode).toBe(4);
    const ok = await captureRun(['move', 'deps/x', 'archive/x', '--update'], tmp.cwd);
    expect(ok.exitCode).toBeNull();
  });

  it('move missing source exits 3', async () => {
    await captureRun(['init'], tmp.cwd);
    const r = await captureRun(['move', 'deps/missing', 'archive/x'], tmp.cwd);
    expect(r.exitCode).toBe(3);
  });

  it('rm --yes moves to .trash/', async () => {
    await captureRun(['init'], tmp.cwd);
    await captureRun(['save', 'deps/x', '--summary', 's', '--agent', 'a'], tmp.cwd);
    const r = await captureRun(['rm', 'deps/x', '--yes'], tmp.cwd);
    expect(r.exitCode).toBeNull();
    expect(r.stdout.join('\n')).toMatch(/removed: deps\/x.md/);
    const fs = await import('node:fs');
    expect(fs.existsSync(join(tmp.cwd, '.carnet/deps/x.md'))).toBe(false);
    expect(fs.existsSync(join(tmp.cwd, '.carnet/.trash/deps/x.md'))).toBe(true);
  });

  it('rm --hard --yes unlinks immediately', async () => {
    await captureRun(['init'], tmp.cwd);
    await captureRun(['save', 'deps/x', '--summary', 's', '--agent', 'a'], tmp.cwd);
    const r = await captureRun(['rm', 'deps/x', '--hard', '--yes'], tmp.cwd);
    expect(r.exitCode).toBeNull();
    expect(r.stdout.join('\n')).toContain('(hard delete)');
    const fs = await import('node:fs');
    expect(fs.existsSync(join(tmp.cwd, '.carnet/deps/x.md'))).toBe(false);
    expect(fs.existsSync(join(tmp.cwd, '.carnet/.trash/deps/x.md'))).toBe(false);
  });

  it('rm without --yes and no TTY falls back to "cancelled"', async () => {
    await captureRun(['init'], tmp.cwd);
    await captureRun(['save', 'deps/x', '--summary', 's', '--agent', 'a'], tmp.cwd);
    // Vitest workers have stdin.isTTY === undefined → confirm() returns false.
    const r = await captureRun(['rm', 'deps/x'], tmp.cwd);
    expect(r.exitCode).toBeNull();
    expect(r.stdout.join('\n')).toContain('cancelled');
    const fs = await import('node:fs');
    expect(fs.existsSync(join(tmp.cwd, '.carnet/deps/x.md'))).toBe(true);
  });

  it('rm JSON output shape', async () => {
    await captureRun(['init'], tmp.cwd);
    await captureRun(['save', 'deps/x', '--summary', 's', '--agent', 'a'], tmp.cwd);
    const r = await captureRun(['--json', 'rm', 'deps/x', '--yes'], tmp.cwd);
    const obj = JSON.parse(r.stdout.join('\n'));
    expect(obj).toEqual({ ok: true, path: 'deps/x.md', trashed: true });
  });

  it('rm missing carnet exits 3', async () => {
    await captureRun(['init'], tmp.cwd);
    const r = await captureRun(['rm', 'deps/missing', '--yes'], tmp.cwd);
    expect(r.exitCode).toBe(3);
  });

  it('prune --interactive --json is rejected', async () => {
    await captureRun(['init'], tmp.cwd);
    const r = await captureRun(['--json', 'prune', '--interactive'], tmp.cwd);
    expect(r.exitCode).toBe(2);
    expect(r.stderr.join('\n')).toMatch(/interactive/);
  });

  it('prune --interactive without TTY treats every prompt as no', async () => {
    await captureRun(['init'], tmp.cwd);
    await captureRun(['save', 'deps/old', '--summary', 's', '--agent', 'a', '--lifespan', '1d'], tmp.cwd);
    const file = join(tmp.cwd, '.carnet/deps/old.md');
    const fs = await import('node:fs/promises');
    let content = await fs.readFile(file, 'utf-8');
    content = content.replace(/updated: [^\n]+/, 'updated: 2020-01-01');
    await fs.writeFile(file, content, 'utf-8');
    const r = await captureRun(['prune', '--interactive', '--no-auto-prune'], tmp.cwd);
    expect(r.exitCode).toBeNull();
    // Default-no in non-TTY mode means nothing is moved.
    const fs2 = await import('node:fs');
    expect(fs2.existsSync(file)).toBe(true);
    expect(r.stdout.join('\n')).toContain('moved to .trash/: 0');
  });

  it('skill path --here prints <cwd>/.claude/skills/agent-carnet/SKILL.md', async () => {
    const r = await captureRun(['skill', 'path', '--here'], tmp.cwd);
    expect(r.exitCode).toBeNull();
    // macOS resolves /var/folders/... -> /private/var/folders/... via process.chdir,
    // so match on suffix instead of exact equality.
    expect(r.stdout.join('\n')).toMatch(/\.claude\/skills\/agent-carnet\/SKILL\.md$/);
  });

  it('skill path --json --here returns the same path in an envelope', async () => {
    const r = await captureRun(['--json', 'skill', 'path', '--here'], tmp.cwd);
    const obj = JSON.parse(r.stdout.join('\n'));
    expect(obj.ok).toBe(true);
    expect(obj.path).toMatch(/\.claude\/skills\/agent-carnet\/SKILL\.md$/);
  });

  it('skill install --here copies the bundled SKILL.md into the project', async () => {
    const r = await captureRun(['skill', 'install', '--here'], tmp.cwd);
    expect(r.exitCode).toBeNull();
    expect(r.stdout.join('\n')).toMatch(/installed at /);
    const target = join(tmp.cwd, '.claude', 'skills', 'agent-carnet', 'SKILL.md');
    const fs = await import('node:fs');
    expect(fs.existsSync(target)).toBe(true);
    const content = fs.readFileSync(target, 'utf-8');
    expect(content).toContain('name: agent-carnet');
  });

  it('skill install --here twice errors with conflict (exit 4)', async () => {
    await captureRun(['skill', 'install', '--here'], tmp.cwd);
    const r = await captureRun(['skill', 'install', '--here'], tmp.cwd);
    expect(r.exitCode).toBe(4);
    expect(r.stderr.join('\n')).toContain('conflict');
  });

  it('skill install --here --force overwrites and reports overwritten=true', async () => {
    await captureRun(['skill', 'install', '--here'], tmp.cwd);
    const r = await captureRun(['--json', 'skill', 'install', '--here', '--force'], tmp.cwd);
    const obj = JSON.parse(r.stdout.join('\n'));
    expect(obj.ok).toBe(true);
    expect(obj.overwritten).toBe(true);
  });

  it('skill uninstall --here removes the file (and is idempotent)', async () => {
    await captureRun(['skill', 'install', '--here'], tmp.cwd);
    const target = join(tmp.cwd, '.claude', 'skills', 'agent-carnet', 'SKILL.md');
    const fs = await import('node:fs');
    expect(fs.existsSync(target)).toBe(true);
    const r = await captureRun(['skill', 'uninstall', '--here'], tmp.cwd);
    expect(r.exitCode).toBeNull();
    expect(r.stdout.join('\n')).toMatch(/uninstalled/);
    expect(fs.existsSync(target)).toBe(false);
    // Idempotent second run.
    const again = await captureRun(['skill', 'uninstall', '--here'], tmp.cwd);
    expect(again.exitCode).toBeNull();
    expect(again.stdout.join('\n')).toMatch(/nothing to uninstall/);
  });

  it('skill with no subcommand errors with validation_error (exit 2)', async () => {
    const r = await captureRun(['skill'], tmp.cwd);
    expect(r.exitCode).toBe(2);
    expect(r.stderr.join('\n')).toContain('validation_error');
  });

  it('skill with unknown subcommand errors with validation_error (exit 2)', async () => {
    const r = await captureRun(['skill', 'frobnicate'], tmp.cwd);
    expect(r.exitCode).toBe(2);
    expect(r.stderr.join('\n')).toContain('validation_error');
  });

  it('--body and stdin together is rejected', async () => {
    await captureRun(['init'], tmp.cwd);
    // readStdin attaches `data` / `end` / `error` listeners on process.stdin;
    // synthesize one chunk + end so the read resolves before the timeout.
    const origIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
    const onImpl = ((event: string, listener: (...a: unknown[]) => void) => {
      if (event === 'data') queueMicrotask(() => listener(Buffer.from('piped body')));
      if (event === 'end') queueMicrotask(() => listener());
      return process.stdin;
    }) as unknown as Parameters<typeof process.stdin.on>[1] extends never ? never : typeof process.stdin.on;
    const onSpy = vi.spyOn(process.stdin, 'on').mockImplementation(onImpl);
    const removeSpy = vi.spyOn(process.stdin, 'removeListener').mockImplementation((() => process.stdin) as never);
    try {
      const r = await captureRun(['save', 'deps/x', '--summary', 's', '--agent', 'a', '--body', 'inline'], tmp.cwd);
      expect(r.exitCode).toBe(2);
      expect(r.stderr.join('\n')).toMatch(/body.*stdin/);
    } finally {
      onSpy.mockRestore();
      removeSpy.mockRestore();
      Object.defineProperty(process.stdin, 'isTTY', { value: origIsTTY, configurable: true });
    }
  });
});
