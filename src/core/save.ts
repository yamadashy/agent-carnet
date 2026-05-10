import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Carnet, CarnetFrontmatter } from '../types/index.js';
import type { RuntimeConfig } from './config.js';
import { expiryDate, lifespanAnchor, today } from './dates.js';
import { CarnetError } from './errors.js';
import { normalizeCarnetPath, storageRoot } from './paths.js';
import { readCarnet, writeCarnet } from './storage.js';
import { validateFrontmatter } from './validate.js';

/** Frontmatter keys the CLI itself owns. Everything else is preserved on --update. */
const CLI_MANAGED_FIELDS = new Set([
  'summary',
  'agent',
  'created',
  'updated',
  'last_used',
  'use_count',
  'tags',
  'related',
  'lifespan',
  'keep',
]);

export interface SaveInput {
  path: string;
  summary: string;
  agent: string;
  body: string;
  tags?: string[];
  related?: string[];
  lifespan?: string;
  keep?: boolean;
  update?: boolean;
}

export interface SaveResult {
  carnet: Carnet;
  expires: string | null;
  created: boolean;
}

export async function save(
  cwd: string,
  config: RuntimeConfig,
  input: SaveInput,
  now: Date = new Date(),
): Promise<SaveResult> {
  const relPath = normalizeCarnetPath(input.path);
  const absPath = resolve(storageRoot(cwd), relPath);
  const exists = existsSync(absPath);

  if (exists && !input.update) {
    throw new CarnetError('conflict', `carnet already exists: ${relPath}`, 'pass --update to overwrite');
  }

  const dateStr = today(now);
  let createdDate = dateStr;
  // use_count starts at 0 on a fresh carnet. Saving is creation/edit, not "use",
  // so it does not increment the explicit-use counter; only `used` does.
  let useCount = 0;
  const prevExtras: Record<string, unknown> = {};
  if (exists) {
    // On --update, preserve the original creation date, the explicit-use count,
    // and any user-supplied frontmatter keys the CLI doesn't manage itself
    // (e.g. `meta`, custom extension fields). The CLI owns its declared
    // fields; everything else is round-tripped untouched.
    try {
      const prev = await readCarnet(absPath, relPath);
      if (typeof prev.frontmatter.created === 'string') {
        createdDate = prev.frontmatter.created;
      }
      if (typeof prev.frontmatter.use_count === 'number' && Number.isFinite(prev.frontmatter.use_count)) {
        useCount = prev.frontmatter.use_count;
      }
      for (const [k, v] of Object.entries(prev.frontmatter)) {
        if (!CLI_MANAGED_FIELDS.has(k)) prevExtras[k] = v;
      }
    } catch {
      // Fall through with today's date if the prior file is unreadable.
    }
  }

  const fm: Partial<CarnetFrontmatter> = {
    ...prevExtras,
    summary: input.summary,
    agent: input.agent,
    created: createdDate,
    // `updated` tracks content modification — bumped here because save (with or
    // without --update) is a write.
    updated: dateStr,
    // `last_used` tracks usage. Saving fresh content also counts as "use" of
    // that note (the writer is interacting with it), so seed it to today.
    last_used: dateStr,
    use_count: useCount,
    tags: input.tags,
    related: input.related,
    lifespan: input.lifespan,
    keep: input.keep ? true : undefined,
  };
  validateFrontmatter(fm);

  await writeCarnet(absPath, fm, '');
  // Round-trip read so we hand back exactly what's on disk (parsed frontmatter,
  // body, etc.) — useful when we later add migrations.
  const written = await readCarnet(absPath, relPath);
  // Replace body if user supplied content — writeCarnet wrote empty above for
  // a stable header, then we patch in the body to keep the dual-write simple.
  if (input.body !== '') {
    await writeCarnet(absPath, fm, input.body);
    written.body = input.body;
  }

  const exp = expiryDate(lifespanAnchor(dateStr, dateStr), fm.lifespan, fm.keep, config.defaultLifespan);
  return {
    carnet: written,
    expires: exp ? exp.toISOString().slice(0, 10) : null,
    created: !exists,
  };
}
