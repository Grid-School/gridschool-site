# 07 · Module coupling

*You need the `graph.json` file from episode 02. Allow about 40 minutes.*

## The claim

A module groups related code behind a boundary. **Coupling** measures how many call edges cross module boundaries. A high count between two modules can mean that the separation does not match how the code actually works. Calls through a shared `utils` module also appear in these counts.

## Build it

```python
"""nanograph, episode 07: worst-coupled module pairs."""
import json
import sys
from collections import Counter
from pathlib import Path


def load_graph(path="graph.json"):
    return json.loads(Path(path).read_text())


def module_of(qualified):
    parts = qualified.split(".")
    return parts[0] if len(parts) == 1 else ".".join(parts[:-1])


def coupling(graph):
    """Undirected pair counts for cross-module edges."""
    counts = Counter()
    for src, dsts in graph.items():
        a = module_of(src)
        for dst in dsts:
            b = module_of(dst)
            if a == b:
                continue
            pair = tuple(sorted((a, b)))
            counts[pair] += 1
    return counts.most_common()


def main(argv):
    path = argv[2] if len(argv) > 2 else "graph.json"
    if len(argv) < 2 or argv[1] != "coupling":
        print("usage: nanograph.py coupling [graph.json]")
        return 2
    pairs = coupling(load_graph(path))
    if not pairs:
        print("(no cross-module edges)")
        return 0
    for (a, b), n in pairs[:15]:
        print(f"{n}\t{a}\t<>\t{b}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
```

## How to read the worst pair

High coupling can be appropriate. A shared library is expected to receive calls from many modules. For the highest-count pair, decide whether the edges pass through a deliberate application programming interface, or **API**, or whether the modules should have a different boundary. Explain your conclusion in the findings note.

## Exercise (not shown)

Find the module pair with the highest count in a real repository. Propose one change that would reduce the count: extract an interface, merge folders, or invert a dependency so that the current caller becomes the called module. Commit the proposal as a paragraph beside the numbers. This exercise ends with the committed proposal, and implementation comes later.

**Done when** `nanograph coupling` prints the module pairs with the highest counts, and your findings note names one pair and explains what you would do about it. If you are a Lab student, post the output and note in `#ship`.

## Sources

- For module coupling and cohesion, use a software design text that measures
 relationships between modules.
- Your episode-06 write-up habit continues here unchanged.
