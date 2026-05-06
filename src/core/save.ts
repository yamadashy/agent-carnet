import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Carnet, CarnetFrontmatter } from '../types/index.js';
import type { RuntimeConfig } from './config.js';
import { expiryDate, today } from './dates.js';
import { CarnetError } from './errors.js';
import { normalizeCarnetPath, storageRoot } from './paths.js';
import { readCarnet, writeCarnet } from './storage.js';
import { validateFrontmatter } from './validate.js';

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
  if (exists) {
    // Preserve the original creation date when updating; only `updated` rolls
    // forward.
    try {
      const prev = await readCarnet(absPath, relPath);
      if (typeof prev.frontmatter.created === 'string') {
        createdDate = prev.frontmatter.created;
      }
    } catch {
      // Fall through with today's date if the prior file is unreadable.
    }
  }

  const fm: Partial<CarnetFrontmatter> = {
    summary: input.summary,
    agent: input.agent,
    created: createdDate,
    updated: dateStr,
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

  const exp = expiryDate(dateStr, fm.lifespan, fm.keep, config.defaultLifespan);
  return {
    carnet: written,
    expires: exp ? exp.toISOString().slice(0, 10) : null,
    created: !exists,
  };
}
