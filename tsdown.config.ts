import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  deps: {
    // react/react-dom/inkdrop are provided by the Inkdrop host at runtime.
    // mermaid and katex are real dependencies, installed into the plugin's
    // own node_modules; kept external and lazy-imported to protect the
    // bundle budget for the common case of decks without diagrams or math.
    // node:* builtins resolve natively in the Electron renderer (used by
    // katex-assets.ts to read KaTeX's CSS/fonts off disk at runtime).
    // electron is the host's own module (ipcRenderer for the speaker view).
    neverBundle: [
      'react',
      'react-dom',
      'inkdrop',
      'electron',
      'mermaid',
      'katex',
      'node:fs',
      'node:module',
      'node:path'
    ],
    alwaysBundle: ['reveal.js', 'js-yaml', 'event-kit', 'highlight.js']
  },
  sourcemap: true,
  minify: true,
  clean: true,
  outExtensions() {
    return { js: '.js' }
  }
})
