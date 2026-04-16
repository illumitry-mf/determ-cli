# Publish Date Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch `--from`/`--to` on `determ mentions` to filter by `publishedTime` by default, add `--use-feed-time` toggle for crawl-date filtering, and snap date-only `--to` values to end of day.

**Architecture:** Update `buildBody` in `mentions.ts` to branch on `useFeedTime`: when from/to are provided without the flag, set `publishedTime` and keep `feedTime` as a wide 90-day window (required by API); with the flag, set `feedTime` directly. Two small helper functions (`isDateOnly`, `snapToEndOfDay`) handle the end-of-day snapping. The flag is wired into `MentionsOptions`, the CLI flag, and the MCP server schema.

**Tech Stack:** TypeScript, Vitest, Commander (CLI), @modelcontextprotocol/sdk (MCP)

---

## File Map

| File | Change |
|---|---|
| `src/types.ts` | Add `useFeedTime?: boolean` to `MentionsOptions` (line 164) |
| `src/commands/mentions.ts` | Add `isDateOnly`, `snapToEndOfDay`; rewrite `buildBody` date logic |
| `src/cli.ts` | Add `--use-feed-time` flag to `mentions` command |
| `src/mcp-server.ts` | Add `use_feed_time` to `determ_mentions` schema + handler |
| `SKILL.md` | Update `--use-feed-time` flag in options table and key concepts section |
| `tests/commands/mentions.test.ts` | Update 1 existing test; add 3 new describe blocks |

---

## Task 1: Add `useFeedTime` to `MentionsOptions`

**Files:**
- Modify: `src/types.ts` (line 164, inside `MentionsOptions`)

This is a type-only change with no runtime behaviour. It must come first so TypeScript accepts `useFeedTime` in the test file without compile errors.

- [ ] **Step 1: Add the field to `MentionsOptions`**

Open `src/types.ts`. The `MentionsOptions` interface currently ends at line 165. Add `useFeedTime` before `json`:

```typescript
export interface MentionsOptions {
  keyword?: string
  group?: string
  from?: string
  to?: string
  sentiment?: string
  type?: string
  tag?: string
  count?: number
  all?: boolean
  fields?: string[]
  sortBy?: string
  sortDir?: string
  useFeedTime?: boolean
  json?: boolean
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
npm run build
```

Expected: zero errors, `dist/` rebuilt.

- [ ] **Step 3: Commit the type change**

```bash
git add src/types.ts
git commit -m "feat: add useFeedTime to MentionsOptions type"
```

---

## Task 2: Core logic — tests + helpers + `buildBody`

**Files:**
- Modify: `tests/commands/mentions.test.ts` (update 1 test + add 3 describe blocks)
- Modify: `src/commands/mentions.ts` (add `isDateOnly`, `snapToEndOfDay`, rewrite date section of `buildBody`)

### Background

Current `buildBody` always sets `feedTime`:

```typescript
body.query.feedTime = {
  from: options.from ? parseDate(options.from) : Date.now() - 7 * 24 * 60 * 60 * 1000,
  to: options.to ? parseDate(options.to) : Date.now(),
}
```

Target behaviour:

| from/to provided | `useFeedTime` | Result |
|---|---|---|
| No | — | `feedTime = { now-7d, now }` (unchanged default) |
| Yes | not set | `publishedTime = { from, to }` + `feedTime = { now-90d, now+1d }` |
| Yes | set | `feedTime = { from, to }` only |

`--to` with bare `YYYY-MM-DD` input is snapped to `23:59:59.999Z` regardless of which field it ends up in.

### Steps

- [ ] **Step 1: Update the existing breaking test**

In `tests/commands/mentions.test.ts`, find the test at line ~197 inside `describe('request body construction')`:

```typescript
it('adds feedTime when --from is provided', async () => {
  await fetchMentions(mockClient, '177561', {
    keyword: '6798574',
    from: '2026-04-01',
  })
  const body = mockPost.mock.calls[0][1]
  expect(body.query.feedTime.from).toBe(new Date('2026-04-01').getTime())
})
```

Replace it with:

```typescript
it('sets publishedTime (not feedTime origin) when --from is provided without --use-feed-time', async () => {
  await fetchMentions(mockClient, '177561', {
    keyword: '6798574',
    from: '2026-04-01',
  })
  const body = mockPost.mock.calls[0][1]
  expect(body.query.publishedTime?.from).toBe(new Date('2026-04-01').getTime())
  expect(body.query.feedTime).toBeDefined() // wide window still present
})
```

- [ ] **Step 2: Add three new describe blocks at the end of the outer `describe('fetchMentions')` block**

Append before the final closing `})` of `describe('fetchMentions', () => {`:

