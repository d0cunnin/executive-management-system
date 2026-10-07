export const DAY = 86_400_000

export function uid(prefix = 'r'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function startOfDay(d: Date = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** ISO date (yyyy-mm-dd) `n` days from today, in local time. */
export function dayOffset(n: number, hour?: number, minute = 0): string {
  const d = startOfDay()
  d.setDate(d.getDate() + n)
  if (hour === undefined) return toDateKey(d)
  d.setHours(hour, minute)
  return d.toISOString()
}

export function toDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Parse yyyy-mm-dd as a local date, or a full ISO string as-is. */
export function parseDate(s: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(s)
}

export function daysUntil(s: string): number {
  return Math.round((startOfDay(parseDate(s)).getTime() - startOfDay().getTime()) / DAY)
}

export function daysSince(s: string): number {
  return Math.floor((Date.now() - parseDate(s).getTime()) / DAY)
}

export function friendlyDate(s: string): string {
  const n = daysUntil(s)
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n === -1) return 'Yesterday'
  if (n > 1 && n < 7) return parseDate(s).toLocaleDateString(undefined, { weekday: 'long' })
  if (n < 0 && n > -7) return `${-n} days ago`
  return parseDate(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function timeOf(s: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return ''
  return parseDate(s).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function money(n: number): string {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

export function plural(n: number, word: string, many = `${word}s`): string {
  return `${n} ${n === 1 ? word : many}`
}
