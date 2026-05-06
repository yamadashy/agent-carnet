import type { CliErrorShape, ErrorCode } from '../types/index.js';

/**
 * A pre-classified error thrown from `core/` and translated into structured
 * stderr + an exit code at the CLI boundary.
 *
 * core/ never calls `process.exit` or writes to stdout/stderr directly — it
 * throws one of these and lets `cli/` decide how to render it.
 */
export class CarnetError extends Error implements CliErrorShape {
  readonly code: ErrorCode;
  readonly hint?: string;

  constructor(code: ErrorCode, message: string, hint?: string) {
    super(message);
    this.name = 'CarnetError';
    this.code = code;
    this.hint = hint;
  }
}

/**
 * Map an error code to the exit code agents should branch on. Mirrors the
 * table in CLI.md: 0 success, 1 internal, 2 validation/frontmatter, 3 missing,
 * 4 conflict.
 */
export function exitCodeFor(code: ErrorCode): number {
  switch (code) {
    case 'validation_error':
    case 'frontmatter_error':
      return 2;
    case 'not_found':
      return 3;
    case 'conflict':
      return 4;
    default:
      return 1;
  }
}
