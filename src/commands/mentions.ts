import { AxiosInstance } from 'axios'
import { MentionsRequest, MentionsResponse, MentionsOptions } from '../types'
import { formatOutput } from '../formatters'
import { parseDate } from '../utils/date'

function isDateOnly(input: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(input)
}

function snapToEndOfDay(ms: number): number {
  return ms + 24 * 60 * 60 * 1000 - 1
}

function buildEndpoint(orgId: string, keyword?: string, group?: string): string {
  if (keyword && group) {
    return `/v2/organization/${orgId}/group/${group}/keyword/${keyword}/mentions/scroll`
  }
  if (group) {
    return `/v2/organization/${orgId}/group/${group}/mentions/scroll`
  }
  return `/v2/organization/${orgId}/keyword/${keyword}/mentions/scroll`
}

function buildBody(options: MentionsOptions, scrollToken?: string): MentionsRequest {
  const body: MentionsRequest = {
    query: {},
    paged: {
      count: options.count ?? 20,
      sorted: {
        direction: (options.sortDir as 'ASC' | 'DESC') ?? 'DESC',
        property: (options.sortBy as 'FEED_TIME' | 'PUBLISHED_TIME' | 'REACH' | 'VIRALITY') ?? 'FEED_TIME',
      },
    },
  }

  if (scrollToken) {
    body.scrollToken = scrollToken
  }

  const mentionFilter: Record<string, unknown> = {}

  if (options.type) {
    mentionFilter.mentionType = { any: [options.type.toUpperCase()] }
  }
  if (options.sentiment) {
    mentionFilter.sentiment = { any: [options.sentiment.toUpperCase()] }
  }
  if (options.tag) {
    mentionFilter.tag = { any: [parseInt(options.tag, 10)] }
  }

  if (Object.keys(mentionFilter).length > 0) {
    body.query.mentionFilter = mentionFilter as MentionsRequest['query']['mentionFilter']
  }

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
        to: now + 24 * 60 * 60 * 1000, // +24h buffer for crawl delay and timezone skew
      }
    }
  } else {
    // No date filter provided: use feedTime last 7 days (unchanged default).
    body.query.feedTime = {
      from: now - 7 * 24 * 60 * 60 * 1000,
      to: now,
    }
  }

  return body
}

export async function fetchMentions(
  client: AxiosInstance,
  orgId: string,
  options: MentionsOptions
): Promise<string> {
  if (!options.keyword && !options.group) {
    throw new Error('At least one of --keyword or --group is required')
  }

  const endpoint = buildEndpoint(orgId, options.keyword, options.group)
  const allMentions: unknown[] = []
  let scrollToken: string | undefined

  while (true) {
    const body = buildBody(options, scrollToken)
    const { data } = await client.post<MentionsResponse>(endpoint, body)
    const mentions = data.mentions ?? []
    allMentions.push(...mentions)
    scrollToken = data.scrollToken

    if (!options.all || !scrollToken || mentions.length === 0) break
  }

  return formatOutput(
    { mentions: allMentions },
    { json: options.json, fields: options.fields }
  )
}
