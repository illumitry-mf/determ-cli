// eslint-disable-next-line @typescript-eslint/no-var-requires
const { encode } = require('@toon-format/toon') as { encode: (data: unknown) => string }
import { FormatOptions } from './types'

export function formatOutput(data: object, options: FormatOptions): string {
  const processed =
    options.fields && options.fields.length > 0
      ? filterFields(data, options.fields)
      : data

  if (options.json) {
    return JSON.stringify(processed, null, 2)
  }

  return encode(processed)
}

function filterFields(data: unknown, fields: string[]): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => filterFields(item, fields))
  }

  if (data !== null && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const hasTargetField = fields.some((f) => f in obj)

    if (hasTargetField) {
      return Object.fromEntries(
        fields.filter((f) => f in obj).map((f) => [f, obj[f]])
      )
    }

    // Recurse into nested objects (e.g. { mentions: [...] })
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, filterFields(v, fields)])
    )
  }

  return data
}
