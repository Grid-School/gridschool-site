/**
 * The profile images routes (server/images_api.py). Images are private, so they are fetched with the
 * student's token and shown from object URLs, never from a public address.
 */

import { PERSIST, isPlaceholder } from "../../config.js?v=6ba739d-202610272145";
import { persistToken } from "./session.js?v=6ba739d-202610272145";

export function imagesReady() {
  return Boolean(persistToken() && PERSIST?.endpoint && !isPlaceholder(PERSIST.endpoint));
}

const root = () => PERSIST.endpoint.replace(/\/$/, "");
const base = (slug) => `/students/${encodeURIComponent(slug)}/images`;

async function call(method, path, body) {
  const response = await fetch(`${root()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${persistToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `the server answered ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export const loadImages = (slug) => call("GET", base(slug));
export const uploadImage = (slug, kind, data) => call("POST", `${base(slug)}/upload`, { kind, data });
export const removeImage = (slug, id) => call("POST", `${base(slug)}/delete`, { id });
export const makeImages = (slug, kind, ask = "") => call("POST", `${base(slug)}/generate`, { kind, ask: ask || undefined });
export const pickImage = (slug, id, kind) => call("POST", `${base(slug)}/pick`, { id, kind });

const urls = new Map();

/** An object URL for one stored image. Ids never change, so each is fetched once per visit. */
export async function imageUrl(slug, id) {
  if (urls.has(id)) return urls.get(id);
  const response = await fetch(`${root()}${base(slug)}/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${persistToken()}` } });
  if (!response.ok) throw new Error(`That image didn't load (${response.status}).`);
  const url = URL.createObjectURL(await response.blob());
  urls.set(id, url);
  return url;
}

export function forgetImages() {
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
}
