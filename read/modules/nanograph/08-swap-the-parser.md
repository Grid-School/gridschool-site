# 08 · Swap the parser

*You need: episodes 03-07 working against `graph.json`. ~90 minutes. First real dependency: tree-sitter.*

## The claim

Your queries never cared that the code was Python. They work on nodes and edges. Only the parser knew the language. That boundary is a seam: a line where one part can be swapped without the rest noticing. Today you put tree-sitter behind the same interface and keep every query unchanged.

Seams are what people mean when they say "good architecture." Systems with seams evolve. Systems without them get rewritten.

## The interface, frozen

Whatever language you parse, the output is still:

```json
{ "module.fn": ["other.fn", ".."] }
```

Callers, blast, cycles, rank, and coupling read that shape and nothing else. If you find yourself editing a query because the parser changed, the seam leaked.

## Build it

Install once:

```
pip install tree-sitter tree-sitter-python tree-sitter-c-sharp
```

(Use the grammars you need. Lab students mapping the world server need C#.)

Sketch the seam:

```python
"""nanograph, episode 08: parser plugins behind one graph shape."""
from pathlib import Path


class PythonAstParser:
 """Your episode-02 parser, wrapped."""
 def parse_folder(self, root: Path) -> dict:
 # return adjacency list {qualified: [callees]}
 ..


class TreeSitterParser:
 """Same method name. Different language. Same output shape."""
 def __init__(self, language):
 self.language = language

 def parse_folder(self, root: Path) -> dict:
 # walk files, query function defs + calls via tree-sitter,
 # emit the same adjacency list
 ..


def build_graph(root, parser) -> dict:
 return parser.parse_folder(Path(root))
```

Wire your CLI so `nanograph.py parse <root> --lang python|csharp` chooses a parser, writes `graph.json`, and leaves every other command untouched.

## Then map the world

Point the C# parser at the world server repo. Run blast on the function your next world ticket will touch. Post the blast radius in #world. This is the moment the tracks fuse: an instrument you built, analyzing a live system you are about to change.

## Exercise (not shown)

Parse a tiny JS or Go fixture with a third grammar. Prove `callers` still works with zero query changes. Commit the fixture and the one-line CLI addition.

## Done when

`graph.json` builds from a non-Python repo, queries are unchanged, and you have a blast radius for a world-server function. Lab students: URL + blast output in #ship.

## Sources

- tree-sitter docs: tree-sitter.github.io
- "Seams" as a teaching word: Michael Feathers, *Working Effectively with Legacy Code* (the idea; you do not need the whole book today)
