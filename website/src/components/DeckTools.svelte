<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { Spring } from 'svelte/motion';
  import HyperspaceOverlay from './HyperspaceOverlay.svelte';
  import { parseDeckUrl, normalizeDeck } from '../lib/normalize';
  import { fetchDeck, fetchSets, DeckFetchError } from '../lib/swudb';
  import { sortDeck, toMarkdown, type SortedDeck } from '../lib/sort';
  import { validateDeck, validateTrilogy, type CardRef, type DeckValidation, type TrilogyValidation } from '../lib/validate';
  import { cardImage, cardImageUrl, swudbImageUrl } from '../lib/cards';
  import { setMeta, type SetMeta } from '../lib/sets';
  import { SET_ORDER, SUB_SET_ORDER, setStatus, type SetStatus } from '../lib/legality';
  import { fetchLocalIndex, buildPremierReprintNames, type LocalDataIndex } from '../lib/carddata';
  import type { NormalizedDeck, RawCard } from '../lib/types';

  // Image for a violation ref (carries the payload image path when known).
  function refImg(v: CardRef): string {
    return swudbImageUrl(v.imagePath) ?? cardImageUrl(v.set, v.number);
  }

  function mainCount(d: NormalizedDeck): number {
    return d.mainboard.reduce((n, c) => n + c.quantity, 0);
  }
  function sbCount(d: NormalizedDeck): number {
    return d.sideboard.reduce((n, c) => n + c.quantity, 0);
  }

  // Numeric aspect id -> name (verified against the SWUDB/swu-db data).
  const ASPECTS: Record<number, { name: string; cls: string }> = {
    1: { name: 'Aggression', cls: 'aggression' },
    2: { name: 'Command', cls: 'command' },
    3: { name: 'Cunning', cls: 'cunning' },
    4: { name: 'Vigilance', cls: 'vigilance' },
    5: { name: 'Heroism', cls: 'heroism' },
    6: { name: 'Villainy', cls: 'villainy' },
  };

  // A deck's aspect identity = the aspects on its leaders + base (id order).
  // Works for both NormalizedDeck and SortedDeck (both expose leaders + base).
  function deckAspects(d: { leaders: RawCard[]; base: RawCard | null }): number[] {
    const ids = new Set<number>();
    for (const l of d.leaders) for (const a of l.aspects ?? []) ids.add(a);
    for (const a of d.base?.aspects ?? []) ids.add(a);
    return [...ids].sort((a, b) => a - b);
  }

  // Human label for a deck format.
  function playName(f: string): string {
    return f === 'twinSuns' ? 'Twin Suns' : f === 'eternal' ? 'Eternal' : 'Premier';
  }

  // How many trilogy-violation cards involve a given deck (0-based index).
  function deckTrilogyCount(t: TrilogyValidation, deckIndex: number): number {
    let n = 0;
    for (const v of t.dupViolations) if (v.decks.includes(deckIndex + 1)) n++;
    for (const v of t.copyViolations) if (v.perDeck[deckIndex] > 0) n++;
    return n;
  }

  type Mode = 'sort' | 'validate';
  let mode = $state<Mode>('sort');

  // Motion: all animation respects prefers-reduced-motion (durations drop to 0
  // and the hyperspace jump is skipped entirely).
  const motionOK =
    typeof matchMedia === 'undefined' || !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DUR = motionOK ? 320 : 0;

  // Staggered reveal: sections cascade, rows ripple within their section
  // (capped so long sections don't drag the tail out).
  function staggerDelay(section: number, row = 0): number {
    return motionOK ? 60 + section * 80 + Math.min(row * 14, 180) : 0;
  }

  // Focus mode: hide the form panel so results get the full width (useful when
  // referencing cards). The toggle appears once the right pane has content —
  // and stays while expanded, so you can always get the form back.
  let expanded = $state(false);
  const hasResults = $derived(mode === 'sort' ? !!sorted : !!trilogy);

  // Hyperspace jump overlay: shown while a fetch is in flight, held for a
  // minimum beat so quick responses don't strobe the effect.
  let jumping = $state(false);
  const MIN_JUMP_MS = 1100;

  async function holdJump<T>(work: () => Promise<T>): Promise<T> {
    jumping = true;
    const t0 = performance.now();
    try {
      return await work();
    } finally {
      const left = motionOK ? MIN_JUMP_MS - (performance.now() - t0) : 0;
      if (left > 0) await new Promise((r) => setTimeout(r, left));
      jumping = false;
    }
  }

  // Sort form
  let sortUrl = $state('');
  let sortBusy = $state(false);
  let sortError = $state('');
  let sorted = $state<SortedDeck | null>(null);
  let sortNorm = $state<NormalizedDeck | null>(null);
  let sortValidation = $state<DeckValidation | null>(null);

  // Validate form
  let valUrls = $state(['', '', '']);
  let valBusy = $state(false);
  let valError = $state('');
  let perDeck = $state<{ deck: NormalizedDeck; result: DeckValidation }[]>([]);
  let trilogy = $state<TrilogyValidation | null>(null);

  // Card hover preview — follows the cursor, with a holographic tilt + glare
  // driven by smoothed cursor velocity (the card leans the way it's "dragged").
  let preview = $state<string | null>(null);
  let previewX = $state(0);
  let previewY = $state(0);

  const PREVIEW_W = 320;
  const PREVIEW_H = 448; // SWU cards are ~1.4:1 portrait
  const TILT_MAX = 12; // degrees

  const tilt = new Spring({ x: 0, y: 0 }, { stiffness: 0.06, damping: 0.4 });
  let tiltTimer: ReturnType<typeof setTimeout> | undefined;
  let lastMX = 0;
  let lastMY = 0;
  let lastMT = 0;

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));

  function movePreview(e: MouseEvent) {
    const margin = 16;
    // Default: to the right of the cursor, vertically centered on it.
    let x = e.clientX + 24;
    let y = e.clientY - PREVIEW_H / 2;
    // Flip to the left if it would overflow the right edge.
    if (x + PREVIEW_W + margin > window.innerWidth) x = e.clientX - PREVIEW_W - 24;
    // Clamp vertically into the viewport.
    y = Math.max(margin, Math.min(y, window.innerHeight - PREVIEW_H - margin));
    previewX = x;
    previewY = y;

    if (!motionOK) return;
    const now = performance.now();
    const dt = now - lastMT;
    // Stale timestamp = fresh hover; just seed the tracking, no velocity spike.
    if (dt < 200) {
      const vx = (e.clientX - lastMX) / Math.max(dt, 8);
      const vy = (e.clientY - lastMY) / Math.max(dt, 8);
      tilt.target = {
        x: clamp(-vy * 28, -TILT_MAX, TILT_MAX),
        y: clamp(vx * 28, -TILT_MAX, TILT_MAX),
      };
      clearTimeout(tiltTimer);
      tiltTimer = setTimeout(() => {
        tilt.target = { x: 0, y: 0 };
      }, 90);
    }
    lastMX = e.clientX;
    lastMY = e.clientY;
    lastMT = now;
  }

  async function loadDeck(input: string): Promise<NormalizedDeck> {
    const id = parseDeckUrl(input);
    if (!id) throw new DeckFetchError(`"${input}" is not a valid SWUDB deck URL or id.`);
    return normalizeDeck(await fetchDeck(id));
  }

  async function runSort(e: Event) {
    e.preventDefault();
    sortError = '';
    sorted = null;
    sortNorm = null;
    sortValidation = null;
    sortBusy = true;
    try {
      // Assign results only after the jump resolves, so the cascade reveal
      // plays as the overlay fades rather than hidden behind it.
      const { deck, catalog, reprints } = await holdJump(async () => ({
        deck: await loadDeck(sortUrl),
        catalog: await fetchSets(),
        reprints: await buildPremierReprintNames(),
      }));
      sortNorm = deck;
      sorted = sortDeck(deck);
      sortValidation = validateDeck(deck, catalog, reprints);
    } catch (err) {
      sortError = err instanceof Error ? err.message : String(err);
    } finally {
      sortBusy = false;
    }
  }

  async function runValidate(e: Event) {
    e.preventDefault();
    valError = '';
    perDeck = [];
    trilogy = null;
    const inputs = valUrls.map((u) => u.trim()).filter(Boolean);
    if (inputs.length !== 3) {
      valError = 'Enter all three deck URLs.';
      return;
    }
    valBusy = true;
    try {
      const { decks, catalog, reprints } = await holdJump(async () => {
        const [cat, rep] = await Promise.all([fetchSets(), buildPremierReprintNames()]);
        return { decks: await Promise.all(inputs.map(loadDeck)), catalog: cat, reprints: rep };
      });
      // validateTrilogy judges every deck by the trilogy's format and returns them.
      trilogy = validateTrilogy(
        decks as [NormalizedDeck, NormalizedDeck, NormalizedDeck],
        catalog,
        reprints,
      );
      perDeck = trilogy.perDeck;
    } catch (err) {
      valError = err instanceof Error ? err.message : String(err);
    } finally {
      valBusy = false;
    }
  }

  async function copyMarkdown() {
    if (sorted) await navigator.clipboard.writeText(toMarkdown(sorted));
  }

  // "Supported sets" status panel — loads the catalog + local-data index on
  // first expand.
  let setsStatuses = $state<SetStatus[] | null>(null);
  let localIndex = $state<LocalDataIndex | null>(null);
  let setsError = $state('');

  async function loadSetsPanel(e: Event) {
    if (!(e.currentTarget as HTMLDetailsElement).open || setsStatuses) return;
    try {
      const [catalog, index] = await Promise.all([fetchSets(), fetchLocalIndex()]);
      localIndex = index;
      setsStatuses = [...SET_ORDER, ...SUB_SET_ORDER].map((c) => setStatus(c, catalog));
    } catch (err) {
      setsError = err instanceof Error ? err.message : String(err);
    }
  }

  const STATUS_LABEL: Record<SetStatus['premierKind'], string> = {
    legal: 'Premier',
    pending: 'Premier soon',
    rotated: 'Rotated',
    excluded: 'Eternal / Twin Suns',
  };

  function statusLabel(st: SetStatus): string {
    if (st.premierKind === 'pending') {
      return st.premierFrom ? `Premier ${st.premierFrom}` : 'Premier TBA';
    }
    return STATUS_LABEL[st.premierKind];
  }

  // Maintenance signals: anything here means the data needs attention.
  function setWarnings(st: SetStatus, meta: SetMeta): string[] {
    const w: string[] = [];
    if (!st.inCatalog) w.push('Not in the swu-db /sets catalog yet');
    if (st.dateOverridden) w.push(`Release date overridden (${st.releaseDate})`);
    if (!meta.logo && !meta.color) w.push('No media-kit logo or color');
    const local = localIndex?.sets[st.code];
    if (!local) {
      w.push('No local card data — run export_website_data.py');
    } else if (st.catalogCards != null && local.base !== st.catalogCards) {
      w.push(`Local card data may be stale: ${local.base} base cards vs ${st.catalogCards} in the catalog`);
    }
    return w;
  }
