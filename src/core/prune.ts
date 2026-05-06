import { join } from 'node:path';
import type { PruneReport } from '../types/index.js';
import type { RuntimeConfig } from './config.js';
import { expiryDate, parseLifespan } from './dates.js';
import { trashRoot } from './paths.js';
import { fileMtime, hardDelete, loadAllCarnets, moveToTrash, walkMarkdown } from './storage.js';

export interface PruneOptions {
  dryRun?: boolean;
  includeTrash?: boolean;
}

/**
 * Identify expired live carnets and (unless `dryRun`) move them to `.trash/`.
 * Optionally also hard-delete trash entries older than `trashTtl`.
 */
export async function prune(
  cwd: string,
  config: RuntimeConfig,
  options: PruneOptions = {},
  now: Date = new Date(),
): Promise<PruneReport> {
  const report: PruneReport = { movedToTrash: [], hardDeleted: [] };

  const carnets = await loadAllCarnets(cwd);
  for (const c of carnets) {
    const fm = c.frontmatter;
    if (fm.keep) continue;
    if (!fm.updated) continue;
    let exp: Date | null;
    try {
      exp = expiryDate(fm.updated, fm.lifespan, fm.keep, config.defaultLifespan);
    } catch {
      // Invalid lifespan in a carnet shouldn't crash auto-prune. Skip silently.
      continue;
    }
    if (exp === null) continue;
    if (exp.getTime() <= now.getTime()) {
      if (!options.dryRun) {
        await moveToTrash(cwd, c.relPath);
      }
      report.movedToTrash.push(c.relPath);
    }
  }

  if (options.includeTrash) {
    const ttlMs = parseLifespan(config.trashTtl);
    if (ttlMs !== 'never') {
      const trashDir = trashRoot(cwd);
      const trashRels = await walkMarkdown(trashDir);
      for (const rel of trashRels) {
        const abs = join(trashDir, rel);
        const mtime = await fileMtime(abs);
        if (now.getTime() - mtime.getTime() >= ttlMs) {
          if (!options.dryRun) {
            await hardDelete(abs);
          }
          report.hardDeleted.push(rel);
        }
      }
    }
  }

  return report;
}
