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
    if (!rawType) {
      throw new Error(
        `Invalid mention format "${part}" — expected mentionId:sourceType (e.g. "123:web")`
      )
    }
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
    const lower = options.sentiment.toLowerCase()
    if (lower !== 'positive' && lower !== 'negative' && lower !== 'neutral') {
      throw new Error(
        `Invalid sentiment "${options.sentiment}" — must be positive, negative, or neutral`
      )
    }
    body.sentiment = lower as 'positive' | 'negative' | 'neutral'
  }
  if (options.keyword) body.keyword_id = parseInt(options.keyword, 10)

  const endpoint = `/organizations/${orgId}/groups/${options.group}/mentions/meta`
  const { data } = await client.post<UpdateMentionResponse>(endpoint, body)

  if (data.data?.message_code && data.data.message_code !== 'OK') {
    throw new Error(`API error: ${data.data.message_code}`)
  }

  if (options.json) {
    return JSON.stringify(data, null, 2)
  }

  return `Updated ${selected_mention_ids.length} mention(s).`
}
