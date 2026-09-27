import { useMemo, useState } from 'react'

import type { LinkInfo, PageData } from '../../../../lib/types'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { EmptyState } from '../../shared/EmptyState'
import { FilterTabs, type FilterOption } from '../../shared/FilterTabs'
import { Icon } from '../../shared/Icon'
import { SearchInput } from '../../shared/SearchInput'
import { isInternal } from '../../utils/url'
import { LinkSection } from './LinkSection'
import { Stat } from './Stat'

/** Which slice of the page's links to show. */
type Kind = 'all' | 'internal' | 'external' | 'empty'

/**
 * Filter names without their counts, so the row can be built as data and the
 * counts filled in from the current page.
 */
const FILTER_NAMES: Record<Kind, string> = {
  all: 'All',
  internal: 'Internal',
  external: 'External',
  empty: 'No text',
}

/** Heading used when a single bucket is selected instead of "all". */
const SECTION_TITLES: Record<Exclude<Kind, 'all'>, string> = {
  internal: 'Internal',
  external: 'External',
  empty: 'Missing anchor text',
}

/** The page's links, split into the buckets the tab displays. */
interface LinkGroups {
  /** Navigable links only, after dropping `javascript:` and empty hrefs. */
  total: number
  /** Distinct hrefs among them. */
  unique: number
  internal: LinkInfo[]
  external: LinkInfo[]
  /** Links with no accessible text. May overlap `internal`/`external`. */
  empty: LinkInfo[]
}

/**
 * Every link on the current page, grouped and searchable.
 *
 * Grouping runs once per page change, not per keystroke, so typing stays
 * responsive on a page with thousands of links.
 */
export function LinksTab({ page }: { page: PageData }) {
  const [kind, setKind] = useState<Kind>('all')
  const [query, setQuery] = useState('')
  const { copied, copy } = useCopyToClipboard()

  const groups = useMemo(() => groupLinks(page), [page])

  // Free-text match against both the href and the anchor text, because users
  // search for the word a link says at least as often as the URL it points to.
  const search = query.trim().toLowerCase()
  const matches = (link: LinkInfo): boolean =>
    !search ||
    link.href.toLowerCase().includes(search) ||
    link.text.toLowerCase().includes(search)

  const internal = groups.internal.filter(matches)
  const external = groups.external.filter(matches)
  const empty = groups.empty.filter(matches)

  // "All" stacks the two real buckets; the text-less bucket is a subset of
  // them, so showing it alongside would duplicate rows.
  const sections =
    kind === 'all'
      ? [
          { title: SECTION_TITLES.internal, links: internal },
          { title: SECTION_TITLES.external, links: external },
        ]
      : [{ title: SECTION_TITLES[kind], links: kind === 'internal' ? internal : kind === 'external' ? external : empty }]

  // Counts come from the unfiltered groups: they describe the page, not the
  // current search, so the numbers do not jump while typing.
  const filters: FilterOption<Kind>[] = (Object.keys(FILTER_NAMES) as Kind[]).map((id) => ({
    id,
    label: `${FILTER_NAMES[id]} ${linkCount(groups, id)}`,
  }))

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-4 gap-1.5">
        <Stat label="Total" value={groups.total} />
        <Stat label="Unique" value={groups.unique} />
        <Stat label="Internal" value={groups.internal.length} accent />
        <Stat label="External" value={groups.external.length} />
      </div>

      {groups.empty.length > 0 && (
        <p className="flex items-center gap-1.5 rounded-sm bg-warn-soft px-2 py-1.5 text-xs text-warn" role="alert">
          <Icon name="alert" size={13} />
          <span>
            {groups.empty.length} link{groups.empty.length === 1 ? '' : 's'} without anchor text
          </span>
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <FilterTabs options={filters} value={kind} onChange={setKind} label="Filter links" />
        <SearchInput value={query} onChange={setQuery} placeholder="Filter links…" />
      </div>

      {sections.map((section) => (
        <LinkSection
          key={section.title}
          title={section.title}
          links={section.links}
          pageUrl={page.url}
          onCopy={copy}
          copied={copied}
        />
      ))}

      {groups.total === 0 && (
        <EmptyState
          icon="link"
          title="No links on this page"
          hint="Links found here will be listed with their anchor text."
        />
      )}
    </div>
  )
}

/** How many links a filter covers, for its label. */
function linkCount(groups: LinkGroups, kind: Kind): number {
  return kind === 'all' ? groups.total : groups[kind].length
}

/**
 * Sorts the page's links into the buckets the tab displays.
 *
 * `javascript:` hrefs and empty ones are dropped up front: they are not
 * navigable, so counting them would inflate the totals and add rows that do
 * nothing when clicked.
 */
function groupLinks(page: PageData): LinkGroups {
  const links = page.links.filter(isRealLink)
  return {
    total: links.length,
    unique: new Set(links.map((link) => link.href)).size,
    internal: links.filter((link) => isInternal(link.href, page.url)),
    external: links.filter((link) => !isInternal(link.href, page.url)),
    empty: links.filter((link) => !link.text),
  }
}

/** A link is "real" when it points somewhere a click can actually go. */
function isRealLink(link: LinkInfo): boolean {
  return Boolean(link.href) && !link.href.startsWith('javascript:')
}
