# 03 · Who calls X

*You need: episode 02's `graph.json`. Nothing new to install. ~45 minutes.*

## The claim

A graph on disk is a drawing. A graph you can ask questions of is an instrument. The first question every engineer actually asks is simple: who calls this function? The second is its twin: what does this function call? Both are one-hop lookups if you build the index once.

Until now you re-read `graph.json` with your eyes. Today you give the tool a CLI and stop scanning.

## Build it

Keep `parse_folder` from episode 02. Add a reverse index and two commands. The file grows; the history stays the textbook.

```python
"""nanograph, episode 03: callers and callees from graph.json."""
import json
import sys
from pathlib import Path


def load_graph(path="graph.json"):
    return json.loads(Path(path).read_text())


def reverse_index(graph):
    """callee -> [callers]. Built once; queries are lookups."""
    rev = {name: [] for name in graph}
    for caller, callees in graph.items():
        for callee in callees:
            rev.setdefault(callee, []).append(caller)
    for name in rev:
        rev[name] = sorted(set(rev[name]))
    return rev


def main(argv):
    if len(argv) < 3:
        print("usage: nanograph.py callers|callees <fn> [graph.json]")
        return 2
    cmd, target = argv[1], argv[2]
    path = argv[3] if len(argv) > 3 else "graph.json"
    graph = load_graph(path)

    if cmd == "callees":
        hits = graph.get(target, [])
    elif cmd == "callers":
        hits = reverse_index(graph).get(target, [])
    else:
        print(f"unknown command: {cmd}")
        return 2

    if not hits:
        print("(none)")
    else:
        for name in hits:
            print(name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
```

Walk the design before celebrating:

- **Parse once, query many times.** Rebuilding the graph for every question is how people waste afternoons. The reverse index is the same shape as every database index you will ever meet: pay upfront, answer instantly.
- **The CLI is a contract.** `callers` and `callees` take a qualified name and print one name per line. Later episodes will add flags; the verbs stay stable. Interfaces that change every week teach nothing.
- **Empty is an answer.** `(none)` is honest. Do not invent callers to look useful.

## Run it

```
python3 nanograph.py callers northline.routing.route_note
python3 nanograph.py callees northline.routing.route_note
```

Compare both answers to your paper from episode 00 if you still have it. Where they disagree, one of you is wrong, and that disagreement is the lesson.

## Exercise (not shown)

Qualified names are long. Add a `--short` flag that matches the last segment of the name when exactly one function ends that way, and refuses to guess when two do. Commit a case where short matching would lie, and show the refusal.

## Done when

`callers` and `callees` answer from `graph.json` without re-parsing, and you can explain why the reverse index exists in one sentence. Lab students: drop the command output in #ship.

## Sources

- Adjacency lists and reverse edges: CLRS ch. 22 intro.
- CLI as interface: any tool you already trust (`git`, `rg`). Steal their calm.
