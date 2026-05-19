import {
  type AgentInitRequest,
  type AgentInitResponse,
  type ApiEnvelope,
  type ChallengeRequest,
  type ChallengeResponse,
  type ClaimRequest,
  type ClaimResponse,
  type TokenRequest,
  type TokenResponse,
  agentInitResponseSchema,
  challengeResponseSchema,
  claimResponseSchema,
  envelopeSchema,
  err,
  tokenResponseSchema
} from "@ava/shared-types";
import type { z } from "zod";

export type SalClientConfig = {
  identityUrl: string;
  fetch?: Fetcher;
};

export type SalClient = {
  init(input: AgentInitRequest): Promise<ApiEnvelope<AgentInitResponse>>;
  challenge(input: ChallengeRequest): Promise<ApiEnvelope<ChallengeResponse>>;
  claim(input: ClaimRequest): Promise<ApiEnvelope<ClaimResponse>>;
  token(input: TokenRequest): Promise<ApiEnvelope<TokenResponse>>;
};

const routes = {
  init: "/v1/agent/init",
  challenge: "/v1/challenge",
  claim: "/v1/claim",
  token: "/v1/token"
} as const;

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export function createSalClient(config: SalClientConfig): SalClient {
  const baseUrl = config.identityUrl.replace(/\/+$/, "");
  const fetchImpl = config.fetch ?? fetch;

  const post = async <T>(
    path: string,
    body: unknown,
    dataSchema: z.ZodType<T>
  ): Promise<ApiEnvelope<T>> => {
    let response: Response;

    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    } catch (error) {
      return err("network_error", "Unable to reach Vibebase Identity.", error);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      return err("invalid_json", "Vibebase Identity returned invalid JSON.", error);
    }

    const parsed = envelopeSchema(dataSchema).safeParse(payload);
    if (!parsed.success) {
      return err("invalid_envelope", "Vibebase Identity returned an unexpected envelope.", parsed.error.flatten());
    }

    if (!response.ok && parsed.data.success) {
      return err("http_error", `Vibebase Identity returned HTTP ${response.status}.`, parsed.data);
    }

    return parsed.data;
  };

  return {
    init: (input) => post(routes.init, input, agentInitResponseSchema),
    challenge: (input) => post(routes.challenge, normalizeChallengeRequest(input), challengeResponseSchema),
    claim: (input) => post(routes.claim, input, claimResponseSchema),
    token: (input) => post(routes.token, input, tokenResponseSchema)
  };
}

function normalizeChallengeRequest(input: ChallengeRequest): { agentId: string; action: "claim" | "token" } {
  return {
    agentId: input.agentId,
    action: input.action ?? input.purpose ?? "claim"
  };
}

export * from "@ava/shared-types";
