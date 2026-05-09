import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CarnetError } from '../../src/core/errors.js';
import {
  installSkill,
  resolveSkillTarget,
  SKILL_DIR_NAME,
  SKILL_FILE_NAME,
  uninstallSkill,
} from '../../src/core/skill.js';
import { makeTmpCwd } from '../helpers/tmp.js';

/**
 * Tests for the `skill` subcommand core. Every test mocks `home` and `cwd` to
 * a fresh tmp dir so we never touch the real `~/.claude/`.
 */
describe('skill', () => {
  let tmp: ReturnType<typeof makeTmpCwd>;
  let source: string;

  beforeEach(() => {
    tmp = makeTmpCwd();
    // Synthesize a SKILL.md "bundle" inside the tmp dir so we don't depend on
    // the real one shipped with the package.
    const bundleDir = join(tmp.cwd, '_bundle', 'skills', SKILL_DIR_NAME);
    mkdirSync(bundleDir, { recursive: true });
    source = join(bundleDir, SKILL_FILE_NAME);
    writeFileSync(source, '---\nname: agent-carnet\n---\n# bundled\n', 'utf-8');
  });
  afterEach(() => tmp.cleanup());

  describe('resolveSkillTarget', () => {
    it('defaults to <home>/.claude/skills/agent-carnet/SKILL.md', () => {
      const p = resolveSkillTarget({ home: tmp.cwd });
      expect(p).toBe(join(tmp.cwd, '.claude', 'skills', SKILL_DIR_NAME, SKILL_FILE_NAME));
    });

    it('uses <cwd>/.claude/skills/... when --here is set', () => {
      const p = resolveSkillTarget({ here: true, cwd: tmp.cwd });
      expect(p).toBe(join(tmp.cwd, '.claude', 'skills', SKILL_DIR_NAME, SKILL_FILE_NAME));
    });
  });

  describe('installSkill', () => {
    it('creates the target file', async () => {
      const result = await installSkill({ home: tmp.cwd, source });
      expect(existsSync(result.path)).toBe(true);
      expect(result.overwritten).toBe(false);
      expect(readFileSync(result.path, 'utf-8')).toContain('# bundled');
    });

    it('mkdir -p the parent dir', async () => {
      const result = await installSkill({ home: tmp.cwd, source });
      expect(existsSync(join(tmp.cwd, '.claude', 'skills', SKILL_DIR_NAME))).toBe(true);
      expect(result.path).toMatch(/SKILL\.md$/);
    });

    it('refuses to clobber an existing SKILL.md without --force', async () => {
      await installSkill({ home: tmp.cwd, source });
      await expect(installSkill({ home: tmp.cwd, source })).rejects.toBeInstanceOf(CarnetError);
      await expect(installSkill({ home: tmp.cwd, source })).rejects.toMatchObject({ code: 'conflict' });
    });

    it('overwrites with --force', async () => {
      await installSkill({ home: tmp.cwd, source });
      // Replace the source file so we can prove the copy happened again.
      writeFileSync(source, '---\nname: agent-carnet\n---\n# replaced\n', 'utf-8');
      const result = await installSkill({ home: tmp.cwd, source, force: true });
      expect(result.overwritten).toBe(true);
      expect(readFileSync(result.path, 'utf-8')).toContain('# replaced');
    });

    it('--here installs into <cwd>/.claude/skills/...', async () => {
      const result = await installSkill({ here: true, cwd: tmp.cwd, source });
      expect(result.path).toBe(join(tmp.cwd, '.claude', 'skills', SKILL_DIR_NAME, SKILL_FILE_NAME));
      expect(existsSync(result.path)).toBe(true);
    });
  });

  describe('uninstallSkill', () => {
    it('removes an installed SKILL.md', async () => {
      const installed = await installSkill({ home: tmp.cwd, source });
      const result = await uninstallSkill({ home: tmp.cwd });
      expect(result.removed).toBe(true);
      expect(existsSync(installed.path)).toBe(false);
    });

    it('removes the empty parent agent-carnet/ dir', async () => {
      await installSkill({ home: tmp.cwd, source });
      await uninstallSkill({ home: tmp.cwd });
      expect(existsSync(join(tmp.cwd, '.claude', 'skills', SKILL_DIR_NAME))).toBe(false);
    });

    it('keeps the parent dir when other files live there', async () => {
      await installSkill({ home: tmp.cwd, source });
      // Drop a sibling file so the parent is no longer empty.
      writeFileSync(join(tmp.cwd, '.claude', 'skills', SKILL_DIR_NAME, 'NOTES.md'), 'keep me', 'utf-8');
      await uninstallSkill({ home: tmp.cwd });
      expect(existsSync(join(tmp.cwd, '.claude', 'skills', SKILL_DIR_NAME))).toBe(true);
    });

    it('is idempotent when nothing is installed', async () => {
      const result = await uninstallSkill({ home: tmp.cwd });
      expect(result.removed).toBe(false);
      // And calling it again is still fine.
      const again = await uninstallSkill({ home: tmp.cwd });
      expect(again.removed).toBe(false);
    });
  });
});
