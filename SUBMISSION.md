# Ava Submission Draft

Public demo: https://ava-gemma4good.pages.dev

Ava Brain Worker: https://ava-brain.solitary-mode-3b63.workers.dev

Code repository: https://github.com/SteveEmmerich/ava-gemma4good

Demo video: TODO - public YouTube video URL.

## Summary

Ava helps small nonprofits and community service teams create safe, claimable AI agents from plain-language needs. The demo focuses on a neighborhood food pantry that needs help summarizing intake notes, drafting follow-up texts, tracking dietary preferences, and keeping staff approval in the loop.

## What Uses Gemma 4

`ava-brain` is a stateless Cloudflare Worker using `@cf/google/gemma-4-26b-a4b-it` through Workers AI. It accepts a transcript and returns a strict JSON blueprint validated before returning to the client.

## What Uses Vibebase

`ava-mobile` consumes Vibebase staging identity contracts through the SAL client:

- `POST /v1/agent/init`
- `POST /v1/challenge`
- `POST /v1/claim`
- `POST /v1/token`

Ava does not own lifecycle mutation logic. The claim/token lifecycle stays with Vibebase Identity.

## Public Demo Flow

1. User describes a community-service workflow.
2. Ava Brain generates a validated agent blueprint.
3. The Expo client creates an anonymous staging identity through Vibebase SAL.
4. The user sees the generated blueprint, agent ID, tier, token preview, and claim URL.
5. Clerk claim remains a post-demo owner handoff path, while the public demo proves init plus token exchange without requiring judges to sign in.

## Submission Pitch

Ava turns a messy nonprofit workflow description into a safe, claimable AI agent. The project uses Gemma 4 as a stateless planning brain: it reads a short conversation with a community service team and returns a strict, validated blueprint with persona boundaries, triggers, and workflow actions. The Expo client then proves this is more than a mockup by creating a live Vibebase staging identity, minting an agent token, and surfacing a claim URL for later ownership.

The prototype is aimed at small teams like food pantries, mutual-aid groups, and community intake desks that need useful automation but cannot afford opaque or unsafe agents. Ava keeps the human approval boundary visible: it can summarize intake notes and draft follow-up texts, but the generated blueprint explicitly requires staff review before outbound messages are sent.

## Technical Architecture

- `apps/ava-brain`: Cloudflare Worker using Workers AI with `@cf/google/gemma-4-26b-a4b-it`.
- `apps/ava-mobile`: Expo app for the final user-facing creation flow.
- `packages/shared-types`: validated blueprint and SAL schemas.
- `packages/sal-client`: typed Vibebase Identity client for init, challenge, claim, and token flows.
- Vibebase Identity: source of truth for lifecycle state, claim URLs, and tokens.

## Current Limitations

- The demo uses Vibebase staging.
- The Expo app creates anonymous staging identities for demo validation.
- Clerk claim UX is represented in the client lifecycle and admin/demo flow, but the public hackathon flow focuses on anonymous init plus token exchange.
- MCP linking remains separate and optional.

## Verification

```sh
bun test
bun run typecheck
LIVE_AVA_TESTS=true VIBEBASE_IDENTITY_URL=https://identity.vibebase.app EXPO_PUBLIC_AVA_BRAIN_URL=https://ava-brain.solitary-mode-3b63.workers.dev bun test packages/sal-client/test/live.staging.test.ts
EXPO_PUBLIC_AVA_BRAIN_URL=https://ava-brain.solitary-mode-3b63.workers.dev EXPO_PUBLIC_VIBEBASE_IDENTITY_URL=https://identity.vibebase.app EXPO_PUBLIC_VIBEBASE_GATEWAY_URL=https://gateway.vibebase.app bun run --cwd apps/ava-mobile export:web
```

Latest local validation:

- `bun run typecheck`: passed.
- `bun test`: passed, 25 pass / 2 gated live skips.
- Live staging smoke: passed against deployed Brain and Vibebase staging.
- Expo static export: passed into `apps/ava-mobile/dist`.
- Browser validation: final Expo export reached `staging-ready` with live agent ID, orphan tier, token preview, claim URL, and generated Gemma blueprint.

## Final Submission Checklist

- [x] Deploy final Expo export from `apps/ava-mobile/dist`.
- [x] Publish the code repository.
- [ ] Record and upload the 3-minute demo video.
- [ ] Add video URL above.
- [x] Run one final browser smoke on the deployed Expo URL.
- [ ] Submit Kaggle writeup before May 18, 2026 at 11:59 PM UTC.
