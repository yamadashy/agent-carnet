import pc from 'picocolors';
import type { FindHit } from '../core/find.js';
import type { ListEntry } from '../core/list.js';
import { categoryOf, slugOf } from '../core/paths.js';
import type { Carnet } from '../types/index.js';

/** Group `ListEntry`s by category, preserving sort order within each group. */
function groupByCategory(entries: ListEntry[]): Map<string, ListEntry[]> {
  const groups = new Map<string, ListEntry[]>();
  for (const e of entries) {
    const cat = categoryOf(e.carnet.relPath) || '(root)';
    const arr = groups.get(cat) ?? [];
    arr.push(e);
    groups.set(cat, arr);
  }
  return groups;
}

export function formatListHuman(entries: ListEntry[], useColor: boolean): string {
  if (entries.length === 0) return 'no carnets found';
  const groups = groupByCategory(entries);
  const out: string[] = [];
  const cats = Array.from(groups.keys()).sort();
  for (const cat of cats) {
    out.push(useColor ? pc.bold(`${cat}/`) : `${cat}/`);
    const items = groups.get(cat) ?? [];
    const widest = items.reduce((m, i) => Math.max(m, slugOf(i.carnet.relPath).length), 0);
    for (const item of items) {
      const slug = slugOf(item.carnet.relPath).padEnd(widest);
      const summary = item.carnet.frontmatter.summary ?? '';
      const updated = item.carnet.frontmatter.updated ?? '';
      const tail = useColor ? pc.dim(`(updated: ${updated})`) : `(updated: ${updated})`;
      out.push(`  ${slug}  ${summary}  ${tail}`);
    }
  }
  return out.join('\n');
}

export function formatListJson(entries: ListEntry[]): string {
  return JSON.stringify(
    {
      ok: true,
      entries: entries.map((e) => ({
        path: e.carnet.relPath,
        category: categoryOf(e.carnet.relPath),
        slug: slugOf(e.carnet.relPath),
        frontmatter: e.carnet.frontmatter,
        expires: e.expires,
      })),
    },
    null,
    2,
  );
}

export function formatFindHuman(hits: FindHit[], useColor: boolean): string {
  if (hits.length === 0) return 'no matches';
  const out: string[] = [];
  for (const h of hits) {
    const path = useColor ? pc.cyan(h.carnet.relPath) : h.carnet.relPath;
    const summary = h.carnet.frontmatter.summary ?? '';
    out.push(`${path}  ${summary}  [${h.matchedIn.join(',')}]`);
    if (h.snippet) out.push(`  ${h.snippet}`);
  }
  return out.join('\n');
}

export function formatFindJson(hits: FindHit[]): string {
  return JSON.stringify(
    {
      ok: true,
      hits: hits.map((h) => ({
        path: h.carnet.relPath,
        summary: h.carnet.frontmatter.summary,
        matched_in: h.matchedIn,
        snippet: h.snippet,
      })),
    },
    null,
    2,
  );
}

export function formatShowHuman(carnet: Carnet, withFrontmatter: boolean): string {
  if (!withFrontmatter) return carnet.body;
  const fm = carnet.frontmatter;
  const lines: string[] = [
    `path: ${carnet.relPath}`,
    `summary: ${fm.summary ?? ''}`,
    `agent: ${fm.agent ?? ''}`,
    `created: ${fm.created ?? ''}`,
    `updated: ${fm.updated ?? ''}`,
  ];
  if (fm.tags && fm.tags.length > 0) lines.push(`tags: ${fm.tags.join(', ')}`);
  if (fm.related && fm.related.length > 0) lines.push(`related: ${fm.related.join(', ')}`);
  if (fm.lifespan) lines.push(`lifespan: ${fm.lifespan}`);
  if (fm.keep) lines.push('keep: true');
  lines.push('---');
  lines.push(carnet.body);
  return lines.join('\n');
}

export function formatShowJson(carnet: Carnet): string {
  return JSON.stringify(
    {
      ok: true,
      path: carnet.relPath,
      frontmatter: carnet.frontmatter,
      body: carnet.body,
    },
    null,
    2,
  );
}

export function formatSaveHuman(
  relPath: string,
  fm: Carnet['frontmatter'],
  expires: string | null,
  useColor: boolean,
): string {
  const tick = useColor ? pc.green('saved') : 'saved';
  const lines = [
    `${tick}: ${relPath}`,
    `  summary: ${fm.summary}`,
    `  category: ${categoryOf(relPath)}`,
    `  agent: ${fm.agent}`,
    `  expires: ${expires ?? 'never'}`,
  ];
  return lines.join('\n');
}

export function formatSaveJson(
  relPath: string,
  absPath: string,
  fm: Carnet['frontmatter'],
  expires: string | null,
): string {
  return JSON.stringify({ ok: true, path: relPath, absolute: absPath, frontmatter: fm, expires }, null, 2);
}
