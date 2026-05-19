import { z } from "zod";

export const agentInitRequestSchema = z.object({
  publicKey: z.string().min(1),
  name: z.string().min(1).optional(),
  deviceLabel: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const agentInitResponseSchema = z
  .object({
    id: z.string().min(1).optional(),
    agentId: z.string().min(1).optional(),
    publicKey: z.string().min(1),
    tier: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    claimUrl: z.string().url().optional(),
    claimUrlExpiresAt: z.string().datetime().optional(),
    claimNotificationSubscription: z.unknown().optional()
  })
  .transform((data) =>
    withoutUndefined({
      agentId: data.agentId ?? data.id ?? "",
      publicKey: data.publicKey,
      status: data.status === "claimed" ? "claimed" : "anonymous",
      tier: data.tier,
      name: data.name,
      claimUrl: data.claimUrl,
      claimUrlExpiresAt: data.claimUrlExpiresAt,
      claimNotificationSubscription: data.claimNotificationSubscription
    })
  )
  .pipe(
    z.object({
      agentId: z.string().min(1),
      publicKey: z.string().min(1),
      status: z.enum(["anonymous", "claimed"]),
      tier: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
      claimUrl: z.string().url().optional(),
      claimUrlExpiresAt: z.string().datetime().optional(),
      claimNotificationSubscription: z.unknown().optional()
    })
  );

export const challengeRequestSchema = z.object({
  agentId: z.string().min(1),
  action: z.enum(["claim", "token"]).optional(),
  purpose: z.enum(["claim", "token"]).optional()
});

export const challengeResponseSchema = z
  .object({
    challenge: z.string().min(1).optional(),
    challengeId: z.string().min(1).optional(),
    nonce: z.string().min(1).optional(),
    expiresAt: z.string().datetime()
  })
  .transform((data) =>
    withoutUndefined({
      challenge: data.challenge ?? data.nonce ?? "",
      challengeId: data.challengeId,
      nonce: data.nonce,
      expiresAt: data.expiresAt
    })
  )
  .pipe(
    z.object({
      challenge: z.string().min(1),
      challengeId: z.string().min(1).optional(),
      nonce: z.string().min(1).optional(),
      expiresAt: z.string().datetime()
    })
  );

export const claimRequestSchema = z.object({
  agentId: z.string().min(1),
  humanId: z.string().min(1),
  signature: z.string().min(1),
  challenge: z.string().min(1)
});

export const claimResponseSchema = z
  .object({
    id: z.string().min(1).optional(),
    agentId: z.string().min(1).optional(),
    tier: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
    claimedBy: z.string().min(1).optional(),
    ownerId: z.string().min(1).optional()
  })
  .transform((data) => ({
    agentId: data.agentId ?? data.id ?? "",
    status: data.status === "claimed" || data.tier === "claimed" ? "claimed" : "claimed",
    ownerId: data.ownerId ?? data.claimedBy ?? ""
  }))
  .pipe(
    z.object({
      agentId: z.string().min(1),
      status: z.literal("claimed"),
      ownerId: z.string().min(1)
    })
  );

export const tokenRequestSchema = z.object({
  agentId: z.string().min(1),
  signature: z.string().min(1),
  challenge: z.string().min(1)
});

export const tokenResponseSchema = z
  .object({
    token: z.string().min(1).optional(),
    accessToken: z.string().min(1).optional(),
    tokenType: z.literal("Bearer").optional(),
    expiresAt: z.string().datetime()
  })
  .transform((data) => ({
    accessToken: data.accessToken ?? data.token ?? "",
    tokenType: "Bearer" as const,
    expiresAt: data.expiresAt
  }))
  .pipe(
    z.object({
      accessToken: z.string().min(1),
      tokenType: z.literal("Bearer"),
      expiresAt: z.string().datetime()
    })
  );

export type AgentInitRequest = z.infer<typeof agentInitRequestSchema>;
export type AgentInitResponse = z.infer<typeof agentInitResponseSchema>;
export type ChallengeRequest = z.infer<typeof challengeRequestSchema>;
export type ChallengeResponse = z.infer<typeof challengeResponseSchema>;
export type ClaimRequest = z.infer<typeof claimRequestSchema>;
export type ClaimResponse = z.infer<typeof claimResponseSchema>;
export type TokenRequest = z.infer<typeof tokenRequestSchema>;
export type TokenResponse = z.infer<typeof tokenResponseSchema>;

function withoutUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}
