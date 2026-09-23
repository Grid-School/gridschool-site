# 08 · Product and value engineering

*Connecting a technical change to something a person or a business actually felt, and being able to show the connection. About 11 minutes.*

## The change worked. Did it matter?

A change can be correct and still be a waste. Tests can pass, the review can be kind, and nobody may use what you shipped. Correctness answers whether the code does what you said. Value answers whether that result was worth the time, the risk, and the work you did not do instead.

Ronny Kohavi's work on web experiments has a blunt observation: teams that listen to the highest-paid person's opinion ship guesses. A controlled experiment, with a clear overall evaluation criterion chosen before the test, is how you find out whether the guess was right. Most ideas lose. That result is useful. It saves the next week.

A useful account names a number, a change, a later number, and why you think the change caused the movement. Suppose first-session player interaction sat at eleven percent. You change the spawn layout. The same measure later reads thirty-four percent, and you can say what else you checked before treating that rise as your doing. Treat those percentages as hypothetical until you have measured your own system. “I changed the spawn layout” does not contain that chain.

## Start from a number

Live systems hand you work in two forms. The first is an order: implement a numbered feature. The second is an observation: new players leave after one session. Starting from the observation forces you to name the problem, rank possible causes, and only then choose a change.

Take **GridGlade**, the shared multiplayer game used as the example here. A dashboard might show that eighteen percent of new players return seven days after joining. Treat that figure as hypothetical until you have measured your own system. Once you measure the symptom and rank possible causes before writing code, the explanations become easier to separate.

Seven hypotheses are easy to name: onboarding is confusing; movement is unpleasant; players cannot find each other; there is no visible goal; loading is slow; spawn areas are empty; there is nothing social to do. Each one has a different cost to test and a different plausible effect. Ranking them is the work.

For each **hypothesis**, estimate three things, roughly. How confident are you this is a real cause, given the evidence you already have? If it is, how big is the effect on the metric? A cause that would move retention one point may not deserve a week. What does the smallest test cost in hours and in risk to the live system? Rank by expected effect divided by cost. Do the top one. Write down whether each remaining hypothesis was postponed because time ran out or deliberately set aside. That distinction will matter when someone reviews the decision months later.

Kohavi calls the number you chose to move the overall evaluation criterion. Write it down before you ship. Changing the criterion after you see the result is how a losing idea becomes a story you told yourself.

## Instrument before you intervene

You cannot claim a change caused an improvement if you did not record the **baseline**, the value of the metric before you shipped. The number you hope to move must be visible, and it must have been visible long enough that you know what normal looks like. A single event counter and a weekly total can be enough. A causal claim still requires that recorded baseline.

The metric you were watching can change after you ship. Three things could be true: your change moved it, something else moved it, or it would have moved anyway. Distinguishing them is causal reasoning, the work of deciding whether one thing produced another. On a small live world you have a few honest tools.

Before and after with a long enough window that day-of-week patterns and one-off events wash out. Weak, and often all you have.

A holdout: some players get the change and some do not, chosen randomly. Strong when the numbers are large enough to mean anything. This is the controlled experiment Kohavi describes.

A mechanism: you can show the path from change to outcome, step by step, with an intermediate number that also moved. Players spawned nearer to each other, more first-session chat messages were sent, more players returned. Each link measured.

Say which you used, and say how sure you are. A careful sentence sounds like this: retention rose nine hypothetical points; the spawn layout changed the same week; there was no holdout; the intermediate measure of first-session interaction also rose; moderate confidence that the layout caused it. “We increased retention by fifty percent” hides the method and the doubt.

## A feature is a bet

The week you spend on the top hypothesis is a week you did not spend on the second. That gap is opportunity cost, the value of the next-best use of the same attention. An honest evaluation of any intervention includes what it displaced.

Sometimes the arithmetic says the best move is to decline the requested feature and say so with the numbers attached. That answer can feel less productive than a new screen or a merged pull request. It may save more value than either one creates.

Product engineering begins when a feature stops being an object to deliver and becomes a bet about human behaviour. The baseline tells you where the bet started. The hypothesis explains why it might work. The experiment separates the effect from the story you hoped to tell.

Code can establish that the change works. Only evidence from the world can establish that the change mattered.
