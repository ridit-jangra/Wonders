# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

Package manager is **Bun**, pinned to `bun@1.3.13` via `packageManager`. Do not use npm/yarn/pnpm — `bun.lock` is the committed lockfile.

```bash
bun install
bun run dev      # next dev, http://localhost:3000
bun run build    # next build
bun run start    # next start
bun run lint     # eslint (flat config, eslint-config-next)
```

There is no test framework, test script, or test files in this repo. `bun run lint` plus `bun run build` (which typechecks) are the only automated checks.

The landing page renders with zero configuration. Env vars are only needed once you touch auth, the dashboard, or anything reading Supabase.

## Stack notes

Next.js 16 App Router, React 19, Tailwind v4, framer-motion. Read `AGENTS.md` (imported above) before writing Next.js code — this version has breaking changes from older App Router conventions. Two consequences show up constantly here:

- `params` and `searchParams` are **Promises** and must be awaited (see `app/dashboard/projects/edit/[id]/page.tsx`).
- Layouts use the generated `LayoutProps<"/">` helper type rather than hand-written props (see `app/layout.tsx`).

Tailwind v4 has **no `tailwind.config`**. Theme tokens live in the `@theme inline` block in `app/globals.css`; add new fonts/colors there. `font-finger-paint` is the signature display font used for nearly all UI copy.

## Architecture

### Auth is hand-rolled — Supabase Auth is NOT used

The whole auth stack is in `lib/hc-auth.ts` plus `app/api/hc-auth/*`:

1. `/api/hc-auth/login` generates a random `state`, stores it in the `wonders_hc_auth_state` cookie, and redirects to `auth.hackclub.com/oauth/authorize`.
2. `/api/hc-auth/callback` verifies `state`, exchanges the code, fetches `/api/v1/me`, and mints the session cookie.
3. The session cookie `wonders_session` is `base64url(JSON payload) + "." + HMAC-SHA256`, signed with `SESSION_SECRET`, 7-day expiry, verified with `crypto.timingSafeEqual`. It is not a JWT.

**Identity is keyed by `slack_id`, not email.** `profiles.slack_id` is the upsert conflict target and the lookup key everywhere (`getProfile(session.slackId)`). Email is stored but never used to resolve a user.

The callback requests the same HCA scopes Pixl uses for shop orders (`openid profile slack_id phone birthdate address basic_info`, see `HC_AUTH_SCOPE`) and calls `syncHcaIdentity` in `lib/profiles.ts` on **every login**, which upserts the profile row (so a row now exists before onboarding — `interest` being null is what marks "not onboarded", hence `/wonders` checks `!profile?.interest`). Birthday, phone, and `address_*` are stored AES-256-GCM encrypted via `lib/crypto.ts` (`PII_ENCRYPTION_KEY`, same `gcm1:` format as Pixl) and only decrypted by `getProfileIdentityAdmin` for `/admin/users/[id]`. `slack_display_name`/`slack_avatar_url` come from Slack `users.info` (bot needs `users:read`) and are the only names safe to show publicly.

### There is no middleware — every protected route guards itself

There is no `middleware.ts`. Each protected page repeats this guard inline:

```ts
const session = verifySessionCookie((await cookies()).get(SESSION_COOKIE)?.value);
if (!session) redirect("/login");
const profile = await getProfile(session.slackId);
if (!profile) redirect("/onboarding");
```

`app/dashboard/layout.tsx` also guards (and additionally redirects to `/onboarding` when `profile.interest` is unset), but **you cannot rely on the layout**: `/wonders` and `/explore` live outside `app/dashboard/`, so they never hit that layout and import `Sidebar` from `app/dashboard/components/` directly. Any new protected page must carry its own guard.

### Server actions re-verify from scratch

Inline `"use server"` actions never trust the session captured in the enclosing page's closure. They re-read cookies, re-verify, re-fetch the profile, and re-fetch the target row to confirm ownership before mutating. Follow this pattern for any new action — see `submitProject` and `deleteProjectAction` in the edit page.

### Supabase uses the service role key, so ownership is enforced in application code

`lib/supabase.ts` builds a single server client with `SUPABASE_SERVICE_ROLE_KEY`. **This bypasses RLS entirely.** The safety property comes from every mutation in `lib/projects.ts` taking a `profileId` and chaining `.eq("profile_id", profileId)` alongside `.eq("id", id)`. Preserve that — a query scoped only by `id` is a cross-tenant write.

