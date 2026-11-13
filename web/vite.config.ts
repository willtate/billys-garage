import { defineConfig } from 'vite';

// Every build gets an id. It's baked into the app and also written to /version.json, so a
// running copy can tell when a newer one has been deployed and reload itself.
const buildId = new Date().toISOString();

export default defineConfig({
  // Older iPads (an iPad mini 4 tops out at iOS 15) can't parse newer syntax like class static blocks.
  build: { target: ['es2020', 'safari15'] },
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [{
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: buildId }) });
    },
  }],
});
