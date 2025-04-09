import { type BuildConfig, build } from 'bun';
import { rmPlugin } from './plugin';

const config: BuildConfig = {
  entrypoints: ['src/index.ts'],
  outdir: 'lib',
  splitting: true,
  plugins: [rmPlugin()],
};
await build(config);
