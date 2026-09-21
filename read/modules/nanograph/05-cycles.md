# 05 · Cycles

*You need a working `graph.json` file. Allow about 45 minutes.*

## The claim

A **cycle** is a chain of calls that returns to its starting function. Some cycles are deliberate. Others prevent changes from staying local because changing function A affects function B, and changing function B affects function A. Listing the cycles gives you concrete evidence about these dependencies.

You will find cycles with **depth-first search**, or **DFS**, an algorithm that follows one path as far as possible before returning to try another. A **stack** records the current path. This implementation uses the Python standard library.

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

A reported cycle may be intentional. For each cycle, ask whether a change can stay local. If fixing one function repeatedly requires a change in another function on the cycle, the dependency crosses the intended boundaries. Software layers are boundaries designed to prevent these loops.

## Exercise (not shown)

Build a three-file example that contains a cycle and confirm that the tool finds it. Then create a **seam**, a boundary where one implementation can be separated from another, by extracting a shared helper that both functions call. Remove the calls between the original functions. Commit the code before and after the change so the diff shows how you broke the cycle.

**Done when** `nanograph cycles` names at least one true cycle in a real repository or reports `(no cycles)`, and you can explain in one sentence why the result matters. If you are a Lab student, post the sentence and command output in `#ship`.

## Sources

- DFS and back edges: CLRS ch. 22.3.
- For a later extension, read about Tarjan's algorithm for strongly connected
 components. This episode deliberately finds simple cycles.
