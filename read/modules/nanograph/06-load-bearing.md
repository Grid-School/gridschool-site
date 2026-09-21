# 06 · Load-bearing code

*Episode 05 is optional. Allow about 50 minutes. The math uses fractions and
averaging.*

## The claim

A function's position in the call graph can help you judge its importance. **In-degree** is the number of callers a function has. **PageRank** also gives more weight to a function when its callers have high scores. This episode implements PageRank as repeated averaging. You will compute both measures and explain what the numbers mean for the codebase.

## Build it

Compute in-degree first. Then compute PageRank by giving each node a score, sharing that score equally among its callees, and repeating the calculation for 40 iterations.

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
        nxt = {name: (1 - damp) / n for name in nodes}
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

The table needs an explanation. Write a findings note in the form of a review comment: "Function X ranks first because every command routes through it; a bug here is a bug everywhere; I would guard it with the suite's strictest tests." The note connects the graph result to an engineering judgment.

## Exercise (not shown)

Choose the function with the highest PageRank and the function with the highest in-degree. If they differ, explain the reason in three sentences. If they match, explain why the graph produces the same result for both measures. Commit the note beside the table.

**Done when** `nanograph rank` prints a table and your write-up turns at least one row into an engineering judgment. If you are a Lab student, post the table and write-up in `#ship`.

## Sources

- Brin and Page, 1998, the original PageRank paper. One figure is enough.
- Degree centrality: any networks intro.
