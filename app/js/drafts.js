/**
 * Nothing typed is ever lost. A field bound here writes every keystroke to
 * this device, keyed by board and field, and comes back filled on the next
 * render, the next visit, or after a crash. Saving the form clears the draft;
 * until then the draft is the truth and beats the stored value.
 */

const PREFIX = "gridschool.draft.v1";

function key(slug, id) {
  return `${PREFIX}.${slug}.${id}`;
}

export function readDraft(slug, id) {
  try {
    return localStorage.getItem(key(slug, id));
  } catch {
    return null;
  }
}

export function clearDraft(slug, id) {
  try {
    localStorage.removeItem(key(slug, id));
  } catch {
    /* storage unavailable: nothing to clear */
  }
}

/**
 * Restore a draft into `input` when one exists and differs from the saved
 * value, then keep the draft current. Returns true when a draft was restored.
 */
export function bindDraft(input, { slug, id, saved = "" }) {
  const draft = readDraft(slug, id);
  const restored = draft !== null && draft !== saved;
  if (restored) input.value = draft;
  input.addEventListener("input", () => {
    try {
      if (input.value === saved) localStorage.removeItem(key(slug, id));
      else localStorage.setItem(key(slug, id), input.value);
    } catch {
      /* storage unavailable: the field still holds the text */
    }
  });
  return restored;
}
