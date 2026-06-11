# TODO

Status: logic-first build is complete and working locally (`docker compose watch` → http://localhost:4321).
Sort + Trilogy validator both functional, with Premier / Eternal / Twin Suns format support.

## Big items

- [x] **Theming pass** — done (2026-06). Barlow type, CSS starfield, gold accents, per-set
      logo/color section headers. Details in `DESIGN.md`.
- [ ] **Deploy to Cloudflare Pages.**
  - [ ] `git add` + initial commit (repo has no commits yet).
  - [ ] Create a remote and push.
  - [ ] Connect repo in Cloudflare Pages (build `npm run build`, output `dist`, root `website`),
        or `npx wrangler pages deploy dist`. No env vars/secrets needed.

## Upcoming sets (Q4 2026)

- [ ] **IC27 (Icons 2027 Edition)** — added as Premier-pending (IBH-like supplemental).
      When the release date is announced, add it to `RELEASE_DATE_OVERRIDES` in
      `lib/legality.ts` (+ `swu-tools/lib/swudb.py`) so legality flips at release − 7 days
      even if the swu-db catalog lags. Add logo/color to `lib/sets.ts` + `public/sets/`
      when the media kit ships them.
- [ ] **Homeworlds** (main set after ASH) — set code not announced yet. When known: add to
      `SET_ORDER`, `PREMIER_PENDING_SETS`, `lib/sets.ts`, and Python `MAIN_SETS`.

## Features / correctness

- [ ] **Set-code validity check** — flag any card whose set code isn't in the official `/sets`
      catalog as invalid in all formats (judges require valid set codes). Today an unknown code
      silently falls through to Eternal. The local card DB (`public/data/`, `lib/carddata.ts`)
      now makes the stronger (SET, NUMBER) existence check possible too.
- [ ] TS26 pre-con origin labels (needs `ts26_decks.json` from the Python tool).
- [ ] Non-URL deck sources (JSON / picklist / markdown) that the CLI supports — web app is
      URL-only for now.
- [ ] Premier reprint-by-name nuance is moot per design (reprints carry the new set code) — no
      action, noted so it's not re-investigated.

## Polish

- [ ] **Add a Star Wars themed background image to the title bar** (site header). Check
      licensing before borrowing art — the official media kit (see `DESIGN.md` assets notes)
      is the safest source.
- [x] **Responsive layout** — done with the theming pass (stacks under 900px; card preview
      hidden on touch devices).
- [ ] Fix the a11y warnings (divs/imgs with mouse handlers need an ARIA `role`) — see dev server
      log lines for `DeckTools.svelte`.
- [ ] Card preview polish (fade-in; maybe larger).
- [ ] Optional: per-card aspect icons show every pip; offer a "unique aspects only" view.

## Testing / infra

- [ ] Replace the ad-hoc tsx test scripts (`website/test/*.ts`) with a real runner (vitest) so
      parity + format rules run as `npm test`.
- [ ] `npm audit` triage — fresh Astro install reported a few advisories.
