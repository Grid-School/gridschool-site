# 05 · Agentic workflow engineering

*Series: disciplines. Decomposing a change, choosing what runs in parallel, deciding where a human must stand, recording every intervention, and writing the delegation as a program that owns its own loop. Read before You ran the agents. ~18 minutes.*

## What replaced "development workflow"

The old workflow module taught you to branch, commit, open a pull request and merge. Those mechanics still exist and you used them on Your first ticket. Those mechanics describe version control, while today's workflow also includes work executed by agents. Cisco engineering leads in 2026 describe managing ten to twenty agents at once, and describe their own job as architecture, orchestration and asynchronous review. That is the workflow this discipline teaches, and it starts with a chain that looks nothing like a commit log.

```mermaid
flowchart TB
  O[Objective] --> D[Decomposition]
  D --> CR[Context requirements per task]
  CR --> AS[Agent and tool selection]
  AS --> PL[Parallel or serial?]
  PL --> DP[Dependencies and ordering]
  DP --> EX[Execution]
  EX --> CK[Checkpoints]
  CK -->|human judgment needed| ES[Escalation]
  CK -->|proceed| EV[Evaluation]
  ES --> EV
  EV -->|accept| DONE[Integrate]
  EV -->|reject| D
```

Every box is a decision you make and record. The record is the deliverable.

## Decomposition

A specification describes a state of the world. Decomposition turns it into tasks small enough that each one can be executed, checked and rejected independently. A task that cannot be rejected on its own is too large. A task that needs the output of every other task before it can be checked is in the wrong place in the order.

Three questions per task:

- **What context does this task need and no more?** The whole repository is never the answer. Give the slice that the task touches plus the invariants. Extra context costs twice: the tokens, and the irrelevant patterns a model finds in it to imitate.
- **What could this task break that is outside itself?** That is the blast radius you named on You can read a system, and it decides whether the task can run alongside others.
- **How will I know it is done?** If the answer is "I will look at it," write down what you will look for. If the answer is a test, name the test.

## Parallel or serial

Two tasks can run at the same time when neither needs the other's output and neither touches state the other touches. Everything else is serial, and pretending otherwise is how you get two agents editing the same file with different assumptions. The honest default for a beginner is serial, then parallelise the pairs you can prove are independent. The dishonest default is to launch everything at once and call the resulting merge conflicts "iteration."

When one agent reviews another's output, that is a serial dependency with a specific purpose: catching the class of error the first agent is blind to. It is useful when the review criteria are written down. It is theatre when they are not, because a model asked to "review this" will find something to say regardless.

## Where a human must stand

Autonomy is a setting, and the setting should match the consequence of being wrong. Before you delegate, write down where the machine must stop and wait for you:

| Boundary | Machine may | Machine must stop and ask |
|---|---|---|
| Scope | Edit files inside the task's slice | Touch anything outside it |
| Data | Read production logs | Write to production state |
| Ambiguity | Resolve a choice the spec settles | Resolve a choice the spec lists as unknown |
| Cost | Spend the agreed budget | Exceed it |
| Confidence | Proceed on a verified premise | Proceed on a premise it inferred |

These are checkpoints. An agent that passes a checkpoint without stopping is a finding, and it goes in your record.

## The intervention record

Every time you step in, you write it down. What the agent did, why you stopped it, what you changed, what you told it. That record is the only evidence that a human was in control, and it produces the metric the program tracks as **intervention rate**: useful completed outcome divided by human interventions. Early on you might intervene seventeen times on one task. Later it might be three. The number falling is only good news if the quality of the result held; a falling intervention count with rising defects means you learned to look away, which is the failure this discipline exists to prevent.

The record also answers the question employers are beginning to ask and cannot yet answer: what did the human contribute? Your intervention log is that answer, per task, with timestamps.

## Choose the smallest useful workflow

