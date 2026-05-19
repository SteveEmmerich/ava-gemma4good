---
title: "Ava: Turning Nonprofit Workflows Into Claimable AI Agents With Gemma 4"
published: false
tags: devchallenge, gemmachallenge, gemma, showdev
---

*This is a submission for the [Gemma 4 Challenge: Build with Gemma 4](https://dev.to/challenges/google-gemma-2026-05-06).*

## What I Built

Ava helps small nonprofits and community service teams create safe, claimable AI agents from plain-language needs.

The prototype starts with a simple prompt like:

> Build an assistant for a youth tutoring nonprofit that matches volunteer tutors to students, tracks guardian consent, drafts schedule reminders, and asks staff before contacting families.

Gemma 4 turns that messy workflow description into a structured agent blueprint: name, purpose, actions, triggers, and safety boundaries. The Expo web client then creates a real staging identity through Vibebase, mints a token, and shows a claim URL so the agent can be handed off to an owner later.

The idea is aimed at teams that need useful automation but cannot afford opaque automation:

- food pantries summarizing intake notes and drafting follow-up texts
- tutoring nonprofits matching students with volunteers
- legal aid clinics triaging appointments while keeping attorney approval in the loop
- mutual aid groups coordinating reminders without letting an AI contact people on its own

The important product boundary is that Ava is not "an agent that does everything." It is a generator for human-approved agents. The generated blueprint keeps the approval boundary visible before anything is deployed or claimed.

## Demo

Live demo: https://ava-gemma4good.pages.dev

Ava Brain Worker: https://ava-brain.solitary-mode-3b63.workers.dev

Demo video: TODO - add public video URL

In the current deployed flow:

1. A user writes one nonprofit workflow description.
2. Ava sends the transcript to the Gemma 4 Brain Worker.
3. The Brain returns a strict JSON blueprint validated by shared schemas.
4. The client creates a Vibebase staging identity.
5. The user sees the generated blueprint, staging agent ID, orphan tier, token preview, and claim URL.

Recent live smoke result:

- Prompt: youth tutoring nonprofit workflow
- Generated agent: `Tutoring Nonprofit Assistant`
- Boundaries included staff approval before contacting families and guardian consent checks
- Result reached `staging-ready`
- Vibebase returned an orphan staging identity, token preview, and claim URL

## Code

Repository: https://github.com/SteveEmmerich/ava-gemma4good

Main pieces:

- `apps/ava-brain`: Cloudflare Worker exposing `POST /generate-blueprint`
- `apps/ava-mobile`: Expo web/mobile client for the user-facing creation flow
- `packages/shared-types`: blueprint schema and lifecycle types
- `packages/sal-client`: typed Vibebase Identity client with normalized envelopes

Verification commands:

```sh
bun test
bun run typecheck

LIVE_AVA_TESTS=true \
VIBEBASE_IDENTITY_URL=https://identity.vibebase.app \
EXPO_PUBLIC_AVA_BRAIN_URL=https://ava-brain.solitary-mode-3b63.workers.dev \
bun test packages/sal-client/test/live.staging.test.ts
```

Latest validation:

- `bun run typecheck`: passed
- `bun test`: passed, 25 pass / 2 gated live skips
- deployed browser smoke: passed against `https://ava-gemma4good.pages.dev`
- final Expo export deployed to Cloudflare Pages

## How I Used Gemma 4

Gemma 4 is the planning brain at the center of Ava.

I used `@cf/google/gemma-4-26b-a4b-it` through Cloudflare Workers AI. This is the Gemma 4 26B mixture-of-experts model, and it was the right fit because Ava needs reasoning quality more than tiny-device deployment. The task is not just summarization. The model has to:

- infer the organization type from a short messy prompt
- choose a useful agent name and description
- extract workflow actions
- identify triggers
- preserve safety and human-approval boundaries
- return strict JSON that can be validated before the client trusts it

The Worker is intentionally stateless:

```txt
transcript -> Gemma 4 -> validated blueprint JSON -> Expo client
```

Gemma 4 does not own identity, persistence, or claim authority. It only produces the blueprint. Vibebase owns the identity lifecycle through SAL contracts:

- `POST /v1/agent/init`
- `POST /v1/challenge`
- `POST /v1/claim`
- `POST /v1/token`

That separation matters. The LLM can propose the shape of an agent, but identity, tokens, and claims stay behind deterministic API contracts.

## What Gemma 4 Unlocked

The useful part of Gemma 4 here is that it can turn a plain-language operational need into a structured object without forcing a nonprofit staff member to understand agent schemas.

For example, the tutoring prompt produced:

- an assistant focused on tutor-student matching
- guardian consent tracking
- scheduling reminder drafts
- a boundary that staff must approve before contacting families
- a boundary that guardian consent must be verified before student activities

That is exactly the product loop Ava needs:

1. A human describes work in normal language.
2. Gemma 4 proposes a structured, bounded agent.
3. The UI shows the proposal before any handoff.
4. The identity system creates a claimable staging agent.

The model is doing real work, but it is boxed into a role where its output can be validated, displayed, and rejected.

## Architecture Notes

I kept the system split into three responsibilities:

- Gemma 4 Brain: turn transcript into blueprint
- Expo Client: own local lifecycle state and user experience
- Vibebase SAL: own identity, challenges, claims, and tokens

This let me keep the demo honest. The public page is not just a mockup: it calls the deployed Brain, creates a real staging identity, and returns token/claim information from Vibebase.

## Current Limitations

- The demo uses Vibebase staging.
- The public flow creates anonymous staging identities for review.
- Clerk claim is intentionally post-demo handoff; judges do not need to sign in.
- The UX is optimized for a short challenge demo, not a full production onboarding flow.

## What I Would Build Next

The next version would add:

- a stronger review screen before creating the staging identity
- exportable blueprints for nonprofit admins
- templates for common community-service workflows
- production claim handoff with Clerk
- audit logs for generated safety boundaries

The long-term goal is not to replace nonprofit staff. It is to help small teams safely move from "we need help with this workflow" to "we have a bounded, claimable assistant that still asks humans before it acts."

## Team

TODO - add DEV handles for any teammates, or remove this section for a solo submission.