```typescript
describe('publishedTime filter (default when dates provided)', () => {
  it('sets publishedTime when --from provided without --use-feed-time', async () => {
    await fetchMentions(mockClient, '177561', {
      keyword: '6798574',
      from: '2026-04-15',
    })
    const body = mockPost.mock.calls[0][1]
    expect(body.query.publishedTime).toBeDefined()
    expect(body.query.publishedTime.from).toBe(new Date('2026-04-15').getTime())
  })

  it('sets wide feedTime window alongside publishedTime', async () => {
    const before = Date.now()
    await fetchMentions(mockClient, '177561', {
      keyword: '6798574',
      from: '2026-04-15',
    })
    const after = Date.now()
    const body = mockPost.mock.calls[0][1]
    // feedTime.from should be ~90 days before the call
    expect(body.query.feedTime.from).toBeLessThanOrEqual(before - 89 * 24 * 60 * 60 * 1000)
    // feedTime.to should be after the call (future)
    expect(body.query.feedTime.to).toBeGreaterThanOrEqual(after)
  })

  it('does not set publishedTime when no --from or --to provided', async () => {
    await fetchMentions(mockClient, '177561', { keyword: '6798574' })
    const body = mockPost.mock.calls[0][1]
    expect(body.query.publishedTime).toBeUndefined()
    expect(body.query.feedTime).toBeDefined()
  })
})

describe('--use-feed-time flag', () => {
  it('sets feedTime (not publishedTime) when --use-feed-time is set', async () => {
    await fetchMentions(mockClient, '177561', {
      keyword: '6798574',
      from: '2026-04-15',
      to: '2026-04-16',
      useFeedTime: true,
    })
    const body = mockPost.mock.calls[0][1]
    expect(body.query.publishedTime).toBeUndefined()
    expect(body.query.feedTime.from).toBe(new Date('2026-04-15').getTime())
  })

  it('snaps date-only --to even when --use-feed-time is set', async () => {
    await fetchMentions(mockClient, '177561', {
      keyword: '6798574',
      from: '2026-04-15',
      to: '2026-04-16',
      useFeedTime: true,
    })
    const body = mockPost.mock.calls[0][1]
    const expectedTo = new Date('2026-04-16').getTime() + 24 * 60 * 60 * 1000 - 1
    expect(body.query.feedTime.to).toBe(expectedTo)
  })
})

describe('end-of-day snapping for --to', () => {
  it('snaps date-only --to to 23:59:59.999Z', async () => {
    await fetchMentions(mockClient, '177561', {
      keyword: '6798574',
      from: '2026-04-15',
      to: '2026-04-16',
    })
    const body = mockPost.mock.calls[0][1]
    const expectedTo = new Date('2026-04-16').getTime() + 24 * 60 * 60 * 1000 - 1
    expect(body.query.publishedTime.to).toBe(expectedTo)
  })

  it('does not snap full datetime --to', async () => {
    await fetchMentions(mockClient, '177561', {
      keyword: '6798574',
      from: '2026-04-15',
      to: '2026-04-16T12:00:00Z',
    })
    const body = mockPost.mock.calls[0][1]
    expect(body.query.publishedTime.to).toBe(new Date('2026-04-16T12:00:00Z').getTime())
  })

  it('does not snap relative --to (e.g. 7d)', async () => {
    await fetchMentions(mockClient, '177561', {
      keyword: '6798574',
      from: '7d',
    })
    const body = mockPost.mock.calls[0][1]
    // publishedTime should be set (from was provided) and to defaults to approx now
    expect(body.query.publishedTime).toBeDefined()
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
npm test -- mentions
```

Expected output: multiple failing tests. The updated test in "request body construction" and all tests in the three new describe blocks should fail. Existing passing tests must remain green.

- [ ] **Step 4: Add `isDateOnly` and `snapToEndOfDay` to `mentions.ts`**

Open `src/commands/mentions.ts`. After the import block (line 4), add the two helper functions:

```typescript
function isDateOnly(input: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(input)
}

function snapToEndOfDay(ms: number): number {
  return ms + 24 * 60 * 60 * 1000 - 1
}
```

- [ ] **Step 5: Replace the date logic in `buildBody`**

In `src/commands/mentions.ts`, replace the current date block at the end of `buildBody` (lines 48–53):

```typescript
  // Always include feedTime — the API returns 502 when omitted.
  // Default: last 7 days → now when no range is specified.
  body.query.feedTime = {
    from: options.from ? parseDate(options.from) : Date.now() - 7 * 24 * 60 * 60 * 1000,
    to: options.to ? parseDate(options.to) : Date.now(),
  }
```

With:

