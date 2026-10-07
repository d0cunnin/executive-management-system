// The seam between EMS and a real AI model.
//
// BuiltinProvider: no model. Skills return structured templates built from
// EMS data and say so. Nothing is claimed as researched, written, or sent.
//
// EdgeFunctionProvider: calls the `ems-ai` Supabase Edge Function, which holds
// the Anthropic API key server-side. Enabled with VITE_AI_ENABLED=true.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface GenerateRequest {
  /** Which assistant is speaking, e.g. "social". */
  agentKey: string
  /** What the assistant should produce. */
  instruction: string
  /** Relevant EMS records, already summarized as text. */
  context: string
}

export interface AIProvider {
  readonly connected: boolean
  readonly label: string
  generate(req: GenerateRequest): Promise<string>
}

export class BuiltinProvider implements AIProvider {
  readonly connected = false
  readonly label = 'Built-in planner (no AI model connected)'
  async generate(): Promise<string> {
    throw new Error('No AI model is connected. The built-in planner prepares templates instead.')
  }
}

export class EdgeFunctionProvider implements AIProvider {
  readonly connected = true
  readonly label = 'Connected AI'
  private client: SupabaseClient
  constructor(client: SupabaseClient) {
    this.client = client
  }

  async generate(req: GenerateRequest): Promise<string> {
    const { data, error } = await this.client.functions.invoke<{ text?: string; error?: string }>('ems-ai', { body: req })
    if (error) throw new Error(error.message)
    if (!data?.text) throw new Error(data?.error ?? 'The AI returned nothing.')
    return data.text
  }
}
