# 08 · Swap the parser

*You need the commands from episodes 03 through 07 working with `graph.json`.
Allow about 90 minutes. This episode adds the first external dependency,
tree-sitter.*

## The claim

The query commands work with graph nodes and edges, regardless of the source language. Only the parser depends on Python. The boundary around the parser is a **seam**, a place where you can replace one implementation without changing the rest of the system. In this episode, you will put tree-sitter behind the existing parser interface and keep every query unchanged.

This seam allows the tool to support another language without rewriting its query commands.

## The interface, frozen

For every source language, the parser must still produce:

```json
{ "module.fn": ["other.fn", ".."] }
```

The `callers`, `blast`, `cycles`, `rank`, and `coupling` commands read only this adjacency-list shape. If changing the parser requires a query change, parser-specific behavior has crossed the seam.

## Build it

Install the dependencies once:

```
pip install tree-sitter tree-sitter-python tree-sitter-c-sharp
```

Install only the language grammars you need. Lab students mapping the world server need the C# grammar.

Create the parser interface:

```python
"""nanograph, episode 08: parser plugins behind one graph shape."""
from pathlib import Path


class PythonAstParser:
    """Your episode-02 parser, wrapped."""

    def parse_folder(self, root: Path) -> dict:
        # return adjacency list {qualified: [callees]}
        ...


class TreeSitterParser:
    """Same method name. Different language. Same output shape."""

    def __init__(self, language):
        self.language = language

    def parse_folder(self, root: Path) -> dict:
        # walk files, query function defs + calls via tree-sitter,
        # emit the same adjacency list
        ...


def build_graph(root, parser) -> dict:
    return parser.parse_folder(Path(root))
```

Connect the CLI so that `nanograph.py parse <root> --lang python|csharp` selects a parser and writes `graph.json`. Keep every query command unchanged.

## Lab students: map the world

If you are a Lab student, run the C# parser on the world server repository. Then run `blast` on the function that your next world ticket will change. Post the blast radius in `#world`. The result applies the tool you built to the live system you are preparing to change.

## Exercise (not shown)

Create a small JavaScript or Go fixture and parse it with a third grammar. Run `callers` without changing the query code. Commit the fixture and the one-line CLI addition.

**Done when** `graph.json` builds from a non-Python repository, all query commands remain unchanged, and you have a blast radius for one function in that repository. If you are a Lab student, use a world-server function and post the URL and blast output in `#ship`.

## Sources

- tree-sitter docs: tree-sitter.github.io
- "Seams" as a teaching word: Michael Feathers, *Working Effectively with Legacy Code* (the idea; you do not need the whole book today)
