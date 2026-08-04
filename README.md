# tejaswimsft.github.io

My personal site — a paged, keyboard-navigable single page served from
GitHub Pages at [tejaswimsft.github.io](https://tejaswimsft.github.io/).

## What it is

Four sections (Home, About, Work, Contact) split across ten discrete pages.
Nothing scrolls on desktop: each page is sized to the viewport and the router
moves between them, so content arrives a screen at a time rather than as an
endless column.

## Stack

None, deliberately. Hand-written HTML, CSS and JavaScript with no dependencies,
no build step and no framework. The whole site is under 750 KB including
imagery, and deploys by copying files.

- `index.html` — every view and page
- `styles.css` — design tokens and layout
- `app.js` — hash router, transitions, cursor glow, contact form
- `assets/` — engraving backdrop, favicon, issuer marks

## Design notes

- **Materials.** Surfaces use an Apple-style vibrancy ladder — translucent
  fills over heavy blur with a saturation boost, so colour bleeds through
  rather than flattening to grey. Edges are a three-part specular inset: bright
  top rim, neutral sides, near-dark base.
- **The portrait** is a stipple engraving with its background baked out to real
  transparency at build time, screened over the ink and dissolved on every side
  by an elliptical mask. No blend modes at runtime.
- **Motion** is spring-based and interruptible. Page transitions cascade their
  children on a stagger; the nav pill measures its target rather than assuming
  fixed positions, so it stays exact when labels reflow or the webfont swaps in.

## Accessibility

- Hidden views are `inert` and `aria-hidden`, so they leave the tab order
  entirely rather than lingering behind an opacity of zero.
- Every route is reachable by keyboard; arrow keys page through.
- Text meets WCAG AA against its composited background.
- `prefers-reduced-motion` collapses all animation.
- Any page too tall for its viewport scrolls internally instead of clipping.

## Privacy

The contact form composes a `mailto:` link in the browser — there is no
endpoint and nothing is transmitted anywhere. My address never appears as a
contiguous string in the served source; it is assembled at runtime and the
markup shows a permanent decoy.

## Running locally

Any static file server will do:

```sh
npx http-server -p 8788
```

Then open <http://127.0.0.1:8788>.

## Licence

Code is MIT. The portrait, issuer logos and written content are not — see
[LICENSE](LICENSE).
