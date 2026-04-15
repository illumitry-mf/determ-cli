export function parseDate(input: string): number {
  const relativeMatch = input.match(/^(\d+)(h|d)$/)
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10)
    const unit = relativeMatch[2]
    const ms = unit === 'h' ? amount * 3_600_000 : amount * 86_400_000
    return Date.now() - ms
  }

  const date = new Date(input)
  if (isNaN(date.getTime())) {
    throw new Error(
      `Invalid date: "${input}". Use ISO 8601 (e.g. 2026-04-01) or relative (e.g. 24h, 7d, 30d)`
    )
  }
  return date.getTime()
}
