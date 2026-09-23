/**
 * Reading numbers follow the board. File names (disciplines/15-…, nanograph/00-…)
 * stay as stable ids. What the student sees is the order they meet each
 * reading on the map.
 */

const FILE_PREFIX = /^\d{2}\s*·\s*/;

export function bareReadingTitle(title) {
  return String(title ?? "").replace(FILE_PREFIX, "").trim();
}

export function walkReadings(curriculum) {
  const nodes = [...(curriculum?.nodes ?? [])].sort((a, b) => (a.n ?? 999) - (b.n ?? 999));
  const list = [];
  const indexById = new Map();
  for (const node of nodes) {
    for (const module of node.modules ?? []) {
      const id = module.id;
      if (!id || indexById.has(id)) continue;
      const row = {
        n: list.length + 1,
        id,
        title: bareReadingTitle(module.title),
        nodeId: node.id,
        nodeN: node.n,
        nodeTitle: node.title,
      };
      list.push(row);
      indexById.set(id, row);
    }
  }
  return { list, indexById };
}

export function displayReadingTitle(module, order) {
  const title = bareReadingTitle(module?.title);
  const row = module?.id ? order.indexById.get(module.id) : undefined;
  if (!row) return title;
  return `${String(row.n).padStart(2, "0")} · ${title}`;
}

export function numberCurriculumReadings(curriculum) {
  if (!curriculum?.nodes) return curriculum;
  const order = walkReadings(curriculum);
  return {
    ...curriculum,
    readingOrder: order.list,
    nodes: curriculum.nodes.map((node) => ({
      ...node,
      modules: (node.modules ?? []).map((module) => ({
        ...module,
        title: displayReadingTitle(module, order),
      })),
    })),
  };
}
