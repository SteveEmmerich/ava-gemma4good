# Ava Demo Video Script

Target length: 2-3 minutes.

Public demo URL: `https://ava-mobile-preview.solitary-mode-3b63.workers.dev`

## Shot 1: Problem

Show the public landing page.

Voiceover:

> Small community teams often need useful automation, but they do not have time to design agents, manage identity flows, or wire infrastructure. Ava turns a plain-language need into a safe, claimable agent blueprint.

## Shot 2: Fresh Prompt

Type a prompt that is visibly not prefilled:

```txt
Build an assistant for a neighborhood food pantry that summarizes intake notes, drafts follow-up texts, tracks dietary preferences, and asks staff before sending.
```

Voiceover:

> This prompt is going through the mobile/web input, not a canned backend demo.

## Shot 3: Generate

Click `Create My Ava` and wait for the result.

Voiceover:

> Ava Brain is a stateless Cloudflare Worker using Gemma 4 through Workers AI. It returns a strict JSON blueprint, validates it, and sends deterministic error envelopes if generation fails.

## Shot 4: Identity

Show the staging agent, tier, token preview, and claim URL.

Voiceover:

> Ava does not own identity lifecycle logic. It consumes Vibebase SAL contracts for init, challenge, claim, and token exchange. The private key stays client-side.

## Shot 5: Admin

Open `/admin`, run live SAL smoke, and show the contracts/status area.

Voiceover:

> The admin view exists for judges and operators. It shows the lifecycle boundaries and verifies the staging contract without mixing that complexity into the user-facing flow.

## Shot 6: Architecture

Show the repo folders:

- `apps/ava-brain`
- `apps/ava-mobile`
- `packages/shared-types`
- `packages/sal-client`

Voiceover:

> The repo is split by responsibility: a stateless Brain, a mobile/client lifecycle, shared schemas, and a typed SAL client.

## Close

Voiceover:

> Ava helps small organizations move from need to usable AI agent without losing safety, ownership, or identity boundaries.

## Recording Checklist

- [ ] Record against the public URL.
- [ ] Use a fresh prompt.
- [ ] Show the generated blueprint long enough to read.
- [ ] Show the staging identity result.
- [ ] Mention Gemma 4 and Cloudflare Workers AI.
- [ ] Mention Vibebase staging as the identity provider.
- [ ] Export `media/video/ava-gemma4good-demo.mp4`.
- [ ] Export `media/video/ava-gemma4good-thumbnail.png`.

