import pc from 'picocolors';
import { CarnetError } from '../core/errors.js';
import type { CliErrorShape } from '../types/index.js';

export { exitCodeFor } from '../core/errors.js';

export function toErrorShape(err: unknown): CliErrorShape {
  if (err instanceof CarnetError) {
    return { code: err.code, message: err.message, hint: err.hint };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return { code: 'internal_error', message: msg };
}

export function formatErrorHuman(shape: CliErrorShape, useColor: boolean): string {
  const codeStr = useColor ? pc.red(shape.code) : shape.code;
  const lines = [`error: ${codeStr}`, `  message: ${shape.message}`];
  if (shape.hint) lines.push(`  hint: ${shape.hint}`);
  return lines.join('\n');
}

export function formatErrorJson(shape: CliErrorShape): string {
  return JSON.stringify({ ok: false, error: shape }, null, 2);
}
