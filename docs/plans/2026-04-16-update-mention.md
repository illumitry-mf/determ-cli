# Update Mention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `determ update-mention` CLI command and `determ_update_mention` MCP tool that tag, mark irrelevant, or change sentiment on one or more Determ mentions via the v1 API.

**Architecture:** One new command module (`update-mention.ts`) exports `parseMentions` and `updateMentions`. Both the CLI and MCP server import these; no logic is duplicated. New types are added to `types.ts` first, so every subsequent task can import them cleanly.

**Tech Stack:** TypeScript, axios (existing client), commander (existing CLI), vitest, @modelcontextprotocol/sdk (existing MCP server)

---

## File Map

| Action | Path |
|---|---|
| Create | `src/commands/update-mention.ts` |
| Create | `tests/commands/update-mention.test.ts` |
| Modify | `src/types.ts` |
| Modify | `src/cli.ts` |
| Modify | `src/mcp-server.ts` |

---

### Task 1: Add types to `src/types.ts`

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add the four new types**

Append to the bottom of `src/types.ts`:

```typescript
// v1 Update Mention
export interface MentionRef {
  mention_id: number
  source_type: string
}

export interface UpdateMentionRequest {
  selected_mention_ids: MentionRef[]
  tag_id?: number
  category_id?: number
  irrelevant?: boolean
  sentiment?: 'positive' | 'negative' | 'neutral'
  keyword_id?: number
}

export interface UpdateMentionResponse {
  code: number
  message: string
  data: {
    message_code: string
    message_transformed: string
  }
}

export interface UpdateMentionOptions {
  group: string
  mentions: string     // "mentionId:sourceType,..." comma-separated pairs
  tagId?: string
  categoryId?: string
  irrelevant?: boolean
  sentiment?: string
  keyword?: string
  json?: boolean
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add UpdateMention types to types.ts"
```

---

### Task 2: Write failing tests for `update-mention`

