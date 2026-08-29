# 00 · Your repo is a graph

*Series: nanograph, a code-graph engine built from scratch. No installs this
episode. ~20 minutes.*

## The claim

Open any repo you did not write and try to answer one question: *if I change this function, what breaks?* Watch what you actually do. You find the function, search for its name, open the files that mention it, and in each of those you search again for whatever calls *those*, which means you are already walking edges between nodes. You are traversing a graph, slowly, by hand, with your attention as the only pointer.

Every codebase is a graph whether anyone drew it or not. Functions are nodes. "A calls B" is an edge. Files and folders group nodes into neighborhoods. Comprehension, the thing interviews actually test and the thing seniors are paid for, is the ability to traverse that graph fast and honestly. Most people do it with vibes. You are going to build the machine.

## Why a machine, when the AI can "just read the repo"

Paste a whole repo into an AI assistant and two things happen at once: you pay for every token of noise, and the model's attention smears across code that does not matter. Ask it about `refund()` while feeding it the login system and you have paid extra for a worse answer. The fix is not a bigger context window. It is knowing *which slice matters*, and a call graph computes that slice. By the end of this series your tool will assemble the minimal context for a question, and you will measure, in tokens and in answer quality, what that is worth. That is tokenomics as an engineering discipline instead of a vibe.

## Do this now (paper, 15 minutes)

Pick any repo, one from work or any mid-size open-source project, and pick one function that looks important. On paper:

1. Write its name in the middle of the page.
2. Find everything that calls it. Draw arrows in. (Search for the name; every hit that *invokes* it, not the definition, is an arrow.)
3. For the two most interesting callers, repeat. Two hops is plenty.
4. Now answer: if this function's behavior changed subtly, who is affected? Circle the blast radius.

Notice three things while you do it: how often search lies to you (same name, different thing, and that problem gets a whole episode), how fast the page fills (two hops from one function is often a dozen nodes), and how certain you feel afterward compared to scrolling. That certainty is the product.

## Done when

You have the paper: one function, two hops, a circled blast radius, and one sentence: "if this changes, X and Y break because Z." Keep it. In episode 4 your own tool will draw the same picture in milliseconds, and you will check it against your hand-drawn one. When the tool and your paper disagree, one of them is wrong, and finding out which is the whole job.

## What's next

Episode 01: the smallest possible parser. One Python file that reads source code as *data* and lists every function and every call, starting with itself.
