# প্রশ্নব্যাংক — সম্পূর্ণ আর্কাইভ

**Aapathshala Question Bank — a zero-dependency, client-side browser for 210,082 Bengali/English exam questions with faceted filtering, full-text search, deep links, and CSV/MNR export.**

No build step. No bundler. No framework. No server. No database. Open the page and 210k questions are searchable.

---

## Overview

| | |
|---|---|
| **Total questions** | 210,082 |
| **Source databases** | 17 |
| **Universities / institutes** | 101 |
| **Years covered** | 38 |
| **Subjects (papers)** | 34 |
| **Chapters** | 386 |
| **Topics** | 812 |
| **Questions with explanations** | 175,522 |
| **Questions with images** | 125,141 |
| **MCQ / Written split** | 195,383 / 14,699 |
| **Shard size** | 5,000 questions (43 shards per tier) |
| **Primary key range** | 137,373 – 463,063 |
| **Data build stamp** | `2026-09-27T02:29:22.709Z` |

The UI is Bangla-first (`<html lang="bn">`), right-to-left aware, and ships a complete light/dark theme. The app renders MathML, tables, and chemistry formulas from the source HTML as-is.

---

## Why It's Built This Way

The source corpus is ~467 MB uncompressed. Loading all of it up front would be unusable on the connections this audience actually has. So the app uses a **two-tier on-demand shard architecture**:

```yaml
                       ┌──────────────────────────────────┐
   index.html          │  manifest.js  (95 KB)            │  facet values + counts
   (3 KB shell)  ─────▶│  loaded instantly                │  populates dropdowns
                       └──────────────────────────────────┘  before any data arrives
                                        │
                                        ▼  background, with a progress bar
                       ┌──────────────────────────────────┐
   TIER 1 — INDEX      │  idx/idx-000.js … idx-042.js     │  plain text only
   83 MB · all 43      │  every question, every option,   │  enough to filter,
   shards, always      │  every facet value, lowercased   │  sort, count, search
                       │  into an NFC-normalized haystack │
                       └──────────────────────────────────┘  never leaves memory
                                        │
                                        ▼  only the shards on screen
                       ┌──────────────────────────────────┐
   TIER 2 — CONTENT    │  dat/dat-000.js … dat-042.js     │  sanitized HTML
   160 MB · on demand  │  question body, per-option HTML, │  never enters the
                       │  explanation HTML, images        │  search index
                       └──────────────────────────────────┘
```

Consequences of this design:

- **Search and filtering work on the full 210,082 records**, because Tier 1 holds everything filtering needs.
- **Memory holds ~83 MB of index, not 244 MB** — Tier 2 is fetched per shard and released by the browser once the tab closes.
- **First paint is instant** — dropdowns are populated from `manifest.js` before any shard lands.
- **The dataset ships as `.js`, not `.json`**, because shards are injected as `<script src="idx/idx-000.js">` tags. That sidesteps the browser's local-file JSON/CORS restrictions and lets the browser cache shards as plain static assets.

---

## Quick Start

### Serve it locally (recommended)

Shards are loaded via injected `<script>` tags, so they must come from a real HTTP origin.

```bash
# Python
python -m http.server 8080

# or Node, no install needed beyond npx
npx serve .
npx http-server .
```

Open <http://localhost:8080>.

On first load you'll see a progress bar (`সূচি তৈরি হচ্ছে…` — "building index"). Once all 43 index shards are in, filtering and search become live.

### Open the file directly

Double-clicking `index.html` works with degraded behaviour: `history.replaceState` is rejected on `file://` documents, so the app falls back to plain `location.hash` writes (`app.js:811-816`). Everything else functions.

### Deploy

