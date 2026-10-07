import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Null when Supabase is not configured — EMS then runs in local demo mode. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

export const aiEnabled = import.meta.env.VITE_AI_ENABLED === 'true' && !!supabase
