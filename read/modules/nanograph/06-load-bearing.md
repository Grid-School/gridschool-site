# 06 · Load-bearing code

*You need: episode 05 optional. ~50 minutes. Math: fractions and averaging.*

## The claim

Importance is structural, not alphabetical. The functions everyone leans on are the ones with many callers (degree), and more subtly the ones whose callers are themselves important (PageRank as repeated averaging). You will compute both, then write sentences about the numbers. Numbers without sentences are a data dump.

## Build it

Degree first. Then PageRank as: each node shares its score equally among its callees, repeat until the scores barely move.

```python
"""nanograph, episode 06: degree then PageRank-as-averaging."""
import json
import sys
from pathlib import Path


def load_graph(path="graph.json"):
 return json.loads(Path(path).read_text())


def degree(graph):
 """In-degree: how many callers each node has."""
 rev_count = {n: 0 for n in graph}
 for callees in graph.values():
 for c in callees:
 if c in rev_count:
 rev_count[c] += 1
 else:
 rev_count[c] = 1
 return rev_count


def pagerank(graph, iters=40, damp=0.85):
 nodes = sorted(set(graph) | {c for cs in graph.values() for c in cs})
 n = len(nodes)
 if n == 0:
 return {}
 score = {name: 1.0 / n for name in nodes}
 for _ in range(iters):
 nxt = {name: (1, damp) / n for name in nodes}
 for src in nodes:
 outs = [c for c in graph.get(src, []) if c in score]
 if not outs:
 # dangling: share with everyone
 share = damp * score[src] / n
 for name in nodes:
 nxt[name] += share
 else:
 share = damp * score[src] / len(outs)
 for dst in outs:
 nxt[dst] += share
 score = nxt
 return score


def main(argv):
 path = argv[2] if len(argv) > 2 else "graph.json"
 if len(argv) < 2 or argv[1] != "rank":
 print("usage: nanograph.py rank [graph.json]")
 return 2
 graph = load_graph(path)
 deg = degree(graph)
 pr = pagerank(graph)
 rows = sorted(pr.items(), key=lambda kv: (-kv[1], kv[0]))[:10]
 print("rank\tpr\tdegree\tname")
 for i, (name, score) in enumerate(rows, 1):
 print(f"{i}\t{score:.4f}\t{deg.get(name, 0)}\t{name}")
 return 0


if __name__ == "__main__":
 raise SystemExit(main(sys.argv))
```

## Numbers need sentences

Your evidence is not the table. It is a findings note that reads like a review comment: "Function X ranks first because every command routes through it; a bug here is a bug everywhere; I would guard it with the suite's strictest tests." That sentence is Communication doing real work.

## Exercise (not shown)

Pick the top-ranked function and the top by degree alone. If they differ, explain why in three sentences. If they match, explain why that is unsurprising. Commit the note next to the table.

## Done when

`nanograph rank` prints a table, and your write-up turns at least one row into a judgment. Lab students: both in #ship.

## Sources

- Brin & Page 1998 (the original PageRank paper): one figure is enough.
- Degree centrality: any networks intro.