**Files:**
- Create: `tests/commands/update-mention.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// tests/commands/update-mention.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { AxiosInstance } from 'axios'
import { parseMentions, updateMentions } from '../../src/commands/update-mention'

const mockPost = vi.fn()
const mockClient = { post: mockPost } as unknown as AxiosInstance

const okResponse = {
  data: {
    code: 1,
    message: 'OK',
    data: { message_code: 'OK', message_transformed: 'ok' },
  },
}

describe('parseMentions', () => {
  it('parses a single mention pair', () => {
    expect(parseMentions('123:web')).toEqual([
      { mention_id: 123, source_type: 'web' },
    ])
  })

  it('parses multiple mention pairs', () => {
    expect(parseMentions('123:web,456:twitter')).toEqual([
      { mention_id: 123, source_type: 'web' },
      { mention_id: 456, source_type: 'twitter' },
    ])
  })

  it('normalizes uppercase source type to lowercase', () => {
    expect(parseMentions('123:WEB')).toEqual([
      { mention_id: 123, source_type: 'web' },
    ])
  })

  it('maps TRIPADVISOR to trip_advisor', () => {
    expect(parseMentions('123:TRIPADVISOR')).toEqual([
      { mention_id: 123, source_type: 'trip_advisor' },
    ])
  })

  it('maps tripadvisor to trip_advisor', () => {
    expect(parseMentions('123:tripadvisor')).toEqual([
      { mention_id: 123, source_type: 'trip_advisor' },
    ])
  })

  it('throws on missing colon separator', () => {
    expect(() => parseMentions('123')).toThrow('"123"')
  })

  it('throws on non-numeric mention ID', () => {
    expect(() => parseMentions('abc:web')).toThrow('"abc"')
  })
})

describe('updateMentions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPost.mockResolvedValue(okResponse)
  })

  it('calls the correct v1 endpoint', async () => {
    await updateMentions(mockClient, '177561', {
      group: '250240',
      mentions: '123:web',
      tagId: '7905',
    })
    expect(mockPost).toHaveBeenCalledWith(
      '/organizations/177561/groups/250240/mentions/meta',
      expect.any(Object)
    )
  })

  it('sends selected_mention_ids in the request body', async () => {
    await updateMentions(mockClient, '177561', {
      group: '250240',
      mentions: '123:web,456:twitter',
      irrelevant: true,
    })
    const body = mockPost.mock.calls[0][1]
    expect(body.selected_mention_ids).toEqual([
      { mention_id: 123, source_type: 'web' },
      { mention_id: 456, source_type: 'twitter' },
    ])
  })

  it('sends tag_id when tagId is provided', async () => {
    await updateMentions(mockClient, '177561', {
      group: '250240',
      mentions: '123:web',
      tagId: '7905',
    })
    const body = mockPost.mock.calls[0][1]
    expect(body.tag_id).toBe(7905)
  })

  it('sends category_id when categoryId is provided', async () => {
    await updateMentions(mockClient, '177561', {
      group: '250240',
      mentions: '123:web',
      tagId: '7905',
      categoryId: '2152',
    })
    const body = mockPost.mock.calls[0][1]
    expect(body.category_id).toBe(2152)
  })

  it('sends irrelevant: true when irrelevant option is set', async () => {
    await updateMentions(mockClient, '177561', {
      group: '250240',
      mentions: '123:web',
      irrelevant: true,
    })
    const body = mockPost.mock.calls[0][1]
    expect(body.irrelevant).toBe(true)
  })

  it('sends lowercase sentiment when provided in uppercase', async () => {
    await updateMentions(mockClient, '177561', {
      group: '250240',
      mentions: '123:web',
      sentiment: 'POSITIVE',
    })
    const body = mockPost.mock.calls[0][1]
    expect(body.sentiment).toBe('positive')
  })

  it('sends lowercase sentiment when provided in lowercase', async () => {
    await updateMentions(mockClient, '177561', {
      group: '250240',
      mentions: '123:web',
      sentiment: 'negative',
    })
    const body = mockPost.mock.calls[0][1]
    expect(body.sentiment).toBe('negative')
  })

  it('sends keyword_id when keyword is provided', async () => {
    await updateMentions(mockClient, '177561', {
      group: '250240',
      mentions: '123:web',
      tagId: '7905',
      keyword: '6798574',
    })
    const body = mockPost.mock.calls[0][1]
    expect(body.keyword_id).toBe(6798574)
  })

  it('omits keyword_id when keyword is not provided', async () => {
    await updateMentions(mockClient, '177561', {
      group: '250240',
      mentions: '123:web',
      irrelevant: true,
    })
    const body = mockPost.mock.calls[0][1]
    expect(body.keyword_id).toBeUndefined()
  })

  it('throws when no operation flag is provided', async () => {
    await expect(
      updateMentions(mockClient, '177561', {
        group: '250240',
        mentions: '123:web',
      })
    ).rejects.toThrow('--tag-id, --irrelevant, or --sentiment')
  })

  it('returns confirmation message with mention count on success', async () => {
    const result = await updateMentions(mockClient, '177561', {
      group: '250240',
      mentions: '123:web,456:twitter',
      irrelevant: true,
    })
    expect(result).toBe('Updated 2 mention(s).')
  })

  it('returns raw JSON when json option is true', async () => {
    const result = await updateMentions(mockClient, '177561', {
      group: '250240',
      mentions: '123:web',
      irrelevant: true,
      json: true,
    })
    const parsed = JSON.parse(result)
    expect(parsed.message).toBe('OK')
  })
})
```

- [ ] **Step 2: Run tests — verify they all fail with "cannot find module"**

```bash
npm test -- update-mention
```

Expected: FAIL — `Cannot find module '../../src/commands/update-mention'`

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/commands/update-mention.test.ts
git commit -m "test: add failing tests for update-mention command"
```

---

### Task 3: Implement `src/commands/update-mention.ts`

**Files:**
- Create: `src/commands/update-mention.ts`

- [ ] **Step 1: Create the implementation file**

```typescript
// src/commands/update-mention.ts
import { AxiosInstance } from 'axios'
import {
  MentionRef,
  UpdateMentionRequest,
  UpdateMentionResponse,
  UpdateMentionOptions,
} from '../types'

