/** Parse the student's interests before sending them to the shared queue. */

export const SUGGESTIONS = ["observability", "evaluation", "incident response", "code review", "AI agents"];

const MAX_PHRASES = 6;
const MAX_LENGTH = 40;

export function parseKeywords(input) {
  const unique = [];
  const seen = new Set();
  for (const part of String(input ?? "").split(/[,;\n]/)) {
    const phrase = part.trim().replace(/\s+/g, " ");
    if (phrase.length < 2 || phrase.length > MAX_LENGTH) continue;
    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(phrase);
    if (unique.length === MAX_PHRASES) break;
  }
  return unique;
}

export function addKeyword(current, phrase) {
  const list = parseKeywords(`${current ?? ""}, ${phrase}`);
  return list.join(", ");
}
