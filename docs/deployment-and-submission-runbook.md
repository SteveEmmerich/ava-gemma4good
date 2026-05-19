# Ava Deployment and Submission Runbook

This runbook turns the local hackathon demo into a public, judge-ready submission.

Public demo URL: `https://ava-gemma4good.pages.dev`

Ava Brain URL: `https://ava-brain.solitary-mode-3b63.workers.dev`

## Current Architecture

- `ava-brain` is a stateless Cloudflare Worker.
- `ava-mobile` exports the final Expo web app to Cloudflare Pages.
- `ava-mobile/web-preview` remains a legacy Bun-hosted preview server with HTML pages and API routes.
- Vibebase staging is the canonical SAL identity surface.
- The full public demo requires both the Brain URL and the Pages URL to be reachable.

## Deployment Plan

### Phase 1: Local Full Test

Goal: prove the complete flow works before public deployment.

1. Start the Brain.

```sh
bun --cwd apps/ava-brain dev -- --port 8787
```

2. Start the web/mobile preview.

```sh
EXPO_PUBLIC_AVA_BRAIN_URL=http://localhost:8787 bun --cwd apps/ava-mobile preview:web
```

3. Run deterministic checks.

```sh
bun test
bun run typecheck
```

4. Run live staging checks.

```sh
LIVE_AVA_TESTS=true AVA_WEB_URL=http://localhost:8081 bun test apps/ava-mobile/test/live-user-flow.test.ts

LIVE_AVA_TESTS=true \
VIBEBASE_IDENTITY_URL=https://identity.vibebase.app \
EXPO_PUBLIC_AVA_BRAIN_URL=http://localhost:8787 \
bun test packages/sal-client/test/live.staging.test.ts
```

5. Manually verify:

- [ ] `http://localhost:8081/` creates a new user-generated Ava.
- [ ] `http://localhost:8081/admin` runs the live SAL smoke.
- [ ] Generated blueprint names, actions, and schedules match the prompt.
- [ ] Staging agent ID, claim URL, tier, and token preview render.
- [ ] Failure states are readable if the Brain or Vibebase is offline.

### Phase 2: Deploy `ava-brain`

Goal: publish the Gemma 4 blueprint Worker.

```sh
bun --cwd apps/ava-brain deploy
```

After deploy, record the Worker URL and smoke it:

```sh
AVA_BRAIN_PUBLIC_URL=https://ava-brain.<account-subdomain>.workers.dev

curl -sS "$AVA_BRAIN_PUBLIC_URL/generate-blueprint" \
  -H "Content-Type: application/json" \
  -d '{"transcript":"Build an assistant for a food pantry that summarizes intake notes and drafts follow-up texts."}'
```

Acceptance criteria:

- [ ] Response is a normalized `{ "success": true, "data": ... }` envelope.
- [ ] Output validates against the blueprint schema.
- [ ] The public Worker is using `@cf/google/gemma-4-26b-a4b-it`.

### Phase 3: Deploy the Web/Mobile Preview

Goal: publish the judge-facing app.

Final hackathon path: export the Expo web app and deploy `apps/ava-mobile/dist` to Cloudflare Pages project `ava-gemma4good`.

Required environment:

```sh
EXPO_PUBLIC_AVA_BRAIN_URL=<public ava-brain worker url>
EXPO_PUBLIC_VIBEBASE_IDENTITY_URL=https://identity.vibebase.app
EXPO_PUBLIC_VIBEBASE_GATEWAY_URL=https://gateway.vibebase.app
```

Export command:

```sh
EXPO_PUBLIC_AVA_BRAIN_URL=https://ava-brain.solitary-mode-3b63.workers.dev \
EXPO_PUBLIC_VIBEBASE_IDENTITY_URL=https://identity.vibebase.app \
EXPO_PUBLIC_VIBEBASE_GATEWAY_URL=https://gateway.vibebase.app \
bun --cwd apps/ava-mobile run export:web
```

Deploy command:

```sh
bunx wrangler pages deploy apps/ava-mobile/dist --project-name ava-gemma4good --branch main --commit-dirty=true
```

Acceptance criteria:

- [x] Public `/` loads the final Expo user-facing flow.
- [x] Public app shows the deployed Brain URL and staging Vibebase URLs.
- [x] Public app completes transcript -> blueprint -> staging SAL token.
- [x] Browser smoke produced `Legal Aid Triage Assistant`, orphan tier, token preview, and a claim URL.

### Phase 4: Deployed E2E

Goal: run the same test suite against public URLs.

Manual deployed smoke: open `https://ava-gemma4good.pages.dev`, enter a new nonprofit prompt, and click `Try the live blueprint`.

Acceptance criteria:

- [x] Manual prompt creates a real staging agent.
- [x] Generated blueprint matches the prompt.
- [x] Claim URL, orphan tier, and token preview render.
- [x] No localhost URLs remain in public output, README, or `SUBMISSION.md`.

## Media Generation Tasks

Create a `media/` folder at the repo root for final assets:

```sh
mkdir -p media/screenshots media/video
```

### Screenshot Checklist

- [ ] Public landing screen before input.
- [ ] Filled food pantry prompt before submit.
- [ ] Generated blueprint result with actions visible.
- [ ] Staging identity section with claim URL/token preview visible.
- [ ] Admin page showing live SAL smoke success.
- [ ] Admin contracts/status panel.

Recommended filenames:

```txt
media/screenshots/01-landing.png
media/screenshots/02-prompt.png
media/screenshots/03-blueprint-result.png
media/screenshots/04-staging-identity.png
media/screenshots/05-admin-smoke.png
media/screenshots/06-contracts.png
```

### Video Shot List

Target length: 2-3 minutes.

1. Hook: show the public page and explain the food pantry/community-service problem.
2. Prompt: type a new nonprofit workflow request.
3. Generate: click `Create My Ava` and show Gemma 4 producing the blueprint.
4. Lifecycle: show staging agent ID, claim URL, token preview, and why Ava consumes Vibebase instead of owning identity.
5. Admin: open `/admin`, run live SAL smoke, and point to the contract boundary.
6. Architecture: briefly show `ava-brain`, `ava-mobile`, `shared-types`, and `sal-client`.
7. Close: explain how this helps small teams safely move from need -> agent -> claimable identity.

### Video Recording Checklist

- [ ] Use the deployed public URLs, not localhost, unless recording a backup dev cut.
- [ ] Use a fresh prompt that is not prefilled.
- [ ] Keep terminal/log windows out of the main product walkthrough except during the architecture cut.
- [ ] Show the generated output long enough for judges to read it.
- [ ] Mention Gemma 4 by model family and Cloudflare Workers AI.
- [ ] Mention Vibebase staging as the identity/SAL provider.
- [ ] Export one `mp4` and one thumbnail image.

Recommended files:

```txt
media/video/ava-gemma4good-demo.mp4
media/video/ava-gemma4good-thumbnail.png
```

## Submission Package Tasks

- [ ] Add `SUBMISSION.md`.
- [x] Add final public demo URL.
- [ ] Add public repo URL.
- [x] Add Brain Worker URL.
- [ ] Add screenshots from `media/screenshots`.
- [ ] Add demo video link.
- [ ] Draft DEV.to article.
- [ ] Draft Gemma4Good/Kaggle writeup.
- [ ] Add limitations section: staging identity, prototype UI, no production claim auth in demo yet.
- [ ] Final deployed E2E after all links are in place.
