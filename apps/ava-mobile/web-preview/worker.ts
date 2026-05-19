import { ed25519 } from "@noble/curves/ed25519.js";
import { createSalClient } from "@ava/sal-client";
import adminHtml from "./admin.html";
import userHtml from "./index.html";

type Env = {
  AVA_BRAIN?: {
    fetch(input: Request): Promise<Response>;
  };
  EXPO_PUBLIC_AVA_BRAIN_URL?: string;
  EXPO_PUBLIC_VIBEBASE_IDENTITY_URL?: string;
  EXPO_PUBLIC_VIBEBASE_GATEWAY_URL?: string;
  VIBEBASE_IDENTITY_URL?: string;
  VIBEBASE_GATEWAY_URL?: string;
};

type PreviewConfig = {
  avaBrainService?: {
    fetch(input: Request): Promise<Response>;
  };
  identityUrl: string;
  gatewayUrl: string;
  avaBrainUrl: string;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const config = getConfig(env);
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        identityUrl: config.identityUrl,
        gatewayUrl: config.gatewayUrl,
        avaBrainUrl: config.avaBrainUrl
      });
    }

    if (request.method === "POST" && url.pathname === "/api/generate-blueprint") {
      return proxyGenerateBlueprint(request, config);
    }

    if (request.method === "POST" && url.pathname === "/api/live-sal-smoke") {
      return runLiveSalSmoke(request, config);
    }

    if (request.method === "POST" && url.pathname === "/api/create-agent") {
      return createAgentFromTranscript(request, config);
    }

    return htmlResponse(url.pathname === "/admin" ? adminHtml : userHtml);
  }
};

function getConfig(env: Env): PreviewConfig {
  return {
    avaBrainService: env.AVA_BRAIN,
    identityUrl: env.EXPO_PUBLIC_VIBEBASE_IDENTITY_URL ?? env.VIBEBASE_IDENTITY_URL ?? "https://identity.vibebase.app",
    gatewayUrl: env.EXPO_PUBLIC_VIBEBASE_GATEWAY_URL ?? env.VIBEBASE_GATEWAY_URL ?? "https://gateway.vibebase.app",
    avaBrainUrl: env.EXPO_PUBLIC_AVA_BRAIN_URL ?? "https://ava-brain.solitary-mode-3b63.workers.dev"
  };
}

function htmlResponse(content: unknown): Response {
  return new Response(content as BodyInit, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

async function proxyGenerateBlueprint(request: Request, config: PreviewConfig): Promise<Response> {
  const body = await request.text();
  return callBrain(body, config);
}

async function callBrain(body: string, config: PreviewConfig): Promise<Response> {
  const brainRequest = new Request(`${config.avaBrainUrl.replace(/\/+$/, "")}/generate-blueprint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  });
  const response = config.avaBrainService ? await config.avaBrainService.fetch(brainRequest) : await fetch(brainRequest);

  return new Response(await response.text(), {
    status: response.status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

async function createAgentFromTranscript(request: Request, config: PreviewConfig): Promise<Response> {
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

    const blueprintResponse = await callBrain(JSON.stringify({ transcript }), config);
    const blueprintEnvelope = (await blueprintResponse.json()) as
      | { success: true; data: { name: string; description: string; actions: Array<{ label: string }> } }
      | { success: false; error: { code: string; message: string; details?: unknown } };

    if (!blueprintEnvelope.success) {
      return Response.json(blueprintEnvelope, { status: blueprintResponse.status });
    }

    const identity = await createLiveIdentity(blueprintEnvelope.data.name, config);
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

async function runLiveSalSmoke(request: Request, config: PreviewConfig): Promise<Response> {
  try {
    const input = (await request.json().catch(() => ({}))) as { name?: string };
    const identity = await createLiveIdentity(input.name ?? `ava-demo-${Date.now()}`, config);
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

async function createLiveIdentity(name: string, config: PreviewConfig) {
  const privateKey = crypto.getRandomValues(new Uint8Array(32));
  const publicKey = ed25519.getPublicKey(privateKey);
  const client = createSalClient({ identityUrl: config.identityUrl });

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
