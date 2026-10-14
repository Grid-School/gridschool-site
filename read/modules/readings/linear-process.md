# The standard linear agentic development process

*Five phases, in order, for building a system with a coding agent. The default before anything clever. About 9 minutes.*

A coding agent makes building fast. It does not make deciding fast. Most agent-built projects that fail were not slow to build; they were built quickly in the wrong direction, then patched until the deadline. The standard linear process puts the deciding first and keeps each phase honest about what it has proven.

The five phases are **research, plan, build, test, ship**. Each one ends in something you can show. You can go back a phase whenever you learn something; you never skip forward.

## 1. Research: learn what is true before you choose

Find out what the job really requires and what the world already knows about it. Read the brief twice. Write down every rule in it as a checklist, including the small ones, because take-home briefs and client briefs both hide pass/fail rules in plain sight. Then research the parts you would otherwise guess: the libraries and their current versions, the providers and what they cost, how fast each step can run, what limits a free account has, and how other people built the same kind of system, including how theirs failed.

Put numbers on your constraints. How many hours do you have? How much money? How fast must it respond? A constraint you have not written down will still be enforced, by the reviewer or the bill.

Do not skimp here, and do not hide here either. Research is time-boxed, usually a fifth of the total. It ends when you can answer the plan's questions, not when you run out of things to read.

**You have it when** a research note lists the rules, the constraints with numbers, the options you compared, and the sources.

## 2. Plan: bring everything into one context and think

Put the brief, the rules checklist, and the research note in one place the agent reads every session: a `CLAUDE.md` or `AGENTS.md` at the root of the repository. Then plan with the agent in its planning mode, at its highest reasoning setting, and refuse to approve the plan until it answers these:

- What could go wrong, and how will we notice?
- What makes the result good in the reviewer's eyes, not ours?
- How fast and how cheap must it be, and where is the budget spent?
- How have others succeeded with this kind of system, and how did they fail?
- In what order do we build, and how do we prove each piece before the next?
- What will we test on our own, before we touch anything that counts?

A good plan names the pieces, their order, the check that proves each one, and what is deliberately left out.

**You have it when** you can explain the plan without the agent and point at the line that answers each question above.

## 3. Build: one proven piece at a time

Build the thinnest path that works end to end first, then thicken it. Most systems have a natural order: the pieces each depend on the one before. Build one, prove it with the check from the plan, commit it, then start the next. Work in parallel only on pieces you can show are independent, meaning neither needs the other's output and neither touches what the other touches. When in doubt, stay serial.

Asking the agent to build everything at once feels faster and is usually slower. When the whole thing fails, you cannot tell which piece failed, and the reviewer cannot tell what you did. One commit per working piece is also your evidence that you iterated.

**You have it when** each piece has a commit, and you can run the check that proved it.

## 4. Test: piece by piece, with a human listening

Test each part of the system on its own, then the whole. Test somewhere safe before anywhere that counts: your own machine, then your own phone or account, then a fake of the real thing you build yourself, and only then the real target. Anything a reviewer can see, such as their logs, their inbox, or their phone line, counts.

Look at every output yourself. When the system does something you did not expect, do not just tell the agent to fix it. Ask why. Trace it from input to output, find the step where your prediction broke, and then fix that step. Write the change in an iteration log: what you saw, why it happened, what you changed, what happened next. Then go back to build, and test again.

Your user decides when it is done, not you. With a client or a team, that means asking questions until they are satisfied. When you cannot talk to them, as in most take-home challenges, the brief is the user: turn its evaluation criteria into a written checklist, ask someone you trust to review the result the way the real reviewer would, and stop when every line passes.

**You have it when** every line of the checklist passes and the iteration log shows how you got there.

## 5. Ship: make the work readable

Engineering that nobody can follow does not get credit. Write the README so a stranger can run it with one command after setup. Write the decisions down: what you chose, what you compared it against, and why, with the numbers you measured. Record a short walkthrough on camera if one is asked for, or if it helps. Then walk the rules checklist one last time, line by line, before you submit.

**You have it when** a stranger could run it, follow your reasoning, and find every required item without asking you.

## When linear is the right choice

Linear is the default because it is easy to inspect: one piece at a time, each one proven. Later you will meet processes that run pieces as a graph, fan work out to parallel agents, or loop an agent against a judge until the work passes. Each of those is this process with one rule relaxed, and each is only safe once you can run this one cleanly.

**Done when** you can name the five phases, say what each one ends in, and show one project where you followed them.
