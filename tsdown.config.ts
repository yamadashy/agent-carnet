import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'bin/agent-carnet': 'src/bin/agent-carnet.ts',
  },
  outDir: 'dist',
  format: 'esm',
  target: 'node22',
  platform: 'node',
  clean: true,
  dts: true,
  sourcemap: false,
});
