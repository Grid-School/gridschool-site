/**
 * Submit-required drafts (evidence URL, review send, Focus/Next). Toggles and
 * drags commit on the act. These fields do not. Navigation must confirm.
 */

const guards = new Map();
let unloadBound = false;

function dirtyEntry() {
  for (const entry of guards.values()) {
    if (entry.isDirty()) return entry;
  }
  return null;
}

function onBeforeUnload(event) {
  if (!dirtyEntry()) return;
  event.preventDefault();
  event.returnValue = "";
}

function ensureUnload() {
  if (unloadBound) return;
  const target = globalThis.window ?? globalThis;
  if (typeof target.addEventListener !== "function") return;
  unloadBound = true;
  target.addEventListener("beforeunload", onBeforeUnload);
}

export function registerLeaveGuard(id, isDirty, warn) {
  guards.set(id, { isDirty, warn });
  ensureUnload();
  return () => {
    if (guards.get(id)?.isDirty === isDirty) guards.delete(id);
  };
}

export function clearLeaveGuard(id) {
  if (id) guards.delete(id);
  else guards.clear();
}

export function isLeaveDirty() {
  return Boolean(dirtyEntry());
}

export function allowLeave() {
  const entry = dirtyEntry();
  if (!entry) return true;
  const confirmFn = globalThis.window?.confirm ?? globalThis.confirm;
  if (typeof confirmFn !== "function") return false;
  return confirmFn(entry.warn);
}