```typescript
  const now = Date.now()
  const fromMs = options.from ? parseDate(options.from) : null
  let toMs = options.to ? parseDate(options.to) : null

  // Snap bare YYYY-MM-DD --to values to end-of-day (23:59:59.999Z).
  // Full datetimes and relative inputs are left unchanged.
  if (toMs !== null && options.to && isDateOnly(options.to)) {
    toMs = snapToEndOfDay(toMs)
  }

  if (fromMs !== null || toMs !== null) {
    if (options.useFeedTime) {
      // Explicit crawl-date filtering: feedTime = from→to, no publishedTime.
      body.query.feedTime = {
        from: fromMs ?? now - 7 * 24 * 60 * 60 * 1000,
        to: toMs ?? now,
      }
    } else {
      // Default: filter by publish date.
      // feedTime must always be present (API returns 502 without it);
      // use a wide window that will never exclude a relevant crawl.
      body.query.publishedTime = {
        from: fromMs ?? now - 7 * 24 * 60 * 60 * 1000,
        to: toMs ?? now,
      }
      body.query.feedTime = {
        from: now - 90 * 24 * 60 * 60 * 1000,
        to: now + 24 * 60 * 60 * 1000,
      }
    }
  } else {
    // No date filter provided: use feedTime last 7 days (unchanged default).
    body.query.feedTime = {
      from: now - 7 * 24 * 60 * 60 * 1000,
      to: now,
    }
  }
```

- [ ] **Step 6: Run tests and verify all pass**

```bash
npm test -- mentions
```

Expected: all tests pass. Run the full suite to confirm nothing else regressed:

```bash
npm test
```

Expected: all tests pass (83+ passing, 0 failing).

- [ ] **Step 7: Commit**

```bash
git add tests/commands/mentions.test.ts src/commands/mentions.ts
git commit -m "feat: filter by publishedTime by default; add --use-feed-time toggle and end-of-day snapping"
```

---

## Task 3: Wire `--use-feed-time` flag in the CLI

**Files:**
- Modify: `src/cli.ts` (mentions command block, lines 21–65)

- [ ] **Step 1: Add the `--use-feed-time` option declaration**

In `src/cli.ts`, find the mentions command block. After the `--json` option line (line 37), add:

```typescript
  .option('--use-feed-time', 'Filter by crawl/ingestion date instead of publish date (default: publish date)')
```

The full updated option list for context:

```typescript
program
  .command('mentions')
  .description('Fetch mentions from a keyword or group')
  .option('--keyword <id>', 'Keyword ID')
  .option('--group <id>', 'Group ID (optional when --keyword is provided)')
  .option('--org <id>', 'Organisation ID (overrides DETERM_ORG_ID env var)')
  .option('--token <key>', 'Access token (overrides DETERM_ACCESS_TOKEN env var)')
  .option('--from <date>', 'Start date: ISO 8601 (2026-04-01) or relative (24h, 7d, 30d)')
  .option('--to <date>', 'End date: ISO 8601 or relative')
  .option('--sentiment <value>', 'Filter sentiment: POSITIVE | NEGATIVE | NEUTRAL | UNDEFINED')
  .option('--type <value>', 'Filter source type: WEB | TWITTER | INSTAGRAM | REDDIT | YOUTUBE | ...')
  .option('--tag <id>', 'Filter by tag ID')
  .option('--count <n>', 'Results per page (default: 20)', '20')
  .option('--all', 'Auto-paginate through all pages')
  .option('--fields <fields>', 'Comma-separated fields to include (default: all)')
  .option('--sort-by <property>', 'Sort by: PUBLISHED_TIME | FEED_TIME | REACH | VIRALITY', 'FEED_TIME')
  .option('--sort-dir <direction>', 'Sort direction: ASC | DESC', 'DESC')
  .option('--use-feed-time', 'Filter by crawl/ingestion date instead of publish date (default: publish date)')
  .option('--json', 'Output raw JSON instead of TOON')
```

- [ ] **Step 2: Pass `useFeedTime` through to `fetchMentions`**

In the `.action()` handler, find the `fetchMentions` call (lines 45–59). Add `useFeedTime: options.useFeedTime` to the options object:

```typescript
      const output = await fetchMentions(client, config.orgId, {
        keyword: options.keyword,
        group: options.group,
        from: options.from,
        to: options.to,
        sentiment: options.sentiment,
        type: options.type,
        tag: options.tag,
        count: parseInt(options.count, 10),
        all: options.all,
        fields,
        sortBy: options.sortBy,
        sortDir: options.sortDir,
        useFeedTime: options.useFeedTime,
        json: options.json,
      })
```

- [ ] **Step 3: Build and smoke-test**

```bash
npm run build
node dist/cli.js mentions --keyword 6798574 --from 2026-04-15 --to 2026-04-16 --json 2>/dev/null | head -5
```

