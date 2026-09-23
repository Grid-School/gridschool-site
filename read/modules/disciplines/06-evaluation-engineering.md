# 06 · Evaluation engineering

*What passing tests establish, what they leave uncertain, and how hard you should try to prove yourself wrong. About 12 minutes.*

## Start with the failures you can see

Hamel Husain's rule for products that use language models is to start with error analysis before infrastructure. Open the traces. Read twenty to fifty real outputs. Write down how they fail. The checks you need come from those failures. Older quality work called the same habit a test suite. The current name for the same discipline, on code and on prompts, is evaluation. An **eval** is a repeatable check with a defined failing result.

“The tests passed” reports the result for cases included in the suite. A broader correctness claim also covers cases the suite's author did not anticipate. Evaluation engineering is the discipline of closing that gap on purpose: whether your checks would have caught a wrong answer.

Before running a check, state which result would make you stop and revert. Without that condition, observing the output does not verify the change. The honest question is simple: how hard did you try to **prove yourself wrong**? The useful evidence is the defects you found. Running commands alone does not answer the question.

## One marketplace, the checks it actually needed

Suppose someone adds trading to a multiplayer world. The first draft compiles. The unit test shows that buying decreases the buyer's gold by the price. That check would catch a sign error. It would not catch a write that never reached storage, so you add an integration check: a completed purchase still exists after a server restart.

Those two checks still miss the bug you cannot see in any single transaction. An invariant helps: total item count across all inventories never increases except by minting. If two buyers can both receive the same sword, the count rises and the invariant fails.

Then you construct a sequence nobody wrote a test for. Two hundred bots trade for ten minutes. Ordering and drift appear. You disconnect the buyer between confirm and commit. You send a forged client message. Those adversarial cases catch half-applied state and a trust boundary the happy path never touched. A thousand simultaneous listings catch the query that was fine at ten.

After release, purchases per hour, failure rate, and latency percentiles show a failure that occurred without a test noticing. Then you look at what people did. Do players actually trade? With whom? How often? A working feature nobody uses is a different kind of miss. Did trading change retention, or create exploitation that drove people away? Success that was actually harm is still a miss.

Each change needs only the evidence layers that match its risks. Choose those layers and explain why the remaining layers would cost more than they would establish for this change.

Useful findings include a counterexample to your own acceptance criteria, the observable conditions that define success; an invariant violation under a sequence you constructed; a failure under load; a behaviour an adversary could exploit; state left inconsistent after an interruption; a user who could not use the feature you built; or a business effect you did not intend. Finding and fixing a duplication bug before release is stronger evidence than a green suite, because you constructed a check that exposed a real defect.

## Green tests, hidden defects

Imagine several systems that all pass their tests. Some are correct. Some contain a race condition, a security hole, a quiet requirement violation, a performance cliff, a state corruption, an accessibility failure, or a metric that lies. The useful work is to name the defects you find and to answer this question: what evidence would justify trusting this system? Write that as a list of checks, then run them. A repeatable check provides stronger evidence than discovering a defect by chance.

An agent can present an incorrect output in fluent and confident language. Treat the output as evidence that still requires evaluation. Before reading the diff, write down what you would expect to see and what would worry you. Then read. Where the diff surprised you, either your model is wrong or the agent is wrong, and you owe both a test. A subtle defect can survive even when the existing tests are green. Noticing that gap is the skill.

## An eval set is a test suite for a prompt

Everything above applies to code. Prompts behave differently because a wording change produces no compiler error. Change a word in a system prompt and nothing compiles differently, no test goes red, and the only way to know whether the change helped is to run the prompt against cases you already know the answer to and count. That collection of cases is an **eval set**. A basic eval set needs five to ten inputs with the outcome you expect from each, written down before you touch the prompt, so that the prompt cannot be edited to fit the cases after the fact.

If you ask a model to judge whether a build matched a plan, you need an eval set to measure how often that judgment is correct. Take five diffs you know are correct and five that contain defects. Include subtle and obvious failures, then run the reviewer over all ten. Change one part of the rubric and run the cases again. Keep a table of every result before and after the change.

Add one line of error analysis for each incorrect judgment. A reviewer that misses off-by-one errors has a different weakness from one that misses absent tests, and each weakness requires a different correction. Judge outputs before learning which prompt produced them so your preference cannot influence the score. Keep every failing case in the eval set. A perfect score means you need harder cases before drawing a conclusion about the prompt.

Husain favours binary pass or fail over a one-to-five rating, because a binary call forces you to say what “good enough” means. If a model judge follows a written scoring rubric, change one rule at a time and rerun the same cases. Track how often the model judge agrees with a person. A judge you have not checked against a person is another unverified claim.

## Tests are weak oracles

A suite that is green is a claim about the cases someone thought of. The honest way to find out what it cannot catch is to inject a known-bad edit and watch which layer notices.

Delete a function that still has callers, or delete it and then delete the failing test. Run the project's own layers: build, tests, lint, static analysis, and any reviewer you use. If a code-graph check is available, use it to verify claims about callers and imports against the repository. Record which layer caught the defect and which let it through. Put the code back. Write one line of error analysis for each escape.

If the AI reviewer missed it and the test you deleted was the sole cover of the changed symbol, that is the finding. If every layer caught it, say so. Either result is evidence. A green suite alone does not establish the same claim.

The same skill works without deleting code. Given an agent pull request, list three cases it does not test.

Tests run once. Telemetry runs while people are using the system. Evaluation continues after release through telemetry. A change needs a way to show whether it is working in production. That can be as small as a counter and a log line. Before claiming success, name the production measure that could disprove the claim tomorrow.

## Confidence has to be earned again

Evaluation does not turn uncertain software into certain software. It turns a vague feeling of confidence into a visible argument: these are the failures we looked for, these are the checks that would catch them, and these are the risks that remain.

That argument changes as the system meets reality. A production failure becomes a new case. A mistaken model judgment becomes a new eval. A user who cannot complete the task reveals a quality definition the original suite missed. The evaluation grows from contact with the world instead of from a generic list of metrics.

Passing describes the evidence available at one moment. Good evaluation engineering keeps asking what the current checks are unable to see, then makes the next important failure harder to hide.
