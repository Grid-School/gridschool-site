# 09 · Context packing

*You need a working blast-radius command. An LLM API key is optional, but it
is useful for the measurement. Allow about 60 minutes.*

## The claim

AI assistants bill by the token. Pasting whole files can include code unrelated to the question. For a question about one function, the blast radius provides a candidate set of relevant functions. In this episode, you will build `nanograph pack`. The command accepts a question and a token budget, then produces a small context slice.

You will compare the packed slice with a whole-file prompt. The benchmark must include a case where the packed slice produces a worse answer, so the result records the method's cost as well as its benefit.

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

Connect the command as `nanograph.py pack <fn> --hops 2 --budget 4000 --question ".."`.

Print the prompt, the estimated token count, and the number of functions that fit. Label the token count as an estimate because `approx_tokens` uses the heuristic of about four characters per token.

## Measure it honestly

Choose three real questions. Ask each question in two ways:

1. Whole-file paste of everything you would have dumped by hand.
2. Your packed slice.

Record the tokens spent and classify answer quality as right, partial, or wrong. Your evidence table must include **at least one case where the slice lost**, followed by an explanation. If all three packed slices perform as well as the whole-file prompts, choose harder questions and repeat the comparison.

## Exercise (not shown)

Add `--show-dropped` to list the functions that did not fit within the budget. Write one sentence explaining whether excluding those functions was safe. Commit the flag and the sentence.

**Done when** the evidence table exists, the table names one loss, and `pack` respects `--budget`. If you are a Lab student, post the table in `#ship`.

## Sources

- Token budgeting follows the same measurement practice as the cohort's
 tokenomics training.
- The blast radius from episode 04 supplies the candidate functions. The
 budget determines which functions fit in the final slice.
