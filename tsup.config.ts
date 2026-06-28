import { defineConfig } from 'tsup';

export default defineConfig([
  {
    clean: true,
    dts: true,
    entry: { index: 'src/index.ts' },
    format: ['cjs', 'esm'],
    treeshake: true,
  },
  {
    bundle: true,
    entry: { 'index.bundle': 'src/index.ts' },
    format: ['cjs', 'esm'],
    noExternal: [/(.*)/],
    treeshake: true,
  },
]);
