import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import matter from 'gray-matter';
import type { CarnetFrontmatter } from '../types/index.js';
import { today } from './dates.js';
import { CarnetError } from './errors.js';
import { storageRoot } from './paths.js';
import { walkMarkdown, writeCarnet } from './storage.js';

export interface ImportOptions {
  dryRun?: boolean;
}

export interface ImportReport {
  imported: string[];
  skipped: string[];
}

/**
 * Migrate from the legacy `agent-memory` skill format. Expects markdown files
 * with `summary` (required) and any of `created`, `updated`, `status`, `tags`,
 * `related` in the frontmatter. The skill's `status` field has no carnet
 * equivalent — preserve the information by lifting it into `tags` instead of
 * silently dropping it.
 */
export async function importFrom(
  cwd: string,
  src: string,
  options: ImportOptions = {},
  now: Date = new Date(),
): Promise<ImportReport> {
  const srcAbs = resolve(cwd, src);
  if (!existsSync(srcAbs)) {
    throw new CarnetError('not_found', `import source not found: ${src}`);
  }

  const dest = storageRoot(cwd);
  const rels = await walkMarkdown(srcAbs);
  const report: ImportReport = { imported: [], skipped: [] };
  const dateStr = today(now);

  for (const rel of rels) {
    const abs = resolve(srcAbs, rel);
    const raw = await readFile(abs, 'utf-8');
    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(raw);
    } catch {
      report.skipped.push(rel);
      continue;
    }
    const old = parsed.data as Record<string, unknown>;
    if (typeof old.summary !== 'string' || old.summary.length === 0) {
      report.skipped.push(rel);
      continue;
    }

    const tags: string[] = Array.isArray(old.tags) ? (old.tags as string[]).slice() : [];
    if (typeof old.status === 'string' && old.status.length > 0) {
      const statusTag = `status:${old.status}`;
      if (!tags.includes(statusTag)) tags.push(statusTag);
    }

    const fm: CarnetFrontmatter = {
      summary: old.summary,
      agent: 'imported',
      created: typeof old.created === 'string' ? old.created : dateStr,
      updated: typeof old.updated === 'string' ? old.updated : dateStr,
      ...(tags.length > 0 ? { tags } : {}),
      ...(Array.isArray(old.related) ? { related: old.related as string[] } : {}),
    };

    const destPath = resolve(dest, rel);
    if (!options.dryRun) {
      await writeCarnet(destPath, fm, parsed.content);
    }
    report.imported.push(rel);
  }

  return report;
}
