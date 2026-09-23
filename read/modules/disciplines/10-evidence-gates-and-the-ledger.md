# 10 · Evidence, gates and the evidence record

*How to write a claim another person can check, and how to tell strong evidence from a story you told yourself. About 11 minutes.*

## Show me the artifact

Hamel Husain's demand for model work is “show me the prompt.” The same demand applies to any claim you will reuse. “I can specify a change” and “this check would have caught the bug” sound finished. They are not finished until someone can open the specification, the check, or the review and see what would have counted as failure.

Karl Popper's name for this habit is falsification. You cannot prove that every swan is white. One black swan ends the claim. Quality work is a structured attempt to find that swan. A claim with no failing condition is a hope.

Take one sentence you might write about yourself: “I can specify a change well enough that another person can execute it.” What behaviour would demonstrate it? A stranger takes the specification and ships the change without asking you fourteen questions. What artifact records that behaviour? The specification, the question count, and the resulting pull request. What would convince a reader you do not have it? The executor guessing past an unknown you never named. What counts as enough? Two clarifications on a real change, with a working result. Where would you have to show it again, in a place you did not choose? On a system you did not design, with a reviewer who owed you nothing.

Together, the claim, the behaviour that would demonstrate it, the artifact, the way to falsify it, the threshold, and the transfer test form a **gate**: a check that can fail. You do not need this structure on every scrap of work. You need it when someone else will rely on the claim to hire, build, or release. A claim shown only in the room where you already knew the answers is still thin.

## A claim gains weight

Suppose an engineer says, “I can change an unfamiliar system safely.” The sentence tells you what they believe about themselves. It gives you no reason to believe it too.

They show you a repository. Now you know that some work exists, although you still do not know who made the important decisions or whether the result works. The repository becomes more useful when it contains the trail: the bug as first observed, the engineer's initial model, a test that failed, the change, and the same test passing. You can inspect how the conclusion was reached instead of judging the finished code alone.

Then the engineer receives a problem they did not choose in a system they did not design. Their usual shortcuts may no longer fit. If they can form a new model, expose the defect, and repair it under those conditions, the original claim carries more weight.

Another engineer reviews the change and challenges its assumptions. Production supplies a harder review: real requests, unexpected sequences, and users who behave differently from test data. If the change survives both, you have evidence about what happened outside the author's control.

One success can still be luck or familiarity with a particular stack. The claim becomes most convincing when the same reasoning transfers to a different system with different constraints. The repeated result suggests that the capability belongs to the engineer rather than to the original project.

**GridGlade**, the shared multiplayer game used as the example here, can provide one such unfamiliar setting. A content delivery network serves its browser client, a rented virtual machine runs its game server, and it has no database. A safe change has to respect machines and decisions the engineer did not choose.

An **evidence record**, sometimes called an evidence ledger, preserves this story. It connects the claim to the artifacts, the challenges that could have defeated it, and the result under each condition. The strength comes from how many plausible explanations the evidence rules out.

## What the evidence record should reveal

A useful evidence record answers four questions. Each question exposes a different place where a polished final result can hide weak judgment.

**Clarifications.** How often did another person's work stop because your specification left an important decision unresolved?

**Calibration.** When you recorded high confidence in a claim, how often did later evidence show that the claim was correct?

**Interventions.** When you delegated work, where did you have to step in, and what would have happened if you had not?

**Falsification.** Which counterexamples, invariant violations, load failures, adversarial findings, or unintended effects did you actively look for?

These answers do not require a special dashboard. They require the claim, the confidence, the challenge, and the result to remain together so a reader can follow what actually happened.

## Evidence is a claim that survived

An artifact can show that work exists. Evidence shows why a particular conclusion deserves belief. The difference is the possibility of failure. A test that could never fail, a review with no opposing view, and a metric chosen after the result all decorate the claim without challenging it.

A gate makes the challenge explicit before the answer is known. An evidence record preserves what happened afterward, including the counterexample, the uncertainty, and the cases where the claim did not transfer.

That record cannot make a false idea true. It can make the boundary between what you know and what you hope visible. Trust begins at that boundary.
