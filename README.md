# Open SEO

Open-source, local-first SEO inspector for Chrome, Edge, and Firefox.

Everything runs in your browser — no page URL is ever sent to a server, and the
extension collects no data.

## Status

It audits the current page's **title**, **meta description**, **canonical link**,
**indexability** (`robots` meta, `X-Robots-Tag`, `robots.txt`), **social tags**
(Open Graph / Twitter Cards), **heading structure** (H1–H6),
**internal/external links**, and **word count**, then renders a search-result
preview. A **Links** tab lists every link, and a **Social** tab previews the
Facebook/LinkedIn and X (Twitter) cards.

A **Site** tab audits a whole site: it discovers the site's pages (sitemap first,
internal-link crawl as a fallback), lets you pick how many to scan (10 → 1000),
scans them in the background with a live progress bar, and produces a report with
a score, issues grouped by type, a per-page table, and CSV/JSON export.

## Site audit

1. Open the popup on any page of the site → **Site** tab.
2. **Find pages** — the extension asks for access to that one origin, then reads
   `robots.txt` + `sitemap.xml` (following sitemap indexes) or crawls internal
   links when there is no sitemap.
3. Pick a preset (10/25/50/100/250/500) or type a custom number, optionally
   filter the list, then **Scan N pages**.
4. The scan runs in the background, so the popup can be closed. Reopen it to see
   progress; a service-worker restart resumes the remaining pages.
5. When it finishes: score + counts, issues grouped by type ("missing meta
   description — 63 pages"), a page table you can drill into, and export.

Crawling is polite by default: `robots.txt` rules and `Crawl-delay` are
respected, 4 requests run in parallel, and a scan is capped at 1000 pages.

Known limitation: pages are audited as static HTML, so client-side rendered
(JS-only) pages can look empty. Those show up with a word count of 0.

## Roadmap

- [ ] More on-page checks: images/`alt`.
- [x] Site crawler (crawl a whole site and list issues per page).
- [ ] JavaScript rendering for SPA pages in site scans.
- [ ] AI-search readiness checks (`llms.txt`, AI-crawler directives).

## Development

```
npm install
npm run dev            # Chrome with hot reload
npm run dev:firefox    # Firefox
```

## Build

```
npm run build          # Chrome/Edge -> .output/chrome-mv3
npm run build:firefox  # Firefox     -> .output/firefox-mv2
npm run zip            # store-ready zips
```

Load the unpacked build from `.output/chrome-mv3` via `chrome://extensions`
(enable Developer mode → "Load unpacked").

## Architecture

- `entrypoints/popup/` — the React popup UI (Audit / Links / Social / Site tabs).
  Styles are Tailwind CSS v4 utilities; the design tokens live in
  `entrypoints/popup/popup.css` (`@theme`), which is also where the few
  custom utilities (`btn`, `hide-marker`, `skeleton`) are defined.
- `entrypoints/background.ts` — the site-audit job: discovery, the scan queue,
  persistence and progress broadcasts.
- `lib/extract.ts` — one self-contained extractor. Injected into the live tab it
  reads that page's DOM; the crawler calls the same function with a parsed
  document plus a base URL.
- `lib/site-context.ts` — a second injected function that reads server-side
  signals (`robots.txt`, `X-Robots-Tag`) with same-origin requests.
- `lib/audit.ts` — runs every check.
- `lib/checks/` — one file per check. Adding a check is a small, self-contained
  PR.
- `lib/crawl/` — the site crawler: `discover.ts` (sitemap → link crawl),
  `sitemap.ts`, `robots.ts`, `normalize.ts`, `http.ts`, `scan.ts`,
  `report.ts` (aggregation + CSV/JSON), `store.ts` (per-origin state).

### Permissions

`activeTab` + `scripting` cover the single-page audit. Site scans additionally
use `storage` (scan state survives popup/service-worker restarts) and request
**optional host access for the current origin only** when you start a scan —
never `<all_urls>` up front.

### Adding a check

```ts
import type { Check } from '../types'

export const myCheck: Check = (page) => [
  {
    id: 'my-check',
    label: 'My check',
    value: page.title,
    length: page.title.length,
    status: 'pass', // 'pass' | 'warn' | 'fail'
    message: 'What was checked.',
    fix: 'How to fix it (optional).',
  },
]
```

Register it in the `checks` array in `lib/audit.ts`.

## License

MIT
