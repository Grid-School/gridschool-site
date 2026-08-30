# 01 · Parse one file

*You need: Python 3.9+ and a terminal. Nothing to install; the whole episode
is the standard library. ~45 minutes.*

## The idea, before any code

Source code is text you *run*. To a parser, the same text is data you *read*, like a CSV. Python ships its own reader: the `ast` module ("abstract syntax tree") turns a `.py` file into a tree of typed nodes, where a function definition, a call, and a name are distinct kinds of node. Instead of grepping for patterns and hoping, you walk a structure the language itself guarantees.

That tree is the raw material for everything in this series. Today's slice of it is narrow on purpose: **which functions exist in one file, and what does each one call.**

## Build it (type it, don't paste it)

Make a folder, create `nanograph.py`, and build it in the order below. Each piece runs before the next exists. Typing it matters: the goal is that no line survives that you cannot explain.

**1. The skeleton: prove the tree exists.**

```python
"""nanograph, episode 01: read one Python file and list its functions and calls."""
import ast
import sys

source = open(sys.argv[1]).read()
tree = ast.parse(source, filename=sys.argv[1])
print(ast.dump(tree)[:300])
```

Run it on itself: `python3 nanograph.py nanograph.py`. That wall of text is the tree. You never need to read it raw again, but see it once so the rest of the episode is demystified rather than magic.

**2. Find the functions.** Replace the last line:

```python
for node in ast.walk(tree):
 if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
 print(node.name)
```

`ast.walk` visits every node in the tree; `isinstance` filters for the type we care about. Run it. It prints nothing, which is correct: the file has no functions yet. First lesson in trusting a tool: empty output is an answer, not a bug.

**3. Now the real shape.** Rewrite the file as functions and make it report
calls too:

```python
"""nanograph, episode 01: read one Python file and list its functions and calls."""
import ast
import sys


def parse_file(path):
 """One file in, one report out: which functions exist, what each one calls."""
 source = open(path).read()
 tree = ast.parse(source, filename=path)

 functions = {}
 for node in ast.walk(tree):
 if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
 functions[node.name] = sorted(set(calls_inside(node)))
 return functions


def calls_inside(fn_node):
 """Every name that gets called inside this function's body."""
 for node in ast.walk(fn_node):
 if isinstance(node, ast.Call):
 yield call_name(node.func)


def call_name(func):
 """The readable name of a call target: foo() -> 'foo', obj.method() -> 'obj.method'."""
 if isinstance(func, ast.Name):
 return func.id
 if isinstance(func, ast.Attribute):
 return f"{call_name(func.value)}.{func.attr}"
 return "<dynamic>"


def main():
 path = sys.argv[1] if len(sys.argv) > 1 else __file__
 for name, calls in parse_file(path).items():
 print(f"{name} -> {', '.join(calls) or '(calls nothing)'}")


if __name__ == "__main__":
 main()
```

**4. The moment.** Run it with no arguments. It parses *itself*:

```
parse_file -> <dynamic>.read, ast.parse, ast.walk, calls_inside, isinstance, open, set, sorted
calls_inside -> ast.walk, call_name, isinstance
call_name -> call_name, isinstance
main -> <dynamic>.items, <dynamic>.join, len, parse_file, print
```

Read that output slowly. Your tool just told you three true things about its own structure:

- `call_name -> call_name`: it found its own recursion (an attribute chain
 like `a.b.c` needs the inner name first). You wrote a recursive function and
 the graph caught it.
- `<dynamic>.read`: `open(path).read()` calls `.read` on a value with no
 name. The tool does not guess; it says `<dynamic>`. **When your tool does not
 know, it must say so.** That rule is worth more than any feature, and it is
 the difference between an instrument and a horoscope.
- `main -> parse_file` but nothing points at `main`: from inside one file,
 nobody calls main. Whether that means "dead code" or "entry point" needs
 more than one file to answer. That is exactly episode 02's problem.

## Exercise (not shown in any video)

`calls_inside` currently walks *everything* inside a function, including
functions nested within it, whose calls get wrongly credited to the parent.
Prove the bug: write a file where an inner function calls something the outer
one never does, and show the report is wrong. Then fix it (hint: stop the walk
when you meet a new `FunctionDef` that isn't the one you started at). Commit
the failing example *and* the fix. The pair is the artifact.

## Done when

Your `nanograph.py` parses itself and one real file from a repo you care
about, and you can explain every line out loud without reading comments. Lab
students: push the repo with the exercise commits and drop the URL in #ship.

## Sources

- Python `ast` docs: docs.python.org/3/library/ast.html. Skim `walk`, `Call`,
 `FunctionDef`; ignore the rest for now.
- The pattern of building in runnable steps is stolen deliberately from
 Karpathy's build-nanogpt, where the commit history is the textbook.
