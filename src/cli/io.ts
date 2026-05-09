import { createInterface } from 'node:readline';

/** Y/N/Q answers from `confirm3`. Defaults match `[y/N/q]` semantics. */
export type Confirm3Answer = 'yes' | 'no' | 'quit';

/**
 * Yes/no prompt. Returns `false` for an empty answer or anything not starting
 * with `y` (case-insensitive). Falls back to `false` when stdin isn't a TTY
 * (CI without `--yes` should never silently delete things).
 */
export async function confirm(prompt: string): Promise<boolean> {
  if (process.stdin.isTTY !== true) return false;
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer: string = await new Promise((resolve) => {
      rl.question(prompt, (a) => resolve(a));
    });
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

/**
 * Three-way prompt for `prune --interactive`: yes / no / quit. Empty answer =
 * `no` (so a confused operator doesn't accidentally delete). Anything starting
 * with `q` quits; anything starting with `y` accepts.
 */
export async function confirm3(prompt: string): Promise<Confirm3Answer> {
  if (process.stdin.isTTY !== true) return 'no';
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer: string = await new Promise((resolve) => {
      rl.question(prompt, (a) => resolve(a));
    });
    const trimmed = answer.trim().toLowerCase();
    if (trimmed.startsWith('q')) return 'quit';
    if (trimmed.startsWith('y')) return 'yes';
    return 'no';
  } finally {
    rl.close();
  }
}

/**
 * Read all of stdin (utf-8). Returns null when nothing was piped in so
 * callers can distinguish "no body provided" from "empty body intentionally
 * piped in".
 *
 * Detection is tricky:
 * - Interactive TTY: `isTTY === true` — skip cleanly.
 * - Real pipe (`echo x | agent-carnet save`): `isTTY === undefined`, data
 *   arrives within the same tick.
 * - Vitest workers: `isTTY === undefined`, stdin is open but never receives
 *   data and never EOFs — a naive `for await` hangs forever.
 *
 * We race the read against a tiny timeout: real piped input always arrives
 * essentially instantly, so 50 ms is plenty. The startup cost is paid only
 * when no data was actually piped (and is dwarfed by Node's own startup).
 */
export async function readStdin(): Promise<string | null> {
  if (process.stdin.isTTY === true) return null;
  const READ_DEADLINE_MS = 50;
  return await new Promise<string | null>((resolve) => {
    const chunks: Buffer[] = [];
    let received = false;
    const onData = (chunk: Buffer | string): void => {
      received = true;
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    };
    const onEnd = (): void => {
      cleanup();
      resolve(received ? Buffer.concat(chunks).toString('utf-8') : null);
    };
    const onError = (): void => {
      cleanup();
      resolve(null);
    };
    const timer = setTimeout(() => {
      if (!received) {
        cleanup();
        resolve(null);
      }
    }, READ_DEADLINE_MS);
    function cleanup(): void {
      clearTimeout(timer);
      process.stdin.removeListener('data', onData);
      process.stdin.removeListener('end', onEnd);
      process.stdin.removeListener('error', onError);
    }
    process.stdin.on('data', onData);
    process.stdin.on('end', onEnd);
    process.stdin.on('error', onError);
  });
}
