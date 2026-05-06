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