`lib/supabase.ts`, `lib/profiles.ts`, `lib/projects.ts`, and `lib/slack.ts` all start with `import "server-only"` so the service key can never be pulled into a client bundle. Keep that import on any new module touching Supabase or secrets.

### Database schema lives only in Supabase

There are no migrations or SQL files in the repo. The `Profile` and `Project` TypeScript interfaces in `lib/profiles.ts` and `lib/projects.ts` are the de-facto in-repo schema documentation — update them when the remote schema changes. Two tables: `profiles` (one row per person, keyed by `slack_id`) and `projects` (linked by `profile_id`). Both have an `updated_at` the app writes but the interfaces omit.

**`projects.id` is a plain auto-incrementing integer (`generated always as identity`), not a uuid** — the one exception to every other id in this schema (`profiles.id`, `project_history.id`). `lib/projects.ts` exports a `ProjectId = string | number` type and every function taking a project id accepts either, since callers sometimes have a route-param string (`await params`) and sometimes a `Project`'s already-numeric `.id`. `recordProjectHistory` normalizes it to a number before inserting — an INSERT body isn't cast from a string the way a URL filter is.

`status` is the wonder's full lifecycle, enforced by the `projects_status_check` constraint in Supabase and by `lib/projects.ts` (there is no generic "set status to anything" function — every transition is its own function scoped to the status it leaves from):

```
building -> in_review (first pass) -> second_pass -> shipped -> fulfillment_started -> fulfilled
                     \-> rejected        \-> rejected
```

