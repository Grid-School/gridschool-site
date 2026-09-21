# 04 · Blast radius

*You need the tool from episode 03. This episode adds one setting,
`--hops`. Allow about 45 minutes.*

## The claim

"If I change this, what breaks?" is a graph traversal. Begin at a function and follow call edges backward to find the functions that depend on it. Each edge you follow is one **hop**. The `--hops` value sets the maximum number of edges to follow.

Direction determines the question. An **upstream** walk follows edges to callers and shows which functions may be affected by a change. A **downstream** walk follows edges to callees and shows which functions the starting function can reach.

## Build it

Add a reverse **breadth-first search**, or **BFS**. BFS visits nodes one hop at a time by using a queue. Keep the `callers` and `callees` commands, and query the saved graph without re-parsing the repository.

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

The `--hops` value controls the traversal distance. Keep it as the only new setting in this episode.

## Run it against your paper

```
python3 nanograph.py blast northline.routing.route_note --hops 2
```

Place the output beside your episode-00 drawing. Check the matching nodes against the source code, then investigate every difference until you can show which result is wrong.

## Exercise (not shown)

Add a `--forward` flag that follows callees while using the same hop limit. Run the upstream and forward traversals on one function. Write one sentence about the possible effects on callers and one sentence about the callees the function can reach. Commit the flag and both sentences.

**Done when** the blast radius matches your paper or you can explain every difference, and `--hops` is the only setting you added. If you are a Lab student, post both outputs in `#ship`.

## Sources

- Breadth-first search: CLRS ch. 22.2, or any algorithms notes that draw the queue.
- Upstream and downstream: walking edges backward finds callers, while
 walking edges forward finds callees.
