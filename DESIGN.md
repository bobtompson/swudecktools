# Design

The logic-first build ships with minimal dark styling. This doc captures the intended
Star Wars look & feel for the dedicated theming pass.

## Reference sites

| Site | What to borrow |
|------|----------------|
| [starwarsnewsnet.com](https://www.starwarsnewsnet.com/) | Fonts and color themes — "very Star Wars" |
| [starwarsunlimited.com](https://starwarsunlimited.com/) | Layout, section borders, header, background art assets |
| [starwars.com](https://starwars.com) | Display fonts and the space background image on the main page |
| [swudb.com/deck/...](https://swudb.com/deck/nFflVPWtxK) | Deck-list reference: leaders/base header, clear card rows, hover card preview |

Reference screenshots live in `design_images/`.

## Current layout (implemented)

- Two-column: **left** = form panel with a Sort / Validate toggle; **right** = output.
- **Sort output:** deck header with leader/base thumbnails + card count + aspect icons,
  then per-set sections; "copy as markdown".
- **Hover** any card row, leader/base thumbnail, or violation card → full card-art preview
  that **follows the cursor** (320px, flips at screen edges), sourced from `swudb.com`'s
  per-card `defaultImagePath` (fallback: `cdn.swu-db.com` by set + padded number).
- **Validate output:** overall trilogy verdict ("Valid for Premier Play"), per-deck
  summaries (leader/base thumbnails, card + sideboard counts, aspect icons, contextual
  "Valid Premier deck — but fails trilogy check with N cards"), then an "N cards are invalid
  across 3 decks" section rendering each violation as a card.
- **Aspect icons:** real hexagonal gem icons in `public/aspects/*.webp` (vendored from the
  MIT-licensed Karabast client). Numeric aspect-id map: 1=Aggression, 2=Command, 3=Cunning,
  4=Vigilance, 5=Heroism, 6=Villainy.
- **Deck color-coding:** Deck 1/2/3 = blue/gold/teal across headers and badges.
- **Supported-sets panel:** collapsible `<details>` under the form (left panel). Lists every
  set in `SET_ORDER`/`SPECIAL_SET_ORDER` with its logo, status chip (Premier / Premier
  <flip-date> / Premier TBA / Rotated / Eternal-Twin Suns), and ⚠ maintenance warnings
  (not in swu-db catalog, release date overridden, missing media-kit assets). Driven by
  `setStatus()` in `lib/legality.ts`; catalog loads lazily on first expand.

## Available theming data

Per-set signature colors + set logos are vendored in `~/github/swu-tools/assets/`
(`set-colors.json`, `set-logos/`) — usable for set-themed accents in the theming pass.

## Theming pass — implemented (2026-06)

- [x] **Typecase:** Barlow Condensed (uppercase, letterspaced) for display, Barlow for body —
      matches starwarsunlimited.com. Self-hosted via `@fontsource/barlow{,-condensed}`,
      4 weights, imported in `index.astro` frontmatter.
- [x] **Palette:** CSS custom properties in `index.astro` (`:root`) — deep-space gradient,
      two golds with distinct jobs (`--gold` #FFE81F for text/hairline accents,
      `--gold-deep` #f2a900 official SWU gold for tab/button fills), tokenized semantic
      colors (deck 1/2/3, format badges, ok/bad/warn — hexes unchanged).
- [x] **Header:** "SWU" in gold + condensed caps title, angled gold rule (`clip-path`)
      echoing starwarsunlimited.com.
- [x] **Header key art:** official header key art (1920×1080, from the SWU media kit CDN)
      behind the title bar, layered under a left-to-right dark gradient so the title sits
      on near-solid space. Two variants picked at random per page load by an inline head
      script (sets `data-hero` on `<html>` before first paint; no-JS default is JTL):
      `public/art/header-jtl.jpg` (Hera/Thrawn/X-wings) and `header-lof.jpg`
      (Yoda/Ahsoka/Dooku, mirrored from the source art so Yoda lands right of the title). Per-variant `--hero-y` crops frame the faces in the thin band —
      JTL `30%` / LOF `25%` desktop, `18%` / `12%` under 900px (the cover slice is taller
      on narrow screens, and a stronger overlay applies there).
- [x] **Space background:** pure CSS starfield — two fixed pseudo-element star layers
      (dense faint + sparse bright with halos) over a radial space gradient. No image
      assets, no licensing concerns. Living (2026-06-11): layers drift slowly in
      opposite directions (oversized `inset: -120px` so edges never show) and the
      bright layer twinkles (7s opacity pulse); the dense layer stays constant so the
      field never blinks as a whole. CSS-only, disabled under reduced motion.
- [x] **Per-set headers:** logo (30px, downscaled to 96px-tall PNGs in `public/sets/`) +
      signature-color left border / tinted underline via inline `--set-color` custom
      property. Mapping in `src/lib/sets.ts`. TS26/unknown sets fall back to a text name
      with the neutral accent. Set colors are accents only, never text (contrast).
- [x] **Responsive:** panels stack under 900px; preview hidden on touch (`hover: none`).
- [x] **Disclaimer footer:** unofficial-fan-site notice (not affiliated with Lucasfilm,
      Disney, FFG, or SW:U) + Lucasfilm/FFG trademark attribution — required cover for
      using official key art/logos. Faint, small, centered, hairline top border.
- [x] Aspect icons (real gem icons) — done.
- [x] Card preview follows cursor, larger — done (now with subtle gold border).
- [x] **Motion pass (2026-06-11):** all gated on `prefers-reduced-motion`.
  - **Hyperspace jump loading state:** three.js starfield (700 line-segment streaks,
    cylindrical shell around the camera) in a full-screen overlay while a deck fetch is
    in flight — `lib/hyperspace.ts` + `HyperspaceOverlay.svelte`. three.js is dynamically
    imported so it code-splits and only loads on first jump. Min 1.1s hold (`holdJump`)
    so fast fetches don't strobe; results are assigned only after the jump resolves so
    the reveal isn't hidden behind the overlay. Silently skipped without WebGL.
  - **Staggered results reveal:** Svelte built-in `fly` transitions (no GSAP needed) —
    set headers slide from the left, rows ripple in (capped per-section), trilogy deck
    summaries and violation cards cascade. `|global` modifier required: elements created
    by the outer `{#if sorted}` toggle don't play default-local transitions.
  - **Holographic card preview:** cursor-velocity tilt (svelte/motion `Spring`, ±12°)
    with a tilt-tracking radial glare (`mix-blend-mode: screen`), 90ms settle-back.
- [x] **Aurebesh toggle (2026-06-11):** header pill toggle swaps the whole site's type
      between Galactic Basic (Barlow) and Aurebesh — like a light/dark toggle, but for
      alphabets. Font: AurebeshAF Canon (AurekFonts, "free for all personal and
      commercial uses") — the angular on-screen movie style; 8KB woff2 self-hosted at
      `public/fonts/` with a provenance/license note. `size-adjust: 82%` on the
      @font-face: Aurebesh has no lowercase (every glyph is cap-height, 700/1000 vs
      Barlow's 506 x-height), so unscaled body text reads ~38% oversized; 82% splits
      the difference between lowercase body and all-caps display text. (Aurebesh Rodian was tried first
      and rejected — it's a rounded handwriting-style variant, not the canon look.) Mechanics: `data-font="aurebesh"` on
      `<html>` re-points the `--font-body`/`--font-display` custom props (all type
      already flows through them); persisted in `localStorage('swu-font')` and restored
      by the inline head script before first paint. The button is always labeled in the
      alphabet it switches TO (teaser going in, readable escape hatch coming back).
      Deck-URL inputs and the legal disclaimer footer stay in Basic on purpose.
- [x] **Focus mode (2026-06-11):** maximize toggle on the results panel (appears once
      content is loaded, stays while expanded) — hides the form panel and gives results
      the full width for card reference. `expand-btn` corner button, feather-style
      maximize/minimize icons, `aria-pressed`. Animated: the grid tracks themselves
      transition (`360px 1fr` → `0px 1fr`, 0.35s) so the results panel grows smoothly
      while the form panel slides/fades out (visibility flips after the slide; padding
      collapses so no sliver remains). Stacked (<900px) layout snaps instead; off under
      reduced motion. Fixing this surfaced a real bug: `body` became a flex column for
      the sticky footer, and `main`'s auto inline margins disabled flex stretch —
      shrink-wrapping all content to ~half width. `main` now sets `width: 100%`.