const SOURCE_TYPE_MAP: Record<string, string> = {
  tripadvisor: 'trip_advisor',
}

export function parseMentions(mentionsStr: string): MentionRef[] {
  return mentionsStr.split(',').map((part) => {
    const colonIdx = part.indexOf(':')
    if (colonIdx === -1) {
      throw new Error(
        `Invalid mention format "${part}" — expected mentionId:sourceType (e.g. "123:web")`
      )
    }
    const rawId = part.slice(0, colonIdx)
    const rawType = part.slice(colonIdx + 1)
    const mentionId = parseInt(rawId, 10)
    if (isNaN(mentionId)) {
      throw new Error(`Invalid mention ID "${rawId}" — must be a number`)
    }
    const lower = rawType.toLowerCase()
    return {
      mention_id: mentionId,
      source_type: SOURCE_TYPE_MAP[lower] ?? lower,
    }
  })
}

export async function updateMentions(
  client: AxiosInstance,
  orgId: string,
  options: UpdateMentionOptions
): Promise<string> {
  if (!options.tagId && !options.irrelevant && !options.sentiment) {
    throw new Error(
      'Specify at least one of --tag-id, --irrelevant, or --sentiment'
    )
  }

  const selected_mention_ids = parseMentions(options.mentions)

  const body: UpdateMentionRequest = { selected_mention_ids }

  if (options.tagId) body.tag_id = parseInt(options.tagId, 10)
  if (options.categoryId) body.category_id = parseInt(options.categoryId, 10)
  if (options.irrelevant) body.irrelevant = true
  if (options.sentiment) {
    body.sentiment = options.sentiment.toLowerCase() as
      | 'positive'
      | 'negative'
      | 'neutral'
  }
  if (options.keyword) body.keyword_id = parseInt(options.keyword, 10)

  const endpoint = `/organizations/${orgId}/groups/${options.group}/mentions/meta`
  const { data } = await client.post<UpdateMentionResponse>(endpoint, body)

  if (options.json) {
    return JSON.stringify(data, null, 2)
  }

  return `Updated ${selected_mention_ids.length} mention(s).`
}
```

- [ ] **Step 2: Run tests — verify they all pass**

```bash
npm test -- update-mention
```

Expected: all tests PASS.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/commands/update-mention.ts
git commit -m "feat: implement update-mention command"
```

---

### Task 4: Wire the CLI command in `src/cli.ts`

**Files:**
- Modify: `src/cli.ts`

- [ ] **Step 1: Add the import**

In `src/cli.ts`, add this import alongside the existing command imports (after the `fetchGroups` import):

```typescript
import { updateMentions } from './commands/update-mention'
```

- [ ] **Step 2: Register the command**

Append this block to `src/cli.ts` immediately before the `program.parse()` call at the bottom:

```typescript
program
  .command('update-mention')
  .description('Tag, mark irrelevant, or change sentiment on one or more mentions')
  .requiredOption('--group <id>', 'Group ID (required — used in API path)')
  .requiredOption(
    '--mentions <pairs>',
    'Comma-separated mentionId:sourceType pairs (e.g. "123:web,456:twitter")'
  )
  .option('--tag-id <id>', 'Tag ID to apply to the mention(s)')
  .option('--category-id <id>', 'Tag category ID (used alongside --tag-id)')
  .option('--irrelevant', 'Mark mention(s) as irrelevant (removes from feed)')
  .option('--sentiment <value>', 'Set sentiment: positive | negative | neutral')
  .option('--keyword <id>', 'Scope update to one keyword feed')
  .option('--org <id>', 'Organisation ID (overrides DETERM_ORG_ID env var)')
  .option('--token <key>', 'Access token (overrides DETERM_ACCESS_TOKEN env var)')
  .option('--json', 'Output raw JSON response')
  .action(async (options) => {
    try {
      const config = resolveConfig({ token: options.token, org: options.org })
      const client = createClient(config.accessToken)
      const output = await updateMentions(client, config.orgId, {
        group: options.group,
        mentions: options.mentions,
        tagId: options.tagId,
        categoryId: options.categoryId,
        irrelevant: options.irrelevant,
        sentiment: options.sentiment,
        keyword: options.keyword,
        json: options.json,
      })
      console.log(output)
    } catch (err: unknown) {
      console.error(`Error: ${(err as Error).message}`)
      process.exit(1)
    }
  })
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 4: Smoke-test help output**

```bash
node dist/cli.js update-mention --help
```

Expected: shows usage with `--group`, `--mentions`, `--tag-id`, `--irrelevant`, `--sentiment`, `--keyword`, `--json` options.

- [ ] **Step 5: Run full test suite — no regressions**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/cli.ts
git commit -m "feat: register update-mention CLI command"
```

