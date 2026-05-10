import type { Carnet } from '../types/index.js';
import type { RuntimeConfig } from './config.js';
import { expiryDate, lifespanAnchor, parseLifespan } from './dates.js';
import { categoryOf } from './paths.js';
import { loadAllCarnets } from './storage.js';

export type SortKey = 'updated' | 'created' | 'name' | 'last_used' | 'use_count';

export interface ListOptions {
  category?: string;
  recent?: number;
  tags?: string[];
  expiring?: string;
  sort?: SortKey;
}

export interface ListEntry {
  carnet: Carnet;
  expires: string | null;
}

export async function list(
  cwd: string,
  config: RuntimeConfig,
  options: ListOptions = {},
  now: Date = new Date(),
): Promise<ListEntry[]> {
  let carnets = await loadAllCarnets(cwd);

  if (options.category) {
    const cat = options.category.replace(/\/$/, '');
    carnets = carnets.filter((c) => categoryOf(c.relPath) === cat || categoryOf(c.relPath).startsWith(`${cat}/`));
  }
  if (options.tags && options.tags.length > 0) {
    const required = options.tags;
    carnets = carnets.filter((c) => {
      const tags = c.frontmatter.tags ?? [];
      return required.every((t) => tags.includes(t));
    });
  }
  if (options.expiring) {
    const windowMs = parseLifespan(options.expiring);
    if (windowMs !== 'never') {
      const cutoff = now.getTime() + windowMs;
      carnets = carnets.filter((c) => {
        const exp = expiryDate(
          lifespanAnchor(c.frontmatter.updated, c.frontmatter.last_used),
          c.frontmatter.lifespan,
          c.frontmatter.keep,
          config.defaultLifespan,
        );
        return exp !== null && exp.getTime() <= cutoff;
      });
    }
  }

  const sortKey = options.sort ?? 'last_used';
  carnets.sort((a, b) => {
    if (sortKey === 'name') return a.relPath.localeCompare(b.relPath);
    if (sortKey === 'use_count') {
      const an = typeof a.frontmatter.use_count === 'number' ? a.frontmatter.use_count : 0;
      const bn = typeof b.frontmatter.use_count === 'number' ? b.frontmatter.use_count : 0;
      return bn - an; // most-used first
    }
    // For date-shaped fields, fall back to `updated` when `last_used` is
    // missing — this keeps legacy carnets that pre-date `last_used` from
    // sinking to the bottom of every list.
    const av =
      sortKey === 'last_used'
        ? String(a.frontmatter.last_used ?? a.frontmatter.updated ?? '')
        : String(a.frontmatter[sortKey] ?? '');
    const bv =
      sortKey === 'last_used'
        ? String(b.frontmatter.last_used ?? b.frontmatter.updated ?? '')
        : String(b.frontmatter[sortKey] ?? '');
    return bv.localeCompare(av); // newest first
  });

  if (options.recent !== undefined) {
    carnets = carnets.slice(0, options.recent);
  }

  return carnets.map((c) => ({
    carnet: c,
    expires: (() => {
      try {
        const e = expiryDate(
          lifespanAnchor(c.frontmatter.updated, c.frontmatter.last_used),
          c.frontmatter.lifespan,
          c.frontmatter.keep,
          config.defaultLifespan,
        );
        return e ? e.toISOString().slice(0, 10) : null;
      } catch {
        return null;
      }
    })(),
  }));
}
