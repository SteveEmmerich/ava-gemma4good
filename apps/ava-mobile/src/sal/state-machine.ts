import type { Blueprint } from "@ava/shared-types";
import type { AvaLifecycleDeps, AvaLifecycleState, KeyPair } from "./types";

export class AvaLifecycle {
  private state: AvaLifecycleState = { phase: "fresh" };

  constructor(private readonly deps: AvaLifecycleDeps) {}

  getState(): AvaLifecycleState {
    return this.state;
  }

  async bootstrap(name?: string): Promise<AvaLifecycleState> {
    this.state = { ...this.state, phase: "initializing", error: undefined };

    try {
      const { keyPair, replacedStoredKey } = await this.ensureKeyPair();
      const existingAgentId = await this.deps.storage.getAgentId();

      if (existingAgentId && !replacedStoredKey) {
        this.state = { ...this.state, phase: "anonymous", agentId: existingAgentId, publicKey: keyPair.publicKey };
        return this.state;
      }

      const initInput = withoutUndefined({
        publicKey: keyPair.publicKey,
        deviceLabel: "Ava Mobile",
        name: name ? toAgentName(name) : undefined
      });
      const init = await this.deps.sal.init(initInput);
      if (!init.success) {
        return this.recover(init.error.message);
      }

      await this.deps.storage.saveAgentId(init.data.agentId);
      this.state = withoutUndefined({
        ...this.state,
        phase: "anonymous" as const,
        agentId: init.data.agentId,
        publicKey: keyPair.publicKey,
        tier: init.data.tier,
        claimUrl: init.data.claimUrl,
        claimUrlExpiresAt: init.data.claimUrlExpiresAt
      });
      return this.state;
    } catch (error) {
      return this.recover(toMessage(error));
    }
  }

  setBlueprint(blueprint: Blueprint): AvaLifecycleState {
    this.state = {
      ...this.state,
      phase: "blueprint-ready",
      blueprint
    };
    return this.state;
  }

  async createAnonymousToken(name?: string): Promise<AvaLifecycleState> {
    if (name) {
      const initialized = await this.initializeAnonymousAgent(name);
      if (initialized.phase === "recoverable-error") {
        return initialized;
      }
    } else if (!this.state.agentId || !(await this.deps.storage.getKeyPair())) {
      const initialized = await this.bootstrap(name);
      if (initialized.phase === "recoverable-error") {
        return initialized;
      }
    }

    const agentId = this.state.agentId;
    const keyPair = await this.deps.storage.getKeyPair();

    if (!agentId || !keyPair) {
      return this.recover("Ava needs an anonymous agent before it can mint a staging token.");
    }

    this.state = { ...this.state, phase: "initializing", error: undefined };

    try {
      const tokenChallenge = await this.deps.sal.challenge({ agentId, action: "token" });
      if (!tokenChallenge.success) {
        return this.recover(tokenChallenge.error.message);
      }

      const tokenSignature = await this.deps.crypto.sign(keyPair.privateKeyRef, tokenChallenge.data.challenge);
      const token = await this.deps.sal.token({
        agentId,
        signature: tokenSignature,
        challenge: tokenChallenge.data.challenge
      });
      if (!token.success) {
        return this.recover(token.error.message);
      }

      await this.deps.storage.saveToken(token.data);
      this.state = { ...this.state, phase: "staging-ready", token: token.data };
      return this.state;
    } catch (error) {
      return this.recover(toMessage(error));
    }
  }

  async saveAndDeploy(): Promise<AvaLifecycleState> {
    if (!this.state.agentId || !(await this.deps.storage.getKeyPair())) {
      const initialized = await this.bootstrap();
      if (initialized.phase === "recoverable-error") {
        return initialized;
      }
    }

    const agentId = this.state.agentId;
    const keyPair = await this.deps.storage.getKeyPair();

    if (!agentId || !keyPair) {
      return this.recover("Ava needs an anonymous agent before it can be claimed.");
    }

    this.state = { ...this.state, phase: "claiming", error: undefined };

    try {
      const humanId = await this.deps.auth.getHumanId();
      const challenge = await this.deps.sal.challenge({ agentId, action: "claim" });
      if (!challenge.success) {
        return this.recover(challenge.error.message);
      }

      const signature = await this.deps.crypto.sign(keyPair.privateKeyRef, challenge.data.challenge);
      const claim = await this.deps.sal.claim({
        agentId,
        humanId,
        signature,
        challenge: challenge.data.challenge
      });
      if (!claim.success) {
        return this.recover(claim.error.message);
      }

      const tokenChallenge = await this.deps.sal.challenge({ agentId, action: "token" });
      if (!tokenChallenge.success) {
        return this.recover(tokenChallenge.error.message);
      }

      const tokenSignature = await this.deps.crypto.sign(keyPair.privateKeyRef, tokenChallenge.data.challenge);
      const token = await this.deps.sal.token({
        agentId,
        signature: tokenSignature,
        challenge: tokenChallenge.data.challenge
      });
      if (!token.success) {
        return this.recover(token.error.message);
      }

      await this.deps.storage.saveToken(token.data);
      this.state = { ...this.state, phase: "claimed-authenticated", token: token.data };

      if (this.deps.optionalMcpLink) {
        void this.deps.optionalMcpLink({ agentId, token: token.data }).catch(() => undefined);
      }

      return this.state;
    } catch (error) {
      return this.recover(toMessage(error));
    }
  }

  private async ensureKeyPair(): Promise<{ keyPair: KeyPair; replacedStoredKey: boolean }> {
    const existing = await this.deps.storage.getKeyPair();
    if (existing && isHexPublicKey(existing.publicKey)) {
      return { keyPair: existing, replacedStoredKey: false };
    }

    const keyPair = await this.deps.crypto.createKeyPair();
    await this.deps.storage.saveKeyPair(keyPair);
    return { keyPair, replacedStoredKey: !!existing };
  }

  private async initializeAnonymousAgent(name?: string): Promise<AvaLifecycleState> {
    this.state = { ...this.state, phase: "initializing", error: undefined };

    try {
      const keyPair = await this.deps.crypto.createKeyPair();
      await this.deps.storage.saveKeyPair(keyPair);
      const init = await this.deps.sal.init(
        withoutUndefined({
          publicKey: keyPair.publicKey,
          deviceLabel: "Ava Mobile",
          name: name ? toAgentName(name) : undefined
        })
      );
      if (!init.success) {
        return this.recover(init.error.message);
      }

      await this.deps.storage.saveAgentId(init.data.agentId);
      this.state = withoutUndefined({
        ...this.state,
        phase: "anonymous" as const,
        agentId: init.data.agentId,
        publicKey: keyPair.publicKey,
        tier: init.data.tier,
        claimUrl: init.data.claimUrl,
        claimUrlExpiresAt: init.data.claimUrlExpiresAt,
        token: undefined
      });
      return this.state;
    } catch (error) {
      return this.recover(toMessage(error));
    }
  }

  private recover(message: string): AvaLifecycleState {
    this.state = {
      ...this.state,
      phase: "recoverable-error",
      error: message
    };
    return this.state;
  }
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

function isHexPublicKey(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value);
}

function toAgentName(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 42);

  return slug || `ava-agent-${Date.now()}`;
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
