# Ava

Ava is a standalone consumer of Vibebase identity and gateway contracts.

## Apps

- `apps/ava-brain`: stateless Cloudflare Worker exposing `POST /generate-blueprint`.
- `apps/ava-mobile`: Expo app implementing the SAL client lifecycle against Vibebase.

## Packages

- `packages/shared-types`: blueprint schema and SAL lifecycle types.
- `packages/sal-client`: typed Vibebase API client with normalized envelope handling.

## Environment

Start against Vibebase staging.

```sh
VIBEBASE_IDENTITY_URL=https://identity.vibebase.app
VIBEBASE_GATEWAY_URL=https://gateway.vibebase.app
EXPO_PUBLIC_VIBEBASE_IDENTITY_URL=https://identity.vibebase.app
EXPO_PUBLIC_VIBEBASE_GATEWAY_URL=https://gateway.vibebase.app
EXPO_PUBLIC_AVA_BRAIN_URL=https://ava-brain.solitary-mode-3b63.workers.dev
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_aW5maW5pdGUtc2hlcGhlcmQtNjIuY2xlcmsuYWNjb3VudHMuZGV2JA
```

`ava-brain` uses the Cloudflare Workers AI binding configured in `apps/ava-brain/wrangler.jsonc`.
The default blueprint model is `@cf/google/gemma-4-26b-a4b-it`.

## Commands

```sh
bun install
bun test
bun run typecheck
bun --cwd apps/ava-brain dev
bun --cwd apps/ava-mobile start
```

For local Brain development, point `EXPO_PUBLIC_AVA_BRAIN_URL` at your local `ava-brain` dev server.

For the final Expo web build:

```sh
EXPO_PUBLIC_AVA_BRAIN_URL=https://ava-brain.solitary-mode-3b63.workers.dev \
EXPO_PUBLIC_VIBEBASE_IDENTITY_URL=https://identity.vibebase.app \
EXPO_PUBLIC_VIBEBASE_GATEWAY_URL=https://gateway.vibebase.app \
bun --cwd apps/ava-mobile run export:web
```

## Submission Ops

- Task tracking: `AGENTS.md`
- Deployment, testing, screenshots, and video runbook: `docs/deployment-and-submission-runbook.md`
- Demo video script: `docs/demo-video-script.md`
- Submission draft: `SUBMISSION.md`

## Public Demo

- Final Expo web demo: https://ava-gemma4good.pages.dev
- Legacy user/admin preview: https://ava-mobile-preview.solitary-mode-3b63.workers.dev
- Ava Brain Worker: https://ava-brain.solitary-mode-3b63.workers.dev
