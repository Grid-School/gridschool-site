# 10 · Ship it

*You need: a tool that parses, queries, and packs. ~60 minutes.*

## The claim

A tool nobody can use is a diary. Packaging is respect for the reader. Today you ship: a README with real numbers from a real repo, an install path a stranger can follow, and a tiny `--serve` view so someone can see the graph without reading JSON.

## What the README must carry

Not marketing. Numbers:

- Repo analyzed (name + approximate line count).
- Functions and edges counted.
- One blast-radius example with `--hops`.
- One rank or coupling finding in a sentence.
- How to install and run the three most useful commands.

If a stranger cannot reproduce a number in five minutes, the README is unfinished.

## Build a tiny serve

```python
"""nanograph, episode 10: --serve a read-only view of graph.json."""
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import json


HTML = """<!doctype html><meta charset=utf-8>
<title>nanograph</title>
<pre id=out></pre>
<script>
fetch('graph.json').then(r=>r.json()).then(g=>{
 const lines = Object.entries(g).slice(0,200).map(([k,v]) => k + ' -> ' + v.join(', '));
 document.getElementById('out').textContent = lines.join('\\n');
});
</script>
"""


def serve(graph_path="graph.json", port=8765):
 data = Path(graph_path).read_bytes()

 class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
 if self.path in ("/", "/index.html"):
 body = HTML.encode()
 ctype = "text/html"
 elif self.path.endswith("graph.json"):
 body = data
 ctype = "application/json"
 else:
 self.send_error(404)
 return
 self.send_response(200)
 self.send_header("Content-Type", ctype)
 self.send_header("Content-Length", str(len(body)))
 self.end_headers()
 self.wfile.write(body)

 def log_message(self, *args):
 pass

 HTTPServer(("127.0.0.1", port), Handler).serve_forever()
```

Wire `nanograph.py --serve`. Open the page. Confirm a stranger on your machine could follow the README to the same screen.

## Exercise (not shown)

Add a `/blast?fn=..&hops=2` endpoint that returns plain text. Commit it. Packaging includes the boring paths.

## Done when

A stranger can install it, run it on their repo, and read your numbers in the README. Lab students: public repo URL in #ship.

## Sources

- README as interface: any tool you already installed from GitHub this year.
- `--serve` as respect: seeing beats downloading JSON into a void.
