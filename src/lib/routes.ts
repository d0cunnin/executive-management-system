import type { Area } from '../domain/types'

/** Some areas have their own dedicated screens. */
export function areaHref(a: Area): string {
  if (a.slug === 'ideas') return '/ideas'
  if (a.slug === 'ai-team') return '/team'
  if (a.slug === 'wellness') return '/wellness'
  return `/areas/${a.slug}`
}
