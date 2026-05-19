import * as SecureStore from "expo-secure-store";
import type { AvaStorage, KeyPair, SecureToken } from "../sal/types";

const keyPairKey = "ava.keyPair";
const agentIdKey = "ava.agentId";
const tokenKey = "ava.token";

export const secureStoreStorage: AvaStorage = {
  async getKeyPair() {
    const value = await getItem(keyPairKey);
    return value ? (JSON.parse(value) as KeyPair) : null;
  },
  async saveKeyPair(keyPair) {
    await setItem(keyPairKey, JSON.stringify(keyPair), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
    });
  },
  getAgentId() {
    return getItem(agentIdKey);
  },
  async saveAgentId(agentId) {
    await setItem(agentIdKey, agentId);
  },
  async saveToken(token: SecureToken) {
    await setItem(tokenKey, JSON.stringify(token), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
    });
  }
};

async function getItem(key: string): Promise<string | null> {
  if (canUseLocalStorage()) {
    return localStorage.getItem(key);
  }

  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string, options?: SecureStore.SecureStoreOptions): Promise<void> {
  if (canUseLocalStorage()) {
    localStorage.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value, options);
}

function canUseLocalStorage(): boolean {
  return typeof localStorage !== "undefined";
}
