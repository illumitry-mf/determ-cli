// tests/formatters.test.ts
import { describe, it, expect } from 'vitest'
import { formatOutput } from '../src/formatters'

const sampleMentions = {
  mentions: [
    {
      id: 1,
      type: 'web',
      title: 'Test Article',
      url: 'https://example.com',
      from: 'example.com',
      autoSentiment: 'positive',
      reach: 500,
    },
    {
      id: 2,
      type: 'twitter',
      title: 'Test Tweet',
      url: 'https://twitter.com/x/1',
      from: 'TestUser',
      autoSentiment: 'neutral',
      reach: 1200,
      retweetCount: 5,
    },
  ],
}

describe('formatOutput', () => {
  describe('JSON mode (--json)', () => {
    it('returns valid JSON string', () => {
      const result = formatOutput(sampleMentions, { json: true })
      expect(() => JSON.parse(result)).not.toThrow()
    })

    it('JSON output contains all mention fields', () => {
      const result = formatOutput(sampleMentions, { json: true })
      const parsed = JSON.parse(result)
      expect(parsed.mentions[0].url).toBe('https://example.com')
      expect(parsed.mentions[1].retweetCount).toBe(5)
    })
  })

  describe('TOON mode (default)', () => {
    it('returns non-JSON string', () => {
      const result = formatOutput(sampleMentions, {})
      expect(() => JSON.parse(result)).toThrow()
    })

    it('TOON output contains mention data', () => {
      const result = formatOutput(sampleMentions, {})
      expect(result).toContain('Test Article')
      expect(result).toContain('https://example.com')
    })
  })

  describe('field filtering', () => {
    it('filters to specified fields only', () => {
      const result = formatOutput(sampleMentions, { fields: ['id', 'title'] })
      expect(result).toContain('id')
      expect(result).toContain('title')
      expect(result).not.toContain('url')
      expect(result).not.toContain('reach')
    })

    it('filtering works in JSON mode too', () => {
      const result = formatOutput(sampleMentions, {
        json: true,
        fields: ['id', 'type'],
      })
      const parsed = JSON.parse(result)
      expect(Object.keys(parsed.mentions[0])).toEqual(['id', 'type'])
    })

    it('includes all fields when fields option is undefined', () => {
      const result = formatOutput(sampleMentions, { json: true })
      const parsed = JSON.parse(result)
      expect(parsed.mentions[0].url).toBeDefined()
      expect(parsed.mentions[0].reach).toBeDefined()
    })

    it('includes all fields when fields is empty array', () => {
      const result = formatOutput(sampleMentions, { json: true, fields: [] })
      const parsed = JSON.parse(result)
      expect(parsed.mentions[0].url).toBeDefined()
    })
  })

  describe('tags data', () => {
    it('formats tags in TOON mode', () => {
      const tags = { tags: [{ id: 1, name: 'Crisis', categoryId: 0 }] }
      const result = formatOutput(tags, {})
      expect(result).toContain('Crisis')
    })

    it('filters tag fields', () => {
      const tags = { tags: [{ id: 1, name: 'Crisis', categoryId: 0 }] }
      const result = formatOutput(tags, { json: true, fields: ['id', 'name'] })
      const parsed = JSON.parse(result)
      expect(Object.keys(parsed.tags[0])).toEqual(['id', 'name'])
    })
  })
})
