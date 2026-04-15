// tests/commands/mentions.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { AxiosInstance } from 'axios'
import { fetchMentions } from '../../src/commands/mentions'

const mockPost = vi.fn()
const mockClient = { post: mockPost } as unknown as AxiosInstance

const makeMention = (id: number) => ({
  id,
  type: 'web',
  title: `Article ${id}`,
  url: `https://example.com/${id}`,
  from: 'example.com',
  mention: '',
  languages: ['en'],
  author: 'author',
  insertTime: 1_700_000_000,
  keywords: [],
  locations: ['SG'],
  autoSentiment: 'positive',
  tagFeedLocations: [],
})

describe('fetchMentions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPost.mockResolvedValue({
      data: { mentions: [makeMention(1)] },
    })
  })

  describe('endpoint resolution', () => {
    it('keyword only → org-keyword path (no group)', async () => {
      await fetchMentions(mockClient, '177561', { keyword: '6798574' })
      expect(mockPost).toHaveBeenCalledWith(
        '/v2/organization/177561/keyword/6798574/mentions/scroll',
        expect.any(Object)
      )
    })

    it('group only → org-group path', async () => {
      await fetchMentions(mockClient, '177561', { group: '250240' })
      expect(mockPost).toHaveBeenCalledWith(
        '/v2/organization/177561/group/250240/mentions/scroll',
        expect.any(Object)
      )
    })

    it('keyword + group → full three-part path', async () => {
      await fetchMentions(mockClient, '177561', {
        keyword: '6798574',
        group: '250240',
      })
      expect(mockPost).toHaveBeenCalledWith(
        '/v2/organization/177561/group/250240/keyword/6798574/mentions/scroll',
        expect.any(Object)
      )
    })

    it('throws when neither keyword nor group is provided', async () => {
      await expect(fetchMentions(mockClient, '177561', {})).rejects.toThrow(
        '--keyword or --group'
      )
    })
  })

  describe('pagination', () => {
    it('fetches one page by default (no --all)', async () => {
      mockPost.mockResolvedValueOnce({
        data: { mentions: [makeMention(1)], scrollToken: 'tok1' },
      })
      await fetchMentions(mockClient, '177561', { keyword: '6798574' })
      expect(mockPost).toHaveBeenCalledTimes(1)
    })

    it('auto-paginates when --all is set', async () => {
      mockPost
        .mockResolvedValueOnce({
          data: { mentions: [makeMention(1)], scrollToken: 'tok1' },
        })
        .mockResolvedValueOnce({
          data: { mentions: [makeMention(2)], scrollToken: 'tok2' },
        })
        .mockResolvedValueOnce({
          data: { mentions: [] },
        })

      const result = await fetchMentions(mockClient, '177561', {
        keyword: '6798574',
        all: true,
        json: true,
      })

      expect(mockPost).toHaveBeenCalledTimes(3)
      const parsed = JSON.parse(result)
      expect(parsed.mentions).toHaveLength(2)
    })

    it('stops paginating when scrollToken is absent', async () => {
      mockPost
        .mockResolvedValueOnce({
          data: { mentions: [makeMention(1)], scrollToken: 'tok1' },
        })
        .mockResolvedValueOnce({
          data: { mentions: [makeMention(2)] }, // no scrollToken
        })

      await fetchMentions(mockClient, '177561', {
        keyword: '6798574',
        all: true,
      })

      expect(mockPost).toHaveBeenCalledTimes(2)
    })

    it('passes scrollToken in subsequent requests', async () => {
      mockPost
        .mockResolvedValueOnce({
          data: { mentions: [makeMention(1)], scrollToken: 'mytoken' },
        })
        .mockResolvedValueOnce({
          data: { mentions: [] },
        })

      await fetchMentions(mockClient, '177561', {
        keyword: '6798574',
        all: true,
      })

      const secondCallBody = mockPost.mock.calls[1][1]
      expect(secondCallBody.scrollToken).toBe('mytoken')
    })
  })

  describe('request body construction', () => {
    it('uses FEED_TIME DESC as default sort', async () => {
      await fetchMentions(mockClient, '177561', { keyword: '6798574' })
      const body = mockPost.mock.calls[0][1]
      expect(body.paged.sorted.property).toBe('FEED_TIME')
      expect(body.paged.sorted.direction).toBe('DESC')
    })

    it('passes custom sort-by and sort-dir', async () => {
      await fetchMentions(mockClient, '177561', {
        keyword: '6798574',
        sortBy: 'REACH',
        sortDir: 'ASC',
      })
      const body = mockPost.mock.calls[0][1]
      expect(body.paged.sorted.property).toBe('REACH')
      expect(body.paged.sorted.direction).toBe('ASC')
    })

    it('sets default count to 20', async () => {
      await fetchMentions(mockClient, '177561', { keyword: '6798574' })
      const body = mockPost.mock.calls[0][1]
      expect(body.paged.count).toBe(20)
    })

    it('respects custom count', async () => {
      await fetchMentions(mockClient, '177561', {
        keyword: '6798574',
        count: 50,
      })
      const body = mockPost.mock.calls[0][1]
      expect(body.paged.count).toBe(50)
    })

    it('adds sentiment filter when provided', async () => {
      await fetchMentions(mockClient, '177561', {
        keyword: '6798574',
        sentiment: 'positive',
      })
      const body = mockPost.mock.calls[0][1]
      expect(body.query.mentionFilter.sentiment.any).toEqual(['POSITIVE'])
    })

    it('adds type filter when provided', async () => {
      await fetchMentions(mockClient, '177561', {
        keyword: '6798574',
        type: 'twitter',
      })
      const body = mockPost.mock.calls[0][1]
      expect(body.query.mentionFilter.mentionType.any).toEqual(['TWITTER'])
    })

    it('adds tag filter when provided', async () => {
      await fetchMentions(mockClient, '177561', {
        keyword: '6798574',
        tag: '24900',
      })
      const body = mockPost.mock.calls[0][1]
      expect(body.query.mentionFilter.tag.any).toEqual([24900])
    })

    it('adds feedTime when --from is provided', async () => {
      await fetchMentions(mockClient, '177561', {
        keyword: '6798574',
        from: '2026-04-01',
      })
      const body = mockPost.mock.calls[0][1]
      expect(body.query.feedTime.from).toBe(new Date('2026-04-01').getTime())
    })
  })

  describe('field filtering', () => {
    it('filters mention fields when --fields is provided', async () => {
      const result = await fetchMentions(mockClient, '177561', {
        keyword: '6798574',
        json: true,
        fields: ['id', 'title'],
      })
      const parsed = JSON.parse(result)
      expect(Object.keys(parsed.mentions[0])).toEqual(['id', 'title'])
    })
  })
})
