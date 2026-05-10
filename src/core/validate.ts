import type { CarnetFrontmatter } from '../types/index.js';
import { parseLifespan } from './dates.js';
import { CarnetError } from './errors.js';

/** Check that a fully-built frontmatter passes the agent-carnet schema. */
export function validateFrontmatter(fm: Partial<CarnetFrontmatter>): asserts fm is CarnetFrontmatter {
  if (!fm.summary || typeof fm.summary !== 'string') {
    throw new CarnetError('validation_error', '--summary is required', 'pass --summary "<text>"');
  }
  if (!fm.agent || typeof fm.agent !== 'string') {
    throw new CarnetError(
      'validation_error',
      '--agent is required',
      'pass --agent <name> (claude-code, codex, cursor, human, ...)',
    );
  }
  if (fm.tags !== undefined && !Array.isArray(fm.tags)) {
    throw new CarnetError('validation_error', 'tags must be a list of strings');
  }
  if (fm.related !== undefined && !Array.isArray(fm.related)) {
    throw new CarnetError('validation_error', 'related must be a list of strings');
  }
  if (fm.lifespan !== undefined) {
    parseLifespan(fm.lifespan);
  }
  if (fm.keep !== undefined && typeof fm.keep !== 'boolean') {
    throw new CarnetError('validation_error', 'keep must be a boolean');
  }
  if (fm.last_used !== undefined && typeof fm.last_used !== 'string') {
    throw new CarnetError('validation_error', 'last_used must be a YYYY-MM-DD string');
  }
  if (
    fm.use_count !== undefined &&
    (typeof fm.use_count !== 'number' || !Number.isInteger(fm.use_count) || fm.use_count < 0)
  ) {
    throw new CarnetError('validation_error', 'use_count must be a non-negative integer');
  }
}

/** Parse a `--tags a,b,c` style flag into a deduped array. */
export function parseCsv(input: string | undefined): string[] | undefined {
  if (input === undefined) return undefined;
  const items = input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return items.length > 0 ? Array.from(new Set(items)) : undefined;
}
