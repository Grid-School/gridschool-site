# 10 · Ship it

*You need a tool that parses, queries, and packs context. Allow about 60
minutes.*

## The claim

In this episode, you will package the tool so another person can use it. You will write a README with measurements from a real repository, provide installation instructions a stranger can follow, and add a small `--serve` view that displays the graph without requiring the reader to inspect JSON.

## What the README must carry

Include these measurements and instructions:

- Repo analyzed (name + approximate line count).
- Functions and edges counted.
- One blast-radius example with `--hops`.
- One rank or coupling finding in a sentence.
- How to install and run the three most useful commands.

Ask a stranger to follow the README. Revise the instructions until they can reproduce one of the measurements within five minutes.

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

Connect the server to `nanograph.py --serve`, then run the command and open the page. Follow the README from the beginning on your machine and confirm that it leads to the same screen.

## Exercise (not shown)

Add a `/blast?fn=..&hops=2` endpoint that returns plain text, then commit it. The endpoint is part of the packaged interface.

**Done when** a stranger can install the tool, run it on their repository, and reproduce the numbers in the README. If you are a Lab student, post the public repository URL in `#ship`.

## Sources

- For an example of a README as an interface, review a tool you installed
 from GitHub this year.
- `--serve` gives the reader a visible graph without requiring them to
 download and inspect the JSON file.
