import { existsSync } from 'node:fs';
import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { STORAGE_DIR_NAME, storageRoot } from './paths.js';
import { ensureDir } from './storage.js';

export interface InitOptions {
  gitignore?: boolean;
}

export interface InitResult {
  storageDir: string;
  created: boolean;
  gitignoreUpdated: boolean;
}

export async function init(cwd: string, options: InitOptions = {}): Promise<InitResult> {
  const storage = storageRoot(cwd);
  const created = !existsSync(storage);
  await ensureDir(storage);

  let gitignoreUpdated = false;
  if (options.gitignore) {
    const gi = join(cwd, '.gitignore');
    const entry = `${STORAGE_DIR_NAME}/`;
    let current = '';
    if (existsSync(gi)) {
      current = await readFile(gi, 'utf-8');
    }
    const lines = current.split('\n').map((l) => l.trim());
    if (!lines.includes(entry) && !lines.includes(STORAGE_DIR_NAME)) {
      const prefix = current.length > 0 && !current.endsWith('\n') ? '\n' : '';
      await appendFile(gi, `${prefix}${entry}\n`);
      gitignoreUpdated = true;
    }
  }

  return { storageDir: storage, created, gitignoreUpdated };
}
