/**
 * The content gate. On the published site the curriculum ships encrypted
 * (AES-GCM, key derived from the access key students receive at enrollment).
 * In local development the plaintext file exists and no gate appears.
 *
 * The passphrase is remembered on this device only. Rotating the key for a
 * new cohort = re-encrypt at deploy; old keys stop working on next visit.
 */

const STORE = "gridschool.gate.v1";

let cachedKey = null;

const fromB64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function deriveKey(passphrase, gate) {
  const material = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: fromB64(gate.salt), iterations: gate.iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

async function decrypt(key, box) {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(box.iv) }, key, fromB64(box.ct));
  return new TextDecoder().decode(plain);
}

async function gateConfig() {
  const res = await fetch("../data/gate.json", { cache: "no-store" });
  if (!res.ok) return null;
  const gate = await res.json();
  return gate.canary ? gate : null; // v:0 = local development, no gate
}

/** Try the remembered passphrase. Returns true when content is accessible. */
export async function tryStoredKey() {
  const gate = await gateConfig();
  if (!gate) return true; // plaintext world; nothing to unlock
  const stored = localStorage.getItem(STORE);
  if (!stored) return false;
  try {
    const key = await deriveKey(stored, gate);
    await decrypt(key, gate.canary);
    cachedKey = key;
    return true;
  } catch {
    localStorage.removeItem(STORE);
    return false;
  }
}

/** Attempt an unlock. Throws on a wrong key. */
export async function unlock(passphrase) {
  const gate = await gateConfig();
  if (!gate) return;
  const key = await deriveKey(passphrase.trim(), gate);
  await decrypt(key, gate.canary); // throws if wrong
  localStorage.setItem(STORE, passphrase.trim());
  cachedKey = key;
}

export function lock() {
  localStorage.removeItem(STORE);
  cachedKey = null;
}

/** Fetch + decrypt an encrypted JSON file. Assumes an earlier successful unlock. */
export async function loadPrivateJson(path) {
  const box = await (await fetch(path, { cache: "no-store" })).json();
  return JSON.parse(await decrypt(cachedKey, box));
}
