# Content Studio, AI Team approvals, and initiative workspaces

This upgrade extends the existing EMS. Nothing existing was removed or renamed, and every existing route still works.

## The workflow

```
Create campaign → Draft (by hand or with an assistant) → Edit → Submit for approval
→ Approve (or Request changes → Draft → Resubmit) → Schedule on the platform yourself
→ Record "scheduled" in EMS → Record "published" (with link) → Enter results with their source
```

| Status | Meaning |
| --- | --- |
| Draft | Being written. Assistants only ever create drafts. |
| Needs review | Submitted for approval. |
| Changes requested | Sent back by an approver, with a required reason. |
| Approved — not scheduled | Approved internally. **Nothing is scheduled or posted.** |
| Scheduled (recorded) | A person scheduled it on the platform and recorded where and for when. |
| Published (recorded) | A person confirmed it went live (date, optional link). |
| Archived | Kept for history. |

The rules are in `src/domain/content.ts`:

- `transition()` refuses any move the workflow doesn't allow.
- Approving records who approved it and when. It never sets a schedule.
- "Scheduled" requires where it was scheduled and the date. "Published" requires the publication date.
- Changing the wording of approved copy sends it back to Draft, so it has to be approved again.
- Scheduled and published copy is locked.

Every edit keeps the previous version (revision history). Every status change records who made it, when, and why.

## Who can approve

| Role | Can do |
| --- | --- |
| `owner` | Everything, including approving and requesting changes |
| `approver` | Same as owner for content |
| `editor` | Write, edit, submit for approval, return to draft, record scheduling and publishing |
| `viewer` | Read only |

This is enforced in two places:

- **The app** shows Approve and Request changes only to owners and approvers.
- **The database** has a trigger (`ems_guard_content_approval`) that refuses approval or change requests from anyone else, even if they bypass the app.

Anyone with an account when the migration runs becomes `owner`. Accounts created later default to `editor`. To change someone's role, open the Supabase SQL editor:

```sql
insert into ems_user_roles (user_id, role)
values ('<their user id from Authentication → Users>', 'approver')
on conflict (user_id) do update set role = excluded.role;
```

> Note: EMS data is private to each account (row-level security). A second user has their own separate EMS. They don't see D'Andrea's records, so team approval inside one shared workspace is not part of this release.

## Database changes (migration `supabase/migrations/20261016000000_content_studio.sql`)

The migration only adds things. It does not drop, rename or rewrite any existing table, column or row, and it is safe to run more than once.

- **New tables:**
  - `ems_content_revisions`
  - `ems_content_events` (status history)
  - `ems_campaign_metrics`
  - `ems_brand_settings`

  They have the same shape and row-level security as the existing `ems_*` tables, with indexes on `campaign_id` / `content_id`.
- **New column** `ems_content.campaign_id`, with an index.
- **Reused tables:** campaigns stay in `ems_campaigns` and drafts in `ems_content`. The record shapes were extended; older records load unchanged, and the old status names `idea` and `needs_approval` are read as `draft` and `needs_review`.
- **Roles:** the new `ems_user_roles` table, the `ems_can_approve()` function, and guard triggers on `ems_content` and `ems_content_events`.
- **Links between records** (draft → campaign, revision → draft) are maintained by the app and indexed. They are not foreign keys, because the app saves each record in its own request and can't guarantee the order.

**Tested:** all three migrations were applied in order to a scratch PostgreSQL 16 database, with stand-ins for Supabase's sign-in system. The checks in `supabase/tests/content_studio_rules.sql` then confirmed:

- An editor can't approve, request changes, or forge an approval record.
- The owner can complete the full flow.
- Users can't change their own role.
- Each user sees only their own rows.
- Anonymous visitors see nothing.

These checks were **not** run against the live Supabase project.

**If the migration hasn't been run yet:**

- The rest of EMS keeps working, and drafts and campaigns still save.
- The Studio shows a notice that revision history, approval records, metrics and brand settings can't be saved until it runs.
- Approving is turned off, because roles can't be read.

## Integrations: what is connected and what is not

| Integration | Status |
| --- | --- |
| AI drafting (Claude via the `ems-ai` edge function) | **Connected**, if the function is deployed. Redeploy it to pick up the updated instructions (no invented facts; missing information marked `[Needs confirmation]`). |
| Meta Business Suite (Facebook, Instagram) | **Not connected.** EMS gives you the approved copy to copy and a link to Meta's content calendar, then records the schedule and publication details you enter. |
| TikTok, YouTube | **Not connected.** Same workflow: platform drafts, approval, planned date, recorded external status, published link, results. |
| Email platform | **Not connected.** Email drafts have a subject, preview text, list reference, call to action and approval. EMS never sends email. Put your email platform's link in the initiative's Email guidance. |
| Performance data | **Entered by hand,** with the source and period required. Nothing is fetched or estimated. |
| Media | **Links only** (for example Canva or Drive). File upload isn't connected. |

**Before building direct Meta publishing:**

- It needs a Meta Business account, a Facebook Page and an Instagram professional account linked to it, and a Meta developer app.
- The app needs `pages_manage_posts`, `pages_read_engagement`, `instagram_basic` and `instagram_content_publish`, and passing Meta's App Review.
- Page access tokens must be stored server-side (for example a Supabase secret plus an edge function), never in the browser.
- Instagram publishing requires media at a public URL.

None of this exists yet, so EMS doesn't claim to publish.

## Initiatives

Every initiative page now has four tabs: **Overview**, **Campaigns & content**, **Brand & setup**, and **People & events**. New initiatives can be added from the **+** next to "My areas", with no code change.

- **Growth & Innovation Hub** was added as an initiative. Its five focus areas are **not in the repository**, so EMS asks for them and won't invent them.
- **Becoming Her:** its two pathways are **not in the repository** either. EMS asks for them.
- **Build Your Ark** stays standalone. Its six suggested workstreams are optional, one click each, and are only added if you choose them.
- **Faith + Mental Health Summit** stays a standalone initiative, as before. Speakers and partners are recorded under People & events. Registrations are tracked as a campaign metric.
- **DBM Learning Institute's** focus areas remain its learning areas (Faith + Mental Health, plus four still to name).

## Environment variables

These are unchanged: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_AI_ENABLED` (public, in `.env.production`), plus the `ANTHROPIC_API_KEY` Supabase secret (server-side only). No new variables are needed.

## Deploying

1. In Supabase, open the **SQL Editor**, paste in `supabase/migrations/20261016000000_content_studio.sql`, and click **Run**.
2. Optional: redeploy the `ems-ai` edge function from `supabase/functions/ems-ai/index.ts`.
3. Merge the pull request. Vercel builds and deploys `main` as before.
4. Hard-refresh the site.
