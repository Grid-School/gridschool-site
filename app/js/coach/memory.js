/**
 * Student memory. Founding size: a list of notes and a list of text files,
 * retrieved by keyword overlap. The shape is what later storage swaps against.
 *
 * We do not extract embeddings and we do not phone home. A note the student
 * did not ask us to keep is not stored. Auto-capture is limited to an explicit
 * "remember:" prefix so the product never surprises them with a diary.
 */

const STOP = new Set(
  "a an the and or to of in on for with is it this that be as at by from if we you i my".split(" ")
);

function tokens(text) {
  return String(text ?? "")
    .toLowerCase()
    .split(/[^a-z0-9+#.]/g)
    .filter((word) => word.length > 2 && !STOP.has(word));
}

function score(hay, needles) {
  if (!needles.length) return 0;
  const set = new Set(tokens(hay));
  let hits = 0;
  for (const word of needles) if (set.has(word)) hits += 1;
  return hits / needles.length;
}

/**
 * Pull the few notes and files that overlap the current message. Always include
 * the most recent note so a fact they just saved is not lost to a cold query.
 */
export function retrieve(memory, query, { limit = 6 } = {}) {
  const notes = memory?.notes ?? [];
  const files = memory?.files ?? [];
  const needles = tokens(query);
  const scored = [
    ...notes.map((note) => ({ kind: "note", item: note, score: score(note.text, needles) })),
    ...files.map((file) => ({ kind: "file", item: file, score: score(`${file.name} ${file.text}`, needles) })),
  ]
    .filter((row) => row.score > 0 || needles.length === 0)
    .sort((a, b) => b.score - a.score || (b.item.at ?? "").localeCompare(a.item.at ?? ""));

  const picked = [];
  const seen = new Set();
  const newest = notes[0];
  if (newest) {
    picked.push({ kind: "note", item: newest });
    seen.add(`note:${newest.id}`);
  }
  for (const row of scored) {
    const key = `${row.kind}:${row.item.id}`;
    if (seen.has(key)) continue;
    picked.push(row);
    seen.add(key);
    if (picked.length >= limit) break;
  }
  return picked;
}

/** "remember: I am targeting backend roles in Denver" → the durable sentence. */
export function rememberIntent(text) {
  const match = String(text ?? "").match(/remember:\s*([^\n]+)/i);
  return match ? match[1].trim() : null;
}

export function formatSnippets(snippets) {
  if (!snippets.length) return "(none yet)";
  return snippets
    .map((row) => {
      if (row.kind === "file") {
        const body = String(row.item.text ?? "").slice(0, 800);
        return `FILE ${row.item.name}:\n${body}`;
      }
      return `NOTE: ${row.item.text}`;
    })
    .join("\n\n");
}
