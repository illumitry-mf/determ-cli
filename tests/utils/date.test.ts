// tests/utils/date.test.ts
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parseDate } from '../../src/utils/date'

describe('parseDate', () => {
  const NOW = 1_744_700_000_000 // fixed timestamp for determinism

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('parses hours relative shorthand', () => {
    expect(parseDate('24h')).toBe(NOW - 24 * 3_600_000)
  })

  it('parses days relative shorthand', () => {
    expect(parseDate('7d')).toBe(NOW - 7 * 86_400_000)
  })

  it('parses 30d relative shorthand', () => {
    expect(parseDate('30d')).toBe(NOW - 30 * 86_400_000)
  })

  it('parses ISO 8601 date string', () => {
    const result = parseDate('2026-04-01')
    expect(result).toBe(new Date('2026-04-01').getTime())
  })

  it('parses ISO 8601 datetime string', () => {
    const result = parseDate('2026-04-01T00:00:00.000Z')
    expect(result).toBe(new Date('2026-04-01T00:00:00.000Z').getTime())
  })

  it('throws on invalid input', () => {
    expect(() => parseDate('not-a-date')).toThrow('Invalid date')
  })

  it('throws with the invalid value in the error message', () => {
    expect(() => parseDate('badval')).toThrow('"badval"')
  })
})
