const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * Minimal VS Code‑style problem‑matcher so `npm run watch` streams clean errors.
 * Prints a line before/after each rebuild and surfaces diagnostics in VS Code’s
 * Problems panel when run via the built‑in tasks runner.
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',
  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd(result => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        if (location) {
          console.error(`    ${location.file}:${location.line}:${location.column}`);
        }
      });
      console.log('[watch] build finished');
    });
  }
};

/**
 * Shared esbuild options between the extension host and the language‑server.
 * Certain fields (entryPoints/outfile) are filled per‑build.
 *
 * NOTE: Both bundles target Node 18 (Electron 28) and use CommonJS so we can
 * simply `require()` them from VS Code.
 * @type {import('esbuild').BuildOptions}
 */
const baseOptions = {
  bundle: true,
  format: 'cjs',
  minify: production,
  sourcemap: !production,
  sourcesContent: false,
  platform: 'node',
  external: ['vscode'],
  logLevel: 'silent',
  plugins: [esbuildProblemMatcherPlugin]
};

/** The two entrypoints we need to build → their desired output files */
const entries = [
  { in: 'extension.ts', out: 'extension.js' },
  { in: 'server.ts',    out: 'server.js' }
];

async function buildAll() {
  // In watch‑mode we create an independent context per entry so esbuild can
  // incremental‑rebuild each bundle in parallel.
  if (watch) {
    await Promise.all(entries.map(async ({ in: input, out: output }) => {
      const ctx = await esbuild.context({
        ...baseOptions,
        entryPoints: [`src/${input}`],
        outfile: `dist/${output}`
      });
      return ctx.watch();
    }));
  } else {
    // One‑shot build → simple build() calls.
    await Promise.all(entries.map(({ in: input, out: output }) =>
      esbuild.build({
        ...baseOptions,
        entryPoints: [`src/${input}`],
        outfile: `dist/${output}`
      })
    ));
  }
}

buildAll().catch(err => {
  console.error(err);
  process.exit(1);
});
