# Design: Publish Date Filter for `determ mentions`

**Date:** 2026-04-16  
**Status:** Approved

## Problem

`--from`/`--to` on `determ mentions` currently filter by `feedTime` (when Determ crawled the mention), not by `publishedTime` (when the source actually published it). For a PR agency querying "show me coverage from April 15–16", crawl date is the wrong axis — an article published April 15 may not be crawled until April 16.

A second issue: `--to 2026-04-16` resolves to `2026-04-16T00:00:00.000Z` (start of day), so any mention published or crawled after midnight UTC on April 16 is excluded. Users expect the full day to be included.

---

## Solution

1. Make `--from`/`--to` filter `publishedTime` by default.
2. Add `--use-feed-time` toggle to restore crawl-date filtering when needed.
3. When `--to` is a bare date (`YYYY-MM-DD`), snap to `23:59:59.999Z` (end of day).

---

## Behaviour Matrix

| `--from`/`--to` | `--use-feed-time` | API request |
|---|---|---|
| not provided | — | `feedTime` last 7 days (unchanged default) |
| provided | not set | `publishedTime` = from→to; `feedTime` = [now−90d, now+1d] |
| provided | set | `feedTime` = from→to; no `publishedTime` |

The `feedTime` wide window ([now−90d, now+1d]) is required because the API returns 502 when `feedTime` is omitted. It is wide enough to never accidentally exclude a relevant crawl.

---

## End-of-Day Snapping

Applied only to the `--to` value, and only when the raw input is a bare date (`YYYY-MM-DD`):

```
--to 2026-04-16             → 2026-04-16T23:59:59.999Z  (snapped)
--to 2026-04-16T12:00:00Z   → 2026-04-16T12:00:00.000Z  (unchanged)
--to 7d                     → relative, unchanged
```

`--from` is not snapped — midnight start-of-day is correct for the lower bound.

---

## CLI Interface

```bash
# Default: filter by publish date (new behaviour)
determ mentions --keyword 6798574 --from 2026-04-15 --to 2026-04-16

# Explicit crawl-date filtering
determ mentions --keyword 6798574 --from 2026-04-15 --to 2026-04-16 --use-feed-time
```

New flag:

| Flag | Description |
|---|---|
| `--use-feed-time` | Filter by crawl/ingestion date instead of publish date |

---

## MCP Tool Interface

New property added to `determ_mentions` inputSchema:

```json
{
  "use_feed_time": {
    "type": "boolean",
    "description": "Filter by crawl/ingestion date instead of publish date (default: publish date)"
  }
}
```

---

## Architecture

### Files changed

| File | Change |
|---|---|
| `src/commands/mentions.ts` | Add `isDateOnly`, `snapToEndOfDay`; update `buildBody` |
| `src/types.ts` | Add `useFeedTime?: boolean` to `MentionsOptions` |
| `src/cli.ts` | Register `--use-feed-time` flag |
| `src/mcp-server.ts` | Add `use_feed_time` to schema + handler |

### `buildBody` logic (pseudocode)

```
toMs = options.to ? parseDate(options.to) : null
if toMs and isDateOnly(options.to):
  toMs = snapToEndOfDay(toMs)

fromMs = options.from ? parseDate(options.from) : null

if fromMs or toMs:
  if options.useFeedTime:
    body.query.feedTime = { from: fromMs ?? (now - 7d), to: toMs ?? now }
  else:
    body.query.publishedTime = { from: fromMs ?? (now - 7d), to: toMs ?? now }
    body.query.feedTime = { from: now - 90d, to: now + 1d }
else:
  body.query.feedTime = { from: now - 7d, to: now }   // unchanged default
```

### Helper functions (in `mentions.ts`)

```typescript
function isDateOnly(input: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(input)
}

function snapToEndOfDay(ms: number): number {
  return ms + 24 * 60 * 60 * 1000 - 1  // add 23h 59m 59s 999ms
}
```

---

## Error Handling

No new error cases. `parseDate` already throws on invalid input. The `--use-feed-time` flag is boolean — no value to validate.

---

## Testing

- `isDateOnly` — pure function, unit tested with date-only, datetime, and relative inputs
- `snapToEndOfDay` — unit tested: input midnight UTC → output 23:59:59.999Z same day
- `buildBody` — existing tests cover the no-date-filter default; new tests cover:
  - `--from`/`--to` without `--use-feed-time` → `publishedTime` set, `feedTime` is wide window
  - `--from`/`--to` with `--use-feed-time` → `feedTime` set, no `publishedTime`
  - date-only `--to` → snapped to end of day
  - full datetime `--to` → not snapped
- Existing passing tests must remain green
