# 09 · Context packing

*You need: blast radius working. An LLM API key optional but useful for the measurement. ~60 minutes.*

## The claim

AI assistants bill by the token. Most people pay blindly, pasting whole files and hoping. You own a call graph, which changes the economics: given a question about a function, the blast radius *is* the relevant context. Today you build `nanograph pack`: question in, token budget in, minimal slice out.

Then you measure. A benchmark with no losses is marketing. A benchmark with a named loss is engineering.

## Build it

```python
"""nanograph, episode 09: pack a slice under a token budget."""
import json
import sys
from pathlib import Path


def load_graph(path="graph.json"):
    return json.loads(Path(path).read_text())


def approx_tokens(text):
    """Honest heuristic: ~4 chars per token. Say so."""
    return max(1, len(text) // 4)


def pack(graph, sources, start, hops, budget, question):
    """Assemble prompt from blast-radius files until budget fills."""
    # reuse blast() from episode 04; map names -> file paths via your own index
    names = [start] + [n for _, n in blast(graph, start, hops)]
    chunks = []
    used = 0
    header = f"Question: {question}\nRelevant code:\n"
    used += approx_tokens(header)
    for name in names:
        body = sources.get(name, f"# missing source for {name}\n")
        block = f"\n# {name}\n{body}"
        cost = approx_tokens(block)
        if used + cost > budget:
            break
        chunks.append(block)
        used += cost
    prompt = header + "".join(chunks)
    return prompt, used, len(chunks)


# blast imported/copied from episode 04
```

Wire: `nanograph.py pack <fn> --hops 2 --budget 4000 --question "..."`.

Print the prompt, the token estimate, and how many functions fit. Do not pretend the estimator is exact; label it.

## Measure it honestly

Ask the same three real questions two ways:

1. Whole-file paste of everything you would have dumped by hand.
2. Your packed slice.

Record tokens spent and answer quality (right / partial / wrong). Your evidence table must include **at least one case where the slice lost**, plus why. If you cannot find a loss, your questions were too easy; pick harder ones.

## Exercise (not shown)

Add `--show-dropped` to list functions that did not fit the budget. Write one sentence about whether dropping them was safe. Commit the flag and the sentence.

## Done when

The table exists, one loss is named, and `pack` respects `--budget`. Lab students: table in #ship.

## Sources

- Token budgeting as engineering: same doctrine as the cohort's tokenomics training, taught from the tool side.
- Your blast radius from episode 04 is the candidate set; the budget is the trim.
