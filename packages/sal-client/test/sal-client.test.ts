import { describe, expect, test } from "bun:test";
import { createSalClient } from "../src";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

describe("SAL client", () => {
  test("parses init success envelopes", async () => {
    const client = createSalClient({
      identityUrl: "https://identity.staging.example/",
      fetch: async (url, init) => {
        expect(url).toBe("https://identity.staging.example/v1/agent/init");
        expect(init?.method).toBe("POST");
        return jsonResponse(200, {
          success: true,
          data: { id: "agent_123", publicKey: "pub", tier: "orphan", name: "iphone" }
        });
      }
    });

    const result = await client.init({ publicKey: "pub", deviceLabel: "iPhone" });

    expect(result).toEqual({
      success: true,
      data: { agentId: "agent_123", publicKey: "pub", status: "anonymous", tier: "orphan", name: "iphone" }
    });
  });

  test("runs challenge, claim, and token flows", async () => {
    const calls: string[] = [];
    const client = createSalClient({
      identityUrl: "https://identity.staging.example",
      fetch: async (url) => {
        const path = new URL(String(url)).pathname;
        calls.push(path);

        if (path === "/v1/challenge") {
          return jsonResponse(200, {
            success: true,
            data: { challenge: "vibebase:claim:agent_123:nonce", expiresAt: "2026-05-13T13:00:00.000Z" }
          });
        }

        if (path === "/v1/claim") {
          return jsonResponse(200, {
            success: true,
            data: { id: "agent_123", tier: "claimed", claimedBy: "user_123" }
          });
        }

        return jsonResponse(200, {
          success: true,
          data: { token: "token", expiresAt: "2026-05-13T14:00:00.000Z" }
        });
      }
    });

    await expect(client.challenge({ agentId: "agent_123", purpose: "claim" })).resolves.toMatchObject({ success: true });
    await expect(
      client.claim({
        agentId: "agent_123",
        humanId: "user_123",
        signature: "sig",
        challenge: "vibebase:claim:agent_123:nonce"
      })
    ).resolves.toMatchObject({ success: true });
    await expect(
      client.token({ agentId: "agent_123", signature: "sig", challenge: "vibebase:token:agent_123:nonce" })
    ).resolves.toMatchObject({ success: true });

    expect(calls).toEqual(["/v1/challenge", "/v1/claim", "/v1/token"]);
  });

  test.each([
    ["bad_jwt", "Clerk JWT rejected."],
    ["bad_signature", "Signature rejected."],
    ["challenge_replayed", "Challenge was already used."],
    ["challenge_expired", "Challenge expired."]
  ])("preserves claim failure envelopes for %s", async (code, message) => {
    const client = createSalClient({
      identityUrl: "https://identity.staging.example",
      fetch: async () => jsonResponse(401, { success: false, error: { code, message } })
    });

    await expect(
      client.claim({
        agentId: "agent_123",
        humanId: "user_123",
        signature: "sig",
        challenge: "vibebase:claim:agent_123:nonce"
      })
    ).resolves.toEqual({ success: false, error: { code, message } });
  });

  test("preserves token exchange failure envelopes", async () => {
    const client = createSalClient({
      identityUrl: "https://identity.staging.example",
      fetch: async () => jsonResponse(403, { success: false, error: { code: "not_claimed", message: "Agent is not claimed." } })
    });

    await expect(
      client.token({ agentId: "agent_123", signature: "sig", challenge: "vibebase:token:agent_123:nonce" })
    ).resolves.toEqual({
      success: false,
      error: { code: "not_claimed", message: "Agent is not claimed." }
    });
  });

  test("normalizes malformed envelopes", async () => {
    const client = createSalClient({
      identityUrl: "https://identity.staging.example",
      fetch: async () => jsonResponse(200, { data: { agentId: "agent_123" } })
    });

    const result = await client.init({ publicKey: "pub" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("invalid_envelope");
    }
  });
});