</script>

<div class="layout" class:expanded>
  <!-- LEFT: form panel -->
  <section class="panel left">
    <div class="tabs">
      <button class:active={mode === 'sort'} onclick={() => (mode = 'sort')}>Sort deck</button>
      <button class:active={mode === 'validate'} onclick={() => (mode = 'validate')}>Validate trilogy</button>
    </div>

    {#if mode === 'sort'}
      <form onsubmit={runSort}>
        <label for="sort-url">Deck URL</label>
        <input id="sort-url" type="text" bind:value={sortUrl} placeholder="https://www.swudb.com/deck/..." />
        <button type="submit" disabled={sortBusy}>{sortBusy ? 'Loading…' : 'Sort by set'}</button>
        {#if sortError}<p class="error">{sortError}</p>{/if}
      </form>
    {:else}
      <form onsubmit={runValidate}>
        {#each valUrls as _, i}
          <label for={`val-url-${i}`}>Deck {i + 1}</label>
          <input id={`val-url-${i}`} type="text" bind:value={valUrls[i]} placeholder="https://www.swudb.com/deck/..." />
        {/each}
        <button type="submit" disabled={valBusy}>{valBusy ? 'Validating…' : 'Validate trilogy'}</button>
        {#if valError}<p class="error">{valError}</p>{/if}
      </form>
    {/if}

    <details class="sets-status" ontoggle={loadSetsPanel}>
      <summary>Supported sets</summary>
      {#if setsError}
        <p class="error">{setsError}</p>
      {:else if !setsStatuses}
        <p class="muted">Loading set catalog…</p>
      {:else}
        <ul class="sets-list">
          {#each setsStatuses as st}
            {@const meta = setMeta(st.code)}
            {@const warnings = setWarnings(st, meta)}
            <li style:--set-color={meta.color ?? 'var(--line-bright)'}>
              <span class="sets-id" title={meta.name}>
                {#if meta.logo}
                  <img class="sets-logo" src={meta.logo} alt={meta.name} />
                {:else}
                  <span class="sets-name">{meta.name}</span>
                {/if}
              </span>
              <span class="sets-code">{st.code}</span>
              <span class="sets-chip {st.premierKind}">{statusLabel(st)}</span>
              {#if warnings.length}
                <span class="sets-warn" title={warnings.join('\n')}>⚠</span>
              {/if}
            </li>
          {/each}
        </ul>
        <p class="sets-note">
          ⚠ marks data that may need maintenance — hover for details.
          {#if localIndex}Local card data generated {localIndex.generated}.{/if}
        </p>
      {/if}
    </details>
  </section>

  <!-- RIGHT: output panel -->
  <section class="panel right">
    {#if hasResults || expanded}
      <button
        class="expand-btn"
        onclick={() => (expanded = !expanded)}
        aria-pressed={expanded}
        title={expanded ? 'Show the form panel' : 'Expand results to full width'}
        aria-label={expanded ? 'Show the form panel' : 'Expand results to full width'}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          {#if expanded}
            <polyline points="4 14 10 14 10 20" />
            <polyline points="20 10 14 10 14 4" />
            <line x1="14" y1="10" x2="21" y2="3" />
            <line x1="3" y1="21" x2="10" y2="14" />
          {:else}
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          {/if}
        </svg>
      </button>
    {/if}
    {#if mode === 'sort'}
      {#if sorted}
        <header class="deck-head" in:fly|global={{ y: 14, duration: DUR }}>
          <h2>{sorted.title}</h2>
          {#if sorted.author}<p class="muted"><span>by {sorted.author}</span></p>{/if}
          <div class="thumbs">
            {#each sorted.leaders as l}
              <figure
                onmouseenter={(e) => { preview = cardImage(l); movePreview(e); }}
                onmousemove={movePreview}
                onmouseleave={() => (preview = null)}
              >
                <img src={cardImage(l)} alt={l.cardName} />
                <figcaption>{l.cardName}{l.title ? ` – ${l.title}` : ''}</figcaption>
              </figure>
            {/each}
            {#if sorted.base}
              {@const base = sorted.base}
              <figure
                onmouseenter={(e) => { preview = cardImage(base); movePreview(e); }}
                onmousemove={movePreview}
                onmouseleave={() => (preview = null)}
              >
                <img src={cardImage(base)} alt={base.cardName} />
                <figcaption>{base.cardName}</figcaption>
              </figure>
            {/if}
          </div>
          {#if sortNorm && sortValidation}
            {@const norm = sortNorm}
            {@const val = sortValidation}
            {@const dplay = playName(val.format)}
            <div class="deck-info">
              <div class="deck-stats">
                <span class="aspects">
                  {#each deckAspects(sorted) as a}
                    <img class="aspect" src={`/aspects/${ASPECTS[a]?.cls}.webp`} title={ASPECTS[a]?.name} alt={ASPECTS[a]?.name} />
                  {/each}
                </span>
                <span><strong>{mainCount(norm)}</strong> cards</span>
                {#if val.format !== 'twinSuns'}
                  <span><strong>{sbCount(norm)}</strong> sideboard</span>
                {/if}
              </div>
              <span class="format-badge {val.format}">
                <svg class="fmt-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
                {dplay}
              </span>
            </div>
            {#if val.valid}
              <p class="deck-verdict ok">✓ Valid {dplay} deck</p>
            {:else}
              <p class="deck-verdict bad">✗ Invalid {dplay} deck</p>
              {#if val.reasons.length}<ul class="reasons">{#each val.reasons as r}<li>{r}</li>{/each}</ul>{/if}
            {/if}
          {/if}
          <button class="ghost" onclick={copyMarkdown}>Copy as markdown</button>
        </header>
        {#each sorted.sets as s, i}
          {@const meta = setMeta(s.set)}
          <h3
            class="set-head"
            style:--set-color={meta.color ?? 'var(--line-bright)'}
            in:fly|global={{ x: -18, duration: DUR, delay: staggerDelay(i) }}
          >
            {#if meta.logo}
              <img class="set-logo" src={meta.logo} alt={meta.name} title={meta.name} />
            {:else}
              <span class="set-name">{meta.name}</span>
            {/if}
            <span class="set-count">{s.set} · {s.cardCount}</span>
          </h3>
          <ul class="cards">
            {#each s.cards as c, j}
              <li
                in:fly|global={{ y: 10, duration: DUR, delay: staggerDelay(i, j + 1) }}
                onmouseenter={(e) => { preview = cardImage(c.card); movePreview(e); }}
                onmousemove={movePreview}
                onmouseleave={() => (preview = null)}
              >
                <span class="qty">{c.quantity}×</span>
                <span class="num">{c.number}</span>
                <span class="name">{c.name}</span>
                <span class="row-aspects">
                  {#each c.card.aspects ?? [] as a}
                    {#if ASPECTS[a]}
                      <img class="aspect-sm" src={`/aspects/${ASPECTS[a].cls}.webp`} title={ASPECTS[a].name} alt={ASPECTS[a].name} />
                    {/if}
                  {/each}
                </span>
              </li>
            {/each}
          </ul>
        {/each}
      {:else}
        <p class="muted">Enter a deck URL to generate a sorted list.</p>
      {/if}
    {:else if trilogy}
      {@const tv = trilogy}
      {@const trilogyPlay = playName(tv.format)}
      {@const invalidCount = tv.dupViolations.length + tv.copyViolations.length}
      <header class="deck-head" in:fly|global={{ y: 14, duration: DUR }}>
        <h2>{tv.formatLabel}</h2>
        {#if tv.formatReasons.length}
          <p class="verdict bad">Invalid</p>
          <ul class="reasons">{#each tv.formatReasons as r}<li>{r}</li>{/each}</ul>
        {:else}
          <p class={`verdict ${tv.valid ? 'ok' : 'bad'}`}>
            {tv.valid ? 'Valid' : 'Invalid'} for {trilogyPlay} Play
          </p>
        {/if}
      </header>

      <!-- Per-deck summaries first -->
      {#each perDeck as { deck, result }, i}
        {@const dplay = playName(result.format)}
        {@const tcount = deckTrilogyCount(tv, i)}
        <div class="deck-result deck-{i + 1}" in:fly|global={{ y: 16, duration: DUR, delay: staggerDelay(i) }}>
          <h3>
            <span class="deck-tag deck-{i + 1}">Deck {i + 1}</span>
            {deck.title}
            <span class="format-badge {result.format}">
              <svg class="fmt-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
              {dplay}
            </span>
          </h3>
          <div class="deck-info">
            <div class="deck-thumbs">
              {#each deck.leaders as l}
                <img
                  class="mini" src={cardImage(l)} alt={l.cardName}
                  onmouseenter={(e) => { preview = cardImage(l); movePreview(e); }}
                  onmousemove={movePreview}
                  onmouseleave={() => (preview = null)}
                />
              {/each}
              {#if deck.base}
                {@const base = deck.base}
                <img
                  class="mini" src={cardImage(base)} alt={base.cardName}
                  onmouseenter={(e) => { preview = cardImage(base); movePreview(e); }}
                  onmousemove={movePreview}
                  onmouseleave={() => (preview = null)}
                />
              {/if}
            </div>
            <div class="deck-stats">
              <span class="aspects">
                {#each deckAspects(deck) as a}
                  <img class="aspect" src={`/aspects/${ASPECTS[a]?.cls}.webp`} title={ASPECTS[a]?.name} alt={ASPECTS[a]?.name} />
                {/each}
              </span>
              <span><strong>{mainCount(deck)}</strong> cards</span>
              {#if result.format !== 'twinSuns'}
                <span><strong>{sbCount(deck)}</strong> sideboard</span>
              {/if}
            </div>
          </div>
          {#if !result.valid}
            <p class="deck-verdict bad">✗ Invalid {dplay} deck</p>
          {:else if tcount > 0}
            <p class="deck-verdict warn">
              ✓ Valid {dplay} deck — but fails the trilogy check with {tcount} {tcount === 1 ? 'card' : 'cards'}
            </p>
          {:else}
            <p class="deck-verdict ok">✓ Valid {dplay} deck</p>
          {/if}
          {#if result.reasons.length}<ul class="reasons">{#each result.reasons as r}<li>{r}</li>{/each}</ul>{/if}
          {#if result.notes.length}<ul class="notes">{#each result.notes as n}<li>{n}</li>{/each}</ul>{/if}
        </div>
      {/each}

      <!-- Invalid cards listed under the deck summaries -->
      {#if invalidCount > 0}
        <section class="invalid-section" in:fly|global={{ y: 16, duration: DUR, delay: staggerDelay(3) }}>
          <h3 class="invalid-head">
            {invalidCount} {invalidCount === 1 ? 'card is' : 'cards are'} invalid across 3 decks
          </h3>
          <div class="violations">
            {#each trilogy.dupViolations as v, vi}
              <div
                class="vcard"
                in:fly|global={{ y: 10, duration: DUR, delay: staggerDelay(3, vi + 1) }}
                onmouseenter={(e) => { preview = refImg(v); movePreview(e); }}
                onmousemove={movePreview}
                onmouseleave={() => (preview = null)}
              >
                <img class="vthumb" src={refImg(v)} alt={v.name} />
                <div class="vbody">
                  <span class="vname">{v.name}</span>
                  <span class="vmeta">{v.set} {v.number}</span>
                  <span class="vdetail bad">Duplicate {v.kind}</span>
                  <div class="vbreak">
                    {#each v.decks as d}<span class="badge deck-{d}">Deck {d}</span>{/each}
                  </div>
                </div>
              </div>
            {/each}
            {#each trilogy.copyViolations as v, vi}
              <div
                class="vcard"
                in:fly|global={{ y: 10, duration: DUR, delay: staggerDelay(3, trilogy.dupViolations.length + vi + 1) }}
                onmouseenter={(e) => { preview = refImg(v); movePreview(e); }}
                onmousemove={movePreview}
                onmouseleave={() => (preview = null)}
              >
                <img class="vthumb" src={refImg(v)} alt={v.name} />
                <div class="vbody">
                  <span class="vname">{v.name}</span>
                  <span class="vmeta">{v.set} {v.number}</span>
                  <span class="vdetail bad">{v.total} copies across 3 decks · limit {v.limit}</span>
                  <div class="vbreak">
                    {#each v.perDeck as n, i}
                      {#if n > 0}<span class="badge deck-{i + 1}">Deck {i + 1}: {n}</span>{/if}
                    {/each}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/if}
    {:else}
      <p class="muted">Enter three deck URLs to validate a trilogy.</p>
    {/if}

    {#if preview}
      <div
        class="preview-wrap"
        style={`left:${previewX}px; top:${previewY}px;`}
        transition:fade={{ duration: motionOK ? 130 : 0 }}
      >
        <div
          class="preview-card"
          style={`transform: rotateX(${tilt.current.x}deg) rotateY(${tilt.current.y}deg); --gx: ${50 + tilt.current.y * 3.5}%; --gy: ${50 - tilt.current.x * 3.5}%;`}
        >
          <img src={preview} alt="card preview" />
          <div class="glare"></div>
        </div>
      </div>
    {/if}
  </section>
</div>

<HyperspaceOverlay active={jumping} />

<style>
  .layout {
    display: grid; grid-template-columns: 360px 1fr; gap: 1.5rem; align-items: start;
    transition: grid-template-columns 0.35s ease, gap 0.35s ease;
  }
  /* Focus mode: the left track animates to 0 so the results panel grows
     smoothly while the form panel slides out. The panel clips its content
     (overflow hidden + min-width 0) and collapses its padding so no sliver
     remains; visibility flips only after the slide finishes. */
  .layout.expanded { grid-template-columns: 0px 1fr; gap: 0; }
  .panel.left {
    min-width: 0; overflow: hidden;
    transition:
      opacity 0.22s ease, transform 0.35s ease, padding 0.35s ease,
      border-color 0.35s ease, visibility 0s linear 0s;
  }
  .layout.expanded .left {
    opacity: 0; transform: translateX(-28px); visibility: hidden;
    padding-left: 0; padding-right: 0; border-color: transparent;
    transition:
      opacity 0.22s ease, transform 0.35s ease, padding 0.35s ease,
      border-color 0.35s ease, visibility 0s linear 0.35s;
  }
  .panel.right { position: relative; }
  .expand-btn {
    position: absolute; top: 0.85rem; right: 0.85rem; z-index: 5;
    display: grid; place-items: center; width: 32px; height: 32px;
    background: transparent; border: 1px solid var(--line); border-radius: 6px;
    color: var(--text-dim); cursor: pointer;
  }
  .expand-btn:hover { border-color: var(--gold-deep); color: var(--gold); }
  .deck-head { padding-right: 2.75rem; }
  .panel {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 1.25rem;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.35);
  }
  .tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
  .tabs button {
    flex: 1; padding: 0.5rem; cursor: pointer; border-radius: 6px;
    background: transparent; border: 1px solid var(--line); color: var(--text-dim);
    font-family: var(--font-display); font-weight: 700; font-size: 0.95rem;
    text-transform: uppercase; letter-spacing: 0.07em;
  }
  .tabs button.active { background: var(--gold-deep); border-color: var(--gold-deep); color: #121212; }
  form { display: flex; flex-direction: column; gap: 0.4rem; }
  label {
    font-family: var(--font-display); font-weight: 500; font-size: 0.85rem;
    text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-dim); margin-top: 0.4rem;
  }
  input { padding: 0.5rem; background: #0a0e18; border: 1px solid var(--line); border-radius: 6px; color: var(--text); font-family: var(--font-body); }
  input:focus { outline: none; border-color: var(--gold-deep); box-shadow: 0 0 0 3px var(--gold-dim); }
  form > button {
    margin-top: 0.8rem; padding: 0.55rem; border: none; border-radius: 6px; cursor: pointer;
    background: var(--gold-deep); color: #121212;
    font-family: var(--font-display); font-weight: 700; font-size: 1rem;
    text-transform: uppercase; letter-spacing: 0.07em;
  }
  form > button:hover { background: #ffbe1f; }
  form > button:disabled { opacity: 0.6; cursor: default; }
  .ghost {
    background: transparent; border: 1px solid var(--line); color: var(--text-dim);
    padding: 0.35rem 0.7rem; border-radius: 6px; cursor: pointer; margin-top: 0.5rem;
    font-family: var(--font-display); font-weight: 500; font-size: 0.85rem;
    text-transform: uppercase; letter-spacing: 0.07em;
  }
  .ghost:hover { border-color: var(--gold-deep); color: var(--gold); }
  .error { color: var(--bad); font-size: 0.85rem; }
  /* Supported-sets status panel */
  .sets-status { margin-top: 1.1rem; border-top: 1px solid var(--line); padding-top: 0.75rem; }
  .sets-status summary {
    cursor: pointer; list-style: none; user-select: none;
    font-family: var(--font-display); font-weight: 700; font-size: 0.95rem;
    text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-dim);
  }
  .sets-status summary::before { content: '▸'; display: inline-block; margin-right: 0.4rem; transition: transform 0.15s; }
  .sets-status[open] summary::before { transform: rotate(90deg); }
  .sets-status summary:hover { color: var(--gold); }
  .sets-status summary::-webkit-details-marker { display: none; }
  /* The list owns the column tracks; rows inherit them via subgrid so the
     code/chip columns stay aligned no matter how wide a row's chip is. */
  .sets-list {
    list-style: none; margin: 0.6rem 0 0; padding: 0;
    display: grid; grid-template-columns: minmax(0, 1fr) auto auto 1rem;
    row-gap: 0.3rem; column-gap: 0.5rem;
  }
  .sets-list li {
    display: grid; grid-column: 1 / -1; grid-template-columns: subgrid;
    align-items: center;
    padding: 0.2rem 0 0.2rem 0.5rem; border-left: 3px solid var(--set-color); border-radius: 2px;
  }
  .sets-id { min-width: 0; display: flex; align-items: center; }
  .sets-logo { height: 18px; max-width: 100%; width: auto; object-fit: contain; object-position: left; }
  .sets-name {
    font-family: var(--font-display); font-weight: 500; font-size: 0.85rem;
    text-transform: uppercase; letter-spacing: 0.06em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .sets-code { color: var(--text-faint); font-size: 0.75rem; font-variant-numeric: tabular-nums; }
  .sets-chip {
    justify-self: end; padding: 0.05rem 0.45rem; border-radius: 999px;
    font-family: var(--font-display); font-weight: 700; font-size: 0.7rem;
    text-transform: uppercase; letter-spacing: 0.06em; color: #fff; white-space: nowrap;
  }
  .sets-chip.legal { background: var(--fmt-premier); }
  .sets-chip.pending { background: rgba(240, 180, 74, 0.18); border: 1px solid var(--warn); color: var(--warn); }
  .sets-chip.rotated { background: #21262d; border: 1px solid var(--line); color: var(--text-dim); }
  .sets-chip.excluded { background: var(--fmt-eternal); }
  .sets-warn { color: var(--warn); font-size: 0.85rem; cursor: help; }
  .sets-note { margin: 0.5rem 0 0; color: var(--text-faint); font-size: 0.72rem; }
  .deck-head h2 {
    margin: 0 0 0.25rem;
    font-family: var(--font-display); font-weight: 700; font-size: 1.65rem;
    text-transform: uppercase; letter-spacing: 0.05em;
  }
  .thumbs { display: flex; gap: 0.6rem; flex-wrap: wrap; margin: 0.6rem 0 0.4rem; }
  .thumbs figure { margin: 0; width: 140px; }
  .thumbs img { width: 100%; display: block; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.5); }
  .thumbs figcaption { font-size: 0.7rem; color: var(--text-dim); margin-top: 0.2rem; line-height: 1.2; text-align: center; }
  .muted { color: var(--text-dim); font-size: 0.85rem; display: flex; flex-wrap: wrap; gap: 0.75rem; }
  /* Set section header: logo (or name) + accent in the set's signature color. */
  .set-head {
    display: flex; align-items: center; gap: 0.6rem;
    margin: 1.1rem 0 0.35rem; padding: 0.15rem 0 0.3rem 0.6rem;
    border-left: 3px solid var(--set-color);
    border-bottom: 1px solid var(--set-color);
    border-bottom-color: color-mix(in srgb, var(--set-color) 45%, transparent);
  }
  .set-logo { height: 30px; max-width: 220px; width: auto; object-fit: contain; object-position: left; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6)); }
  .set-name {
    font-family: var(--font-display); font-weight: 700; font-size: 1.2rem;
    text-transform: uppercase; letter-spacing: 0.07em;
  }
  .set-count {
    margin-left: auto; color: var(--text-dim); font-size: 0.9rem; font-weight: 500;
    font-family: var(--font-display); text-transform: uppercase; letter-spacing: 0.1em;
    font-variant-numeric: tabular-nums;
  }
  ul.cards { list-style: none; margin: 0; padding: 0; }
  ul.cards li { display: grid; grid-template-columns: 2.5rem 3rem 1fr auto; gap: 0.5rem; align-items: center; padding: 0.15rem 0.25rem; border-radius: 4px; }
  ul.cards li:hover { background: rgba(255,232,31,0.05); }
  .row-aspects { display: inline-flex; gap: 2px; align-items: center; justify-content: flex-end; }
  .aspect-sm { height: 16px; width: auto; display: block; }
  .qty { color: var(--text-dim); } .num { color: var(--text-faint); font-variant-numeric: tabular-nums; }
  .verdict {
    font-family: var(--font-display); font-weight: 700; font-size: 1.05rem;
    text-transform: uppercase; letter-spacing: 0.1em;
  }
  .verdict.ok { color: var(--ok); } .verdict.bad { color: var(--bad); }
  .reasons { color: var(--reason); font-size: 0.85rem; }
  .notes { color: var(--text-dim); font-size: 0.8rem; }
  .invalid-section { margin-top: 1.25rem; border-top: 1px solid var(--line); padding-top: 0.85rem; }
  .invalid-head {
    margin: 0; color: #f0a8a8; font-size: 1.05rem;
    font-family: var(--font-display); font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.07em;
  }
  .violations { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 0.6rem; margin: 0.85rem 0 0.25rem; }
  .vcard { display: flex; gap: 0.65rem; align-items: center; padding: 0.55rem; background: #161b22; border: 1px solid #3a2a2f; border-radius: 8px; }
  .vcard:hover { border-color: #6b3b42; background: #1b1216; }
  .vthumb { width: 54px; flex-shrink: 0; border-radius: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.5); }
  .vbody { display: flex; flex-direction: column; gap: 0.12rem; min-width: 0; }
  .vname { font-weight: 600; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .vmeta { font-size: 0.7rem; color: var(--text-faint); font-variant-numeric: tabular-nums; }
  .vdetail { font-size: 0.78rem; }
  .vdetail.bad { color: #f0a8a8; }
  .vbreak { display: flex; gap: 0.3rem; flex-wrap: wrap; margin-top: 0.15rem; }
  .badge {
    font-size: 0.75rem; font-weight: 700; background: #21262d; border: 1px solid var(--line); border-radius: 4px;
    padding: 0.05rem 0.4rem; color: #fff;
    font-family: var(--font-display); text-transform: uppercase; letter-spacing: 0.06em;
  }
  /* Per-deck color coding, shared by badges + deck headers. */
  .badge.deck-1 { background: rgba(74,140,255,0.20); border-color: var(--deck-1); }
  .badge.deck-2 { background: rgba(240,180,74,0.20); border-color: var(--deck-2); }
  .badge.deck-3 { background: rgba(74,209,160,0.20); border-color: var(--deck-3); }
  .deck-result { margin-top: 1rem; border-top: 1px solid var(--line); border-left: 3px solid var(--line); padding: 0.75rem 0 0 0.75rem; }
  .deck-result.deck-1 { border-left-color: var(--deck-1); }
  .deck-result.deck-2 { border-left-color: var(--deck-2); }
  .deck-result.deck-3 { border-left-color: var(--deck-3); }
  .deck-result h3 {
    margin: 0 0 0.5rem;
    font-family: var(--font-display); font-weight: 700; font-size: 1.25rem;
    text-transform: uppercase; letter-spacing: 0.05em;
  }
  .deck-tag { font-weight: 700; }
  .deck-tag.deck-1 { color: var(--deck-1); }
  .deck-tag.deck-2 { color: var(--deck-2); }
  .deck-tag.deck-3 { color: var(--deck-3); }
  .deck-info { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
  .deck-thumbs { display: flex; gap: 0.4rem; }
  .mini { height: 56px; border-radius: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.5); }
  .deck-stats { display: flex; gap: 1rem; align-items: center; font-size: 0.85rem; color: var(--text-dim); }
  .deck-stats strong { color: var(--text); font-weight: 600; font-variant-numeric: tabular-nums; }
  .aspects { display: inline-flex; gap: 0.25rem; align-items: center; }
  .aspect { height: 26px; width: auto; display: block; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5)); }
  /* Deck-type pill: full-color background, white bold text, small icon. */
  .format-badge {
    display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.1rem 0.5rem; border-radius: 999px;
    font-size: 0.78rem; font-weight: 700; color: #fff; vertical-align: middle;
    font-family: var(--font-display); text-transform: uppercase; letter-spacing: 0.06em;
  }
  .format-badge.premier { background: var(--fmt-premier); }
  .format-badge.eternal { background: var(--fmt-eternal); }
  .format-badge.twinSuns { background: var(--fmt-twinsuns); }
  .fmt-icon { flex-shrink: 0; }
  .deck-verdict { margin: 0.5rem 0 0; font-weight: 600; font-size: 0.85rem; }
  .deck-verdict.ok { color: var(--ok); }
  .deck-verdict.warn { color: var(--warn); }
  .deck-verdict.bad { color: var(--bad); }
  /* Holographic hover preview: the wrap owns position + perspective, the card
     tilts with smoothed cursor velocity, the glare tracks the tilt. */
  .preview-wrap {
    position: fixed; width: 320px; pointer-events: none; z-index: 50;
    perspective: 700px;
  }
  .preview-card {
    position: relative; border-radius: 12px; overflow: hidden;
    border: 1px solid rgba(255,232,31,0.25);
    box-shadow: 0 8px 30px rgba(0,0,0,0.6);
    will-change: transform;
  }
  .preview-card img { width: 100%; display: block; }
  .glare {
    position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(
      circle at var(--gx, 50%) var(--gy, 50%),
      rgba(255, 255, 255, 0.2),
      rgba(255, 255, 255, 0.05) 35%,
      transparent 60%
    );
    mix-blend-mode: screen;
  }

  @media (max-width: 900px) {
    .layout { grid-template-columns: 1fr; }
    .thumbs figure { width: 112px; }
    /* Stacked layout: the column animation doesn't apply, just remove the row. */
    .layout.expanded { grid-template-columns: 1fr; }
    .layout.expanded .left { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .layout, .panel.left { transition: none; }
  }
  /* Touch devices: no hover, so never render the cursor-following preview. */
  @media (hover: none) {
    .preview-wrap { display: none; }
  }
</style>
