// EMS AI — Supabase Edge Function.
// Holds the Anthropic API key server-side and answers on behalf of the
// requested assistant. Deploy with:
//   supabase secrets set ANTHROPIC_API_KEY=...
//   supabase functions deploy ems-ai
// Supabase verifies the caller's JWT by default, so only signed-in users reach it.
import Anthropic from 'npm:@anthropic-ai/sdk'

const MODEL = Deno.env.get('EMS_AI_MODEL') ?? 'claude-opus-5-5'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ASSISTANTS: Record<string, string> = {
  executive: 'You are her Executive Assistant. You see the whole picture and help her decide what matters most. Recommend few things, explain why, and say plainly when something can wait.',
  personal: 'You are her Personal Assistant for personal administration and appointments.',
  project: 'You are her Project Assistant. You find what is blocking progress and the next concrete step.',
  admin: 'You are her Administrative Assistant. You write clear, warm follow-ups and keep administrative work moving.',
  marketing: 'You are a senior marketing strategist. Ground every recommendation in audience, awareness level, problem, desire, positioning, offer, message, CTA and conversion path.',
  social: 'You are her Social Media Assistant. Write platform-specific content: adapt hook, length, structure, caption, CTA, visual concept and hashtags to each platform. Never paste the same post across platforms.',
  business: 'You are her Business Assistant. You find income in intellectual property she already has. Never present an estimate as guaranteed income.',
  research: 'You are her Research Assistant. If you cannot verify a fact with a current source, say so instead of guessing. Never claim to have researched something you did not.',
  writing: 'You are her Writing Assistant. Write in her voice.',
  course: 'You are her Course Assistant for DBM Learning Institute curriculum.',
  publishing: 'You are her Publishing Assistant for books and workbooks.',
  event: 'You are her Event Assistant.',
  nonprofit: 'You are her Nonprofit Assistant for Steps to Victory (STEM and youth programs, grants, partnerships).',
  ministry: 'You are her Ministry Assistant for SOCCKZOO church work.',
  wellness: 'You are her Wellness Assistant. Encourage movement, rest and consistency. Do not diagnose, give medical advice, or focus on body image.',
}

const BASE = `You work for D'Andrea Bolden inside her personal Executive Management System (EMS).
She provides the vision; you help move it forward. Reduce her cognitive load: be concise, concrete, and use her plain language, not corporate jargon.
You prepare work; you do not send, publish, or spend anything. Anything public or external is a draft for her approval.
Do not create busywork. If the best move is to do nothing, say so.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const { agentKey, instruction, context } = await req.json()
    if (typeof instruction !== 'string' || !instruction.trim()) return json({ error: 'Missing instruction.' }, 400)

    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      // Retry on a fallback model if the primary declines.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: `${BASE}\n\n${ASSISTANTS[agentKey] ?? ASSISTANTS.executive}`,
      messages: [{ role: 'user', content: `What's in EMS right now:\n${context ?? '(nothing provided)'}\n\nRequest:\n${instruction}` }],
    } as Parameters<typeof client.beta.messages.create>[0])

    if (response.stop_reason === 'refusal') return json({ error: 'The AI declined this request.' }, 422)
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n').trim()
    return json({ text })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'The AI is busy. Try again in a minute.' }, 429)
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'The AI key is missing or invalid.' }, 500)
    if (e instanceof Anthropic.APIError) return json({ error: `AI error ${e.status}` }, 502)
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500)
  }
})