---

### Task 5: Wire the MCP tool in `src/mcp-server.ts`

**Files:**
- Modify: `src/mcp-server.ts`

- [ ] **Step 1: Add the import**

In `src/mcp-server.ts`, add this import alongside the existing command imports (after the `fetchGroups` import):

```typescript
import { updateMentions } from './commands/update-mention'
```

- [ ] **Step 2: Add the tool to the `ListTools` handler**

In the `tools` array inside `server.setRequestHandler(ListToolsRequestSchema, ...)`, append this entry after the `determ_tags` entry:

```typescript
{
  name: 'determ_update_mention',
  description:
    'Tag, mark irrelevant, or change sentiment on one or more Determ mentions. ' +
    'Requires group ID and at least one operation (tag_id, irrelevant, or sentiment). ' +
    'Use determ_groups to find group IDs and determ_tags to find tag IDs.',
  inputSchema: {
    type: 'object',
    properties: {
      group: {
        type: 'string',
        description: 'Group ID (required — used in API path)',
      },
      mentions: {
        type: 'string',
        description:
          'Comma-separated mentionId:sourceType pairs (e.g. "123:web,456:twitter"). ' +
          'Source types: web, twitter, instagram, facebook, reddit, youtube, forum, ' +
          'comment, disqus, vkontakte, trip_advisor',
      },
      tag_id: {
        type: 'number',
        description: 'Tag ID to apply to the mention(s)',
      },
      category_id: {
        type: 'number',
        description: 'Tag category ID (used alongside tag_id)',
      },
      irrelevant: {
        type: 'boolean',
        description: 'Mark mention(s) as irrelevant (removes from feed)',
      },
      sentiment: {
        type: 'string',
        enum: ['positive', 'negative', 'neutral'],
        description: 'Override the sentiment on the mention(s)',
      },
      keyword: {
        type: 'string',
        description: 'Keyword ID to scope the update to one keyword feed',
      },
      json: {
        type: 'boolean',
        description: 'Return raw JSON response',
      },
    },
    required: ['group', 'mentions'],
  },
},
```

- [ ] **Step 3: Add the `CallTool` handler branch**

In the `CallToolRequestSchema` handler, add this `else if` branch after the `determ_tags` branch (before the final `else` that throws `Unknown tool`):

```typescript
} else if (name === 'determ_update_mention') {
  if (!args.group) throw new Error('"group" is required')
  if (!args.mentions) throw new Error('"mentions" is required')
  output = await updateMentions(client, config.orgId, {
    group: args.group as string,
    mentions: args.mentions as string,
    tagId: args.tag_id !== undefined ? String(args.tag_id) : undefined,
    categoryId: args.category_id !== undefined ? String(args.category_id) : undefined,
    irrelevant: args.irrelevant as boolean | undefined,
    sentiment: args.sentiment as string | undefined,
    keyword: args.keyword as string | undefined,
    json: args.json as boolean | undefined,
  })
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build
```

Expected: exits 0, no errors.

- [ ] **Step 5: Run full test suite — no regressions**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/mcp-server.ts
git commit -m "feat: add determ_update_mention MCP tool"
```
