import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  // react/react-dom/inkdrop are provided by the Inkdrop host at runtime.
  external: ['react', 'react-dom', 'inkdrop'],
  noExternal: ['reveal.js', 'js-yaml', 'event-kit', 'highlight.js'],
  sourcemap: true,
  minify: true,
  clean: true,
  outExtensions() {
    return { js: '.js' }
  }
})
