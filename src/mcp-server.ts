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
        json: args.json as boolean | undefined,
      })
    } else if (name === 'determ_tags') {
      output = await fetchTags(client, config.orgId, {
        json: args.json as boolean | undefined,
        fields: parseFields(args.fields),
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
