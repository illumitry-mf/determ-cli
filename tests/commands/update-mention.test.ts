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

  it('throws on empty string', () => {
    expect(() => parseMentions('')).toThrow()
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
    expect(parsed.code).toBe(1)
    expect(parsed.message).toBe('OK')
  })

  it('propagates HTTP errors from client.post', async () => {
    mockPost.mockRejectedValue(new Error('500 Internal Server Error'))
    await expect(
      updateMentions(mockClient, '177561', {
        group: '250240',
        mentions: '123:web',
        irrelevant: true,
      })
    ).rejects.toThrow('500 Internal Server Error')
  })

  it('omits category_id when categoryId is not provided', async () => {
    await updateMentions(mockClient, '177561', {
      group: '250240',
      mentions: '123:web',
      irrelevant: true,
    })
    const body = mockPost.mock.calls[0][1]
    expect(body.category_id).toBeUndefined()
  })
})
