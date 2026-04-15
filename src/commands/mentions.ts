import { AxiosInstance } from 'axios'
import { MentionsRequest, MentionsResponse, MentionsOptions } from '../types'
import { formatOutput } from '../formatters'
import { parseDate } from '../utils/date'

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

  if (options.from || options.to) {
    body.query.feedTime = {
      from: options.from ? parseDate(options.from) : 0,
      to: options.to ? parseDate(options.to) : Date.now(),
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
