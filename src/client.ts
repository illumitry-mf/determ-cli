import axios, { AxiosInstance } from 'axios'

const BASE_URL = 'https://api.mediatoolkit.com'

const HTTP_ERRORS: Record<number, string> = {
  401: 'Unauthorized — check your access token',
  403: 'Forbidden — insufficient permissions',
  404: 'Not found — check your org/group/keyword IDs',
  429: 'Rate limited — try again later',
  500: 'Server error — try again later',
}

export function createClient(accessToken: string): AxiosInstance {
  const client = axios.create({ baseURL: BASE_URL })

  client.interceptors.request.use((config) => {
    config.params = { ...config.params, access_token: accessToken }
    return config
  })

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const status: number = error.response?.status
      const message = HTTP_ERRORS[status] ?? error.message
      return Promise.reject(new Error(`${status} ${message}`))
    }
  )

  return client
}
