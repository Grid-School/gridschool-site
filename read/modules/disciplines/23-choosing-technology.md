# 23 · Choosing technology for the goal

*Series: disciplines. Monolith against services, build against buy against managed, reversibility, and the decision record you will defend with the assistant silent. ~12 minutes.*

## The skill whose price is rising

Expertise in one framework is losing value and the ability to look at a goal and pick a stack you can defend is gaining it, because the first can now be bought by the hour and the second is the thing the person paying for the system actually needs from you. This is architect-level work at student scale, and it is not "I like this library." It is a written argument that this goal, under these constraints, is best served by this choice, that these two alternatives were considered and lost for these reasons, and that this specific condition would make you revisit it. The kit gives that argument two filenames, `DECISION.md` and `STACK-ADR.md`, so that you can find the general form and the stack-shaped form when you need them, and the review treats them as one artifact.

## The questions, in the order they resolve each other

Start with the goal, because a live system that a stranger will use and a number you intend to move is a different target from a library other engineers will import, and most stack arguments are two people optimising for different goals without noticing. Then decide between one deployable and several: default to a monolith and split only when a team boundary, a scale limit, or a failure domain forces it, because a student project with four services and one user is a costume, and the review will say so.

Then build, buy, or managed. Build when the thing is the product. Buy when it is a commodity such as auth, email, or payments and the vendor failing is something you could survive. Take the managed version when the alternative is becoming the operator of a database you do not yet understand. Price it in monthly dollars and count the moving parts, and if you cannot say either number you have not chosen the stack, you have admired it. Ask what is reversible: data in a proprietary store or a framework that owns your models is a one-way door and needs a better reason than a container you can move next month. Finally, ask who else can run it. A clever stack that only you can stand up is a liability you are choosing on behalf of the next engineer, who may be you in six months.

## What the memo contains

Context: the goal, the constraints, the users or data or partner. Decision: the stack, named without hedging. Alternatives: at least two, each with the reason it lost. Consequences: what this makes easy, what it makes expensive, and the condition that would trigger a revisit. Cost: the monthly number and the unit you will watch. The world's own decision is a useful example to argue with, because a .NET WebSocket server on a single Lightsail box with no database is defensible for a classroom world with a handful of players and becomes indefensible at some player count you should be able to estimate, and the memo that says where that line is beats the memo that says the stack is good.

## Defended, not read

You bring the memo to the 1:1 in Defense mode, which means the assistant helped you write it and is silent while you talk. If you cannot explain the choice without reading the note, the note is not yet yours. A memo that survives the hardest question in the room is evidence. A memo that names the condition under which you would have picked the rejected option is better evidence, because it shows the choice was a judgment and not a loyalty.

## Do this now (45 minutes)

Write the stack decision for the menu project using `STACK-ADR.md` from the kit, with two rejected alternatives, a monthly cost, a reversibility note, and a revisit condition. Bring it to the 1:1 and be ready to lose an argument on camera; record the hardest question and whether the memo survived it.

## Done when

The record has two rejected alternatives, a cost, and a revisit condition, and you defended it in the 1:1 with the assistant off. `pj.model` does not open until this link exists.

## What's next

`pj.model`: the model and first specification for the system this memo just chose.
