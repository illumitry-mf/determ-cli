// tests/commands/tags.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { AxiosInstance } from 'axios'
import { fetchTags } from '../../src/commands/tags'

const mockGet = vi.fn()
const mockClient = { get: mockGet } as unknown as AxiosInstance

const sampleTags = {
  tags: [
    { id: 24900, name: 'Complaint', categoryId: 0 },
    { id: 24901, name: 'Crisis', categoryId: 0 },
  ],
}

describe('fetchTags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockResolvedValue({ data: sampleTags })
  })

  it('calls the correct endpoint', async () => {
    await fetchTags(mockClient, '177561', {})
    expect(mockGet).toHaveBeenCalledWith('/v2/organization/177561/tags')
  })

  it('returns TOON output by default', async () => {
    const result = await fetchTags(mockClient, '177561', {})
    expect(() => JSON.parse(result)).toThrow()
    expect(result).toContain('Complaint')
  })

  it('returns JSON when json option is true', async () => {
    const result = await fetchTags(mockClient, '177561', { json: true })
    const parsed = JSON.parse(result)
    expect(parsed.tags[0].name).toBe('Complaint')
  })

  it('filters fields when fields option is provided', async () => {
    const result = await fetchTags(mockClient, '177561', {
      json: true,
      fields: ['id', 'name'],
    })
    const parsed = JSON.parse(result)
    expect(Object.keys(parsed.tags[0])).toEqual(['id', 'name'])
    expect(parsed.tags[0].categoryId).toBeUndefined()
  })
})
