import { describe, expect, test } from "bun:test";
import { ed25519 } from "@noble/curves/ed25519.js";
import { createSalClient } from "../src";

const liveTest = process.env.LIVE_AVA_TESTS === "true" ? test : test.skip;

const identityUrl = process.env.VIBEBASE_IDENTITY_URL ?? "https://identity.vibebase.app";
const avaBrainUrl = process.env.EXPO_PUBLIC_AVA_BRAIN_URL ?? "http://localhost:8787";

describe("live staging smoke", () => {
  liveTest("generates a blueprint and exchanges an identity token", async () => {
    const blueprintResponse = await fetch(`${avaBrainUrl.replace(/\/+$/, "")}/generate-blueprint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript:
          "Build an assistant for a neighborhood food pantry that summarizes intake notes, drafts follow-up texts, tracks dietary preferences, and asks staff before sending."
      })
    });
    const blueprint = await blueprintResponse.json();

    expect(blueprintResponse.ok).toBe(true);
    expect(blueprint).toMatchObject({
      success: true,
      data: {
        metadata: { source: "transcript" }
      }
    });

    const privateKey = crypto.getRandomValues(new Uint8Array(32));
    const publicKey = ed25519.getPublicKey(privateKey);
    const client = createSalClient({ identityUrl });

    const init = await client.init({
      publicKey: toHex(publicKey),
      name: `ava-live-${Date.now()}`
    });

    expect(init.success).toBe(true);
    if (!init.success) {
      throw new Error(init.error.message);
    }

    const challenge = await client.challenge({ agentId: init.data.agentId, action: "token" });
    expect(challenge.success).toBe(true);
    if (!challenge.success) {
      throw new Error(challenge.error.message);
    }

    const signature = ed25519.sign(new TextEncoder().encode(challenge.data.challenge), privateKey);
    const token = await client.token({
      agentId: init.data.agentId,
      challenge: challenge.data.challenge,
      signature: toHex(signature)
    });

    expect(token.success).toBe(true);
    if (!token.success) {
      throw new Error(token.error.message);
    }

    expect(token.data.accessToken.split(".").length).toBeGreaterThanOrEqual(2);
  }, 120_000);
});

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
