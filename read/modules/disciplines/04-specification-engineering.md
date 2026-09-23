# 04 · Specification engineering

*How to write a change so that another person or an agent can execute it without asking you anything. About 11 minutes.*

## No code without a spec

Joel Spolsky's rule at Fog Creek was short: no code without a spec. His reason was practical. Writing how the product will behave from the user's point of view finds the holes while the document is still cheap to change. A vague ticket once wasted part of one engineer's day. The engineer might guess, ask a question in chat, wait for an answer, and eventually ship something close to the intended change.

Giving the same ticket to many agents multiplies the ambiguity. Each agent can choose a plausible interpretation and execute it confidently, leaving you to identify many incorrect results. When implementation is cheap, errors in translating intent into code become a dominant failure. The specification has to be the shared source of truth for requirements, design, implementation, and validation. It is also the prompt and the acceptance check: the observable result an agent must produce.

A specification is finished when someone who cannot talk to you can execute it and does not need to.

## Two sentences

> Add trading.

> Allow two authenticated players within interaction distance to exchange mutually accepted inventory items atomically, with no duplication or loss, even if either client disconnects during confirmation.

The added length settles decisions that the first sentence left open, and each open door is a place an executor would have had to guess. Authenticated: no trading from a spoofed session. Within interaction distance: no cross-map trades. Mutually accepted: both confirm. Atomically: both sides move or neither does. No duplication or loss: the **invariant**. Even if a client disconnects: the failure case that will otherwise be discovered in production.

Spolsky called this a functional specification: how the product works from the user's view, without saying how the internals are implemented. The trading sentence is that kind of writing. It does not name a database table. It names what a player can do, what must stay true, and what happens when the network drops.

## The decisions the short sentence hid

A useful specification answers a handful of questions in ordinary sentences.

What should happen on the good path? Two players can propose, review, and confirm an exchange of items.

What must always remain true? Total item count across both inventories is unchanged by any trade. An item has exactly one owner at any instant. Those sentences are invariants. Executors, human or machine, will implement the good path you described and improvise the rest. The invariant is the only thing standing between their improvisation and a duplicated item. Write invariants as sentences a test could check, and write them before the requirement if you can, because the requirement often changes once you see what it must not break.

How well? Confirmation round trip under 300 ms at the 95th percentile. The feature works on a mobile viewport.

What observable conditions establish success? Given A and B adjacent, when both confirm, then both inventories reflect the swap after a server restart. That “given, when, then” statement is an acceptance criterion. “Trading works” gives a reviewer nothing observable to check. Writing the acceptance sentence well does half the work of proving the change behaved as intended.

What still needs investigation? Whether the current inventory write is transactional. How “adjacent” is computed today. A careful specification usually contains unknowns. An empty section often means the author stopped investigating too early. Listing what you have not confirmed is what lets an executor stop at the right moment and ask, instead of guessing past it.

What are we deliberately not solving? Currency. Trade history UI. Trading with offline players. Out of scope is useful information when somebody else must decide what to build.

## The handoff test

The next person or agent to receive the specification will run this test whether you plan for it or not. They attempt to execute the document without access to the thoughts you left out. Every time they need to ask something, that is a clarification. Two clarifications on a real specification is a strong result. Fourteen clarifications show that the specification left many decisions to the executor. Watch your own number. A falling count with a working result means the writing improved.

Before you hand a spec over, run the test on yourself. Read it as a stranger. At every sentence ask whether you could execute this without asking. If the answer is “I would assume,” write down the assumption as a requirement or as an unknown. Assumptions that stay in your head are the ones that get executed wrong.

Agents read exactly what you wrote and nothing you meant. That property makes the handoff test cheap to run. Give an assistant your spec and the invariants and ask it to list every decision it would have to make that the document does not settle. It will find your gaps faster than a colleague will, and it will not be polite about it.

## The code begins in the reader's head

A specification is often described as paperwork that happens before the real work. In practice, it is the first implementation. It assembles the behaviour in language while the design is still inexpensive to change. Missing cases appear as unanswered questions instead of production incidents.

That is why specification matters more as execution gets faster. An agent can turn ambiguity into code at great speed. A good specification slows the decision down once, where thought is cheap, so every later executor can move quickly in the same direction.

The document does not need to predict every line of code. It needs to make the intended behaviour, the invariants, the unknowns, and the boundary of the change clear enough that guessing is no longer part of implementation.
