#!/usr/bin/env node
import { Command } from 'commander'
import dotenv from 'dotenv'
import { resolveConfig } from './config'
import { createClient } from './client'
import { fetchMentions } from './commands/mentions'
import { fetchTags } from './commands/tags'
import { fetchGroups } from './commands/groups'

dotenv.config()

const program = new Command()

program
  .name('determ')
  .description('CLI for the Determ (Mediatoolkit) media monitoring API — outputs TOON format for LLM use')
  .version('1.0.0')

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
  .option('--json', 'Output raw JSON instead of TOON')
  .action(async (options) => {
    try {
      const config = resolveConfig({ token: options.token, org: options.org })
      const client = createClient(config.accessToken)
      const fields = options.fields
        ? options.fields.split(',').map((f: string) => f.trim()).filter(Boolean)
        : undefined
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
        json: options.json,
      })
      console.log(output)
    } catch (err: unknown) {
      console.error(`Error: ${(err as Error).message}`)
      process.exit(1)
    }
  })

program
  .command('tags')
  .description('List all tags for the organisation')
  .option('--org <id>', 'Organisation ID (overrides DETERM_ORG_ID env var)')
  .option('--token <key>', 'Access token (overrides DETERM_ACCESS_TOKEN env var)')
  .option('--fields <fields>', 'Comma-separated fields to include (default: all)')
  .option('--json', 'Output raw JSON instead of TOON')
  .action(async (options) => {
    try {
      const config = resolveConfig({ token: options.token, org: options.org })
      const client = createClient(config.accessToken)
      const fields = options.fields
        ? options.fields.split(',').map((f: string) => f.trim()).filter(Boolean)
        : undefined
      const output = await fetchTags(client, config.orgId, {
        json: options.json,
        fields,
      })
      console.log(output)
    } catch (err: unknown) {
      console.error(`Error: ${(err as Error).message}`)
      process.exit(1)
    }
  })

program
  .command('groups')
  .description('List all groups (campaigns) and their topics (keywords) for the organisation')
  .option('--org <id>', 'Organisation ID (overrides DETERM_ORG_ID env var)')
  .option('--token <key>', 'Access token (overrides DETERM_ACCESS_TOKEN env var)')
  .option('--fields <fields>', 'Comma-separated fields to include (default: all)')
  .option('--json', 'Output raw JSON instead of TOON')
  .action(async (options) => {
    try {
      const config = resolveConfig({ token: options.token, org: options.org })
      const client = createClient(config.accessToken)
      const fields = options.fields
        ? options.fields.split(',').map((f: string) => f.trim()).filter(Boolean)
        : undefined
      const output = await fetchGroups(client, config.orgId, {
        json: options.json,
        fields,
      })
      console.log(output)
    } catch (err: unknown) {
      console.error(`Error: ${(err as Error).message}`)
      process.exit(1)
    }
  })

program.parse()
