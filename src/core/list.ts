import type { Carnet } from '../types/index.js';
import type { RuntimeConfig } from './config.js';
import { expiryDate, parseLifespan } from './dates.js';
import { categoryOf } from './paths.js';
import { loadAllCarnets } from './storage.js';

export type SortKey = 'updated' | 'created' | 'name';

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
          c.frontmatter.updated,
          c.frontmatter.lifespan,
          c.frontmatter.keep,
          config.defaultLifespan,
        );
        return exp !== null && exp.getTime() <= cutoff;
      });
    }
  }

  const sortKey = options.sort ?? 'updated';
  carnets.sort((a, b) => {
    if (sortKey === 'name') return a.relPath.localeCompare(b.relPath);
    const av = String(a.frontmatter[sortKey] ?? '');
    const bv = String(b.frontmatter[sortKey] ?? '');
    return bv.localeCompare(av); // newest first
  });

  if (options.recent !== undefined) {
    carnets = carnets.slice(0, options.recent);
  }

  return carnets.map((c) => ({
    carnet: c,
    expires: (() => {
      try {
        const e = expiryDate(c.frontmatter.updated, c.frontmatter.lifespan, c.frontmatter.keep, config.defaultLifespan);
        return e ? e.toISOString().slice(0, 10) : null;
      } catch {
        return null;
      }
    })(),
  }));
}
