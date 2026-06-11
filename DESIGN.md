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
- [x] **Space background:** pure CSS starfield — two fixed pseudo-element star layers
      (dense faint + sparse bright with halos) over a radial space gradient. No image
      assets, no licensing concerns, no animation.
- [x] **Per-set headers:** logo (30px, downscaled to 96px-tall PNGs in `public/sets/`) +
      signature-color left border / tinted underline via inline `--set-color` custom
      property. Mapping in `src/lib/sets.ts`. TS26/unknown sets fall back to a text name
      with the neutral accent. Set colors are accents only, never text (contrast).
- [x] **Responsive:** panels stack under 900px; preview hidden on touch (`hover: none`).
- [x] Aspect icons (real gem icons) — done.
- [x] Card preview follows cursor, larger — done (now with subtle gold border).
