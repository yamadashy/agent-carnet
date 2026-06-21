import { join } from 'node:path';
import type { Carnet, PruneReport } from '../types/index.js';
import type { RuntimeConfig } from './config.js';
import { daysUntil, expiryDate, lifespanAnchor, parseLifespan } from './dates.js';
import { trashRoot } from './paths.js';
import { hardDelete, loadAllCarnets, moveToTrash, trashEntryTime, walkMarkdown } from './storage.js';

/** What an interactive prompter is told about each expired carnet. */
export interface PruneCandidate {
  carnet: Carnet;
  /** Days the carnet has been expired (positive integer). */
  expiredDays: number;
}

/** A user-visible answer for the per-candidate prompt. */
export type PruneDecision = 'yes' | 'no' | 'quit';

export interface PruneOptions {
  dryRun?: boolean;
  includeTrash?: boolean;
  /**
   * Per-candidate decision callback. Returning `quit` aborts the loop early
   * (everything already accepted in this pass is kept). The CLI layer plugs
   * in its `confirm` helper here; core stays I/O-free.
   */
  onCandidate?: (candidate: PruneCandidate) => Promise<PruneDecision> | PruneDecision;
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
    if (!fm.updated && !fm.last_used) continue;
    let exp: Date | null;
    try {
      exp = expiryDate(lifespanAnchor(fm.updated, fm.last_used), fm.lifespan, fm.keep, config.defaultLifespan);
    } catch {
      // Invalid lifespan in a carnet shouldn't crash auto-prune. Skip silently.
      continue;
    }
    if (exp === null) continue;
    if (exp.getTime() <= now.getTime()) {
      if (options.onCandidate) {
        const expiredDays = Math.max(0, -daysUntil(exp, now));
        const decision = await options.onCandidate({ carnet: c, expiredDays });
        if (decision === 'quit') break;
        if (decision === 'no') continue;
      }
      if (!options.dryRun) {
        await moveToTrash(cwd, c.relPath, now);
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
        const entryTime = await trashEntryTime(abs, rel);
        if (now.getTime() - entryTime.getTime() >= ttlMs) {
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
