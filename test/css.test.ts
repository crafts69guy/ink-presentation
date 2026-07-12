import { describe, expect, it } from 'vitest'
import {
  prepareForShadowRoot,
  scopeRootSelectors,
  stripFontImports,
  stripRemoteUrls
} from '../src/core/css'

describe('scopeRootSelectors', () => {
  it('rewrites :root to :host', () => {
    expect(scopeRootSelectors(':root { --r-main-color: #fff; }')).toBe(
      ':host { --r-main-color: #fff; }'
    )
  })

  it('rewrites every occurrence', () => {
    const css = ':root { --a: 1; }\n:root.dark { --a: 2; }'
    expect(scopeRootSelectors(css)).toBe(':host { --a: 1; }\n:host.dark { --a: 2; }')
  })

  it('does not touch selectors merely containing "root"', () => {
    expect(scopeRootSelectors('.rootless { color: red; }')).toBe('.rootless { color: red; }')
  })
})

describe('stripFontImports', () => {
  it('removes @import statements', () => {
    const css = "@import url('./fonts/league-gothic.css');\n.reveal { color: #fff; }"
    expect(stripFontImports(css)).toBe('\n.reveal { color: #fff; }')
  })

  it('removes @font-face blocks', () => {
    const css = "@font-face { font-family: X; src: url('x.woff'); }\n.a { color: red; }"
    expect(stripFontImports(css)).toBe('\n.a { color: red; }')
  })

  it('keeps unrelated at-rules', () => {
    const css = '@media print { .a { display: none; } }'
    expect(stripFontImports(css)).toBe(css)
  })
})

describe('prepareForShadowRoot', () => {
  it('applies both transforms', () => {
    const css = "@import url('f.css');\n:root { --x: 1; }"
    expect(prepareForShadowRoot(css)).toBe('\n:host { --x: 1; }')
  })
})

describe('stripRemoteUrls', () => {
  it('neutralizes http(s) references, quoted or not', () => {
    expect(stripRemoteUrls('.a { background: url(https://evil.example/x.png); }')).toBe(
      '.a { background: url(); }'
    )
    expect(stripRemoteUrls(".a { background: url('http://x/y'); }")).toBe(
      '.a { background: url(); }'
    )
    expect(stripRemoteUrls('.a { background: URL( //cdn/x.png ); }')).toBe(
      '.a { background: url(); }'
    )
  })

  it('neutralizes local file paths', () => {
    expect(stripRemoteUrls('.a { background: url(/etc/x.png); }')).toBe(
      '.a { background: url(); }'
    )
    expect(stripRemoteUrls('.a { background: url(file:///tmp/x); }')).toBe(
      '.a { background: url(); }'
    )
  })

  it('keeps data: URIs and fragment references', () => {
    const data = '.a { background: url(data:image/png;base64,AAAA); }'
    expect(stripRemoteUrls(data)).toBe(data)
    const quotedData = '.a { background: url("data:image/svg+xml,<svg/>"); }'
    expect(stripRemoteUrls(quotedData)).toBe(quotedData)
    const fragment = '.a { clip-path: url(#clip); }'
    expect(stripRemoteUrls(fragment)).toBe(fragment)
  })

  it('leaves an already-empty url() alone', () => {
    expect(stripRemoteUrls('.a { background: url(); }')).toBe('.a { background: url(); }')
  })
})
