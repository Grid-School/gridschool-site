/**
 * What a sharp friend would cross out in a note, on the page (the server's message_style.py is the full gate;
 * this is the short list, so a note written before the gate existed still shows its flags on screen).
 */
const TELLS = ["stuck with me", "stood out", "caught my eye", "resonated", "i came across", "i noticed your", "hope this finds you", "i'd love to", "pick your brain", "compare notes", "happy to connect", "fellow", "passionate", "excited to", "leverage", "landscape", "delve", "best regards", "kind regards", "cheers"];
const ASKS = ["job", "referral", "hiring", "opening", "position", "opportunity", "resume", "interview", "recruiter"];

export function noteTells(text, { sender = "" } = {}) {
  const t = String(text || "").trim();
  const low = t.toLowerCase();
  const out = [];
  if (!t) return ["empty"];
  const n = t.split(/\s+/).length;
  if (n > 90) out.push(`over 90 words`);
  if ((t.match(/\?/g) || []).length > 1) out.push("more than one question");
  if (/[—–]| - /.test(t)) out.push("a dash");
  if (/!/.test(t)) out.push("an exclamation mark");
  const hits = TELLS.filter((w) => low.includes(w));
  if (hits.length) out.push(`says ${hits.slice(0, 3).join(", ")}`);
  // Three or more pieces strung with commas and closed with "and" or "or" is a list (the greeting's comma doesn't count).
  for (const s of t.split(/(?<=[.!?])\s+/)) {
    const pieces = s.replace(/^(hi|hey|hello)\s+\S+,\s*/i, "").split(",").map((p) => p.trim());
    if (pieces.length >= 3 && /^(and|or)\b/i.test(pieces[pieces.length - 1])) { out.push("a comma list"); break; }
  }
  const asks = ASKS.filter((w) => new RegExp(`\\b${w}\\b`).test(low));
  if (asks.length) out.push(`asks: ${asks.slice(0, 3).join(", ")}`);
  const last = t.split("\n").pop().trim();
  const first = String(sender || "").split(/\s+/)[0];
  if ((first && new RegExp(`(^|[\\s,.!?])${first}\\.?$`, "i").test(t)) || /^(thanks|thank you|best|cheers|regards|take care)\b/i.test(last) || /[.!?]\s+[A-Z][a-z]+\s*$/.test(t)) out.push("ends with a name or a sign-off");
  else if (!t.endsWith("?")) out.push("doesn't end with the question");
  return out;
}
