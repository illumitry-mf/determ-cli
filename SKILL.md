---
name: determ-cli
description: Fetch media mentions, update mention metadata (tag, mark irrelevant, change sentiment), list groups/topics, and list tags from the Determ (Mediatoolkit) media monitoring API using the `determ` CLI. Use to discover group and topic IDs, retrieve press coverage, social media mentions, sentiment analysis, and tag listings for PR monitoring workflows.
user-invocable: true
metadata:
  openclaw:
    requires:
      bins:
        - determ
      install: "npm install -g illumitry-mf/determ-cli"
    keywords:
      - media monitoring
      - PR
      - mentions
      - determ
      - mediatoolkit
      - sentiment
      - social media
      - tag mention
      - irrelevant
      - update mention
---

# determ CLI

You have access to the `determ` CLI — a command-line tool for the Determ (Mediatoolkit) media monitoring API. Use it to discover groups and topics, fetch press and social media mentions, update mention metadata (tag, mark irrelevant, change sentiment), and list tags for a PR agency's monitoring workflows.

Output defaults to **TOON format** (Token-Oriented Object Notation) — a compact, LLM-optimised encoding that uses ~40% fewer tokens than JSON. Use `--json` when you need structured data to pass to other tools.

## Authentication & Setup

Credentials are resolved in priority order: CLI flags → environment variables → `~/.config/determ-cli/.determ-cli.json`.

```bash
# Recommended: set environment variables
export DETERM_ACCESS_TOKEN=your_access_token
export DETERM_ORG_ID=your_org_id

# Or pass inline on every call
determ mentions --keyword 6798574 --token your_token --org 177561
```

Config file format (`~/.config/determ-cli/.determ-cli.json`):
```json
{
  "accessToken": "your_access_token",
  "orgId": "your_org_id"
}
```

## Global flags

Every command supports these flags:

| Flag | Description |
|---|---|
| `--token <key>` | Access token (overrides `DETERM_ACCESS_TOKEN`) |
| `--org <id>` | Organisation ID (overrides `DETERM_ORG_ID`) |
| `--fields <f1,f2,...>` | Comma-separated field names to include (default: all) |
| `--json` | Output raw JSON instead of TOON |

## Commands

### `determ mentions`

Fetch mentions from a keyword or group using the scroll API.

```bash
# By keyword ID
determ mentions --keyword 6798574

# By group ID (all keywords in the group)
determ mentions --group 250240

# Both keyword and group (precise scope)
determ mentions --keyword 6798574 --group 250240

# Limit results
determ mentions --keyword 6798574 --count 10

# Paginate through all results
determ mentions --keyword 6798574 --all

# Filter by publish date (default — correct for PR coverage queries)
determ mentions --keyword 6798574 --from 7d
determ mentions --keyword 6798574 --from 2026-04-01 --to 2026-04-15

# Filter by crawl/ingestion date instead
determ mentions --keyword 6798574 --from 2026-04-01 --to 2026-04-15 --use-feed-time

# Include full article/post text
determ mentions --keyword 6798574 --full-text
determ mentions --keyword 6798574 --full-text --fields id,title,url,fullText

# Filter by sentiment
determ mentions --keyword 6798574 --sentiment NEGATIVE

# Filter by source type
determ mentions --keyword 6798574 --type TWITTER
determ mentions --keyword 6798574 --type WEB

# Filter by tag ID
determ mentions --keyword 6798574 --tag 24900

# Select specific fields
determ mentions --keyword 6798574 --fields id,title,url,fullText,autoSentiment,reach

# Get raw JSON
determ mentions --keyword 6798574 --json

# Combine filters (--count sets page size; --all fetches all pages)
determ mentions --keyword 6798574 --from 24h --sentiment POSITIVE --count 50 --all
```

**Options:**

| Flag | Default | Description |
|---|---|---|
| `--keyword <id>` | — | Keyword ID (required if no `--group`) |
| `--group <id>` | — | Group ID (required if no `--keyword`) |
| `--from <date>` | last 7 days | Start date: ISO 8601 or relative (`24h`, `7d`, `30d`) |
| `--to <date>` | now | End date: ISO 8601 or relative |
| `--sentiment <value>` | — | `POSITIVE` \| `NEGATIVE` \| `NEUTRAL` \| `UNDEFINED` |
| `--type <value>` | — | `WEB` \| `TWITTER` \| `INSTAGRAM` \| `REDDIT` \| `YOUTUBE` \| `FACEBOOK` \| `FORUM` \| `COMMENT` \| `DISQUS` \| `TRIPADVISOR` \| `VKONTAKTE` |
| `--tag <id>` | — | Tag ID (use `determ tags` to find IDs) |
| `--count <n>` | `20` | Results per page |
| `--all` | false | Auto-paginate through all results |
| `--sort-by <property>` | `FEED_TIME` | `PUBLISHED_TIME` \| `FEED_TIME` \| `REACH` \| `VIRALITY` |
| `--sort-dir <dir>` | `DESC` | `ASC` \| `DESC` |
| `--use-feed-time` | false | Filter by crawl/ingestion date instead of publish date |
| `--full-text` | false | Include full article/post text (API returns empty `fullText` without this) |

