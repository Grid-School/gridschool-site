# 05 · Agentic workflow engineering

*How to decompose a change, decide what may run together, and stand where a human must stand. About 12 minutes.*

## Tools in a loop

Simon Willison's working definition is short. An LLM agent runs tools in a loop to achieve a goal. The tools are ordinary: read a file, run a test, search the repository, edit a function. The loop is the model asking for an action, seeing the result, and deciding what to do next until a stopping condition says the goal is met or the budget is gone.

Anthropic's advice from building these systems is equally short. Start with the simplest workflow that can work. A single well-written prompt is often enough. A **prompt chain** is the next step: one call writes a plan, the next call implements it. **Routing** sends an easy case to a cheap model and a hard case to a stronger one. An **evaluator-optimizer** loop has one model produce work and another model check it until the check passes. A full agent, tools in an open-ended loop, is for work where you cannot hardcode the path in advance. Add that autonomy only when the fixed path fails.

The familiar git workflow still exists. Branch, commit, open a pull request, merge. Those mechanics describe version control. Today's workflow also includes work executed by agents. Some engineering leads now describe their job as architecture, orchestration, and asynchronous review of many concurrent agents.

## Decomposition

A specification describes a state of the world. **Decomposition** turns it into tasks small enough that each one can be executed, checked, and rejected independently. A task that cannot be rejected on its own is too large. A task that needs the output of every other task before it can be checked is in the wrong place in the order.

Three questions per task help. What context does this task need, and no more? The whole repository is never the answer; give the slice the task touches plus the invariants, the rules that must remain true. Extra context costs twice: the tokens, and the irrelevant patterns a model finds in it to imitate. What could this task break that is outside itself? That blast radius decides whether the task can run alongside others. How will you know it is done? If the answer is “I will look at it,” write down what you will look for. If the answer is a test, name the test.

Two tasks can run at the same time when neither needs the other's output and neither touches state the other touches. Everything else is serial, and pretending otherwise is how you get two agents editing the same file with different assumptions. The honest default for a beginner is serial, then parallelise the pairs you can prove are independent.

When one agent reviews another's output, that is a serial dependency with a specific purpose: catching the class of error the first agent is blind to. Written review criteria make that useful. Without them, a model asked to “review this” will find something to say regardless.

## Where a human must stand

Autonomy is a setting, and the setting should match the consequence of being wrong. Before you delegate, write down where the machine must stop and wait for you. In workflow engineering, that human stop is called an **intervention**. This is different from a product experiment's intervention, which is a small change used to test a hypothesis.

The machine may edit files inside the task's slice. It must stop before touching anything outside that slice. It may read production logs. It must stop before writing to production state. It may resolve a choice the spec already settles. It must stop when the spec lists the choice as unknown. It may spend the agreed budget. It must stop before exceeding it. It may proceed on a verified premise. It must stop before proceeding on a premise it inferred.

These are checkpoints. An agent that passes a checkpoint without stopping is a finding, and it goes in the **intervention log**, the written record of when you stopped the agent, why you stopped it, and what changed next.

Every time you step in, write it down. What the agent did, why you stopped it, what you changed, what you told it. The intervention log is the evidence that a human was in control. It also produces a useful ratio: completed useful outcomes divided by human interventions. Early on you might intervene many times on one task. Later the number may fall. A falling count is good news only if the quality of the result held. A falling intervention count with rising defects means you learned to look away.

The intervention log also answers a question employers are beginning to ask and cannot yet answer: what did the human contribute? The log gives that answer per task, with timestamps.

## Choose the smallest useful workflow

Sometimes the correct orchestration is one model call. Sometimes it is you, typing, for eleven minutes. A five-agent graph that produces a worse result than one well-contexted prompt adds cost without improving the outcome. Run the same specification through one agent and through several. Measure completion, correctness, cost, elapsed time, interventions, context consumed, and regressions. Then compare whether the additional agents produced more useful progress.

Token spend and wall-clock time are part of the specification whether you wrote them down or not. An agentic workflow that solves the task for forty dollars when a colleague solved it for two has failed a non-functional requirement. Record both.

## Who owns the loop

You will encounter several names for this work. Loop engineering means letting an agent run the same prompt against a task list until a judge says the work is done. An agent execution graph draws the tasks and their order, showing which task blocks or reviews another. This is different from a code call graph, which maps which functions call each other.

A software factory, in the sense a few practitioners have revived it, is a script in an ordinary language that calls an agent for one bounded phase, checks what came back with code, and decides itself whether to continue, retry, or stop. Harness engineering is the name for building the runtime all of those sit inside: the tools, the sandbox, the memory, and the stop conditions around a model.

All of these approaches address the same problem. A non-deterministic worker repeats tasks until an external judge accepts the result. The workflow has a budget, stores state beyond the context window, and leaves a trace another person can read. Products differ mainly in which component owns that loop.

Four rules apply to every version. Use code for a step with a known command; for example, run the test suite directly as a subprocess. Check a deterministic predicate before calling a judge model because the predicate is fast, inexpensive, and consistent. Keep the verifier outside the generator so the agent cannot edit its own gate. Define stop conditions before execution, because unattended loops often keep spending after they stop improving.

## Orchestration is restraint

The impressive part of an agentic workflow is rarely the number of agents in it. A good workflow gives each worker a bounded question, enough context to answer it, an independent check, and a clear reason to stop. Every extra loop, branch, and reviewer has to earn its cost by catching an error or shortening the path.

Decomposition makes the work understandable. Checkpoints keep uncertainty from travelling downstream. Intervention is where human judgment enters when the written rules run out. Together, those choices turn a model with tools into a process another person can inspect and trust.

The goal is therefore smaller than “full autonomy” and more useful: give the machine as much freedom as the evidence can support, and no more.
