/**
 * Last line of defense between note-authored markup and the live DOM.
 *
 * RevealMarkdown's bundled marked converts note markdown with raw HTML
 * passthrough, and the renderer runs with nodeIntegration — so a synced or
 * shared note is an XSS-with-Node-privileges vector unless every slide is
 * sanitized after conversion. This pass runs once per deck build, after
 * RevealMarkdown has converted the slides and BEFORE the mermaid pass:
 * mermaid's own SVG output is already DOMPurify-sanitized internally
 * (securityLevel: 'strict') and must not be re-run through an HTML profile.
 */
import DOMPurify, { type Config } from 'dompurify'
import { MATH_DISPLAY_ATTR, MATH_TEX_ATTR } from '../core/math'

/**
 * DOMPurify defaults already do the heavy lifting: no <script>/<iframe>,
 * `on*` handlers dropped, `javascript:` URLs blocked, `data-*` attributes
 * kept (which is what carries the KaTeX placeholders and Reveal's own slide
 * metadata through unharmed).
 */
export const SANITIZE_CONFIG: Config = {
  // Note-authored styling has its own hardened channel (the `css`
  // frontmatter key); inline <style> would bypass it.
  FORBID_TAGS: ['style'],
  // Reveal turns this into a fullscreen embedded page — an arbitrary-site
  // load a note comment (`<!-- .slide: ... -->`) could trigger silently.
  FORBID_ATTR: ['data-background-iframe']
}

/** Attributes RevealMarkdown may have copied onto the <section> elements
 * themselves from `<!-- .slide: ... -->` comments in the note. */
const FORBIDDEN_SECTION_ATTRS = ['data-background-iframe']

function sanitizeSectionAttributes(section: Element): void {
  for (const attr of Array.from(section.attributes)) {
    if (/^on/i.test(attr.name) || FORBIDDEN_SECTION_ATTRS.includes(attr.name)) {
      section.removeAttribute(attr.name)
    }
  }
}

/**
 * Sanitize every converted slide in place. Top-level sections get their own
 * attributes cleaned by hand (DOMPurify only sees their innerHTML); nested
 * vertical-stack sections are covered by the parent's innerHTML pass.
 */
export function sanitizeSlideContent(root: ParentNode): void {
  for (const section of Array.from(root.querySelectorAll('.slides > section'))) {
    sanitizeSectionAttributes(section)
    section.innerHTML = DOMPurify.sanitize(section.innerHTML, SANITIZE_CONFIG)
  }
}

// Referenced so a future config change cannot silently drop the math
// placeholders: data-* survives via DOMPurify's ALLOW_DATA_ATTR default,
// and the DOM test suite asserts these exact attributes make it through.
export const MATH_PLACEHOLDER_ATTRS = [MATH_TEX_ATTR, MATH_DISPLAY_ATTR] as const
