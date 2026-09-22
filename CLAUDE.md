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

`ALLOWED_EMAILS` appears in `.env.example` and the README describes an allowlist, but **no code reads it** — there is currently no allowlist enforcement. Don't assume it exists.

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

`status` (`building | shipped | in_review | reviewed`), `reviewer_note`, and `reward` are **read-only from this app** — no code path writes them. They are filled in on the reviewer's side, and the status default comes from the DB. `STATUS_LABEL` in `app/dashboard/components/ProjectCard.tsx` maps them to the playful user-facing strings.

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

`app/api/public/wonders` and `app/api/public/players` perform no session check and are consumed client-side by `app/explore/page.tsx`. Note that the players route returns every profile's `email` in its response — treat any change there as a change to what's publicly exposed.

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
