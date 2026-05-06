/**
 * Read all of stdin (utf-8). Returns an empty string if stdin is a TTY (no
 * input piped in) so callers can distinguish "no body provided" from "empty
 * body intentionally piped in".
 */
export async function readStdin(): Promise<string | null> {
  // TTY = no piped input. In test runners isTTY can be undefined; check for
  // the explicit `true` so we don't block forever on a non-piped stdin.
  if (process.stdin.isTTY !== false) return null;
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString('utf-8');
}
