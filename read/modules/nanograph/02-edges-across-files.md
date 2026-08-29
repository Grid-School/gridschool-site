# 02 · Edges across files

*You need: episode 01 working. ~60 minutes. This is the episode where it
becomes a graph.*

## The problem episode 01 left you

One file tells you `main` calls `parse_file`. Real questions cross files: `routing.py` calls something defined in `rules.py`, and the whole point of a graph engine is seeing that edge. Two new problems appear the moment you cross a file boundary:

1. **Identity.** Two files can each define `load()`. "load" is no longer a
   name. You need *qualified* names: `store.load_tickets`, not `load_tickets`.
2. **Resolution.** When `main.py` calls `load_tickets(...)`, which definition
   is that? Python answers with imports and scopes, which is a hard problem.
   We will start with a heuristic (match by short name) and *say so in the
   code*. An honest heuristic beats a silent guess: that principle has a name
   in the grown-up tools (evidence tiers), and your tool is about to earn it.

## Build it

Extend to `nanograph.py` v2 (keep v1 in git history; the history is the textbook). Two passes: first collect every definition under a folder, then resolve every call against what was collected. One pass cannot work: you would meet calls to functions you have not seen defined yet.

```python
"""nanograph, episode 02: every function in a folder, and the edges between them."""
import ast
import json
import sys
from pathlib import Path


def parse_folder(root):
    """Every .py file under root -> {qualified_name: [called qualified names]}."""
    defs = {}      # short name -> qualified name (last definition wins; honest limitation)
    bodies = {}    # qualified name -> its AST node

    for path in sorted(Path(root).rglob("*.py")):
        module = path.relative_to(root).with_suffix("")
        module = ".".join(module.parts)
        tree = ast.parse(path.read_text(), filename=str(path))
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                qualified = f"{module}.{node.name}"
                defs[node.name] = qualified
                bodies[qualified] = node

    graph = {}
    for qualified, fn_node in bodies.items():
        edges = set()
        for called in calls_inside(fn_node):
            short = called.split(".")[-1]
            if short in defs:
                edges.add(defs[short])
        graph[qualified] = sorted(edges)
    return graph


def calls_inside(fn_node):
    for node in ast.walk(fn_node):
        if isinstance(node, ast.Call):
            yield call_name(node.func)


def call_name(func):
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        return f"{call_name(func.value)}.{func.attr}"
    return "<dynamic>"


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    graph = parse_folder(root)
    Path("graph.json").write_text(json.dumps(graph, indent=2))
    edge_count = sum(len(v) for v in graph.values())
    print(f"{len(graph)} functions, {edge_count} edges -> graph.json")


if __name__ == "__main__":
    main()
```

Walk the design before running it:

- **`defs` is the phone book** (short name → qualified name); **`bodies`**
  keeps each function's AST for pass two. Building an index first and querying
  it second is the same shape as every database you will ever meet.
- **The output is a file, not a printout.** `graph.json` is an adjacency list,
  the standard way to store a graph, and the input to every later episode.
  From here on, parsing and querying are separate programs. That split is an
  architecture decision you just made; notice it.
- **Two admitted lies, in comments, on purpose:** last definition wins when
  names collide, and calls are matched by short name (so `obj.save()` matches
  any `save` anywhere). Your tool's report is now *evidence with a stated
  confidence*, not truth. Episode 08 upgrades the evidence; the honesty stays.

## Run it on a real system

Lab students: run it on the studio repo. Real output from Northline Desk:

```
16 functions, 14 edges -> graph.json

northline.main.main        -> [cmd_ingest, cmd_show, cmd_status]
northline.main.cmd_status  -> [northline.store.load_tickets]
northline.routing.route_note -> [northline.ingest.clean_note, northline.rules.owner_from_keywords]
northline.sla.within_sla   -> [northline.sla.business_hours_between]
```

Read what the machine just handed you: `main` fans out to three commands; the routing logic leans on ingest *and* rules (a cross-module dependency you would want to know before touching either); SLA math stays inside its own module, a clean boundary that somebody chose. You have never read most of that code, and you already know its shape. **That is the entire thesis of this series, happening on a system you did not write.**

Not in the lab? Any Python project works. Try a small library you actually
use. Bigger repos will produce noisier graphs; noise is data too.

## Exercise (not shown)

The short-name heuristic lies when two modules define the same name. Build a
minimal repo where the lie happens (`a.py` and `b.py` both define `save`;
`c.py` calls it) and show the wrong edge. Then make the tool *confess* instead
of guessing: when a short name has two owners, emit the edge to a node called
`<ambiguous:save>` rather than picking one. Commit the lie and the confession.

## Done when

`graph.json` exists for a real repo, you can name one true thing the graph told you that you did not know, and one place where the heuristic might be lying. Lab students: both go in #ship with the repo URL.

## Sources

- Adjacency lists: any algorithms text; CLRS ch. 22 intro if you want depth.
- `pathlib.rglob`, `ast`: Python docs.
- The "evidence tier" idea (say how you know, not just what you know) is the
  same doctrine the production-grade tool (GridSeak) carries in every response.