Publish the directory as-is to any static host — Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3 + CloudFront. All paths are relative; no configuration file is required. See [Deployment](#deployment) for payload notes.

---

## Features

### Filtering

Seven facets, plus four non-facet controls:

| Control | Behaviour |
|---|---|
| **Search** (`q`) | Full text across question text, **all option texts**, and all facet values. Multiple terms combine with AND. 220 ms debounce. |
| **Database** (`db`) | Source database. Cascades: changing it clears university, year, subject, chapter, topic. |
| **University** (`un`) | 101 institutions. Clears subject, chapter, topic. |
| **Year** (`y`) | 38 years. |
| **Subject** (`s`) | 34 papers — **multi-select**, values union (OR). |
| **Chapter** (`c`) | 386 chapters. Clears topic. |
| **Topic** (`k`) | 812 topics. |
| **Question type** (`ty`) | MCQ vs Written. Derived at load time, not shipped in the manifest. |
| **Option count** (`n`) | 2 / 3 / 4 / 5. |
| **Has explanation** (`e`) | 175,522 records match. |
| **Has image** (`img`) | 125,141 records match. |
| **Sort** | Default, year ↓, year ↑, database, subject, topic. Numeric-aware via `Intl.Collator`. |

**Live faceted counts** — a record counts toward facet *F* if it satisfies every filter *except* F. Selecting a value therefore never zeroes out its own dropdown, which is what makes iterative narrowing usable on a set this large (`app.js:203-227`).

Options with zero current matches are hidden, but any value you have actively selected is force-preserved in its list (`app.js:725`, `app.js:735`).

### Question type classification

A record is **Written** if the source row has no options at all, or its only options are the `Done` / `Skip` placeholders the upstream data-entry system attaches to descriptive questions (`app.js:100-104`). Rendering shows a `✍ লিখিত উত্তর — নিজে উত্তর লিখুন` note instead of fake choices.

### Rendering

- 40 cards per page, `IntersectionObserver` infinite scroll (`rootMargin: 800px`) **plus** an explicit `আরও দেখান` button for keyboard and reduced-motion users.
- `document.createDocumentFragment` batch insertion; every image gets `loading="lazy" decoding="async"`.
- A render token guards against a slow async page clobbering a newer one (`app.js:275`, `app.js:280`).
- Global show/hide answers via `body[data-answers]`, applied in CSS rather than by rebuilding the DOM.
- Fisher–Yates shuffle of the current result set (`এলোমেলো`).

### State & links

Every filter, sort, and toggled flag is mirrored into the URL hash. Any view is linkable, bookmarkable, and survives reload. Each card exposes a clickable `#<pk>` chip that copies a direct link to that question.

### Search normalization

Roughly one third of the source texts are stored in Unicode **decomposed (NFD)** form. Both the stored haystack and the incoming query are normalized to NFC (`app.js:92`, `app.js:231`). Without this, searching for a composed query silently misses a third of the corpus.

---

## Data Model

### Tier 1 — `idx/idx-NNN.js` → `window.QB_IDX[i]`

Plain-text records. Everything filtering and search needs, nothing more.

```jsonc
{
  "p": 399548,          // primary key
  "t": "প্রশ্নের লেখা…",  // question text (occasionally an array — see plain())
  "ot": "Done Skip",    // all option texts joined, so options are searchable
  "db": "Ac.QB",        // source database
  "un": "MCC",          // university / institute / board
  "y": "2024",          // year
  "s": "P-1",           // subject / paper code
  "c": "P-1.2",         // chapter
  "k": "লন রোলার",      // topic
  "a": 1,               // correct option number, 1-based
  "n": 2,               // option count
  "e": 1,               // derived: has explanation
  "hi": 1               // derived: has image
}
```

Runtime fields added by `app.js`, not shipped in the file:

| Field | Meaning |
|---|---|
| `_sh` | owning shard id — routes a result to its content shard |
| `_h` | lowercased, NFC-normalized search haystack |
| `_sk_<facet>` | memoized sort key |

`e` and `hi` are **derived** at load time, not stored. `null` in any facet field means "unspecified" and surfaces as `(নির্দিষ্ট নয়)` / `__none__`.

### Tier 2 — `dat/dat-NNN.js` → `window.QB_DAT[i]`

Sanitized HTML. Loaded only for shards actually being viewed.

```jsonc
{
  "p": 399548,                      // joins to idx
  "q": "<p><strong><span>…</span></strong></p>",
  "o": [                            // 820,077 option objects across the corpus
    { "n": 1, "h": "<p>Done</p>", "t": "Done", "c": 1 },
    { "n": 2, "h": "<p>Skip</p>", "t": "Skip", "c": 0 }
  ],
  "a": 1,
  "e": "<p><img …></p>",            // explanation HTML
  "et": null                        // explanation plain text
}
```

### Source — `database-dump-raw-full.jsonl`

The upstream export: 210,082 newline-delimited JSON objects, 14 keys (`p q t o a e et db un y un2 sh s c k`). This file is **not read by any runtime code** — it is the input the shards were built from, kept for provenance and rebuilds. Safe to exclude from any deployment.

`un2` (English-medium stream, e.g. `"Science"`) and `sh` (Bengali letter, e.g. `"গ"`) exist in the raw dump but are dropped by the build.

---

## Architecture

```
shards.js     → window.QB_IDX / QB_DAT / QB_LOADED   (globals the shards append into)
manifest.js   → window.QB_MANIFEST                   (totals, shard count, facet tables)
app.js        → everything else, as one ES5 IIFE
```

Classic scripts, loaded in order by `index.html:179-181`. No bundler, no modules, no `type="module"` — so the directory works from a bare file server with no build.

`app.js` is a single `'use strict'` IIFE with three pieces worth calling out:

**Shard loader** (`app.js:41-81`) — `loadScript()` injects a `<script>` and resolves on `onload`. In-flight requests are deduped through `pendIdx` / `pendDat`, so a fast scroll can't request the same shard twice. Index shards retry once before the app gives up and warns about partial results.

**In-memory flat list** — on load, `loadIdx(i)` stamps `_sh`, derives `ty`, builds the `_h` haystack, and pushes into the single `FLAT` array. All filtering and search operate on that array.

**Content map** — `loadDat(i)` builds `DATMAP[i] = { pk → record }` so a rendered card can look up its full record in O(1).

Errors are handled, not swallowed: a failed shard rejects, the progress bar shows partial state, and the app continues with what loaded (`app.js:137-142`, `app.js:291-297`).

---

## URL Scheme & Deep Links

All state lives in the URL fragment, written via `history.replaceState` and re-read on `hashchange` (guarded by `lastSyncedHash` so the app ignores its own writes — `app.js:942-948`).

```
#q=জীবন&db=Ac.QB&y=2024&s=P-1,P-2&ty=mcq&n=4&e=1&sort=y-desc
```

| Key | Meaning |
|---|---|
| `q` | search query |
| `db` `un` `y` `s` `c` `k` `ty` | facet selections (`s` is comma-joined for multi-select) |
| `n` | option count |
| `e=1` | has explanation |
| `img=1` | has image |
| `sort` | `y-desc` · `y-asc` · `db` · `s` · `k` |
| `p` | primary key — scrolls to and isolates that question |

`#p=399548` scrolls a single question into view. The `#<pk>` chip on each card copies that link to your clipboard.

---

## Export Formats

One modal, two formats, same start/end range for both. Both are **BOM-prefixed** (`\uFEFF`) so Excel and Google Sheets open Bengali UTF-8 correctly, with CRLF line endings.

### CSV — 10 columns

```
questions,option1,option2,option3,option4,option5,answer,explanation,type,section
```

`type` and `section` are fixed at `1` per the import format. Answer falls back to scanning option `c` flags if `a` is absent (`app.js:406-408`).

### MNR — 19 columns

```
question,question_image,
option_1,option_1_image,option_2,option_2_image,option_3,option_3_image,
option_4,option_4_image,option_5,option_5_image,
correct_options,explanation,explanation_image,
type_id,paper_id,chapter_id,topic_id
```

Implemented against a documented 17-rule import spec, with each rule cited inline at `app.js:421-508`. The non-obvious ones:

| Rule | Implementation |
|---|---|
| Text + image are separate columns | `imgCell()` — one `<img>` → bare URL; multiple → JSON array of URLs (`app.js:442-445`) |
| `paper_id` normalization | First tag, lowercased, hyphen dropped: `B-1` → `b1`, `P-1` → `p1`. `bangla`/`ban`/`ba`/`bn` → `bn` (`app.js:463-468`) |
| `chapter_id` extraction | The number after the decimal in `P-1.4` → `4`. No decimal → the tag as-is. Blanked when it would just repeat the paper id (`app.js:472-488`) |
| `topic_id` | Bangla topic passed through verbatim (`app.js:507`) |
| `type_id` | Always empty (`app.js:504`) |
| `correct_options` | 1-based positions joined by comma; bare when single, quoted when it contains a comma so the CSV doesn't split (`app.js:457-461`) |

### Range input

Accepts `1 to 10`, `5-50`, `৬ থেকে ৩৪`, or a value in either box — **Bengali numerals are parsed** (`১০` → `10`, `app.js:518-521`). Reversed bounds are normalized automatically.

Content shards the range needs are fetched on demand with a live `কনটেন্ট লোড হচ্ছে n/N শার্ড…` progress note. The filename auto-fills from the range (`questions-1-10.csv` / `mnr-1-10.csv`), `.csv` is appended if missing, and illegal filename characters are sanitized. Enter runs the last-used format; the modal remembers your format and filename choice across sessions.

The last generated file is also exposed on `window.__lastCSV` / `__lastFmt` / `__lastName` for inspection (`app.js:642-644`).

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `/` | Focus search |
| `a` | Toggle answers |
| `Esc` | Close subject popover → close export modal → blur search |

---

## Accessibility

- `aria-pressed` on toggle buttons, `aria-expanded` / `aria-haspopup` on the subject popover
- `role="dialog" aria-modal="true"` on the export modal
- `aria-live="polite"` on the result list
- Every filter control has a real `<label>`
- Answer visibility is toggled by a `body` data attribute, so screen readers see a consistent DOM rather than one that mutates under them
- Explicit "load more" button alongside infinite scroll
- Full keyboard path through filters, popover, and modal
- Responsive down to 320 px, plus a `@media print` stylesheet (`styles.css:501-505`)

---

## Browser Support

Targets current Chrome, Edge, Firefox, and Safari. `styles.css` relies on CSS custom properties with a `html[data-theme="dark"]` override.

Modern APIs used, with their practical floors:

| API | Used for | Minimum |
|---|---|---|
| `String.prototype.normalize` | NFC search indexing | Chrome 50 / FF 69 / Safari 10 |
| `Intl.Collator` | numeric-aware sort | Chrome 24 / FF 29 / Safari 10 |
| `Intl.NumberFormat` | thousands separators | universal |
| `URLSearchParams` | URL state | Chrome 49 / FF 44 / Safari 10 |
| `IntersectionObserver` | infinite scroll | Chrome 51 / FF 55 / Safari 12.1 |
| `Element.replaceChildren`-era DOM | rendering | — |

Graceful degradations are in place: `history.replaceState` falls back to `location.hash` on `file://`, `IntersectionObserver` absence simply disables auto-scroll, `matchMedia` absence defaults to light theme, and missing `URL.createObjectURL` (jsdom, very old engines) skips the download instead of throwing. Every `localStorage` access is `try`/`catch`-wrapped.

---

## Project Structure

```
aapathshala-qb-full/
├── index.html                       8 KB   app shell — topbar, filters, modal, footer
├── app.js                          42 KB   all application logic (975 lines)
├── styles.css                      13 KB   complete design system (505 lines)
├── shards.js                        68 B   declares QB_IDX / QB_DAT / QB_LOADED
├── manifest.js                      95 KB   totals + facet value/count tables
├── idx/                            83 MB   43 × 5,000 plain-text index records
│   ├── idx-000.js … idx-041.js      (5,000 records each)
│   └── idx-042.js                      82 records
├── dat/                           160 MB   43 × sanitized HTML content shards
│   ├── dat-000.js … dat-041.js
│   └── dat-042.js
└── database-dump-raw-full.jsonl   223 MB   source export — not used at runtime
```

There is no `package.json`, no lockfile, no transpiler, no linter config, and no test suite. Hand-written code is 64 KB total. Run `node --check app.js` for the only syntax check available.

---

## Deployment

Any static host works, no config required. Every asset reference is relative — the app runs at a domain root or a sub-path without modification.

| Target | Verdict |
|---|---|
| Netlify / Vercel / Cloudflare Pages | Drop-in, zero config |
| S3 + Cloudfront | **Recommended at this size** — long cache headers on `idx/` and `dat/` |
| GitHub Pages | Works, but the ~467 MB repo is painful to push |
| Local / LAN | `npx serve .` |

### Trim the payload

**Exclude `database-dump-raw-full.jsonl`** (223 MB, zero runtime references). That takes the deploy from ~467 MB to **~244 MB** — a 48% cut, and the single biggest win available.

Deploy `index.html`, `app.js`, `styles.css`, `shards.js`, `manifest.js`, `idx/`, and `dat/`. Nothing else.

### Cache headers

Shard content is immutable per `manifest.generated`, so:

```
/idx/*    Cache-Control: public, max-age=31536000, immutable
/dat/*    Cache-Control: public, max-age=31536000, immutable
/*.html   Cache-Control: no-cache
```

Bump `manifest.generated` whenever you rebuild the shards — that's the cache-buster signal.

### Hard requirement

Shard availability is the only thing that can break a deploy. If an index shard 404s, the app loads with a warning and partial results rather than failing outright — but those questions are gone until it's fixed.

---

## Performance Notes

| Concern | Approach |
|---|---|
| First paint | `manifest.js` populates all dropdowns before any data shard loads |
| Filtering 210k records | Flat in-memory array, no DOM involved until render |
| Search | Lowercased haystack per record, memoized in `_h`; AND-ed terms; 220 ms debounce |
| Sort | Sort keys memoized per record in `_sk_<facet>` |
| Content HTML | Never in the search index; fetched per shard on demand |
| Images | 136,146 `<img>` tags, all `loading="lazy" decoding="async"` |
| Initial index load | 83 MB across 43 shards, sequential, with a progress bar and one retry each |

**Not fully offline.** Despite the "অফলাইন আর্কাইভ" framing, 135,994 of the 136,146 images are hotlinked from `testmozusercontent.com`, with the remainder spread across S3, Wikimedia, Wikipedia, and ~28 one-off hosts. The *interface* and *text* are fully local; question images require network access. Fonts are fully local too: `fonts/solaiman-lipi-{regular,semibold,bold}.woff2` (SolaimanLipi 400/600/700, Bangla + Latin) are declared with `@font-face`, so no Google Fonts request is made.

---

## Privacy & Storage

No network calls of any kind — no `fetch`, no `XMLHttpRequest`, no `WebSocket`, no analytics, no telemetry, no error reporting. No accounts, no auth, no cookies. The only external requests are the images embedded in question HTML.

Four `localStorage` keys, all optional and all `try`/`catch`-wrapped:

| Key | Purpose |
|---|---|
| `qb-theme` | `light` / `dark` |
| `qb-answers` | answers shown or hidden |
| `lastExportFmt` | `csv` or `mnr` |
| `lastExportName` | last filename typed into the export modal |

---

## Regenerating the Data Shards

The shard files are **generated artifacts**. `database-dump-raw-full.jsonl` is the source of truth; the build script that produced `idx/` and `dat/` is not present in this directory. If you need to rebuild:

1. Read `database-dump-raw-full.jsonl` — one JSON object per line, keys `p q t o a e et db un y un2 sh s c k`.
2. Emit **Tier 1** per record: `{p, t, ot, db, un, y, s, c, k, a, n}`. `ot` is the option texts joined with a space. Drop `e`/`hi` — they're derived at runtime. Drop `un2` and `sh`.
3. Emit **Tier 2** per record: `{p, q, o:[{n, h, t, c}], a, e, et}`.
4. Chunk both tiers into groups of 5,000 records, assign to shard ids `000`…`042`, and write each as `window.QB_IDX[i] = [...]` / `window.QB_DAT[i] = [...]`.
5. Regenerate `manifest.js` with the new `total`, `shards`, and per-facet `[{value, count}]` tables. **Every facet's counts must sum to exactly `total`** — the app relies on this.
6. Update `generated` to the new ISO timestamp.

Keep shard *i* in `idx/` aligned with shard *i* in `dat/`. Records are assigned `_sh` from their index shard id and content is looked up from `DATMAP[_sh]`, so a misaligned pair renders an empty card rather than an error.

---

## Troubleshooting

**The progress bar never completes.** A shard failed to load twice. Serve over HTTP rather than `file://`, and check that `idx/` is being published alongside the root files.

**No questions match a search that should hit.** Almost always a Unicode normalization issue. If you edit `haystack()`, keep the `.normalize('NFC')` call on both the stored text and the query side — about a third of the corpus is stored decomposed.

**Export downloads nothing.** `URL.createObjectURL` is unavailable (jsdom or a very old engine — `app.js:538`). Check `window.__lastCSV` to confirm the CSV was generated successfully regardless.

**Images don't appear.** Expected. 135,994 of 136,146 are hotlinked from external hosts and need network access. Self-host them by rewriting `src` in `dat/` if you need a truly self-contained archive.

**Options render as `Done` / `Skip`.** Those are upstream placeholders on descriptive questions. The app classifies them as Written and shows a "write your own answer" note only when *all* options are placeholders (`app.js:106-112`).

**A dropdown is empty but I know the data exists.** Facet counts respect all *other* active filters. Clear a filter or two — the active value is always force-preserved in its own list, so it should still be selectable.

**Syntax error after editing `app.js`.** `node --check app.js`.

---

## Known Limitations

- **The 223 MB JSONL is not wired to anything.** Regenerating shards currently means reimplementing the build.
- **Not offline-complete** — images are hotlinked, see [Performance Notes](#performance-notes).
- **No automated tests.** Validation is manual. Two debug hooks exist (`window.__lastCSV`, and the `createObjectURL` guard) but there's no suite.
- **No linting or formatting config**, so hand-edited code will drift.
- **A small number of Tier 1 records store `t` as an array, not a string.** `plain()` (`app.js:83-87`) absorbs this, but it's an upstream data quirk, not a clean schema.
- **Source HTML is only loosely sanitized.** Tags are handled broadly, but chemistry formula strings such as `clo4`, `c6h5cooh`, `so42` appear in the source and are not well-formed markup.
- **`_sk_*` sort keys accumulate** in memory as users cycle through sort modes. Bounded by facet count; not yet evicted.
- **No `.gitignore`**, and the directory is currently untracked in the parent repository.

---

## Attribution

Question content originates from the Aapathshala question-bank sources, aggregated across 17 databases spanning 101 universities, institutes, and boards. Images belong to their original hosts and are referenced, not redistributed.

This repository contains the viewer application. Verify ownership and licensing of the underlying question content before redistribution.