Sometimes the correct orchestration is one model call. Sometimes it is you, typing, for eleven minutes. A five-agent graph that produces a worse result than one well-contexted prompt adds cost without improving the outcome. Part of this discipline is running the same specification through one agent and through several, measuring completion, correctness, cost, elapsed time, interventions, context consumed and regressions, and comparing whether the additional agents produced more useful progress. The eight-week intensive does this once on purpose, in You ran the agents, so you have the experience before a job asks you to have the opinion.

## Cost and latency are requirements

Token spend and wall-clock time are part of the specification whether you wrote them down or not. An agentic workflow that solves the task for forty dollars when a colleague solved it for two has failed a non-functional requirement. Record both. You will be asked for them.

## Loops, graphs, factories: one problem

You will encounter several names for this work. Each name emphasizes a different implementation. Loop engineering means letting an agent run the same prompt against a task list until a judge says the work is done. Graph engineering, in the sense the industry usually means, draws the tasks and their execution order as an explicit topology, like the diagram at the top of this reading.

A software factory, in the sense a few practitioners have revived it, is a script in an ordinary language that calls an agent for one bounded phase, checks what came back with code, and decides itself whether to continue, retry or stop. Harness engineering is the name for building the runtime all of those sit inside, the tools, the sandbox, the memory and the stop conditions around a model.

All of these approaches address the same problem. A non-deterministic worker repeats tasks until an external judge accepts the result. The workflow has a budget, stores state beyond the context window, and leaves a trace another person can read. Products differ mainly in which component owns that loop. A vendor's goal mode puts the judge inside their runtime and hands you a knob for the budget. A script you wrote puts the judge in your code and gives you every knob, at the cost of writing and maintaining the script. A topology diagram makes the order legible before anything runs, which matters exactly when tasks depend on each other and not at all when they do not.

| Question | Vendor loop | Your script | Explicit graph |
|---|---|---|---|
| Who decides done | A judge model in their runtime | A predicate in your code, then a judge if no predicate exists | Whatever node you marked as the gate |
| Who enforces budget | Their cap | Your cap | Yours, per node |
| Where state lives | Their session | Files and a trace you own | The graph's edges plus files |
| What you can change | The prompt and the knobs | Everything | Everything, at the cost of drawing it first |
| What you can prove afterward | Their transcript | Your trace | Your trace, per node |

Four rules apply to every version. Use code for a step with a known command; for example, run the test suite directly as a subprocess. Check a deterministic predicate before calling a judge model because the predicate is fast, inexpensive, and consistent. Keep the verifier outside the generator so the agent cannot edit its own gate. Define stop conditions before execution because published data on unattended loops shows that continued spending often produces no further improvement.

Read at least one published factory using the same method you applied to the world's test suite in You can prove it. Look for a gate that checks only whether a file exists, a placeholder test phase, or a diff check that never reads the diff. Every published one so far has at least one of those, and the authors usually say so in the README. Their admitted gaps are a reason to write your own small factory for a ticket you already understand. The experience should let you explain which conditions another factory enforces and which conditions it only asserts.

## Do this now (45 minutes)

Take the specification from Specification engineering.

1. Decompose it into no more than six tasks. For each, one line of context needed, one line of what it could break, one line of how you would know it is done.
2. Mark which tasks may run in parallel and justify each pair.
3. Write the human boundary table for this change.
4. Execute the first task with an assistant. Keep a running note: every time you intervene, one line saying what and why.
5. At the end, count the interventions and write one sentence about whether each was the spec's fault, the agent's fault, or yours.
6. Then write the delegation down as a program, no more than a screen or two: a plan phase that calls an agent and must return a typed result, a build phase that calls an agent, a test phase that is a subprocess running the real test command, and a review phase with the rubric you wrote in step 1. Add a budget cap, a stop on the same error twice, and a line per phase appended to a trace file with tokens, cost and elapsed time. Run it once against the ticket.

**Done when** someone can use your decomposition and intervention log to reconstruct what the machine did and what you did, and your script's trace shows at least one place where a check rejected the agent's output.

## What's next

06 · Evaluation engineering: what passing tests establish, what they leave uncertain, and which evidence to add.
