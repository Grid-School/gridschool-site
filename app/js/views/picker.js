/**
 * The gate. A real provider goes here later; today it lists who exists so the
 * whole platform can be walked without an account.
 */

import { el } from "../dom.js";
import { btn } from "../ui.js";
import { gmark, wordmark } from "../../../js/brand.js";
import { loadRoster, loadStudent } from "../api.js";
import { signIn } from "../session.js";

export function renderPicker(mountPoint) {
  const list = el("div.picker__list", {}, el("p.muted", {}, "Loading boards."));

  const card = el(
    "div.picker",
    {},
    el("div.picker__brand", {}, gmark({ className: "picker__logo" }), wordmark()),
    el("h1", {}, "Open a board"),
    el(
      "p.muted",
      {},
      "The student platform, open to walk. Real sign-in lands with the first paid seat; nothing listed here is another person's work."
    ),
    list,
    el(
      "p.picker__foot",
      {},
      "Not a student yet? ",
      el("a", { href: "../#offer" }, "See the offer"),
      "."
    )
  );

  loadRoster().then(async (roster) => {
    const students = await Promise.all(
      roster.students.map((slug) => loadStudent(slug).catch(() => null))
    );
    list.replaceChildren(
      ...students.filter(Boolean).map((student) =>
        el(
          "button.picker__row",
          {
            type: "button",
            onclick: () => {
              signIn(student.slug);
              location.search = `?s=${student.slug}`;
            },
          },
          el("b", {}, student.name),
          el("span", {}, student.note ?? `${student.cohort} · joined ${student.joined}`)
        )
      )
    );
  });

  mountPoint.replaceChildren(el("div.gate", {}, card));
}
