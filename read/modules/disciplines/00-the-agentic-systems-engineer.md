# 00 · The Agentic Systems Engineer

*How the job moved when a first draft of the code became cheap. About 10 minutes.*

## The last thirty percent

Give a capable coding model a clear request and it will produce a working implementation in seconds. The first draft often looks finished. Then you find the case that receives null, the race that only appears under load, the permission check the generated code skipped, and the seam where this module meets the rest of the system. Addy Osmani calls that gap the seventy percent problem: the model gets you most of the way quickly, and the remaining work is where engineering judgment still earns its keep.

A vague instruction that used to waste one afternoon can now be executed wrong many times before lunch. Responsibility still requires a person. Somebody has to know what the system is for, decide what should change, describe that change precisely enough for a machine or a person to execute it, verify the result, and answer for failures. Those acts grew more valuable as implementation got cheaper.

Hiring language already points this way. Postings for forward-deployed and platform roles ask for agent orchestration, context and retrieval, evaluation pipelines, observability, messy problem solving, production delivery, and measured outcomes. Some teams treat the specification as the shared source of truth once many executors can write the code. The common theme is decisions, coordination, verification, and results.

## The name for the outer loop

Osmani puts the remaining job on an outer loop. The model can investigate a bug, write a diagnosis, implement a fix, and run the tests. A person still decides whether that was the right problem, whether the diagnosis is sound, whether the change should ship, and who carries the consequences. The boundary between the two loops is evidence: the diff, the tests, the logs, and a short explanation that connects them.

An **Agentic Systems Engineer** can understand a complex system, define the outcomes and constraints that matter, organize machine and human work around those outcomes, and establish evidence that the result deserves trust. A first role may use a different title. The capabilities transfer.

Four skills organize that outer loop. Older programs called the first one program comprehension. Here it is **Comprehension**: understanding code you did not write well enough to explain it and to predict what it will do next. **Vision** means choosing work that serves the goal and declining work that does not. **Communication** means giving accurate information another person can use. **Verification** means using a repeatable check to establish whether a claim is true.

Those four skills appear across eight kinds of work. System comprehension asks what actually exists. Context and graph engineering asks what a person or a model must have in front of it. Specification engineering asks what should become true. Agentic workflow engineering asks how intelligence should execute the work. Evaluation engineering asks how you know it worked. Reliability and systems reasoning asks what can go wrong. Product and value engineering asks whether the change was worth building. Technical communication and defense asks whether others can trust the reasoning.

Problem framing connects comprehension to specification. It is the habit of walking from an observation to a cause before anyone writes code, and it exercises Vision across all eight kinds of work.

## Why a live system is a better teacher

A coding exercise tests whether you can produce a known answer under a clock. That work became cheap. A live multiplayer system tests whether you can enter code you did not write, form an honest model of it, choose a useful change, describe it for another executor, direct the tools, prove the result, and explain your reasoning to a stranger.

**GridGlade** is the shared multiplayer game used as the running example here. CloudFront, a content delivery network, serves its Unity WebGL client. Lightsail, a small virtual-server service, runs its WebSocket server. The game has no database. GridGlade has real state, regressions, consequential dependencies, undocumented bugs, and visible effects when someone misunderstands the system. Working inside it exposes the gaps a tidy exercise can hide: a system you do not yet understand, an assistant error, a weak specification, or a technically correct change that users do not value.

## The part that remains yours

Code generation changed where the difficult work sits. Producing a first draft is becoming ordinary. Deciding what deserves to exist, understanding the system it will enter, and accepting the consequences of releasing it remain human responsibilities.

CCVV is a compact way to hold that responsibility. Comprehension keeps you tied to the system that exists. Vision keeps the work tied to a worthwhile result. Communication lets another mind act on what you know. Verification keeps a plausible answer from passing as a true one.

An Agentic Systems Engineer is therefore defined less by how many agents they can run than by the quality of the judgment around those agents. The machine may own more of the inner loop over time. The outer loop still needs someone who understands the goal, guards the boundaries, checks the evidence, and can answer for the result.
