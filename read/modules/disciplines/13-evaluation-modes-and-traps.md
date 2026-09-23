# 13 · Evaluation modes and traps

*When the assistant is open, limited, removed, or silent, your use of it still has to be visible, and some of what you are handed may be wrong on purpose. About 10 minutes.*

## The measure you grade on is the behaviour you get

Kent Beck's reminder about productivity metrics is Goodhart's law: once a number has consequences, people start producing the number. Banning the assistant during an evaluation produces people who can work without a tool they will have on the job. That is a different question from whether they can direct the tool, notice when it is wrong, and still own the result.

Most engineering workplaces allow access to AI models. Employers therefore need to know whether they can trust the work you produce with those models. Addy Osmani's line on review is the same trap in another costume. “The tests passed” is **observable**. It is still a thin claim. A person understanding the change, and being able to say so under a challenge, is the **verification** that matters.

A fair evaluation names the condition under which you are working.

## Five situations, one constraint

Open tools: every model, agent, search, and tool you can reach. This is how you actually work.

Budgeted tools: a fixed budget, a dollar figure of inference, or one model only. This tests whether more machine was more progress.

Favourite tool removed: the interface you rely on is gone. This tests whether you understood the work or only the product.

Oral defense, tools silent: AI allowed beforehand; silent during questioning. A technical defense is a live review in which an engineer changes one fact and asks what follows. This condition tests whether the knowledge reached your head. You may use an assistant beforehand to write a specification, a check, or a pull request description. During questioning, you answer from your own understanding.

Incident with a clock: a production problem, a time limit, AI allowed. This tests whether you can prioritise under pressure.

One constraint holds in every situation. Your use of AI has to be observable. Operating the machine is part of what a reviewer is evaluating, so the reviewer needs an **instrumented record** of your actions: the goal, context, instructions, agent actions, human interventions, checks, and final decision. This record lets someone reconstruct the question employers are starting to ask and cannot yet answer: what did the human contribute?

Keep enough of the instrumented record for a reader to trace your question or goal, the context you retrieved, the specification you wrote, the instructions you gave the agent, what the agent did, the tool calls and results, where you intervened, the checks you ran, and why you accepted or rejected the result. A record with those parts filled in is instrumented behaviour. A green pull request with no record is an artifact, and it stays an artifact no matter how good the code is.

## Some of what you are handed is wrong on purpose

A serious evaluation of machine-assisted work will, at selected points, hand you output that contains deliberate defects. The point is to see how you evaluate that output. Expect situations like these.

An assistant given context that is stale or misleading, so its confident explanation is wrong. A change where the obvious implementation is the wrong one. A test suite that is green while a requirement is broken. A task where the cheapest model is entirely sufficient and a frontier model adds nothing but cost. A problem where a complicated multi-agent arrangement loses to one well-contexted call. A request where the correct answer, argued with evidence, is “do not build this.”

The planted cases are usually not labelled in advance. Apply these two rules to every piece of machine output. Treat AI output as evidence that requires verification. Additional complexity must justify its cost.

Run checks before trusting output. Choose the least expensive tool that can do the work. Use evidence to recommend against building a request when the arithmetic says so.

## Three habits

Write what you expect before you read what the machine produced. A prediction made first cannot be contaminated by a fluent answer.

Write the check before you trust the green. A passing suite is a claim about the cases someone thought of. Ask which cases nobody did.

Record every intervention, including the ones that embarrass you. The log where you stopped an agent seventeen times is more valuable than the one where you claim you stopped it twice, because the first one is believable.

## Judge the work people will actually do

An evaluation teaches people what the evaluator values. Reward raw output and they will produce output. Ban the common tool and they will rehearse an unusual condition. Reward a green test result and they may stop asking what the tests missed.

AI-assisted work makes the old shortcut especially dangerous because the visible artifact can be polished while the understanding behind it is thin. A fair evaluation therefore keeps the tools visible, varies the constraints, and tests whether the person can still explain, challenge, and own the result.

The central question is not whether a person used a model. It is whether the combined process produced trustworthy work, and whether the person knew enough to tell.
