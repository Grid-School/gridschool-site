/**
 * Token math and the monthly cap.
 *
 * We never ask the student to think in tokens. They see dollars left. The
 * estimate is chars/4, which is what every lab uses when the API has not
 * returned usage yet; once a live response includes `usage`, we store that
 * and the estimate is only for the "will this turn fit" check.
 */

import { COACH } from "../../../config.js";

const CHARS_PER_TOKEN = 4;

export function monthKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function estimateTokens(text) {
  const chars = String(text ?? "").length;
  return Math.max(1, Math.ceil(chars / CHARS_PER_TOKEN));
}

export function costUsd({ inputTokens = 0, cachedTokens = 0, outputTokens = 0 }, rates = COACH.rates) {
  const input = (inputTokens / 1_000_000) * rates.inputPerM;
  const cached = (cachedTokens / 1_000_000) * (rates.cachedPerM ?? 0);
  const output = (outputTokens / 1_000_000) * rates.outputPerM;
  return input + cached + output;
}

export function usageForMonth(entries, now = new Date()) {
  const key = monthKey(now);
  return (entries ?? []).filter((entry) => (entry.month ?? monthKey(new Date(entry.at))) === key);
}

export function spentUsd(student, now = new Date()) {
  return usageForMonth(student?.usage ?? [], now).reduce((sum, entry) => sum + (entry.usd ?? 0), 0);
}

export function credits(student, now = new Date()) {
  const cap = COACH.monthlyUsd;
  const spent = spentUsd(student, now);
  const left = Math.max(0, cap - spent);
  return {
    cap,
    spent,
    left,
    month: monthKey(now),
    model: COACH.model,
  };
}

export function formatUsd(value) {
  const n = Math.max(0, Number(value) || 0);
  return `$${n.toFixed(n >= 10 ? 2 : 2)}`;
}

/** True when this prompt would cross the monthly cap. */
export function wouldExceed(student, inputText, now = new Date()) {
  const { left } = credits(student, now);
  const estimated = costUsd({ inputTokens: estimateTokens(inputText), outputTokens: 400 });
  return { blocked: estimated > left, estimated, left };
}

export function attachmentBudget(files, paste) {
  const pasteChars = String(paste ?? "").length;
  const fileChars = (files ?? []).reduce((sum, file) => sum + String(file.text ?? "").length, 0);
  const used = pasteChars + fileChars;
  return {
    used,
    left: Math.max(0, COACH.maxPasteChars - used),
    over: used > COACH.maxPasteChars,
    max: COACH.maxPasteChars,
  };
}
