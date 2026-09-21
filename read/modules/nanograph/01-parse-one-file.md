# 01 · Parse one file

*You need Python 3.9 or later and a terminal. This episode uses only the
Python standard library, so you do not need to install a package. Allow about
45 minutes.*

## The idea, before any code

You usually run source code. A parser reads the same source code as data, much as another program might read a CSV file. Python includes the `ast` module. AST stands for **abstract syntax tree**, a tree of typed nodes that represents the structure of a `.py` file. A function definition, a function call, and a name become different kinds of nodes. You can inspect those nodes instead of relying on text patterns.

The abstract syntax tree provides the data for the rest of this series. In this episode, you will answer two questions: **Which functions exist in one file, and what does each function call?**

## Build the parser

Create a folder, then create `nanograph.py` inside the folder. Type each version below in order and run it before continuing. By typing the code, you can stop at any line you cannot explain.

**1. Confirm that the tree exists.**

```python
"""nanograph, episode 01: read one Python file and list its functions and calls."""
import ast
import sys

source = open(sys.argv[1]).read()
tree = ast.parse(source, filename=sys.argv[1])
print(ast.dump(tree)[:300])
```

Run the parser on its own source code with `python3 nanograph.py nanograph.py`. The command prints the first 300 characters of the abstract syntax tree. This first run confirms that `ast.parse` created the tree. You will not need to read the raw tree again.

**2. Find the functions.** Replace the final line with:

```python
for node in ast.walk(tree):
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        print(node.name)
```

`ast.walk` visits every node in the tree. `isinstance` keeps only `FunctionDef` and `AsyncFunctionDef` nodes, which represent regular and asynchronous function definitions. Run the command again. The program prints nothing because the file does not define a function yet. The empty output accurately describes the file.

**3. Report functions and calls.** Replace the complete file with:

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

**4. Run the completed parser.** Run it without arguments so that it parses its own source code:

```
parse_file -> <dynamic>.read, ast.parse, ast.walk, calls_inside, isinstance, open, set, sorted
calls_inside -> ast.walk, call_name, isinstance
call_name -> call_name, isinstance
main -> <dynamic>.items, <dynamic>.join, len, parse_file, print
```

The output shows three facts about the parser's structure:

- `call_name -> call_name` shows **recursion**, which occurs when a function
 calls itself. An attribute chain such as `a.b.c` requires `call_name` to
 resolve the inner name first.
- `<dynamic>.read`: `open(path).read()` calls `.read` on a value with no
 name. The tool reports `<dynamic>` because it cannot identify that value.
 When the tool cannot identify a call target, it must report the uncertainty.
- `main -> parse_file` but nothing points at `main`: from inside one file,
 nobody calls `main`. One file cannot show whether `main` is unused code or
 an entry point called from outside the file. Episode 02 addresses calls
 across files.

## Exercise (not shown in any video)

`calls_inside` currently visits every node inside a function, including
functions defined inside it. The report therefore credits a nested function's
calls to the parent function. Create a file where an inner function calls
something that the outer function never calls, then run the parser to show the
incorrect report. Fix the bug by stopping the walk when you reach a new
`FunctionDef` other than the starting function. Commit the failing example and
the fix. Together, those commits are the exercise artifact.

**Done when** your `nanograph.py` parses itself and one real file from a
repository you care about, and you can explain every line aloud without
reading the comments. If you are a Lab student, push the repository with the
exercise commits and post the URL in `#ship`.

## Sources

- Python `ast` documentation: docs.python.org/3/library/ast.html. Read the
 sections on `walk`, `Call`, and `FunctionDef`. You can leave the rest for
 later.
- The pattern of building in runnable steps comes from Karpathy's
 build-nanogpt, where the commit history serves as the textbook.
