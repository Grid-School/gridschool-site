# The hosted Coach, what ships now, and what waits

Today is the Coach. Not a dock, not a page of drills to copy, not a dashboard
with a chat bolted on. The student lands, sees one next action, and talks.

This file is the contract for how that grows. The code in this folder is the
founding slice: enough that a first customer can talk, be steered, be remembered
in a small way, and see how much of their month is left. Everything below the
line is a later enhancement, not a missing piece of the MVP.


## What students get

- A conversation on the Coach door, input at the bottom, the way Cursor sits.
- The model is Claude (`COACH_MODEL`, default Sonnet), behind the notebook
 server's own route, `POST /students/<slug>/coach` (`site/server/coach_api.py`).
 The browser never holds a key; the student's own sign-in token is the auth.
- A monthly allowance per student, by plan, in real dollars of model use
 (`coach_api.MONTHLY_USD`: free 1, Complete 10, Residency 25). It is counted
 server-side in `ai_usage` (kind `coach`), so it holds across devices and
 deploys, and the server answers 429 when the month is spent. The meter beside
 the input shows what the server last reported.
- Context in every turn, built on the server: the coach prompt and teaching
 corpus (`data/coach-prompt.md` + `data/coach-corpus.md`, a cached prefix),
 the student's seeds (`seeds.py`: target, level, skills, interests, confirmed
 proof) and their published map with finished steps marked. The page adds the
 board lines only it can work out: the open node, the top task, the coach's
 Focus and Next, and retrieved memory. The model is not allowed to invent a
 different "what now".
- A small memory: notes the student asks it to keep, plus text files they
 attach. Retrieval is keyword overlap over that list. No vector database.
- Limits on paste and attachments (client and server), because an unbounded
 paste is how a monthly allowance dies in one afternoon.
- The student's message and files travel inside USER and FILE fences the prompt
 calls untrusted data. The coach has no tools.

The demo board, and any device without a sign-in token, gets practice replies
composed locally from the same pack, labelled as practice. With
`ANTHROPIC_API_KEY` unset on the server the route answers 503 and says so.
"Need help with this step?" on each step still sends the question to the
student's coach with a link to the step; it does not go through the model.

## Why not pull an open-source memory stack

mem0, Chroma, LlamaIndex, and friends are built for long-lived corpora and a
server. A small cohort and a monthly allowance do not need that. They need
notes that survive a refresh and get quoted when the student mentions the same
topic again.

The retrieval function is one file (`memory.js`) with a stable shape:
`retrieve(memory, query) → snippets`. When the corpus outgrows keyword search
(video transcripts, every review, every failure log), swap the body of that
function. Candidates when that day comes, in order of simplicity:

1. **sqlite-vec** or **LanceDB** next to the student JSON, still local.
2. **mem0** only if we already have a real backend and want managed extraction.
3. Never a hosted "second brain" product that phones home with student code.

## The math

A typical turn is about 3k tokens of cached prompt, 2k of context and history,
and 300 out: roughly two cents on Sonnet. Complete's allowance is a few hundred
turns a month. The cap exists so a student cannot paste a repo and idle-loop
the model overnight, not because conversation is expensive.

Hard rules:

- The server refuses the turn once the month's allowance is spent.
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
 prompts, weekly "what changed in the job market", all of that is corpus, not
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
- Meter the coach's own tokens as if they were the student's. The allowance is theirs.
- Fake a live model. Demo replies are labelled. The credit meter still moves,
 so the student learns the shape before a key is pasted.