`rejected` sends it back to the player (`shipProject` accepts `building` or `rejected` as the starting state), who can edit and reship to `in_review`. Only the `building -> in_review` transition (via `shipProject`, called from the player's own "Ship it" button) is player-facing — every other transition is admin-only, driven by action buttons on `/admin/review/[id]` and `/admin/fulfillment`, never a raw status dropdown. `reviewer_note` and `reward` are likewise **read-only from the player-facing app** — nothing under `/dashboard` or `/wonders` writes them. `STATUS_LABEL` in `app/dashboard/components/ProjectCard.tsx` (and `ProjectCardWide.tsx`) maps every status to a playful user-facing string.

**`reward` is a surprise and must never be rendered back to the player.** The whole point of this YSWS is that the reward is a surprise, so no component under `app/dashboard/`, `app/wonders/`, `app/explore/`, or any `/api/public/*` route should ever read or display `project.reward`. It's only read by `/admin` (the review panel, fulfillment, history, user detail) — keep it that way when touching any player-facing view.

`fulfilled_at`/`fulfilled_by` on `projects` are timestamp/actor metadata recorded alongside the `-> fulfilled` transition (set by `fulfillProject`) — see `/admin/fulfillment` below. They're admin-only too and live only on `ProjectWithOwner` (the admin query shape in `lib/projects.ts`), not on the base `Project` interface player-facing code uses.

### `/admin` is the reviewer-facing dashboard

Gated by `requireAdmin()` in `lib/admin.ts`, which uses its **own** Hack Club Auth app and its own session — never the player `wonders_session`. `/api/admin-auth/login` + `/callback` sign in with `ADMIN_HC_AUTH_CLIENT_ID`/`ADMIN_HC_AUTH_CLIENT_SECRET` (scopes `openid profile slack_id`), reject anyone whose `slack_id` isn't in the comma-separated `ADMIN_SLACK_IDS` allowlist, and mint `wonders_admin_session`: same `payload.HMAC` format as the player cookie but signed with `SESSION_SECRET + ":admin"` so a player cookie can't be swapped in, 12h expiry, and the allowlist is re-checked on every verify. `requireAdmin()` redirects to `/api/admin-auth/login` when there's no admin session. There's no `is_admin` column or `admins` table, and the layout guard (`app/admin/layout.tsx`) is trusted for the whole tree since nothing outside `app/admin/` imports these routes or components. Every status-changing action in `app/admin/review/[id]/page.tsx` and `app/admin/fulfillment/page.tsx` (`approve`/`reject`/`publish`/`beginFulfillment`/`markFulfilled`) still re-verifies with `requireAdmin()` itself rather than trusting the page closure, per the server-actions convention above.

- `lib/admin.ts` — the guard.
- `lib/admin-stats.ts` — program-wide counts for the overview page.
- `lib/project-history.ts` + the `project_history` table — an append-only audit trail (`from_status`, `to_status`, `reviewer_note`, `reward`, `reviewed_by` = admin's slack_id, or the player's own slack_id for the `-> in_review` transition) written alongside every status change. Not scoped by ownership; it's cross-tenant by design. `to_status` is typed `ProjectEvent = ProjectStatus`.
- The `listAllProjects`/`listAllProfiles`/`reviewProject`/`publishProject`/`startFulfillment`/`fulfillProject`/`getProjectWithOwner`/`getProfileByIdAdmin` functions in `lib/projects.ts`/`lib/profiles.ts` are admin-only and deliberately **not** scoped by `profile_id` — that's correct here (access is already gated by `requireAdmin()`), but don't reuse them from player-facing code, and don't copy their unscoped-query pattern into `lib/projects.ts` functions that player-facing routes call.
- A review action calls `revalidatePath("/dashboard")` and `revalidatePath("/wonders")` same as any other status-changing mutation.
- Review is two passes (a fraud-review step will later sit between them, in another tool, not built yet). `/admin/review` has First pass (`in_review`) and Second pass (`second_pass`) tabs. `/admin/review/[id]` is a two-column layout: left is thumbnail, title, markdown description (`components/Markdown.tsx`, raw HTML off), owner card with a Slack deep link, and tabs for Commits (`lib/commits.ts`, GitHub API, optional `GITHUB_TOKEN`), Hackatime (`lib/hackatime.ts`, public stats API by slack_id), Past reviews, and Other YSWS (`lib/ysws.ts`, the whole ships.hackclub.com feed cached in memory 5 min and matched by repo/demo/GitHub user — it has no lookup endpoint); the slow tabs are async components behind `Suspense`. Right is a sticky column capped at the viewport: on-hold toggle (`projects.on_hold`/`hold_reason`), edit submission, and `components/ReviewPassForm.tsx` (1. Submission → 2. Audit notes → 3. Verdict). `firstPassReview` (in_review → second_pass | rejected) and `secondPassReview` (second_pass → shipped | rejected) each write a `project_reviews` row (internal technical/additional notes, which never reach the player, plus second-pass `checks` from `SECOND_PASS_CHECKS` in `lib/reviews.ts`, all required to approve) and a `project_history` row; the note to the player lands in `projects.reviewer_note`.  There is no separate publish step: a second-pass approval ships the wonder straight to `shipped`, which makes it public (Explore, `/api/public/*`) and puts it in `/admin/fulfillment`. `approved` is still allowed by `projects_status_check` but nothing transitions into it any more. Everything typed into the pass form autosaves (800ms debounce, flushed on tab hide) to `review_drafts` — one shared admin-only row per `(project_id, pass)`, never visible to the player — through the `autosaveDraft` server action, which re-checks `requireAdmin()` and that the wonder is still in that pass; the draft is deleted when the verdict lands. Second pass loads its draft if one exists, otherwise prefills from the latest approved first-pass review.
- `/admin/fulfillment` lists `shipped` and `fulfillment_started` projects — published wonders still working through the reward order. "Start fulfillment" (`shipped -> fulfillment_started`) and "Mark fulfilled" (`fulfillment_started -> fulfilled`, which also stamps `fulfilled_at`/`fulfilled_by`) are separate buttons; the reward itself is set here via `setProjectReward`, scoped to those same two statuses, and "Mark fulfilled" is blocked until a reward's been chosen.
- `/admin` is styled with Hack Club's own theme (theme.hackclub.com): the palette, light/dark modes, radii, shadows, pill buttons/badges and Phantom Sans all live as tokens in `app/admin/admin.css` (monospace stays JetBrains Mono), and icons come from `@hackclub/icons` (icons.hackclub.com). Pages compose only the components in `app/admin/components/ui.tsx` — `PageHeader`, `Card`/`CardHeader`/`CardLink`, `Button`/`ButtonLink`/`ActionButton` (wraps `SubmitButton`'s pending guard), `Badge`/`StatusBadge`, `Stat`/`StatGrid`, `Table`/`EmptyRow`, `FilterBar`/`Field`/`Input`/`Select`/`Textarea`, `DescriptionList`, `HistoryTimeline`, `Callout`, `EmptyState`, `Avatar`, `TextLink`, `Mono`, `Icon`, `Pagination`. Add new admin UI by extending that kit, never with raw colors or one-off classes in a page.

