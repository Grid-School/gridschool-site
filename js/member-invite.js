/**
 * Founding-cohort Discord invite. Shown on localhost, or in a browser that
 * already holds a notebook token (a paying student, or Aden testing).
 * The public demo on gridschool.org has no token and never gets the href.
 */

import { LINKS, PRIVATE_LINK_KEYS, isPlaceholder } from "../config.js";
import { persistToken } from "../app/js/session.js";

export const MEMBER_DISCORD_INVITE = "https://discord.gg/FjC83EUu6Q";

export function isLocalHost(hostname = globalThis.location?.hostname || "") {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
}

export function canRevealMemberInvite({ slug = "", token, hostname } = {}) {
  if (isLocalHost(hostname)) return true;
  return Boolean(token ?? persistToken());
}

/** Put the invite on LINKS so Welcome task 2 can open it. */
export function revealMemberInvite(opts = {}) {
  if (!canRevealMemberInvite(opts)) return false;
  for (const key of PRIVATE_LINK_KEYS) {
    if (key in LINKS && isPlaceholder(LINKS[key])) LINKS[key] = MEMBER_DISCORD_INVITE;
  }
  return true;
}
