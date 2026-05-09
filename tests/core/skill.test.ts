import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CarnetError } from '../../src/core/errors.js';
import {
  installSkill,
  resolveSkillDir,
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
  let sourceDir: string;

  beforeEach(() => {
    tmp = makeTmpCwd();
    // Synthesize a "bundle" directory that mirrors the real ship layout
    // (SKILL.md plus references/*.md) so we can prove install copies the
    // whole tree.
    sourceDir = join(tmp.cwd, '_bundle', 'skills', SKILL_DIR_NAME);
    mkdirSync(join(sourceDir, 'references'), { recursive: true });
    writeFileSync(join(sourceDir, SKILL_FILE_NAME), '---\nname: agent-carnet\n---\n# bundled\n', 'utf-8');
    writeFileSync(join(sourceDir, 'references', 'cookbook.md'), '# cookbook\n', 'utf-8');
    writeFileSync(join(sourceDir, 'references', 'frontmatter.md'), '# frontmatter\n', 'utf-8');
  });
  afterEach(() => tmp.cleanup());

  describe('resolveSkillTarget / resolveSkillDir', () => {
    it('defaults to <home>/.claude/skills/agent-carnet/SKILL.md', () => {
      const p = resolveSkillTarget({ home: tmp.cwd });
      expect(p).toBe(join(tmp.cwd, '.claude', 'skills', SKILL_DIR_NAME, SKILL_FILE_NAME));
    });

    it('uses <cwd>/.claude/skills/... when --here is set', () => {
      const p = resolveSkillTarget({ here: true, cwd: tmp.cwd });
      expect(p).toBe(join(tmp.cwd, '.claude', 'skills', SKILL_DIR_NAME, SKILL_FILE_NAME));
    });

    it('resolveSkillDir returns the parent of SKILL.md', () => {
      const dir = resolveSkillDir({ home: tmp.cwd });
      expect(dir).toBe(join(tmp.cwd, '.claude', 'skills', SKILL_DIR_NAME));
    });
  });

  describe('installSkill', () => {
    it('copies SKILL.md and the references/ subtree', async () => {
      const result = await installSkill({ home: tmp.cwd, source: sourceDir });
      expect(existsSync(result.path)).toBe(true);
      expect(result.overwritten).toBe(false);
      expect(readFileSync(result.path, 'utf-8')).toContain('# bundled');
      // references/ files survive the copy.
      expect(existsSync(join(result.dir, 'references', 'cookbook.md'))).toBe(true);
      expect(existsSync(join(result.dir, 'references', 'frontmatter.md'))).toBe(true);
      expect(readFileSync(join(result.dir, 'references', 'cookbook.md'), 'utf-8')).toContain('# cookbook');
    });

    it('mkdir -p the parent dir', async () => {
      const result = await installSkill({ home: tmp.cwd, source: sourceDir });
      expect(existsSync(join(tmp.cwd, '.claude', 'skills', SKILL_DIR_NAME))).toBe(true);
      expect(result.path).toMatch(/SKILL\.md$/);
    });

    it('refuses to clobber an existing SKILL.md without --force', async () => {
      await installSkill({ home: tmp.cwd, source: sourceDir });
      await expect(installSkill({ home: tmp.cwd, source: sourceDir })).rejects.toBeInstanceOf(CarnetError);
      await expect(installSkill({ home: tmp.cwd, source: sourceDir })).rejects.toMatchObject({ code: 'conflict' });
    });

    it('overwrites with --force', async () => {
      await installSkill({ home: tmp.cwd, source: sourceDir });
      // Replace bundle content so we can prove the copy happened again.
      writeFileSync(join(sourceDir, SKILL_FILE_NAME), '---\nname: agent-carnet\n---\n# replaced\n', 'utf-8');
      writeFileSync(join(sourceDir, 'references', 'cookbook.md'), '# replaced cookbook\n', 'utf-8');
      const result = await installSkill({ home: tmp.cwd, source: sourceDir, force: true });
      expect(result.overwritten).toBe(true);
      expect(readFileSync(result.path, 'utf-8')).toContain('# replaced');
      expect(readFileSync(join(result.dir, 'references', 'cookbook.md'), 'utf-8')).toContain('# replaced cookbook');
    });

    it('--here installs into <cwd>/.claude/skills/...', async () => {
      const result = await installSkill({ here: true, cwd: tmp.cwd, source: sourceDir });
      expect(result.path).toBe(join(tmp.cwd, '.claude', 'skills', SKILL_DIR_NAME, SKILL_FILE_NAME));
      expect(existsSync(result.path)).toBe(true);
      expect(existsSync(join(result.dir, 'references', 'cookbook.md'))).toBe(true);
    });
  });

  describe('uninstallSkill', () => {
    it('removes the entire installed skill dir (SKILL.md + references/)', async () => {
      const installed = await installSkill({ home: tmp.cwd, source: sourceDir });
      const result = await uninstallSkill({ home: tmp.cwd });
      expect(result.removed).toBe(true);
      expect(existsSync(installed.path)).toBe(false);
      expect(existsSync(installed.dir)).toBe(false);
    });

    it('keeps the grandparent skills/ dir when other skills live there', async () => {
      await installSkill({ home: tmp.cwd, source: sourceDir });
      // Drop a sibling skill so the skills/ parent is not empty.
      const skillsDir = join(tmp.cwd, '.claude', 'skills');
      mkdirSync(join(skillsDir, 'some-other-skill'), { recursive: true });
      writeFileSync(join(skillsDir, 'some-other-skill', 'SKILL.md'), 'keep me', 'utf-8');
      await uninstallSkill({ home: tmp.cwd });
      // agent-carnet skill dir gone; sibling preserved.
      expect(existsSync(join(skillsDir, SKILL_DIR_NAME))).toBe(false);
      expect(existsSync(join(skillsDir, 'some-other-skill', 'SKILL.md'))).toBe(true);
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
