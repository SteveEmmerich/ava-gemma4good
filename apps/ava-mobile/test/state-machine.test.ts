import { describe, expect, test } from "bun:test";
import { AvaLifecycle } from "../src/sal/state-machine";
import type { AvaCrypto, AvaLifecycleDeps, AvaStorage, KeyPair, SecureToken } from "../src/sal/types";

const keyPair: KeyPair = { publicKey: "pub", privateKeyRef: "private-ref" };
const token: SecureToken = {
  accessToken: "access",
  tokenType: "Bearer",
  expiresAt: "2026-05-13T14:00:00.000Z"
};

function memoryStorage(): AvaStorage & { token: SecureToken | null; agentId: string | null } {
  let storedKeyPair: KeyPair | null = null;
  const storage = {
    token: null as SecureToken | null,
    agentId: null as string | null,
    async getKeyPair() {
      return storedKeyPair;
    },
    async saveKeyPair(nextKeyPair: KeyPair) {
      storedKeyPair = nextKeyPair;
    },
    async getAgentId() {
      return storage.agentId;
    },
    async saveAgentId(agentId: string) {
      storage.agentId = agentId;
    },
    async saveToken(nextToken: SecureToken) {
      storage.token = nextToken;
    }
  };
  return storage;
}

const crypto: AvaCrypto = {
  createKeyPair: async () => keyPair,
  sign: async (_ref, message) => `sig:${message}`
};

const defaults = (): AvaLifecycleDeps => ({
  storage: memoryStorage(),
  crypto,
  auth: { getJwt: async () => "jwt", getHumanId: async () => "user_123" },
  sal: {
    init: async () => ({ success: true, data: { agentId: "agent_123", publicKey: "pub", status: "anonymous" } }),
    challenge: async () => ({
      success: true,
      data: { challenge: "vibebase:test:agent_123:nonce", expiresAt: "2026-05-13T13:00:00.000Z" }
    }),
    claim: async () => ({ success: true, data: { agentId: "agent_123", status: "claimed", ownerId: "user_123" } }),
    token: async () => ({ success: true, data: token })
  }
});

describe("Ava mobile SAL state machine", () => {
  test("fresh install initializes an anonymous Vibebase agent", async () => {
    const deps = defaults();
    const lifecycle = new AvaLifecycle(deps);

    const state = await lifecycle.bootstrap();

    expect(state).toMatchObject({ phase: "anonymous", agentId: "agent_123", publicKey: "pub" });
    await expect(deps.storage.getAgentId()).resolves.toBe("agent_123");
  });

  test("save/deploy claims the agent and caches the exchanged token", async () => {
    const deps = defaults();
    const lifecycle = new AvaLifecycle(deps);

    await lifecycle.bootstrap();
    const state = await lifecycle.saveAndDeploy();

    expect(state).toMatchObject({ phase: "claimed-authenticated", token });
    expect((deps.storage as ReturnType<typeof memoryStorage>).token).toEqual(token);
  });

  test("save/deploy can lazily initialize the anonymous agent", async () => {
    const deps = defaults();
    const lifecycle = new AvaLifecycle(deps);

    const state = await lifecycle.saveAndDeploy();

    expect(state).toMatchObject({ phase: "claimed-authenticated", agentId: "agent_123", token });
    await expect(deps.storage.getAgentId()).resolves.toBe("agent_123");
  });

  test("create anonymous token initializes staging identity without claiming", async () => {
    const deps = defaults();
    const lifecycle = new AvaLifecycle(deps);

    const state = await lifecycle.createAnonymousToken("Food Pantry Intake Assistant");

    expect(state).toMatchObject({ phase: "staging-ready", agentId: "agent_123", token });
    expect((deps.storage as ReturnType<typeof memoryStorage>).token).toEqual(token);
  });

  test.each(["init", "challenge", "claim", "token"] as const)("network failure at %s is recoverable", async (step) => {
    const deps = defaults();
    const failure = { success: false as const, error: { code: "network_error", message: `${step} failed` } };

    if (step === "init") deps.sal.init = async () => failure;
    if (step === "challenge") deps.sal.challenge = async () => failure;
    if (step === "claim") deps.sal.claim = async () => failure;
    if (step === "token") deps.sal.token = async () => failure;

    const lifecycle = new AvaLifecycle(deps);
    const state = step === "init" ? await lifecycle.bootstrap() : await lifecycle.bootstrap().then(() => lifecycle.saveAndDeploy());

    expect(state).toMatchObject({ phase: "recoverable-error", error: `${step} failed` });
  });

  test("optional MCP-link failure does not roll back claimed state", async () => {
    const deps = defaults();
    deps.optionalMcpLink = async () => {
      throw new Error("optional link failed");
    };
    const lifecycle = new AvaLifecycle(deps);

    await lifecycle.bootstrap();
    const state = await lifecycle.saveAndDeploy();

    expect(state.phase).toBe("claimed-authenticated");
  });
});
