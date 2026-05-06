import type { Carnet } from '../types/index.js';
import { categoryOf } from './paths.js';
import { loadAllCarnets } from './storage.js';

export type SearchScope = 'summary' | 'tags' | 'body' | 'all';

export interface FindOptions {
  in?: SearchScope;
  category?: string;
  limit?: number;
}

export interface FindHit {
  carnet: Carnet;
  /** Where the match was found ("summary", "tags", "body"). */
  matchedIn: string[];
  /** A short snippet from the body if it matched there. */
  snippet?: string;
}

/**
 * Pure-JS search. Case-insensitive substring match — good enough for the
 * notebook-scale corpora agent-carnet targets, no regex foot-guns.
 *
 * Note: a successful hit does NOT bump `updated`. Only `show` does that — the
 * carnet hasn't actually been read yet.
 */
export async function find(cwd: string, keyword: string, options: FindOptions = {}): Promise<FindHit[]> {
  const scope: SearchScope = options.in ?? 'summary';
  const needle = keyword.toLowerCase();
  let carnets = await loadAllCarnets(cwd);

  if (options.category) {
    const cat = options.category.replace(/\/$/, '');
    carnets = carnets.filter((c) => categoryOf(c.relPath) === cat || categoryOf(c.relPath).startsWith(`${cat}/`));
  }

  const hits: FindHit[] = [];
  for (const c of carnets) {
    const matchedIn: string[] = [];
    let snippet: string | undefined;
    const checkSummary = scope === 'summary' || scope === 'all';
    const checkTags = scope === 'tags' || scope === 'all';
    const checkBody = scope === 'body' || scope === 'all';

    if (checkSummary && (c.frontmatter.summary ?? '').toLowerCase().includes(needle)) {
      matchedIn.push('summary');
    }
    if (checkTags && (c.frontmatter.tags ?? []).some((t) => t.toLowerCase().includes(needle))) {
      matchedIn.push('tags');
    }
    if (checkBody) {
      const idx = c.body.toLowerCase().indexOf(needle);
      if (idx !== -1) {
        matchedIn.push('body');
        const start = Math.max(0, idx - 30);
        const end = Math.min(c.body.length, idx + needle.length + 30);
        snippet = c.body.slice(start, end).replace(/\s+/g, ' ').trim();
      }
    }

    if (matchedIn.length > 0) {
      hits.push({ carnet: c, matchedIn, snippet });
    }
  }

  if (options.limit !== undefined) {
    return hits.slice(0, options.limit);
  }
  return hits;
}
