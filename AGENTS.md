# Ava Submission Kanban

Working theme: **Ava helps small nonprofits and community service teams create safe, claimable AI agents from plain-language needs.**

## Done

- [x] Monorepo scaffold with `ava-brain`, `ava-mobile`, `shared-types`, and `sal-client`.
- [x] Cloudflare Worker Brain endpoint: `POST /generate-blueprint`.
- [x] Gemma 4 configured as the Brain model: `@cf/google/gemma-4-26b-a4b-it`.
- [x] Blueprint schema validation and deterministic error envelopes.
- [x] Typed Vibebase SAL client with envelope normalization.
- [x] Expo/mobile lifecycle state machine tests.
- [x] Public web/mobile preview with user-generated end-to-end `Create My Ava` flow.
- [x] Admin page at `/admin` with lifecycle, live SAL smoke, staging metrics, and contracts.
- [x] Gated live E2E tests for staging flows via `LIVE_AVA_TESTS=true`.
- [x] Reframed the demo around community-service organizations.
- [x] Deployed `ava-brain` Worker: `https://ava-brain.solitary-mode-3b63.workers.dev`.
- [x] Deployed final Expo web demo: `https://ava-gemma4good.pages.dev`.
- [x] Deployed public preview Worker: `https://ava-mobile-preview.solitary-mode-3b63.workers.dev`.

## In Progress

- [ ] Submission narrative for Gemma4Good and DEV.to.
- [x] Public deployment plan for web preview and `ava-brain`.
- [ ] README polish for judges and reviewers.
- [x] Demo video script and shot list.
- [x] Local full-flow verification before public deploy.
- [x] Deployed E2E verification after public URLs exist.
- [x] Media capture workflow for screenshots and walkthrough video.

## To Do

- [x] Deploy `ava-brain` Worker to a public Cloudflare URL.
- [x] Deploy the web/mobile preview to a public URL.
- [ ] Add screenshots/media assets for Kaggle/Gemma4Good.
- [ ] Add `LICENSE`.
- [x] Add a `SUBMISSION.md` with the final story, architecture, demo link, repo link, and limitations.
- [ ] Record a 2-3 minute walkthrough video.
- [ ] Draft DEV.to Build With Gemma 4 post.
- [ ] Draft Kaggle/Gemma4Good writeup.
- [x] Run final live E2E against deployed URLs, not localhost.
- [x] Verify all public links, env vars, and claim URLs before submission.

## Deployment Kanban

### Ready

- [x] Run local deterministic suite: `bun test && bun run typecheck`.
- [x] Run local live user flow against `http://localhost:8081`.
- [x] Smoke local Brain with a fresh food pantry/community-service prompt.
- [x] Deploy `ava-brain` with `bun --cwd apps/ava-brain deploy`.
- [x] Deploy web preview with `EXPO_PUBLIC_AVA_BRAIN_URL` pointed at the public Worker.

### After Public URLs Exist

- [x] Verify public `/health` shows the public Brain URL and staging Vibebase URLs.
- [x] Run deployed live E2E: `LIVE_AVA_TESTS=true AVA_WEB_URL=<public preview url> bun test apps/ava-mobile/test/live-user-flow.test.ts`.
- [x] Manually create one Ava from a brand-new prompt on the public URL.
- [x] Manually run `/admin` live SAL smoke on the public URL.
- [x] Confirm no `localhost` URLs appear in public UI, README, or submission docs.

## Media Kanban

### Screenshots

- [ ] `media/screenshots/01-landing.png`: public landing screen.
- [ ] `media/screenshots/02-prompt.png`: user-generated prompt filled in.
- [ ] `media/screenshots/03-blueprint-result.png`: generated blueprint and actions.
- [ ] `media/screenshots/04-staging-identity.png`: staging agent, tier, token preview, claim URL.
- [ ] `media/screenshots/05-admin-smoke.png`: admin live SAL smoke success.
- [ ] `media/screenshots/06-contracts.png`: admin contract/status panel.

### Video

- [x] Add video script: `docs/demo-video-script.md`.
- [ ] Record 2-3 minute product walkthrough using the public URL.
- [ ] Show a fresh prompt, not a canned-only demo.
- [ ] Show generated Gemma 4 blueprint output.
- [ ] Show Vibebase staging identity result.
- [ ] Show `/admin` live SAL smoke.
- [ ] Export `media/video/ava-gemma4good-demo.mp4`.
- [ ] Export `media/video/ava-gemma4good-thumbnail.png`.

## Blocked / Needs Decision

- [ ] Final impact lane: food pantry/community intake is the current default, but we should confirm this is the story we want to submit.
- [ ] Team/DEV handles and attribution list.
- [ ] Public hosting target for the web preview: Cloudflare Pages is the natural choice.

## Commands

```sh
bun test
bun run typecheck
LIVE_AVA_TESTS=true AVA_WEB_URL=http://localhost:8081 bun test apps/ava-mobile/test/live-user-flow.test.ts
LIVE_AVA_TESTS=true VIBEBASE_IDENTITY_URL=https://identity.vibebase.app EXPO_PUBLIC_AVA_BRAIN_URL=http://localhost:8787 bun test packages/sal-client/test/live.staging.test.ts
```

Detailed runbook: `docs/deployment-and-submission-runbook.md`.
