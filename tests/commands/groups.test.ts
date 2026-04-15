import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { AxiosInstance } from 'axios'
import { fetchGroups } from '../../src/commands/groups'

const mockGet = vi.fn()
const mockClient = { get: mockGet } as unknown as AxiosInstance

const sampleResponse = {
  message: 'OK',
  data: {
    groups: [
      {
        id: 249932,
        name: 'Industry',
        color: '#a526bb',
        keywords: [
          { id: 6797290, name: 'Public Relations & Communications Industry', group_id: 249932, active: true },
        ],
      },
      {
        id: 250240,
        name: 'Campaigns',
        color: '#00ebff',
        keywords: [
          { id: 6798393, name: 'BCRS', group_id: 250240, active: true },
          { id: 6798574, name: 'Beverage Container Return Scheme', group_id: 250240, active: false },
        ],
      },
    ],
  },
}

describe('fetchGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockResolvedValue({ data: sampleResponse })
  })

  it('calls the v1 groups endpoint', async () => {
    await fetchGroups(mockClient, '177561', {})
    expect(mockGet).toHaveBeenCalledWith('/organizations/177561/groups')
  })

  it('returns TOON output by default', async () => {
    const result = await fetchGroups(mockClient, '177561', {})
    expect(() => JSON.parse(result)).toThrow()
    expect(result).toContain('Industry')
    expect(result).toContain('Campaigns')
  })

  it('returns JSON when json option is true', async () => {
    const result = await fetchGroups(mockClient, '177561', { json: true })
    const parsed = JSON.parse(result)
    expect(parsed.groups).toHaveLength(2)
    expect(parsed.groups[0].name).toBe('Industry')
  })

  it('normalises keywords to topics', async () => {
    const result = await fetchGroups(mockClient, '177561', { json: true })
    const parsed = JSON.parse(result)
    expect(parsed.groups[0].topics).toHaveLength(1)
    expect(parsed.groups[0].topics[0]).toEqual({
      id: 6797290,
      name: 'Public Relations & Communications Industry',
      active: true,
    })
  })

  it('strips v1-only fields (group_id, color) from topics', async () => {
    const result = await fetchGroups(mockClient, '177561', { json: true })
    const parsed = JSON.parse(result)
    const topic = parsed.groups[0].topics[0]
    expect(topic).not.toHaveProperty('group_id')
    expect(topic).not.toHaveProperty('color')
  })

  it('preserves active:false on topics', async () => {
    const result = await fetchGroups(mockClient, '177561', { json: true })
    const parsed = JSON.parse(result)
    const lastTopic = parsed.groups[1].topics[1]
    expect(lastTopic.active).toBe(false)
  })

  it('filters fields when fields option is provided', async () => {
    const result = await fetchGroups(mockClient, '177561', {
      json: true,
      fields: ['id', 'name'],
    })
    const parsed = JSON.parse(result)
    expect(Object.keys(parsed.groups[0])).toEqual(['id', 'name'])
    expect(parsed.groups[0].topics).toBeUndefined()
  })

  it('handles a group with no topics', async () => {
    mockGet.mockResolvedValue({
      data: {
        message: 'OK',
        data: { groups: [{ id: 1, name: 'Empty', color: null, keywords: [] }] },
      },
    })
    const result = await fetchGroups(mockClient, '177561', { json: true })
    const parsed = JSON.parse(result)
    expect(parsed.groups[0].topics).toEqual([])
  })
})
