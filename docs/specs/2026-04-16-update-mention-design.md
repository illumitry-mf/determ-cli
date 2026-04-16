# Design: Update Mention Metadata

**Date:** 2026-04-16  
**Status:** Approved

## Summary

Add a new `update-mention` command to the CLI and a `determ_update_mention` tool to the MCP server. Both allow users to tag, mark irrelevant, or change the sentiment of one or more Determ mentions in a single call.

---

## API Endpoint

**v1 API** (same base as `groups` command):

```
POST https://api.mediatoolkit.com/organizations/{orgId}/groups/{groupId}/mentions/meta?access_token=...
```

Request body:
```json
{
  "selected_mention_ids": [
    { "mention_id": 123, "source_type": "web" },
    { "mention_id": 456, "source_type": "twitter" }
  ],
  "tag_id": 7905,
  "category_id": 2152,
  "irrelevant": true,
  "sentiment": "positive",
  "keyword_id": 99999
}
```

- `selected_mention_ids` is required; all other fields are optional but at least one must be present.
- `source_type` values use lowercase with underscores: `web`, `twitter`, `instagram`, `facebook`, `reddit`, `youtube`, `forum`, `comment`, `disqus`, `vkontakte`, `trip_advisor`.
- Multiple operations can be combined in one call (e.g. tag + irrelevant simultaneously).

Response (200 OK):
```json
{
  "code": 1,
  "message": "OK",
  "data": { "message_code": "OK", "message_transformed": "ok" }
}
```

---

## CLI Interface

```bash
determ update-mention \
  --group <id>         # REQUIRED — group ID (used in API path)
  --mentions <pairs>   # REQUIRED — comma-separated id:type pairs, e.g. "123:web,456:twitter"
  [--tag-id <id>]      # apply this tag to the mention(s)
  [--category-id <id>] # tag category (used alongside --tag-id)
  [--irrelevant]       # mark mention(s) as irrelevant (removes from feed)
  [--sentiment <val>]  # positive | negative | neutral
  [--keyword <id>]     # scope update to one keyword feed (optional)
  [--org <id>]         # override DETERM_ORG_ID
  [--token <key>]      # override DETERM_ACCESS_TOKEN
  [--json]             # output raw JSON response instead of plain confirmation
```

**Validation:**
- At least one of `--tag-id`, `--irrelevant`, or `--sentiment` must be provided; error otherwise.
- Each `--mentions` pair must be in `mentionId:sourceType` format; invalid pairs produce a clear error before any API call is made.

**Output:**
- Default: `Updated 2 mention(s).`
- `--json`: raw API response JSON

---

## MCP Tool: `determ_update_mention`

Schema mirrors the CLI flags exactly. `mentions` is the same `"id:type,..."` string format.

```json
{
  "name": "determ_update_mention",
  "description": "Tag, mark irrelevant, or change sentiment on one or more Determ mentions. Requires group ID and at least one operation (tag_id, irrelevant, or sentiment).",
  "inputSchema": {
    "type": "object",
    "properties": {
      "group":       { "type": "string", "description": "Group ID (required — used in API path)" },
      "mentions":    { "type": "string", "description": "Comma-separated mention pairs: mentionId:sourceType (e.g. '123:web,456:twitter')" },
      "tag_id":      { "type": "number", "description": "Tag ID to apply to the mention(s)" },
      "category_id": { "type": "number", "description": "Tag category ID (used alongside tag_id)" },
      "irrelevant":  { "type": "boolean", "description": "Mark mention(s) as irrelevant (removes from feed)" },
      "sentiment":   { "type": "string", "enum": ["positive", "negative", "neutral"], "description": "Override sentiment" },
      "keyword":     { "type": "string", "description": "Keyword ID to scope the update to one keyword feed" },
      "json":        { "type": "boolean", "description": "Return raw JSON response" }
    },
    "required": ["group", "mentions"]
  }
}
```

---

## Architecture

### New file

**`src/commands/update-mention.ts`**

- `parseMentions(str: string): MentionRef[]`  
  Splits on commas, then splits each token on the first colon. Normalizes source type to lowercase; maps `tripadvisor` → `trip_advisor`. Throws a descriptive error on malformed input before any network call.

- `updateMentions(client, orgId, options: UpdateMentionOptions): Promise<string>`  
  Validates at least one operation flag is set. Builds `UpdateMentionRequest`. POSTs to `/organizations/{orgId}/groups/{groupId}/mentions/meta`. Returns confirmation string or JSON.

### Modified files

| File | Change |
|---|---|
| `src/types.ts` | Add `MentionRef`, `UpdateMentionRequest`, `UpdateMentionResponse`, `UpdateMentionOptions` |
| `src/cli.ts` | Register `update-mention` command; wire options to `updateMentions()` |
| `src/mcp-server.ts` | Add `determ_update_mention` to `ListTools` and `CallTool` handlers |

No changes to `client.ts`, `formatters.ts`, or `utils/date.ts`.

---

## Source Type Normalization

The v2 fetch API uses uppercase (`WEB`, `TWITTER`, `TRIPADVISOR`); the v1 update API uses lowercase with underscores (`web`, `twitter`, `trip_advisor`). The normalization map:

```
TRIPADVISOR | tripadvisor → trip_advisor
everything else → toLowerCase()
```

Accept any case from the user; normalize silently.

---

## Error Handling

| Condition | Behaviour |
|---|---|
| Missing `--group` or `--mentions` | Commander shows usage; error before network call |
| No operation flag provided | Error: "Specify at least one of --tag-id, --irrelevant, or --sentiment" |
| Malformed mention pair (no colon, non-numeric ID) | Error with the offending token, before network call |
| API 4xx/5xx | Existing `client.ts` interceptor surfaces HTTP errors |
| API returns non-OK `message_code` | Surface `data.message_code` in error message |
