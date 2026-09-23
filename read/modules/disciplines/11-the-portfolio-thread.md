# 11 · The portfolio thread

*Your public record is an engineering artifact: the site, the design system behind it, the research you publish, and the users you can point at. About 11 minutes.*

## A trail of hard problems

Julia Evans publishes the problems she actually struggled with. Addy Osmani's point about review is the reason that trail now matters more. Writing got cheap. Understanding stayed expensive. Many candidates can produce a site, a repository, and a project list with model assistance. Before meeting you, an employer still needs evidence that you can work responsibly inside an unfamiliar system. Your public record should make that evidence easy to inspect.

A portfolio now needs to serve as a record of evidence, arranged so a stranger with about four minutes can get from “who is this” to “this person did a real thing and I can check it” without your help. A portfolio item is a link to a change plus a **receipt**, the artifact that supports the claim: a pull request, test result, log, measurement, or recording. A resume line is a sentence with nowhere to click.

## The sentence, and the clauses under it

Write a claim a stranger can check. “Contributed to a continuously operating multiplayer system” is more precise than “built a multiplayer game,” because each clause can point at a receipt.

Mapped a subsystem I had never seen, and the map was checked: a written model plus a reviewer's note. Wrote specifications other people executed without needing me: the specification, with how many questions it produced. Completed production tasks with agents, every human stop recorded: an intervention log that says what the agent did, why you stopped it, and what changed next. Wrote checks that caught a real regression: the failing-then-passing check. Resolved a concurrency defect in a live inventory system: the ticket, the pull request, and the rule that the new test protects. Moved a number: baseline, change, result. Explained a change under questioning: a defense recording that captures the questions, answers, and corrections. Reviewed a peer's change and found something: your review comments.

A stranger who clicks any clause and lands on a real pull request, a real check, or a real recording believes the next clause too. A stranger who clicks and lands on a screenshot of a tutorial stops reading. One page that does this beats five that do not. Put one project in front, with receipts a stranger can reach in under a minute.

## The design system underneath

Everything you put in public should follow the same design system: the site, project page, diagrams, pull request screenshots, and the slide behind you in a defense recording. Consistent choices show an employer that you work from a repeatable method before they read the details.

Write the system down once and apply it everywhere. Tokens: two or three colours, one accent, one type family for prose and one for code, a spacing scale. Record these choices as variables so you can apply them consistently. Type: a heading scale and a body size that read well at phone width, because that is where a recruiter will first open your link. One diagram style, so every graph you publish in a post or a pull request looks like yours. One screenshot convention: same window size, same padding, same annotation colour. The convention is dull, and it makes a pull request description read as if a professional wrote it.

The artifact is a single document you can hand to a model with “apply this” and get consistent output back. That handoff is itself a specification.

## Research in public

People get found for new kinds of work when they have already published a careful attempt at the question. Run one experiment because you wanted the answer, and publish it with the same discipline you would apply to a production change.

The shape is the shape of every honest experiment. Claim: your hypothesis, written as a sentence that could be wrong. Method: what you did, precisely enough that someone could repeat it. Result: what happened, with the numbers, including the ones that disappointed you. What it does not show: the limits of the method, said before anyone else says them. Next: what you would try next and why.

Small is fine. “Does giving an agent a call graph, a map of which functions call which, reduce human interventions on a mechanical refactor? I ran twelve tasks each way; here is the count” is a **research** post. It is interesting because it has a method and a number.

A public record that stops updating looks abandoned. Writing about a change you shipped is also an inexpensive rehearsal for a technical defense, where another engineer challenges your reasoning. If you cannot explain the change to strangers in about two hundred words, you will struggle to explain it under live questioning. Treat every post as a compression exercise: preserve the important meaning in fewer words, then include the supporting link.

## A record another person can trust

A polished project page can be generated quickly. The history behind it cannot. A real receipt contains the stubborn details of work: the first wrong model, the check that failed, the review that changed the design, and the result a user actually experienced.

That trail is valuable because it lets another person inspect your judgment without borrowing your confidence. They can follow the claim to the change, the change to the evidence, and the evidence to its limits. The portfolio stops being a gallery and becomes a record of how you think when the answer is uncertain.

Writing became cheap. Understanding did not. A useful public record makes that understanding visible.
