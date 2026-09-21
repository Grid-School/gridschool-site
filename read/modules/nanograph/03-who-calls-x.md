# 03 · Who calls X

*You need the `graph.json` file from episode 02. You do not need to install
anything else. Allow about 45 minutes.*

## The claim

A saved graph becomes useful when you can query it. This episode answers two questions: Who calls a function, and what does that function call? Each answer is a **one-hop lookup**, which follows one edge from the selected function.

Until now, you have read `graph.json` yourself. In this episode, you will add a command-line interface, or **CLI**, that performs both lookups.

## Build it

Keep `parse_folder` from episode 02. Add a **reverse index**, which maps each called function to its callers, and add two commands. Keep each earlier version in the Git history.

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

Review the design before running the commands:

- Parse the repository once and query the saved graph many times. The reverse
 index does its work before the lookup so that each query can return quickly.
- The CLI defines a stable interface. `callers` and `callees` accept a
 qualified name and print one name per line. Later episodes add flags while
 keeping these command names.
- `(none)` means the graph contains no matching edge. Preserve the empty
 result instead of guessing.

## Run it

```
python3 nanograph.py callers northline.routing.route_note
python3 nanograph.py callees northline.routing.route_note
```

Compare both command results with your paper from episode 00. Investigate every difference to determine whether the paper or the graph is wrong.

## Exercise (not shown)

Qualified names can be long. Add a `--short` flag that matches the final segment of a name only when exactly one function ends with that segment. When two functions match, the command must refuse to choose. Commit a case with two matches and show the refusal.

**Done when** `callers` and `callees` answer from `graph.json` without re-parsing, and you can explain the purpose of the reverse index in one sentence. If you are a Lab student, post the command output in `#ship`.

## Sources

- Adjacency lists and reverse edges: CLRS ch. 22 intro.
- For examples of a CLI as a stable interface, review a tool you already
 trust, such as `git` or `rg`.
