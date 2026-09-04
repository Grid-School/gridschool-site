# 06 · Evaluation engineering

*Series: disciplines. Why "tests passed" is not "correct," the hierarchy of evidence you build instead, and how hard you are expected to try to prove yourself wrong. Read before You can prove it. ~13 minutes.*

## The sentence that gets people fired

"The tests passed." It is true, it is easy to say, and it is the sentence most often spoken in the hour before a production incident. Tests are a claim about the cases someone thought of. Correctness is a claim about all of them. Evaluation engineering is the discipline of closing that gap on purpose, and the skill it builds is the one the review sheet scores as Verification: not whether you checked, but whether your checks would have caught a wrong answer.

The rule that governs this discipline is short. **A check that cannot fail is not a check.** If you cannot say what result would have made you stop and revert, you have not verified anything; you have watched.

## The hierarchy

Evidence about a change comes in layers, and each layer catches what the one before it cannot.

```mermaid
flowchart TB
  U[Unit tests<br/>a function does what its author meant] --> I[Integration tests<br/>the parts agree with each other]
  I --> P[Property and invariant tests<br/>a rule holds for inputs nobody wrote down]
  P --> S[Simulation<br/>the system under realistic sequences]
  S --> A[Adversarial tests<br/>someone trying to break it]
  A --> T[Operational telemetry<br/>what actually happened in production]
  T --> UB[User behaviour<br/>what people did with it]
  UB --> B[Business outcome<br/>whether it mattered]
```

Take a marketplace added to the world:

| Layer | The check | What it would catch |
|---|---|---|
| Unit | Buying decreases the buyer's gold by the price | Arithmetic and sign errors |
| Integration | A completed purchase persists across a server restart | A write that never reached storage |
| Invariant | Total item count across all inventories never increases except by minting | Duplication, the bug you cannot see in any single transaction |
| Simulation | Two hundred bots trading for ten minutes | Ordering and drift that only appear under sequence |
| Adversarial | Disconnect the buyer between confirm and commit; send a forged client message | Half-applied state; trust boundary violations |
| Load | A thousand simultaneous listings | The query that was fine at ten |
| Telemetry | Purchases per hour, failure rate, latency percentiles, after release | The thing that broke and nobody noticed |
| User behaviour | Do players actually trade? With whom? How often? | A working feature nobody wants |
| Business | Did trading change retention, or create exploitation that drove people away? | Success that was actually harm |

Nobody builds all nine layers for every change. The skill is knowing which layer a given change needs and building that one, and being able to say why the others were not worth their cost this time.

## Falsification strength

Founding tracks a metric it calls falsification strength, and it is the answer to a single question: **how hard did you try to prove your own work wrong?** Points come from what you found, not from what you ran.

- A counterexample to your own acceptance criteria
- An invariant violation under a sequence you constructed
- A failure under load
- A behaviour an adversary could exploit
- State left inconsistent after an interruption
- A user who could not do the thing you built
- A business effect you did not intend

An engineer who ran the suite and shipped scores low here even when the suite was green. An engineer who found and fixed a duplication bug in their own marketplace before anyone else saw it scores high, and it is the second engineer the review is looking for.

## The Gate 5 exercise

At some point you will be handed several systems and told: all of these pass their tests. Some are correct. Some contain a race condition, a security hole, a quiet requirement violation, a performance cliff, a state corruption, an accessibility failure, or a metric that lies. Finding the defects is the small part. The deliverable is the answer to a harder question: **what evidence would justify trusting this system?** Write that as a list of checks, then run them. A defect you found by luck teaches you less than a check that would have found it every time.

## Evaluating machine output specifically

An agent's output arrives with the confidence of a senior engineer and the track record of a stranger. Treat it as evidence to be evaluated, never as a result to be accepted. Concretely: before reading the diff, write down what you would expect to see and what would worry you. Then read. Where the diff surprised you, that is either your model wrong or the agent wrong, and you owe both a test. The program will sometimes hand you agent output that is subtly wrong on purpose, with green tests. You are being trained to notice, and the noticing is graded.

## Observability is evaluation that runs forever

Tests run once. Telemetry runs while people are using the thing, which is where the layers above simulation live. A change that ships without a way to see whether it is working has not finished being evaluated; it has stopped being evaluated. For the founding weeks this can be as small as a counter and a log line. The habit is what matters: before you claim success, ask what number you would look at tomorrow to know you were wrong.

## Do this now (25 minutes)

Take the task you executed in Agentic workflow engineering, or any change you shipped this month.

1. Write, before looking at any test output, one sentence per layer: what check at that layer would apply, or why it does not.
2. Pick the highest layer that is cheap enough to build now. Build it.
3. Try to make it fail. Construct an input, a sequence, or an interruption. Spend at least ten minutes on this.
4. Write down what you found, including "nothing, and here is what I tried."

## Done when

You can name the result that would have made you revert, and you looked for it.

## What's next

07 · Reliability and systems reasoning: the fundamentals you learn at the moment a failure makes them necessary.
