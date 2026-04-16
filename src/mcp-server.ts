#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import dotenv from 'dotenv'
import { resolveConfig } from './config'
import { createClient } from './client'
import { fetchMentions } from './commands/mentions'
import { fetchTags } from './commands/tags'
import { fetchGroups } from './commands/groups'
import { updateMentions } from './commands/update-mention'

dotenv.config()

const server = new Server(
  { name: 'determ-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'determ_groups',
      description:
        'List all Determ monitoring groups (campaigns) and their topics (keywords). Run this first to discover group and keyword IDs needed for determ_mentions.',
      inputSchema: {
        type: 'object',
        properties: {
          json: {
            type: 'boolean',
            description: 'Return raw JSON instead of TOON compact format',
          },
          fields: {
            type: 'string',
            description: 'Comma-separated field names to include (e.g. "id,name")',
          },
        },
        required: [],
      },
    },
    {
      name: 'determ_mentions',
      description:
        'Fetch media mentions from a Determ keyword or group. Requires at least one of keyword or group. Use determ_groups to find IDs.',
      inputSchema: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: 'Keyword (topic) ID',
          },
          group: {
            type: 'string',
            description: 'Group (campaign) ID',
          },
          from: {
            type: 'string',
            description:
              'Start date: ISO 8601 (2026-04-01) or relative (24h, 7d, 30d). Defaults to last 7 days.',
          },
          to: {
            type: 'string',
            description: 'End date: ISO 8601 or relative. Defaults to now.',
          },
          sentiment: {
            type: 'string',
            enum: ['POSITIVE', 'NEGATIVE', 'NEUTRAL', 'UNDEFINED'],
            description: 'Filter by sentiment',
          },
          type: {
            type: 'string',
            enum: [
              'WEB', 'TWITTER', 'INSTAGRAM', 'REDDIT', 'YOUTUBE',
              'FACEBOOK', 'FORUM', 'COMMENT', 'DISQUS', 'TRIPADVISOR', 'VKONTAKTE',
            ],
            description: 'Filter by source type',
          },
          tag: {
            type: 'string',
            description: 'Filter by tag ID (use determ_tags to find IDs)',
          },
          count: {
            type: 'number',
            description: 'Results per page (default: 20, max: 100)',
          },
          all: {
            type: 'boolean',
            description: 'Auto-paginate through all results',
          },
          sortBy: {
            type: 'string',
            enum: ['FEED_TIME', 'PUBLISHED_TIME', 'REACH', 'VIRALITY'],
            description: 'Sort property (default: FEED_TIME)',
          },
          sortDir: {
            type: 'string',
            enum: ['ASC', 'DESC'],
            description: 'Sort direction (default: DESC)',
          },
          fields: {
            type: 'string',
            description:
              'Comma-separated fields to return (e.g. "id,title,url,fullText,autoSentiment,reach")',
          },
          json: {
            type: 'boolean',
            description: 'Return raw JSON instead of TOON compact format',
          },
          use_feed_time: {
            type: 'boolean',
            description:
              'Filter by crawl/ingestion date instead of publish date (default: publish date)',
          },
          include_full_text: {
            type: 'boolean',
            description:
              'Include full article/post text in results. By default fullText is empty; set this to true to retrieve the complete body.',
          },
        },
        required: [],
      },
    },
    {
      name: 'determ_tags',
      description: 'List all tags defined in the Determ organisation. Use tag IDs with determ_mentions --tag to filter mentions.',
      inputSchema: {
        type: 'object',
        properties: {
          json: {
            type: 'boolean',
            description: 'Return raw JSON instead of TOON compact format',
          },
          fields: {
            type: 'string',
            description: 'Comma-separated field names to include (e.g. "id,name")',
          },
        },
        required: [],
      },
    },
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
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params
  const config = resolveConfig({})
  const client = createClient(config.accessToken)

  function parseFields(fields: unknown): string[] | undefined {
    if (typeof fields !== 'string' || !fields) return undefined
    return fields.split(',').map((f) => f.trim()).filter(Boolean)
  }

  try {
    let output: string

    if (name === 'determ_groups') {
      output = await fetchGroups(client, config.orgId, {
        json: args.json as boolean | undefined,
        fields: parseFields(args.fields),
      })
    } else if (name === 'determ_mentions') {
      if (!args.keyword && !args.group) {
        throw new Error('At least one of "keyword" or "group" is required')
      }
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
        fullText: args.include_full_text as boolean | undefined,
        json: args.json as boolean | undefined,
      })
    } else if (name === 'determ_tags') {
      output = await fetchTags(client, config.orgId, {
        json: args.json as boolean | undefined,
        fields: parseFields(args.fields),
      })
    } else if (name === 'determ_update_mention') {
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
    } else {
      throw new Error(`Unknown tool: ${name}`)
    }

    return { content: [{ type: 'text', text: output }] }
  } catch (err: unknown) {
    return {
      content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
      isError: true,
    }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`)
  process.exit(1)
})
