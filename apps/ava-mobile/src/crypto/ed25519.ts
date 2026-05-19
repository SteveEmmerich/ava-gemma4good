import { ed25519 } from "@noble/curves/ed25519.js";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import type { AvaCrypto } from "../sal/types";

const privateKeyRef = "ava.ed25519.privateKey";

export const ed25519Crypto: AvaCrypto = {
  async createKeyPair() {
    const privateKeyBytes = await Crypto.getRandomBytesAsync(32);
    const publicKeyBytes = ed25519.getPublicKey(privateKeyBytes);

    await setPrivateKey(toBase64(privateKeyBytes), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
    });

    return {
      publicKey: toHex(publicKeyBytes),
      privateKeyRef
    };
  },
  async sign(ref, message) {
    const storedPrivateKey = await getPrivateKey(ref);
    if (!storedPrivateKey) {
      throw new Error("Private key is missing.");
    }

    const signature = ed25519.sign(new TextEncoder().encode(message), fromBase64(storedPrivateKey));
    return toHex(signature);
  }
};

async function getPrivateKey(ref: string): Promise<string | null> {
  if (canUseLocalStorage()) {
    return localStorage.getItem(ref);
  }

  return SecureStore.getItemAsync(ref);
}

async function setPrivateKey(value: string, options: SecureStore.SecureStoreOptions): Promise<void> {
  if (canUseLocalStorage()) {
    localStorage.setItem(privateKeyRef, value);
    return;
  }

  await SecureStore.setItemAsync(privateKeyRef, value, options);
}

function canUseLocalStorage(): boolean {
  return typeof localStorage !== "undefined";
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