### Thumbnails go through Supabase Storage

Optional wonder thumbnails upload to the public `wonder-thumbnails` bucket through `lib/storage.ts`, which checks the MIME type and a 5MB ceiling before writing to `<profile_id>/<uuid>.<ext>`. The public URL it returns is what lands in `projects.image_url` — the one column on `projects` the app does write. `/project-image-fallback.png` still backs every card when it is null.

The file rides in a Server Action FormData, so `next.config.ts` raises `experimental.serverActions.bodySizeLimit` to `6mb`; the 1MB default would reject a 5MB image. `ThumbnailPicker.tsx` is a client component purely for the object-URL preview, and posts two fields into the surrounding form: `thumbnail` (the file) and `remove-thumbnail` (a flag the edit action reads to null the column).

### Every mutation and navigation shows a pending state

Double-clicking a submit button used to fire the Server Action twice and create duplicate rows, so nothing in the dashboard submits or navigates without feedback:

- `SubmitButton.tsx` wraps `useFormStatus` (react-dom) and disables itself while its form's action runs. The hook reads the *nearest parent form*, so it must stay its own client component — inlining it into a page would always report `pending: false`. Used by the create, edit, and onboarding forms.
- `LinkPending.tsx` wraps `useLinkStatus` (next/link) and covers its link while the navigation is in flight. Same rule: it has to render *inside* the `<Link>`, and that link must be positioned for `inset-0` to land. Defaults to the `/loader.gif` overlay the explore page uses; pass children for a text label on small links.
- `DeleteProjectButton.tsx` predates both and rolls its own `useTransition` pending state.

Any new Server Action form or dashboard link should reuse these rather than a bare `<button type="submit">`.
### `/api/public/*` is deliberately unauthenticated

`app/api/public/wonders` and `app/api/public/players` perform no session check and are consumed client-side by `app/explore/page.tsx`. Both filter projects to `status in (shipped, fulfillment_started, fulfilled)` — only published wonders are public; anything still building, in review, rejected, or approved-but-unpublished is excluded. The players route returns **no PII** — only `slack_id`, Slack display name/avatar, `joined_at`, and published wonders with a `wonder_count`. Never add `email`, `name`/`first_name`/`last_name`, or any HCA PII column to it; it selects columns explicitly for that reason.

### "Projects" in code, "Wonders" in the UI

The DB tables, `lib/projects.ts`, and the `/dashboard/projects/*` routes all say *projects*. Everything user-facing says *Wonders*, including the `/wonders` route and `/api/public/wonders`. Recent commits renamed the user-facing layer only — don't propagate the rename into the DB or `lib/`.

## UI conventions

The design is built on hand-drawn PNG templates in `public/`. Cards and forms are a full-bleed background `<img>` with content absolutely positioned on top using **percentage offsets** (`top-[51%] left-[14%] ...`). Changing a card's size, aspect ratio, or copy length usually means retuning those percentages rather than adjusting flow layout.

Most files open with `/* eslint-disable @next/next/no-img-element */` — plain `<img>` is a deliberate choice for these overlays and the fixed full-screen backgrounds, not an oversight. Keep the disable comment when adding to those files.

Interactive bits are the exception rather than the rule: server components by default, `"use client"` only where genuinely needed (`DeleteProjectButton.tsx` for its confirm modal, `explore/page.tsx` for tab fetching). `Story.tsx` pins a 700vh sticky frame and maps scroll progress onto per-word opacity/position with framer-motion.

After a mutation that isn't followed by a `redirect`, call `revalidatePath` for both `/dashboard` and `/wonders` — they render the same project list from different routes.

## Environment

`.env` and `.env.local` are both gitignored (`.gitignore` matches `.env*`); `.env.example` is the template. Required for the dashboard: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `HC_AUTH_CLIENT_ID`, `HC_AUTH_CLIENT_SECRET`, `SESSION_SECRET`. `HC_AUTH_REDIRECT_URI` is optional and defaults to `<origin>/api/hc-auth/callback`.

`SLACK_BOT_TOKEN` and `SLACK_CHANNEL_ID` drive `inviteToChannel`, called fire-and-forget from the OAuth callback — it logs failures rather than throwing, so a missing Slack config breaks channel invites but not login.

Missing env vars fail loudly at import time via the `getEnv` throw in `lib/supabase.ts`, which surfaces as a server error on the first page that touches the database.
