# 22 · Engineering principles as a suspicion vocabulary

*Series: disciplines. SOLID, DRY, coupling and cohesion, clean-architecture layers, and the testing pyramid, taught as the words you use to review a diff and to ask for a change by name rather than as doctrine to recite. ~13 minutes.*

## Why the old words still earn their keep

Implementation got cheap and review did not, which changes what these principles are for. When you tell an agent to "use SOLID better in the billing module," the sentence is only useful if you know which of the five things you just asked for and can see afterward whether the result did it, and when a senior engineer says a pull request "couples the domain to the payment vendor" you need to hear a specific complaint rather than a mood. This reading is a vocabulary for suspicion. You need it to read a diff for what is missing, to request a refactor precisely enough that an agent cannot satisfy it with a rename, and to sit in a room with other engineers without translating every sentence. You do not need it as a belief system, and the review will not grade you on reciting it.

## The words, as suspicions

SOLID is five ways a design can be quietly wrong, and each is easier to hold as a question than as a rule. Single responsibility asks whether this file changes for more than one reason. Open/closed asks whether adding a new case required editing all the old ones. Liskov asks whether a subtype would surprise the code that calls its parent. Interface segregation asks whether a caller has been forced to depend on methods it never uses. Dependency inversion asks whether the high-level policy imported the low-level detail, so that your domain model now knows the name of a database driver or a payment SDK.

DRY means an idea has one home, and the failure it names is not duplicated lines but duplicated meaning that will drift apart the first time one copy is fixed and the other is not. The opposite failure is just as real: a shared helper that has been made to serve three different meanings is DRY applied as a club, and it is what you get when someone deletes duplication without asking whether the two copies meant the same thing.

Cohesion is the property that things which belong together are together, coupling is the property that this thing cannot change without that thing changing too, and a call-graph cycle is coupling you can measure with the tool you build on the graph track. Clean architecture, at the level worth carrying around, puts policy in the middle and details such as HTTP, the database, and vendor SDKs on the outside, with dependencies pointing inward, so that when an agent puts Stripe types in your domain model you have a sentence for what went wrong. Of the design patterns, three are enough to start: a factory when creation is itself a decision, a strategy when the algorithm is, and an adapter when you have to talk to a shape you do not own.

The testing pyramid you already met as the hierarchy in Evaluation engineering: many fast checks of small units, fewer checks that several units agree, fewest checks that a stranger can click through, with an inverted pyramid being slow and flaky and a pyramid with no top missing the contract entirely.

## How the vocabulary is used on a review

You do not score a pull request "SOLID: 7 out of 10." You name the principle you believe was violated, you ask for the refactor by that name, and then you verify that what came back did what the name means, which is the step that separates vocabulary from costume. If you asked for dependency inversion and the result added a second import of the SDK one layer down, the word was used and the thing was not done.

The senior version of this is reading for absence. "This PR does not test the retry path. This PR copies the price rule into a second file. This PR adds an interface and then imports the concrete class anyway." Those sentences are the vocabulary above applied to what is not on the screen, and they are the ones `cap.review` will accept as evidence that you read the diff rather than skimmed it.

## Do this now (40 minutes)

Take one agent pull request you already have, your own from the first ticket or the delegation script. Write the principle you believe it violates, the request you would make by that name, then make the request and verify the result matches the name, with the before and the after visible. If you conclude nothing was violated, write which principles you looked for and why the diff is clean on each, because "looks fine" is a feeling and not an artifact.

## Done when

The review note names a principle, a request, and a before and after you can show, or names the principles you checked and found satisfied. This note is the one `cap.review` is allowed to draw its vocabulary from.

## What's next

23 · Choosing technology for the goal: the decision record you defend in the 1:1.
