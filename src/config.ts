import { existsSync, readFileSync } from 'fs'
import os from 'os'
import path from 'path'
import { DetermConfig, ConfigOptions } from './types'

const CONFIG_FILE = path.join(os.homedir(), '.determ-cli.json')

export function resolveConfig(options: ConfigOptions): DetermConfig {
  let fileConfig: Partial<DetermConfig> = {}
  if (existsSync(CONFIG_FILE)) {
    try {
      fileConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
    } catch {
      // Ignore malformed config file
    }
  }

  const accessToken =
    options.token ?? process.env.DETERM_ACCESS_TOKEN ?? fileConfig.accessToken
  const orgId =
    options.org ?? process.env.DETERM_ORG_ID ?? fileConfig.orgId

  if (!accessToken) {
    throw new Error(
      'Access token required. Set DETERM_ACCESS_TOKEN, use --token, or add accessToken to ~/.determ-cli.json'
    )
  }
  if (!orgId) {
    throw new Error(
      'Org ID required. Set DETERM_ORG_ID, use --org, or add orgId to ~/.determ-cli.json'
    )
  }

  return { accessToken, orgId }
}
