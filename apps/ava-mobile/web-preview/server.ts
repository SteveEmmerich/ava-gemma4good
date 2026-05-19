import { ed25519 } from "@noble/curves/ed25519.js";
import { createSalClient } from "@ava/sal-client";

const userFile = Bun.file(new URL("./index.html", import.meta.url));
const adminFile = Bun.file(new URL("./admin.html", import.meta.url));
const identityUrl = process.env.EXPO_PUBLIC_VIBEBASE_IDENTITY_URL ?? process.env.VIBEBASE_IDENTITY_URL ?? "https://identity.vibebase.app";
const gatewayUrl = process.env.EXPO_PUBLIC_VIBEBASE_GATEWAY_URL ?? process.env.VIBEBASE_GATEWAY_URL ?? "https://gateway.vibebase.app";
const avaBrainUrl = process.env.EXPO_PUBLIC_AVA_BRAIN_URL ?? "http://localhost:8787";

Bun.serve({
  port: 8081,
  hostname: "127.0.0.1",
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, identityUrl, gatewayUrl, avaBrainUrl });
    }

    if (request.method === "POST" && url.pathname === "/api/generate-blueprint") {
      return proxyGenerateBlueprint(request);
    }

    if (request.method === "POST" && url.pathname === "/api/live-sal-smoke") {
      return runLiveSalSmoke(request);
    }

    if (request.method === "POST" && url.pathname === "/api/create-agent") {
      return createAgentFromTranscript(request);
    }

    return new Response(url.pathname === "/admin" ? adminFile : userFile, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }
});

console.log("Ava web preview ready on http://localhost:8081");

async function proxyGenerateBlueprint(request: Request): Promise<Response> {
  const body = await request.text();
  return callBrain(body);
}

async function callBrain(body: string): Promise<Response> {
  const response = await fetch(`${avaBrainUrl.replace(/\/+$/, "")}/generate-blueprint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  });

  return new Response(await response.text(), {
    status: response.status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

async function createAgentFromTranscript(request: Request): Promise<Response> {
  try {
    const input = (await request.json().catch(() => ({}))) as { transcript?: string };
    const transcript = input.transcript?.trim();

    if (!transcript) {
      return Response.json(
        {
          success: false,
          error: {
            code: "missing_transcript",
            message: "Describe the agent you want Ava to create."
          }
        },
        { status: 400 }
      );
    }

    const blueprintResponse = await callBrain(JSON.stringify({ transcript }));
    const blueprintEnvelope = (await blueprintResponse.json()) as
      | { success: true; data: { name: string; description: string; actions: Array<{ label: string }> } }
      | { success: false; error: { code: string; message: string; details?: unknown } };

    if (!blueprintEnvelope.success) {
      return Response.json(blueprintEnvelope, { status: blueprintResponse.status });
    }

    const identity = await createLiveIdentity(blueprintEnvelope.data.name);
    if (!identity.success) {
      return Response.json(identity, { status: 502 });
    }

    return Response.json({
      success: true,
      data: {
        blueprint: blueprintEnvelope.data,
        identity: identity.data
      }
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: {
          code: "create_agent_failed",
          message: error instanceof Error ? error.message : "Unable to create the agent."
        }
      },
      { status: 500 }
    );
  }
}

async function runLiveSalSmoke(request: Request): Promise<Response> {
  try {
    const input = (await request.json().catch(() => ({}))) as { name?: string };
    const identity = await createLiveIdentity(input.name ?? `ava-demo-${Date.now()}`);
    return Response.json(identity, { status: identity.success ? 200 : 502 });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: {
          code: "live_smoke_failed",
          message: error instanceof Error ? error.message : "Live staging smoke failed."
        }
      },
      { status: 500 }
    );
  }
}

async function createLiveIdentity(name: string) {
  const privateKey = crypto.getRandomValues(new Uint8Array(32));
  const publicKey = ed25519.getPublicKey(privateKey);
  const client = createSalClient({ identityUrl });

  const init = await client.init({
    publicKey: toHex(publicKey),
    name: toAgentName(name)
  });

  if (!init.success) {
    return init;
  }

  const challenge = await client.challenge({ agentId: init.data.agentId, action: "token" });
  if (!challenge.success) {
    return challenge;
  }

  const signature = ed25519.sign(new TextEncoder().encode(challenge.data.challenge), privateKey);
  const token = await client.token({
    agentId: init.data.agentId,
    challenge: challenge.data.challenge,
    signature: toHex(signature)
  });

  if (!token.success) {
    return token;
  }

  return {
    success: true as const,
    data: {
      agentId: init.data.agentId,
      status: init.data.status,
      tier: init.data.tier,
      claimUrl: init.data.claimUrl,
      tokenPreview: `${token.data.accessToken.slice(0, 18)}...`,
      expiresAt: token.data.expiresAt
    }
  };
}

function toAgentName(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 42);

  return slug || `ava-agent-${Date.now()}`;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
