# Screenshots

All six are **real captures**, taken from the extension in dark mode and cropped
to the popup's own 420 × 598 bounds (the macOS window frame is trimmed off). Keep
the filenames — the README links to them by name.

One thing still to do: **they were all captured before the logo landed**, so the
header in each still reads `OpenSEO` as text rather than showing the mark.
Re-take them after rebuilding and re-crop. The header height is unchanged, so the
framing still works; trim ~4px from the left and ~5px from the right.

`05-site-start.png` is the screen where a scan is *started*. There is no capture
of a scan actually running — if you want one, that is the shot still missing.

The unused captures from the same session are in `extra/`. Delete it whenever you
like; nothing references it.

## How to capture

| | |
|---|---|
| Canvas | 1280 × 800 px (Chrome Web Store minimum for screenshots) |
| Format | PNG |
| Popup size | 420 × 600 CSS px — screenshot at 100% zoom so it renders 1:1 |
| Browser chrome | Include a little page context so the tab being audited is obvious |
| Theme | Light, or shoot both and pick |

Easiest approach: open a real page, open the extension popup in its own window
(so the page is not obscured), then capture the browser window at 1280 × 800.

## What goes in each file

| File | Capture this |
|---|---|
| `01-audit-tab.png` | The **Audit** tab on a real page: search preview, the verdict bar, and at least one expanded finding so the message and fix are readable. |
| `02-links-tab.png` | The **Links** tab with the Internal/External counts visible. Hover a row so the copy button shows. |
| `03-social-tab.png` | The **Social** tab: the Facebook and X card previews plus the tag table underneath. |
| `04-site-picker.png` | After *Find pages*: the page count, the preset buttons, the filter box and the paginated URL list. |
| `05-site-start.png` | The **Site** tab before a scan: what it does, which origin it found, and the **Find pages** button. |
| `06-site-report.png` | The finished report: score ring, the counts, the CSV/JSON buttons, and the *Issues by type* list expanded. |

A page with real problems makes the best screenshot. A page that is already
perfect makes for a boring one.
