import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? files(p) : [p]
  })

describe('no secrets reach the browser', () => {
  const source = files('src').filter((f) => !f.includes('__tests__')).map((f) => [f, readFileSync(f, 'utf8')] as const)

  it('never references server-only keys in app code', () => {
    for (const [f, text] of source) {
      expect(text, f).not.toMatch(/service_role|sk-ant-|ANTHROPIC_API_KEY|SUPABASE_SERVICE/)
    }
  })

  it('only puts public VITE_ settings in the committed env file, with an anon key', () => {
    const env = readFileSync('.env.production', 'utf8')
    const keys = env.split('\n').filter((l) => /^\s*[A-Z_]+=/.test(l)).map((l) => l.split('=')[0].trim())
    for (const k of keys) expect(k).toMatch(/^VITE_/)
    const key = env.match(/VITE_SUPABASE_ANON_KEY=(\S+)/)?.[1] ?? ''
    if (key.startsWith('eyJ')) {
      const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString())
      expect(payload.role).toBe('anon')
    }
  })
})
