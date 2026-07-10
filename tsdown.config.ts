import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  deps: {
    // react/react-dom/inkdrop are provided by the Inkdrop host at runtime.
    // mermaid is a real dependency, installed into the plugin's own
    // node_modules; kept external and lazy-imported to protect the bundle
    // budget for the common case of decks with no mermaid fences.
    neverBundle: ['react', 'react-dom', 'inkdrop', 'mermaid'],
    alwaysBundle: ['reveal.js', 'js-yaml', 'event-kit', 'highlight.js']
  },
  sourcemap: true,
  minify: true,
  clean: true,
  outExtensions() {
    return { js: '.js' }
  }
})
