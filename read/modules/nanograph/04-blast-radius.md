# 04 · Blast radius

*You need: episode 03. One dial: `--hops`. ~45 minutes.*

## The claim

"If I change this, what breaks?" is not a metaphor. It is a walk. You start at a function and follow edges *backward* (who depends on me?), hop by hop, until you decide you have gone far enough. That distance is the one complexity dial in this series: `--hops`.

Direction matters. Walking upstream measures fear. Walking downstream measures reach. Same graph, opposite walks, different questions.

## Build it

Add a reverse BFS. Keep callers and callees. Do not re-parse.

```python
"""nanograph, episode 04: blast radius with --hops."""
import json
import sys
from collections import deque
from pathlib import Path


def load_graph(path="graph.json"):
    return json.loads(Path(path).read_text())


def reverse_index(graph):
    rev = {name: [] for name in graph}
    for caller, callees in graph.items():
        for callee in callees:
            rev.setdefault(callee, []).append(caller)
    for name in rev:
        rev[name] = sorted(set(rev[name]))
    return rev


def blast(graph, start, hops):
    """Everything that can reach `start` within `hops` reverse edges."""
    rev = reverse_index(graph)
    seen = {start: 0}
    q = deque([start])
    while q:
        node = q.popleft()
        if seen[node] >= hops:
            continue
        for caller in rev.get(node, []):
            if caller not in seen:
                seen[caller] = seen[node] + 1
                q.append(caller)
    # drop the seed; blast radius is everyone else
    return sorted(((d, n) for n, d in seen.items() if n != start))


def main(argv):
    # nanograph.py blast <fn> --hops 3 [graph.json]
    if len(argv) < 3 or argv[1] != "blast":
        print("usage: nanograph.py blast <fn> --hops N [graph.json]")
        return 2
    start = argv[2]
    hops = 2
    path = "graph.json"
    args = argv[3:]
    i = 0
    while i < len(args):
        if args[i] == "--hops" and i + 1 < len(args):
            hops = int(args[i + 1])
            i += 2
        else:
            path = args[i]
            i += 1
    graph = load_graph(path)
    rows = blast(graph, start, hops)
    if not rows:
        print("(none within hops)")
        return 0
    for depth, name in rows:
        print(f"{depth}\t{name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
```

Notice the dial: every other number in this tool is derived from `--hops`. That is the Karpathy move. Resist the urge to add five more flags today.

## Run it against your paper

```
python3 nanograph.py blast northline.routing.route_note --hops 2
```

Lay the output next to your episode-00 drawing. Where they agree, both are probably right. Where they differ, find out which is wrong with evidence. That hour is worth more than a clean green run.

## Exercise (not shown)

Add a `--forward` flag that walks callees instead of callers, same hop budget. Run both on one function and write two sentences: what fear looks like, what reach looks like. Commit the flag and the two sentences.

## Done when

Blast radius matches your paper or you can explain the difference, and `--hops` is the only dial you needed. Lab students: paste both outputs in #ship.

## Sources

- Breadth-first search: CLRS ch. 22.2, or any algorithms notes that draw the queue.
- Upstream vs downstream: the school's production tool names the same distinction; you just built the nano version.
