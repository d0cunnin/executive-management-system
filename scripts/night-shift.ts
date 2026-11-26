// Runs the EMS night shift for every account. Started on a schedule by
// .github/workflows/night-shift.yml.
//
// Needs two settings:
//   SUPABASE_URL               the project address (public)
//   SUPABASE_SERVICE_ROLE_KEY  a server key, kept as a GitHub secret. Never put it in the app.
// The AI itself runs in the `ems-ai` Supabase function, which holds the AI key.
import { createClient } from '@supabase/supabase-js'
import { EdgeFunctionProvider } from '../src/ai/provider'
import { SupabasePersistence } from '../src/data/supabasePersistence'
import { Store } from '../src/data/store'
import { runNightShift } from '../src/night/nightShift'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const max = Number(process.env.NIGHT_SHIFT_MAX ?? 8)

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add the key under GitHub → Settings → Secrets and variables → Actions.')
  process.exit(1)
}

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const { data, error } = await client.auth.admin.listUsers()
if (error) {
  console.error(`Could not list accounts: ${error.message}`)
  process.exit(1)
}

let failed = false
for (const user of data.users) {
  const persistence = new SupabasePersistence(client, user.id)
  // Only accounts that already have EMS data; never create sample data here.
  const saved = await persistence.load()
  if (!saved) continue
  const store = new Store({ kind: 'supabase', missing: persistence.missing, load: async () => saved, saveCollection: persistence.saveCollection.bind(persistence), saveAll: async () => {} })
  await store.init()
  if (store.loadError) {
    console.error(`Account ${user.id}: ${store.loadError}`)
    failed = true
    continue
  }
  try {
    const r = await runNightShift(store, new EdgeFunctionProvider(client), { max })
    console.log(`Account ${user.id}: drafted ${r.drafted.length}, left ${r.leftForLater}${r.stopped ? `, stopped: ${r.stopped}` : ''}`)
  } catch (e) {
    console.error(`Account ${user.id}: ${e instanceof Error ? e.message : e}`)
    failed = true
  }
}
process.exit(failed ? 1 : 0)
