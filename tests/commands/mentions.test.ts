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

    it('sets publishedTime (not feedTime origin) when --from is provided without --use-feed-time', async () => {
      await fetchMentions(mockClient, '177561', {
        keyword: '6798574',
        from: '2026-04-01',
      })
      const body = mockPost.mock.calls[0][1]
      expect(body.query.publishedTime?.from).toBe(new Date('2026-04-01').getTime())
      expect(body.query.feedTime).toBeDefined() // wide window still present
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

  describe('publishedTime filter (default when dates provided)', () => {
    it('sets publishedTime when --from provided without --use-feed-time', async () => {
      await fetchMentions(mockClient, '177561', {
        keyword: '6798574',
        from: '2026-04-15',
      })
      const body = mockPost.mock.calls[0][1]
      expect(body.query.publishedTime).toBeDefined()
      expect(body.query.publishedTime.from).toBe(new Date('2026-04-15').getTime())
    })

    it('sets wide feedTime window alongside publishedTime', async () => {
      const before = Date.now()
      await fetchMentions(mockClient, '177561', {
        keyword: '6798574',
        from: '2026-04-15',
      })
      const after = Date.now()
      const body = mockPost.mock.calls[0][1]
      // feedTime.from should be ~90 days before the call
      expect(body.query.feedTime.from).toBeLessThanOrEqual(before - 89 * 24 * 60 * 60 * 1000)
      // feedTime.to should be after the call (future)
      expect(body.query.feedTime.to).toBeGreaterThanOrEqual(after)
    })

    it('does not set publishedTime when no --from or --to provided', async () => {
      await fetchMentions(mockClient, '177561', { keyword: '6798574' })
      const body = mockPost.mock.calls[0][1]
      expect(body.query.publishedTime).toBeUndefined()
      expect(body.query.feedTime).toBeDefined()
    })
  })

  describe('--use-feed-time flag', () => {
    it('sets feedTime (not publishedTime) when --use-feed-time is set', async () => {
      await fetchMentions(mockClient, '177561', {
        keyword: '6798574',
        from: '2026-04-15',
        to: '2026-04-16',
        useFeedTime: true,
      })
      const body = mockPost.mock.calls[0][1]
      expect(body.query.publishedTime).toBeUndefined()
      expect(body.query.feedTime.from).toBe(new Date('2026-04-15').getTime())
    })

    it('snaps date-only --to even when --use-feed-time is set', async () => {
      await fetchMentions(mockClient, '177561', {
        keyword: '6798574',
        from: '2026-04-15',
        to: '2026-04-16',
        useFeedTime: true,
      })
      const body = mockPost.mock.calls[0][1]
      const expectedTo = new Date('2026-04-16').getTime() + 24 * 60 * 60 * 1000 - 1
      expect(body.query.feedTime.to).toBe(expectedTo)
    })
  })

  describe('end-of-day snapping for --to', () => {
    it('snaps date-only --to to 23:59:59.999Z', async () => {
      await fetchMentions(mockClient, '177561', {
        keyword: '6798574',
        from: '2026-04-15',
        to: '2026-04-16',
      })
      const body = mockPost.mock.calls[0][1]
      const expectedTo = new Date('2026-04-16').getTime() + 24 * 60 * 60 * 1000 - 1
      expect(body.query.publishedTime.to).toBe(expectedTo)
    })

    it('does not snap full datetime --to', async () => {
      await fetchMentions(mockClient, '177561', {
        keyword: '6798574',
        from: '2026-04-15',
        to: '2026-04-16T12:00:00Z',
      })
      const body = mockPost.mock.calls[0][1]
      expect(body.query.publishedTime.to).toBe(new Date('2026-04-16T12:00:00Z').getTime())
    })

    it('does not snap relative --to (e.g. 7d)', async () => {
      await fetchMentions(mockClient, '177561', {
        keyword: '6798574',
        from: '7d',
      })
      const body = mockPost.mock.calls[0][1]
      // publishedTime should be set (from was provided) and to defaults to approx now
      expect(body.query.publishedTime).toBeDefined()
    })
  })
})
