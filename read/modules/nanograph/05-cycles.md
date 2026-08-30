# 05 · Cycles

*You need: a working `graph.json`. ~45 minutes.*

## The claim

A cycle is a chain of calls that comes back to where it started. Some cycles are deliberate. Many are accidents that make local fixes impossible: change A, break B, change B, break A. Architecture stops being an opinion when you can *list* the loops.

Today you find them with DFS and a stack. No fancy library. The stack *is* the path.

## Build it

```python
"""nanograph, episode 05: find cycles with DFS + stack."""
import json
import sys
from pathlib import Path


def load_graph(path="graph.json"):
 return json.loads(Path(path).read_text())


def find_cycles(graph):
 """Return simple cycles as lists of node names (start == end)."""
 cycles = []
 visiting = set()
 stack = []
 seen = set()

 def dfs(node):
 if node in visiting:
 i = stack.index(node)
 cycles.append(stack[i:] + [node])
 return
 if node in seen:
 return
 visiting.add(node)
 stack.append(node)
 for nxt in graph.get(node, []):
 if nxt in graph:
 dfs(nxt)
 stack.pop()
 visiting.remove(node)
 seen.add(node)

 for name in sorted(graph):
 if name not in seen:
 dfs(name)
 uniq = []
 keys = set()
 for cyc in cycles:
 body = cyc[:-1]
 rot = tuple(min(tuple(body[i:] + body[:i]) for i in range(len(body))))
 if rot not in keys:
 keys.add(rot)
 uniq.append(cyc)
 return uniq


def main(argv):
 path = argv[2] if len(argv) > 2 else "graph.json"
 if len(argv) < 2 or argv[1] != "cycles":
 print("usage: nanograph.py cycles [graph.json]")
 return 2
 cycles = find_cycles(load_graph(path))
 if not cycles:
 print("(no cycles)")
 return 0
 for cyc in cycles:
 print(" -> ".join(cyc))
 return 0


if __name__ == "__main__":
 raise SystemExit(main(sys.argv))
```

## How to read a cycle

A reported cycle is not automatically a bug. Ask: can a change stay local? If fixing one function always forces a change in another on the loop, you have found why layers exist. Layers are a human attempt to forbid exactly these loops.

## Exercise (not shown)

Build a three-file toy that *has* a cycle, confirm the tool finds it, then break the cycle with one seam (extract a shared helper both call, instead of calling each other). Commit before and after. The diff is the architecture lesson.

## Done when

`nanograph cycles` names at least one true cycle in a real repo, or honestly reports none, and you can say in one sentence why the cycle matters or does not. Lab students: the sentence goes in #ship with the output.

## Sources

- DFS and back edges: CLRS ch. 22.3.
- Strongly connected components (Tarjan) if you want the grown-up version later; this episode stays with simple cycles on purpose.
