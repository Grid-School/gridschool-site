# 02 · Context and graph engineering

*How to represent a system so that a person or a model can reason over it without rediscovering it. About 11 minutes.*

## Context is not free

Paste an entire repository into an assistant and the first draft often looks thoughtful. Then the model cites a function that was renamed last month, obeys a comment that contradicts the code, and calls a tool that has nothing to do with the ticket. Drew Breunig's name for this work is context engineering. The older slice of the same job was prompt engineering: choosing the words in one message. The larger job is choosing every token the model is allowed to see, because every token influences the next one.

Breunig lists failure modes that show up once the window is long. Poisoning is a wrong claim that enters the context and gets reused. Distraction is a model that leans on the pile of past tokens instead of looking again. Confusion is irrelevant tools or files pulling the answer off course. Clash is two instructions in the same window that disagree. The common cause is treating a large window as permission to be sloppy.

The useful question underneath the jargon is simple. How do you represent reality so that intelligence, yours or a machine's, can reason over it and be right? Every context window, every retrieval index, every architecture diagram, and every ticket board is an answer to that question.

## Two graphs, two questions

A **call graph** answers “what breaks if I change this function?” The nodes are functions. An edge means A calls B. Before you rename a helper that writes inventory, you want the list of callers. A small parser can usually tell you that it saw a call written in the source. That is already useful. A language server that resolved the exact symbol is stronger evidence than a search that merely matched the same name. Treat those two results as different kinds of evidence.

A different graph answers “what is this model allowed to see?” The nodes are files, tool definitions, notes, and invariants. The edges are the ones you chose when you assembled the window. Most bad assistant output is a bad graph of this second kind. Too much context and the model averages over noise. Too little and it invents the missing piece. The wrong slice and it reasons perfectly about a system that does not exist.

Industry language collides here. When people say graph engineering they often mean the order of agent tasks: which agent runs after which, and who reviews whom. A code-graph tool usually means the call graph and the import graph. Both are real. They meet when the slice your call graph computes is what an agent receives. Say which one you mean.

Other graphs exist and earn their keep for other questions. A dependency graph tells you build order and cycles. An ownership graph tells you who may change a player's position. A knowledge graph records claims with sources so an assistant cannot treat a guess as a fact. Build the graph that answers the question in front of you. Skip the graph for a one-time question, a system small enough to hold in your head, or a relation too uncertain to represent as a factual edge.

## What an edge is worth

Every useful edge carries three things.

A type. “Depends on,” “calls,” and “owns” are different relations. A graph that flattens them lies.

**Provenance.** Where did this edge come from? A parser that read the code is one tier of evidence. A search that matched a string is a weaker tier. A language server that resolved the symbol is a stronger one. A human who typed the edge in is worth whatever that human is worth. When you cannot say where an edge came from, you cannot say how much to trust a conclusion drawn through it.

**Freshness.** Code moves. An edge that was true in March and nobody re-derived is a rumour. Stale knowledge does not degrade gracefully. It corrupts reasoning silently, because the reasoning is still valid and only the premises are wrong.

Some code-graph tools record how each edge was found and how old the scan is. They may label a name match as weaker than a symbol a language server resolved. Read those labels. Yesterday's slice is a rumour.

## How to fix a window

Breunig's remedies follow directly from poisoning, distraction, confusion, and clash. Offload means store notes outside the window and fetch them when needed. Summarize means boil a long trace down before you continue. Prune means delete files and tool definitions that this question does not touch. Quarantine means give a subtask its own thread so a poisoned claim cannot spread. Tool loadout means attach only the tools this step needs. Retrieval means add a document because it answers this question.

Start from the question, then pull only the part of the repository that the question touches. Include the invariants the model must not violate, stated as sentences, near the top. Include the provenance of anything uncertain: “This may retry; I have not confirmed” is a sentence the model can reason with, and silence is a sentence it will fill in. Exclude what you have not verified unless you label it. Refresh the slice when the code moved.

## The model can only reason over what you gave it

Context engineering is easy to mistake for collecting information. The harder skill is exclusion. A useful context contains the smallest set of current, sourced facts that can answer the question, plus the boundaries the answer must respect.

Graphs make those choices visible. They show which relationship you believe exists, where that belief came from, and when it was last checked. The graph may be a call graph in a tool or an implicit set of files in a model window. In both cases, the quality of the answer depends on the quality of the edges.

A larger window cannot repair a false premise. A clever agent cannot recover an invariant nobody gave it. Better reasoning begins before the model runs, with a careful account of what belongs in the room.
