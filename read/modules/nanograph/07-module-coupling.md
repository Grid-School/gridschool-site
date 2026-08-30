# 07 · Module coupling

*You need: episode 06. ~40 minutes.*

## The claim

Folders are supposed to be boundaries. Coupling counts how often edges cross those boundaries. When two modules trade edges constantly, they are secretly one module wearing two names. "Just put it in utils" shows up in these numbers every time.

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

High coupling is not automatically wrong. Shared libraries *should* be called from many places. What you want is judgment: is this pair a deliberate API, or two folders that forgot they were one? Your write-up says which.

## Exercise (not shown)

Find the worst pair in a real repo. Propose one move that would cut the count (extract an interface, merge folders, or invert a dependency). Do not implement it yet. Commit the proposal as a paragraph next to the numbers.

## Done when

`nanograph coupling` prints worst pairs, and your findings note names one pair and what you would do about it. Lab students: #ship.

## Sources

- Module coupling / cohesion: any software design text that prefers numbers over adjectives.
- Your episode-06 write-up habit continues here unchanged.
