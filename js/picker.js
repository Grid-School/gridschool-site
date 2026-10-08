/**
 * The sentence's pickers. A native <select> stays in the page as the source of
 * truth (it works with JS off and in tests); this lays a button over it that
 * is sized to its words, and a listbox that opens under it. Choosing writes the
 * select and fires its change event, so nothing else needs to know.
 *
 * Keyboard: Enter, Space or ArrowDown opens; arrows move; Enter picks; Escape
 * and Tab close. One picker is open at a time.
 */

let openPicker = null;

export function enhancePickers(root = document) {
  for (const select of root.querySelectorAll(".pick select")) enhance(select);
  document.addEventListener("pointerdown", (event) => {
    if (openPicker && !openPicker.wrap.contains(event.target)) openPicker.close();
  });
}

function enhance(select) {
  const wrap = select.closest(".pick");
  const label = document.querySelector(`label[for="${select.id}"]`)?.textContent ?? "";
  const listId = `${select.id}-list`;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "pick__btn";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", listId);
  button.setAttribute("aria-label", label);

  const list = document.createElement("ul");
  list.className = "pick__list";
  list.id = listId;
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", label);
  list.hidden = true;

  const options = [...select.options].map((option, index) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.id = `${listId}-${index}`;
    li.textContent = option.text;
    li.dataset.value = option.value;
    li.addEventListener("pointerenter", () => focusOption(index));
    li.addEventListener("click", () => choose(index));
    list.append(li);
    return li;
  });

  let active = select.selectedIndex;

  function sync() {
    button.textContent = select.options[select.selectedIndex].text;
    options.forEach((li, index) => li.setAttribute("aria-selected", String(index === select.selectedIndex)));
  }

  function focusOption(index) {
    active = (index + options.length) % options.length;
    options.forEach((li, i) => li.classList.toggle("is-active", i === active));
    list.setAttribute("aria-activedescendant", options[active].id);
    options[active].scrollIntoView({ block: "nearest" });
  }

  function open() {
    if (openPicker && openPicker !== api) openPicker.close();
    list.hidden = false;
    button.setAttribute("aria-expanded", "true");
    wrap.classList.add("is-open");
    focusOption(select.selectedIndex);
    list.tabIndex = -1;
    list.focus({ preventScroll: true });
    openPicker = api;
  }

  function close({ refocus = true } = {}) {
    list.hidden = true;
    button.setAttribute("aria-expanded", "false");
    wrap.classList.remove("is-open");
    if (openPicker === api) openPicker = null;
    if (refocus) button.focus({ preventScroll: true });
  }

  function choose(index) {
    const changed = select.selectedIndex !== index;
    select.selectedIndex = index;
    sync();
    close();
    if (changed) select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  button.addEventListener("click", () => (list.hidden ? open() : close()));
  button.addEventListener("keydown", (event) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      open();
    }
  });
  list.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") focusOption(active + 1);
    else if (event.key === "ArrowUp") focusOption(active - 1);
    else if (event.key === "Home") focusOption(0);
    else if (event.key === "End") focusOption(options.length - 1);
    else if (event.key === "Enter" || event.key === " ") choose(active);
    else if (event.key === "Escape") close();
    else if (event.key === "Tab") return close({ refocus: false });
    else return;
    event.preventDefault();
  });
  // Something else (a deep link, a test) changed the select: follow it.
  select.addEventListener("change", sync);

  const api = { wrap, close };
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");
  wrap.classList.add("is-enhanced");
  wrap.append(button, list);
  sync();
}
