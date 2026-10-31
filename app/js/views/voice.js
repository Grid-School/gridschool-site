/**
 * Talk instead of type: a button that dictates into a text box with the browser's own speech
 * recognition (Chrome, Edge, Safari). Nothing is sent anywhere by us until they press Save; where the
 * browser has no speech recognition, there's no button.
 */

import { el } from "../dom.js?v=72f2dd6-202610310710";

const Recognition = () => globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition || null;

export const canTalk = () => Boolean(Recognition());

export function talkButton(box) {
  const R = Recognition();
  if (!R) return null;
  let rec = null;
  let base = "";
  const button = el("button.rz__talk", { type: "button", "aria-pressed": "false" }, "🎙 Talk instead");
  const stop = () => {
    rec?.stop();
    rec = null;
    button.setAttribute("aria-pressed", "false");
    button.textContent = "🎙 Talk instead";
    box.focus({ preventScroll: true });
  };
  button.addEventListener("click", () => {
    if (rec) return stop();
    rec = new R();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    base = box.value.trim() ? `${box.value.trim()} ` : "";
    rec.onresult = (event) => {
      let said = "";
      for (let i = 0; i < event.results.length; i += 1) said += event.results[i][0].transcript;
      box.value = base + said.trim();
    };
    rec.onend = () => rec && stop();
    rec.onerror = () => stop();
    rec.start();
    button.setAttribute("aria-pressed", "true");
    button.textContent = "■ Stop";
  });
  return button;
}
