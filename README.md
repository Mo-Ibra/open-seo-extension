# Open SEO

Open-source, local-first SEO inspector for Chrome, Edge, and Firefox.

Everything runs in your browser — no page URL is ever sent to a server, and the
extension collects no data.

## Status

Early MVP. It audits the current page's **title**, **meta description**,
**canonical link**, **indexability** (`robots` meta, `X-Robots-Tag`,
`robots.txt`), **social tags** (Open Graph / Twitter Cards), **heading
structure** (H1–H6), **internal/external links**, and **word count**, then
renders a search-result preview. A **Links** tab lists every link, and a **Social** tab
previews the Facebook/LinkedIn and X (Twitter) cards.

## Roadmap

- [ ] More on-page checks: images/`alt`.
- [ ] Site crawler (crawl a whole site and list issues per page).
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

- `entrypoints/popup/` — the React popup UI.
- `lib/extract.ts` — a self-contained function injected into the page to read
  its DOM (no network, no persistent content script).
- `lib/site-context.ts` — a second injected function that reads server-side
  signals (`robots.txt`, `X-Robots-Tag`) with same-origin requests.
- `lib/audit.ts` — runs every check.
- `lib/checks/` — one file per check. Adding a check is a small, self-contained
  PR.

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
