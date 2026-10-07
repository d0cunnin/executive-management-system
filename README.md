# D’Andrea Bolden — Executive Management System (EMS)

A private executive management system for D’Andrea Bolden: one place for her life, organizations, programs, books, content, projects, income, wellness and ideas. It has an AI team that helps move the work forward.

> D’Andrea provides the vision. EMS helps move the vision forward.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

With no configuration, EMS runs in **demo mode**:

- There is no password.
- Data stays in this browser (`localStorage`).
- The app is loaded with clearly marked **sample** data.

| Command | What it does |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run build` | Typecheck and production build to `dist/` |
| `npm test` | Unit tests for the EMS intelligence (Vitest) |
| `npm run lint` | Lint (oxlint) |

## Connect real sign-in, storage and AI

1. Create a Supabase project. Put its URL and **anon** key in `.env.production` (already set for D’Andrea’s project) and, for local development, in `.env`. Never commit the service_role key.
2. Apply the schema in `supabase/migrations/` with `supabase db push`, or paste it into the SQL editor. Every table has row-level security, so each row is private to its owner.
3. Restart the app. Sign-in now uses Supabase email and password, and data saves to Postgres. A first-time sign-in starts with the sample data.
4. For AI, deploy the edge function and turn it on:
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase functions deploy ems-ai
   ```
   Then set `VITE_AI_ENABLED=true`. The API key stays on the server and never reaches the browser.

## What is real today, and what is not

EMS never claims that something was researched, sent or published when it wasn't.

- **Built-in planner (works now, no AI needed).** The code in `src/ai/intelligence.ts` reasons over D’Andrea’s actual EMS data. It produces:
  - TODAY
  - Needs Attention
  - What Should I Work On Next
  - Move This Forward
  - Quick Capture classification
  - the first-pass view on ideas
  - finding income in what she already has
  - the connected "everything related to…" view
  - the briefs and reviews
- **Assistants without AI connected.** They prepare structured templates built from her data. Each one is labeled **Built-in template**.
- **Connected AI.** With the edge function on, assistants write full drafts, labeled **AI draft**. The assistant answers open-ended questions.
- **Approvals.** Public, external or financial work goes Draft → Needs approval → Approved → Done. Approving marks it ready, but nothing is sent: email, social, payments and calendar sync are **not connected yet**, and the app says so where it matters.
- **Research.** Outside research (grants, conferences, market trends) needs connected AI with web access. Until then, EMS lists the questions it would research and says it has not researched them.

## How the code is organized

```
src/
  domain/      types.ts (data model) · labels.ts (D’Andrea’s language for the UI)
  data/        store.ts (in-memory store + pluggable persistence)
               localPersistence.ts · supabasePersistence.ts · seed.ts (sample data)
  ai/          intelligence.ts (reasoning over data) · skills.ts (what each assistant can do)
               assistant.ts (natural-language questions) · provider.ts (AI seam)
  auth/        Supabase or demo sign-in; every EMS route is protected
  components/  Layout, Quick Capture, New Project, Move This Forward, Finish Project, approvals, search
  pages/       Today, Command Center, Areas, My Work, Projects, To-dos, Calendar,
               Ideas & Opportunities, Income, Wellness, My AI Team, Ask EMS, My Information, Briefs & Reviews
supabase/
  migrations/  Postgres schema with row-level security
  functions/   ems-ai edge function (Claude API, server-side key)
```

**Key design decisions**

- **Plain language.** Code uses technical names (`Project`, `WorkMode`, `IncomeCertainty`). Every visible word comes from `domain/labels.ts`: I DO IT / AI HELPS ME / AI DOES IT, WHAT MOVED FORWARD, IDEAS & OPPORTUNITIES, MY INFORMATION, INCOME.
- **One store, swappable storage.** Screens read with `useDB()` and write through `store.create/update/remove`. Moving from browser storage to Supabase changes no UI code.
- **Relationships are first-class.** `links` connects any two records (book → course → offer → income). That is what powers “Show me everything related to Faith + Mental Health”.
- **Areas never complete. Projects do.** Ongoing work repeats on a schedule. Finishing a project means a short reflection, then WHAT COMES NEXT. History is kept.
- **Income certainty is explicit.** Every entry is Received, Expected, Forecast or Estimate. Only Received is ever counted as money in hand.
- **No invented structure.** DBM Learning Institute has five learning areas. Only *Faith + Mental Health* is entered. EMS leaves room for the other four and does not guess them.

## Build phases

| Phase | Status |
| --- | --- |
| 1. Foundation: auth, layout, navigation, TODAY, areas, projects, to-dos, calendar, Quick Capture, assistant, search, sample data, mobile | **Built** |
| 2. Work management: project lifecycle, Move This Forward, ongoing work, waiting on, needs attention, finishing, history, reports | **Built** (campaigns and goals shown; full editing next) |
| 3. Income: dashboard, offers, revenue tracking, monetization analysis | **Started:** dashboard, certainty, offers, “income you could unlock” |
| 4. Marketing: campaign builder, content calendar, platform-specific content, analytics | **Started:** campaign strategy and platform-specific post planning skills, repurposing |
| 5. Opportunities: scoring, What Should I Work On Next, What Comes Next, discovery | **Started:** idea evaluation, what next, what comes next, internal asset scan |
| 6. AI team: agents, skills, workflows, approvals, activity | **Built** on the built-in planner; full drafting when AI is connected |
| 7. Knowledge: My Information, relationships, semantic search | **Started:** connected view, notes, relationships, keyword search |
| 8. Integrations: calendar, email, storage, social, payments, analytics | Architecture ready; nothing connected |
