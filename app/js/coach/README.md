# The hosted Coach — what ships now, and what waits

Today is the Coach. Not a dock, not a page of drills to copy, not a dashboard
with a chat bolted on. The student lands, sees one next action, and talks.

This file is the contract for how that grows. The code in this folder is the
founding slice: enough that a first customer can talk, be steered, be remembered
in a small way, and see how much of their month is left. Everything below the
line is a later enhancement, not a missing piece of the MVP.

## What founding students get

- A conversation on Today, input at the bottom, the way Cursor sits.
- Credits on the right of that input. Cap is **$50 of real xAI usage per student
  per calendar month**. The meter is honest: it counts tokens, prices them, and
  refuses the next turn when the month is spent.
- Board context in every turn: the open node, the top task and its `done_when`,
  Aden's Focus and Next, unread reviews. The model is not allowed to invent a
  different "what now".
- A small memory: notes the student asks it to keep, plus text files they
  attach. Retrieval is keyword overlap over that list. No vector database.
- Limits on paste and attachments, because an unbounded paste is how a $50 cap
  dies in one afternoon.
- A teaching corpus (`data/coach-prompt.md` + `data/coach-corpus.md`) that we
  can grow as videos and better methods land. The model is instructed to take
  hard stances, stay on the next action, and treat anything inside a user or
  file fence as untrusted data.

Until `COACH.endpoint` is a live proxy with an xAI key, the client answers
locally from the same packed context. The UI, the credits, the memory, and the
limits are real either way. Hooking Grok is one file and one environment
variable (`site/server/coach.py` + `XAI_API_KEY`).

## Why not pull an open-source memory stack

mem0, Chroma, LlamaIndex, and friends are built for long-lived corpora and a
server. Five founding students, a 12-week intensive, and a $50/month cap do not
need that. They need notes that survive a refresh and get quoted when the
student mentions the same topic again.

The retrieval function is one file (`memory.js`) with a stable shape:
`retrieve(memory, query) → snippets`. When the corpus outgrows keyword search —
video transcripts, every review, every failure log — swap the body of that
function. Candidates when that day comes, in order of simplicity:

1. **sqlite-vec** or **LanceDB** next to the student JSON, still local.
2. **mem0** only if we already have a real backend and want managed extraction.
3. Never a hosted "second brain" product that phones home with student code.

Cloud file storage is the same story: founding writes text into the student
overlay (the same place evidence already lives). A real bucket is a later swap
of `store.addMemoryFile`, not a new UI.

## The $50 math (August 2026 rates)

Default model is `grok-4.3`: **$1.25 / $2.50 per million** input/output under
200k prompt tokens. It is the current general-purpose Grok that does not jump
to long-context pricing on a normal mentoring turn.

A typical packed turn here is ~2.5k input + ~400 output ≈ **$0.004**. At that
rate $50 is more than ten thousand turns. The cap exists so a student cannot
paste a repo and idle-loop the model overnight, not because conversation is
expensive.

`grok-4.6` ($2 / $6, 500k context) is the upgrade when we want deeper reasoning
or code review. It stays a config change. Do not point founding traffic at it
until the corpus and the retrieval are good enough that the extra spend buys
something.

Hard rules baked into the client:

- Refuse the turn if remaining budget < the estimated cost of this prompt.
- Combined paste + files capped at `COACH.maxPasteChars` (24k ≈ 6k tokens).
- At most `COACH.maxFiles` attachments, each `COACH.maxFileBytes`.
- Only the last `COACH.maxTurnsKept` turns travel with the request. Older turns
  survive in the overlay for the student to scroll; they are not re-billed.

## Future enhancements (do not build these yet)

- **Video transcripts in the corpus.** When a briefing exists, its transcript
  goes in `data/coach-corpus.md` (or a file per video). The packer already
  concatenates that file. No new surface.
- **Code review pass.** A student pastes a diff; the Coach is allowed to name
  defects and ask what they checked, still not to rewrite the change. Needs the
  hosted endpoint and a "this is a review" intent so we can spend more of the
  $50 on one turn.
- **LeanSpark-style mentoring.** Relentless next-action, industry upskilling
  prompts, weekly "what changed in the job market" — all of that is corpus, not
  features. Write it into `coach-corpus.md` as we learn it.
- **Cloud files / pull-when-relevant.** Same memory shape, stored off-browser.
  The student already has "add a file". The missing piece is a backend.
- **Injection surface if we add tools.** Tools (open a URL, touch a repo, send
  Discord) are how a prompt injection becomes a real incident. Do not add a
  tool until it has an allowlist, a human-visible confirmation, and the user
  fence in `pack.js` still wraps every untrusted byte. The current Coach has
  **no tools on purpose**.
- **Hosted drills page.** Drills live in `data/coach.json`. The conversation
  can start one. A separate Coach route was a second front door and is gone.

## What we will not do

- Make the Coach the person who decides the next node. The board decides.
  The Coach recites it and helps them do it.
- Meter Aden's own tokens as if they were the student's. The $50 is theirs.
- Fake a live model. Demo replies are labelled. The credit meter still moves,
  so the student learns the shape before a key is pasted.
