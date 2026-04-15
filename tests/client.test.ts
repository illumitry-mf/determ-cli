// tests/client.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest'
import axios from 'axios'
import { createClient } from '../src/client'

describe('createClient', () => {
  let mockRequestUse: ReturnType<typeof vi.fn>
  let mockResponseUse: ReturnType<typeof vi.fn>
  let mockInstance: any

  beforeEach(() => {
    mockRequestUse = vi.fn()
    mockResponseUse = vi.fn()
    mockInstance = {
      interceptors: {
        request: { use: mockRequestUse },
        response: { use: mockResponseUse },
      },
    }
    vi.spyOn(axios, 'create').mockReturnValue(mockInstance)
  })

  it('creates axios instance with Determ base URL', () => {
    createClient('token')
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: 'https://api.mediatoolkit.com',
    })
  })

  it('request interceptor appends access_token to params', () => {
    createClient('my-secret-token')
    const [requestInterceptor] = mockRequestUse.mock.calls[0]
    const config = { params: { existing: 'val' } }
    const result = requestInterceptor(config)
    expect(result.params.access_token).toBe('my-secret-token')
    expect(result.params.existing).toBe('val')
  })

  it('request interceptor works when params is undefined', () => {
    createClient('token')
    const [requestInterceptor] = mockRequestUse.mock.calls[0]
    const result = requestInterceptor({ params: undefined })
    expect(result.params.access_token).toBe('token')
  })

  it('response interceptor maps 401 to readable error', async () => {
    createClient('token')
    const [, errorInterceptor] = mockResponseUse.mock.calls[0]
    await expect(
      errorInterceptor({ response: { status: 401 } })
    ).rejects.toThrow('401 Unauthorized')
  })

  it('response interceptor maps 404 to readable error', async () => {
    createClient('token')
    const [, errorInterceptor] = mockResponseUse.mock.calls[0]
    await expect(
      errorInterceptor({ response: { status: 404 } })
    ).rejects.toThrow('404 Not found')
  })

  it('response interceptor passes through successful responses', () => {
    createClient('token')
    const [successInterceptor] = mockResponseUse.mock.calls[0]
    const response = { data: { mentions: [] } }
    expect(successInterceptor(response)).toBe(response)
  })
})
