import type { ApiEnvelope, Blueprint, SalClient, TokenResponse } from "@ava/sal-client";

export type KeyPair = {
  publicKey: string;
  privateKeyRef: string;
};

export type SecureToken = TokenResponse;

export type AvaPhase =
  | "fresh"
  | "initializing"
  | "anonymous"
  | "blueprint-ready"
  | "staging-ready"
  | "claiming"
  | "claimed-authenticated"
  | "recoverable-error";

export type AvaLifecycleState = {
  phase: AvaPhase;
  agentId?: string;
  publicKey?: string;
  tier?: string;
  claimUrl?: string;
  claimUrlExpiresAt?: string;
  blueprint?: Blueprint;
  token?: SecureToken;
  error?: string;
};

export type AvaStorage = {
  getKeyPair(): Promise<KeyPair | null>;
  saveKeyPair(keyPair: KeyPair): Promise<void>;
  getAgentId(): Promise<string | null>;
  saveAgentId(agentId: string): Promise<void>;
  saveToken(token: SecureToken): Promise<void>;
};

export type AvaCrypto = {
  createKeyPair(): Promise<KeyPair>;
  sign(privateKeyRef: string, message: string): Promise<string>;
};

export type ClerkAuth = {
  getJwt(): Promise<string>;
  getHumanId(): Promise<string>;
};

export type OptionalMcpLinker = (input: { agentId: string; token: SecureToken }) => Promise<ApiEnvelope<{ linked: true }>>;

export type AvaLifecycleDeps = {
  storage: AvaStorage;
  crypto: AvaCrypto;
  sal: SalClient;
  auth: ClerkAuth;
  optionalMcpLink?: OptionalMcpLinker;
};
