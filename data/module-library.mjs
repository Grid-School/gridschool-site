/**
 * Node only: the module library read from disk, keyed "<id>@<version>" the way
 * app/js/modules.js loadModules builds it in the browser. For tests and
 * scripts that validate maps before they ship.
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const MODULE_DIR = join(dirname(fileURLToPath(import.meta.url)), "modules");

export function readLibrary(dir = MODULE_DIR) {
  const library = {};
  for (const name of readdirSync(dir).filter((file) => file.includes("@") && file.endsWith(".json")).sort()) {
    library[name.replace(/\.json$/, "")] = JSON.parse(readFileSync(join(dir, name), "utf8"));
  }
  return library;
}