**Mention fields available for `--fields`:**

Core: `id`, `type`, `title`, `url`, `fullText`, `from`, `author`, `autoSentiment`, `reach`, `virality`, `interaction`, `influenceScore`, `description`, `insertTime`, `databaseInsertTime`, `languages`, `locations`, `keywords`, `keywordId`, `keywordName`, `groupId`, `groupName`

Twitter-specific: `retweetCount`, `favoriteCount`, `replyCount`, `quoteCount`, `followersCount`, `twitterHandle`, `engagementRate`, `prValue`, `tweetType`

Reddit-specific: `subreddit`, `redditType`, `redditScore`

### `determ groups`

List all groups (campaigns) and their topics (keywords) — **run this first to discover IDs** before using `mentions`.

> In the Determ UI, "groups" are campaigns and "keywords" are called "topics".

```bash
# List all groups and topics
determ groups

# JSON output
determ groups --json

# Only group/topic IDs and names
determ groups --fields id,name
```

**Output fields:** `id`, `name`, `topics` (array of `{ id, name, active }`)

Use the IDs here in `determ mentions --keyword <id>` or `--group <id>`.

---

### `determ tags`

List all tags defined in the organisation.

```bash
# List all tags
determ tags

# JSON output
determ tags --json

# Only tag IDs and names
determ tags --fields id,name
```

Tags are used for filtering mentions with `determ mentions --tag <id>`.

### `determ update-mention`

Tag one or more mentions, mark them as irrelevant (removes from feed), or override their sentiment. Requires a group ID and at least one operation flag. Multiple mentions can be updated in a single call.

> **Tip:** Run `determ groups` to find group IDs, and `determ tags` to find tag IDs before updating.

```bash
# Apply a tag to a mention
determ update-mention --group 250240 --mentions "6583047235:web" --tag-id 7905

# Tag multiple mentions at once
determ update-mention --group 250240 --mentions "6583047235:web,3452284869:instagram" --tag-id 7905

# Mark as irrelevant (removes from feed)
determ update-mention --group 250240 --mentions "6583047235:web" --irrelevant

# Override sentiment
determ update-mention --group 250240 --mentions "6583047235:web" --sentiment positive

# Combine: tag + mark irrelevant in one call
determ update-mention --group 250240 --mentions "6583047235:web" --tag-id 7905 --irrelevant

# Scope to a specific keyword feed (mention appears in multiple feeds)
determ update-mention --group 250240 --mentions "6583047235:web" --keyword 6798574 --irrelevant

# Raw JSON response
determ update-mention --group 250240 --mentions "6583047235:web" --tag-id 7905 --json
```

**Options:**

| Flag | Description |
|---|---|
| `--group <id>` | **Required.** Group ID (used in API path) |
| `--mentions <pairs>` | **Required.** Comma-separated `mentionId:sourceType` pairs (e.g. `"123:web,456:twitter"`) |
| `--tag-id <id>` | Tag ID to apply to the mention(s) |
| `--category-id <id>` | Tag category ID (used alongside `--tag-id`) |
| `--irrelevant` | Mark mention(s) as irrelevant (removes from feed) |
| `--sentiment <value>` | Override sentiment: `positive` \| `negative` \| `neutral` |
| `--keyword <id>` | Scope update to one keyword feed |

**Source types for `--mentions`:** `web`, `twitter`, `instagram`, `facebook`, `reddit`, `youtube`, `forum`, `comment`, `disqus`, `vkontakte`, `trip_advisor`

At least one of `--tag-id`, `--irrelevant`, or `--sentiment` must be provided.

---

## Key concepts

**feedTime vs publishedTime:** `--from`/`--to` filter by `publishedTime` (when the source originally published) by default — the right axis for PR coverage queries. Use `--use-feed-time` to filter by `feedTime` (when Determ ingested the mention) for real-time monitoring or crawl-date-specific queries. The API requires `feedTime` to be present; when filtering by `publishedTime`, a wide 90-day window is sent automatically. When no `--from`/`--to` is provided at all, the default is a 7-day `feedTime` window (crawl date); specify `--from 7d` explicitly to apply the same range via `publishedTime` instead.

**Keyword vs Group:** A keyword tracks a specific search term. A group contains multiple keywords. Use `--keyword` for a focused query; use `--group` for all coverage across a campaign.

**TOON output:** The default TOON format uses headers like `mentions[N]{field1,field2,...}:` followed by comma-separated rows. Pass it directly to an LLM — it parses naturally and uses far fewer tokens than JSON.

## Tips

- Use `--fields id,title,url,fullText,autoSentiment` for a concise summary pass to an LLM before deciding which mentions to analyse fully.
- Use `--all` carefully with large date ranges — it will paginate until exhausted. Combine with `--from 24h` for daily briefs.
- Use `--json` and pipe to `jq` when you need to extract specific fields programmatically: `determ mentions --keyword 6798574 --json | jq '.mentions[].url'`
- **Start with `determ groups`** to discover all group and topic IDs — you need these for `determ mentions`.
- To find tag IDs: run `determ tags` first, note the IDs, then use `--tag <id>` in your mentions query.
- `--count 100` is the practical maximum per page; the API may return fewer depending on filters and enforces its own server-side cap.
