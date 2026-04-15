// tests/config.test.ts
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
}))

import * as fs from 'fs'
import { resolveConfig } from '../src/config'

const mockExistsSync = vi.mocked(fs.existsSync)
const mockReadFileSync = vi.mocked(fs.readFileSync)

describe('resolveConfig', () => {
  const savedEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    vi.clearAllMocks()
    mockExistsSync.mockReturnValue(false)
    savedEnv.DETERM_ACCESS_TOKEN = process.env.DETERM_ACCESS_TOKEN
    savedEnv.DETERM_ORG_ID = process.env.DETERM_ORG_ID
    delete process.env.DETERM_ACCESS_TOKEN
    delete process.env.DETERM_ORG_ID
  })

  afterEach(() => {
    process.env.DETERM_ACCESS_TOKEN = savedEnv.DETERM_ACCESS_TOKEN
    process.env.DETERM_ORG_ID = savedEnv.DETERM_ORG_ID
  })

  it('CLI flags take priority over env vars', () => {
    process.env.DETERM_ACCESS_TOKEN = 'env-token'
    process.env.DETERM_ORG_ID = 'env-org'
    const config = resolveConfig({ token: 'flag-token', org: 'flag-org' })
    expect(config.accessToken).toBe('flag-token')
    expect(config.orgId).toBe('flag-org')
  })

  it('env vars used when no CLI flags', () => {
    process.env.DETERM_ACCESS_TOKEN = 'env-token'
    process.env.DETERM_ORG_ID = 'env-org'
    const config = resolveConfig({})
    expect(config.accessToken).toBe('env-token')
    expect(config.orgId).toBe('env-org')
  })

  it('config file used when no flags or env vars', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ accessToken: 'file-token', orgId: 'file-org' }) as any
    )
    const config = resolveConfig({})
    expect(config.accessToken).toBe('file-token')
    expect(config.orgId).toBe('file-org')
  })

  it('flag overrides config file', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ accessToken: 'file-token', orgId: 'file-org' }) as any
    )
    const config = resolveConfig({ token: 'flag-token', org: 'flag-org' })
    expect(config.accessToken).toBe('flag-token')
    expect(config.orgId).toBe('flag-org')
  })

  it('throws when access token is missing', () => {
    expect(() => resolveConfig({})).toThrow('Access token required')
  })

  it('throws when org ID is missing', () => {
    process.env.DETERM_ACCESS_TOKEN = 'token'
    expect(() => resolveConfig({})).toThrow('Org ID required')
  })
})
