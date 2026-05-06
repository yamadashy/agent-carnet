#!/usr/bin/env node
import { run } from '../cli/cli.js';

run().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error('Fatal Error:', error.message);
  } else {
    console.error('Fatal Error:', error);
  }
  process.exit(1);
});