Expected: JSON output with at least the mentions array key (content depends on live API data).

- [ ] **Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "feat: wire --use-feed-time flag to mentions CLI command"
```

---

## Task 4: Wire `use_feed_time` in the MCP server

**Files:**
- Modify: `src/mcp-server.ts` (determ_mentions tool definition + handler, lines 46–222)

- [ ] **Step 1: Add `use_feed_time` to the `determ_mentions` inputSchema**

In `src/mcp-server.ts`, find the `determ_mentions` tool definition. After the `json` property (around line 110), add:

```typescript
          use_feed_time: {
            type: 'boolean',
            description:
              'Filter by crawl/ingestion date instead of publish date (default: publish date)',
          },
```

The full updated `properties` block for `determ_mentions` should include `use_feed_time` as the last entry before the closing brace:

```typescript
        properties: {
          keyword: { ... },
          group: { ... },
          from: { ... },
          to: { ... },
          sentiment: { ... },
          type: { ... },
          tag: { ... },
          count: { ... },
          all: { ... },
          sortBy: { ... },
          sortDir: { ... },
          fields: { ... },
          json: { ... },
          use_feed_time: {
            type: 'boolean',
            description:
              'Filter by crawl/ingestion date instead of publish date (default: publish date)',
          },
        },
```

- [ ] **Step 2: Pass `use_feed_time` through the MCP handler**

In the `CallToolRequestSchema` handler, find the `determ_mentions` branch (around line 208). Add `useFeedTime` to the options passed to `fetchMentions`:

```typescript
      output = await fetchMentions(client, config.orgId, {
        keyword: args.keyword as string | undefined,
        group: args.group as string | undefined,
        from: args.from as string | undefined,
        to: args.to as string | undefined,
        sentiment: args.sentiment as string | undefined,
        type: args.type as string | undefined,
        tag: args.tag as string | undefined,
        count: args.count as number | undefined,
        all: args.all as boolean | undefined,
        sortBy: args.sortBy as string | undefined,
        sortDir: args.sortDir as string | undefined,
        fields: parseFields(args.fields),
        useFeedTime: args.use_feed_time as boolean | undefined,
        json: args.json as boolean | undefined,
      })
```

- [ ] **Step 3: Build and verify**

```bash
npm run build
```

Expected: zero TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/mcp-server.ts
git commit -m "feat: add use_feed_time to determ_mentions MCP tool schema and handler"
```

---

## Task 5: Update SKILL.md

**Files:**
- Modify: `SKILL.md`

- [ ] **Step 1: Add `--use-feed-time` to the mentions options table**

In `SKILL.md`, find the `determ mentions` **Options** table. It currently ends with:

```
| `--sort-dir <dir>` | `DESC` | `ASC` \| `DESC` |
```

Add a new row after it:

```
| `--use-feed-time` | false | Filter by crawl/ingestion date instead of publish date |
```

- [ ] **Step 2: Update the "Key concepts" section**

Find the "feedTime vs publishedTime" paragraph under `## Key concepts`:

```
**feedTime vs publishedTime:** `--from`/`--to` filter by `feedTime` (when Determ ingested the mention). This is correct for real-time monitoring. `publishedTime` (when the source originally published) differs for backdated content.
```

Replace it with:

```
**feedTime vs publishedTime:** `--from`/`--to` filter by `publishedTime` (when the source originally published) by default — the right axis for PR coverage queries. Use `--use-feed-time` to filter by `feedTime` (when Determ ingested the mention) for real-time monitoring or crawl-date-specific queries. The API requires `feedTime` to be present; when filtering by `publishedTime`, a wide 90-day window is sent automatically.
```

- [ ] **Step 3: Update example snippets under `determ mentions`**

Find the `# Filter by date range` comment in the example block:

```bash
# Filter by date range (ISO 8601 or relative; default window is last 7 days)
determ mentions --keyword 6798574 --from 7d
determ mentions --keyword 6798574 --from 2026-04-01 --to 2026-04-15
```

Replace with:

```bash
# Filter by publish date (default — correct for PR coverage queries)
determ mentions --keyword 6798574 --from 7d
determ mentions --keyword 6798574 --from 2026-04-01 --to 2026-04-15

# Filter by crawl/ingestion date instead
determ mentions --keyword 6798574 --from 2026-04-01 --to 2026-04-15 --use-feed-time
```

- [ ] **Step 4: Commit**

```bash
git add SKILL.md
git commit -m "docs: update SKILL.md for publishedTime default and --use-feed-time flag"
```

---

## Done

All 83+ tests pass, the CLI accepts `--use-feed-time`, the MCP tool exposes `use_feed_time`, and SKILL.md reflects the new default behaviour.
