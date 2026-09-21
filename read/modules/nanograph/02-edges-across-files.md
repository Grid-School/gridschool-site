# 02 · Edges across files

*You need the working parser from episode 01. Allow about 60 minutes. In this
episode, you will connect calls across files to form a graph.*

## The problem episode 01 left you

One file can tell you that `main` calls `parse_file`. Real questions cross file boundaries. For example, `routing.py` may call a function defined in `rules.py`, and a graph engine must record that edge. Crossing a file boundary introduces two problems:

1. **Identity.** Two files can each define `load_tickets()`. A **qualified name**
 includes the module that owns the function, such as `store.load_tickets`,
 so the graph can distinguish definitions that share the short name
 `load_tickets`.
2. **Resolution.** When `main.py` calls `load_tickets(..)`, which definition
 does the call refer to? Python uses imports and scopes to resolve the answer.
 This episode starts with a **heuristic**, a limited rule that matches calls
 by short name. The code will state that limitation. Production tools use
 **evidence tiers** to identify how each result was found and how much
 confidence it deserves.

## Build it

Extend `nanograph.py` to version 2, and keep version 1 in the Git history. The new parser uses two passes. The first pass collects every function definition under a folder. The second resolves each call against those definitions. A single pass could encounter a call before its definition.

```python
"""nanograph, episode 02: every function in a folder, and the edges between them."""
import ast
import json
import sys
from pathlib import Path


def parse_folder(root):
    """Every .py file under root -> {qualified_name: [called qualified names]}."""
    defs = {} # short name -> qualified name (last definition wins; honest limitation)
    bodies = {} # qualified name -> its AST node

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

Review the design before running the program:

- `defs` maps each short name to a qualified name. `bodies` keeps each
 function's AST node for the second pass. This is an **index**: data collected
 in advance so later lookups are faster.
- `graph.json` is an **adjacency list**, a graph representation that maps each
 node to the nodes it connects to. Every later episode reads this file.
 Parsing and querying are now separate parts of the program.
- The comments state two limitations. The last definition wins when names
 collide, and calls are matched by short name. As a result, `obj.save()` can
 match any function named `save`. The report is evidence with a stated
 confidence level. Episode 08 improves the evidence while keeping the
 limitations explicit.

## Run it on a real system

If you are a Lab student, run the parser on the studio repository. The command
prints this summary for Northline Desk:

```
16 functions, 14 edges -> graph.json
```

The generated `graph.json` contains these entries:

```json
{
  "northline.main.main": [
    "northline.main.cmd_ingest",
    "northline.main.cmd_show",
    "northline.main.cmd_status"
  ],
  "northline.main.cmd_status": [
    "northline.store.load_tickets"
  ],
  "northline.routing.route_note": [
    "northline.ingest.clean_note",
    "northline.rules.owner_from_keywords"
  ],
  "northline.sla.within_sla": [
    "northline.sla.business_hours_between"
  ]
}
```

The output shows that `main` calls three commands. The routing logic depends on both `ingest` and `rules`, so changing either module could affect routing. The SLA calculations remain inside the `sla` module. These edges describe the structure of a system even before you read most of its code.

If you are not in the Lab, use any Python project. A small library you already
use is enough. Larger repositories will produce graphs with more irrelevant
or uncertain edges, which you should record as part of the result.

## Exercise (not shown)

The short-name heuristic gives the wrong result when two modules define the
same name. Build a minimal repository where `a.py` and `b.py` both define
`save`, and `c.py` calls `save`. Run the parser and show the wrong edge. Then
change the tool so that a short name with two owners produces an edge to a
node called `<ambiguous:save>`. Commit the incorrect result and the explicit
ambiguity result.

**Done when** `graph.json` exists for a real repository, you can name one true fact the graph revealed, and you can identify one result where the heuristic may be wrong. If you are a Lab student, post both statements and the repository URL in `#ship`.

## Sources

- Adjacency lists: any algorithms text; CLRS ch. 22 intro if you want depth.
- `pathlib.rglob`, `ast`: Python docs.
- An evidence tier states how a tool found a result. A parser result and a
 text-search result use different methods, so report the tier with the result.
