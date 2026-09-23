# 00 · Your repo is a graph

*Series: nanograph, a code-graph engine built from scratch. You will not
install anything in this episode. Allow about 20 minutes.*

## The claim

Open a repository you did not write and try to answer one question: *If I change this function, what breaks?* You find the function, search for its name, open the files that mention the function, and then search for the callers of those files' functions. You are following connections in a graph by hand.

Every codebase can be represented as a graph. A graph contains objects called **nodes** and connections called **edges**. In a call graph, functions are nodes, and "A calls B" is an edge from function A to function B. Files and folders group these nodes. Understanding an unfamiliar codebase requires you to follow the graph quickly and report what the code actually shows. In this series, you will build a tool to do that work.

## Why a machine, when the AI can "just read the repo"

When you paste a whole repository into an AI assistant, you pay for tokens from code that may have no bearing on the question. The unrelated code can also take the model's attention away from the relevant code. For example, a question about `refund()` does not need the login system unless the two are connected.

A **context slice** is the part of the codebase relevant to one question. A call graph can identify that slice. By the end of the series, your tool will assemble a small context slice for a question. You will measure its token cost and the quality of the resulting answer. Those measurements turn token use into an engineering decision.

## A paper trace

The rest of this series builds a machine that answers one question: if this function changes, what breaks? Before writing that machine, it helps to do the work by hand once so you know what the machine is supposed to report.

Choose a repository from work or a medium-sized open-source project. Then choose one function that looks important. On paper:

1. Write its name in the middle of the page.
2. Find every function that calls your chosen function. Search for its name and count each invocation, excluding the definition. Draw an arrow from each caller into the chosen function.
3. Choose the two most interesting callers and find the functions that call each of them. This gives you two **hops**, or two steps through the graph.
4. Ask which functions would be affected by a subtle change in the chosen function's behavior. Circle this **blast radius**, the set of functions that the change could affect.

A finished page shows one function, two hops, and a circled blast radius, plus one sentence: "if this changes, X and Y break because Z." As you work, record how often a search result refers to a different object with the same name, how many nodes appear within two hops, and how confident you feel after tracing the calls. A search can match the wrong object, and a two-hop graph often contains a dozen nodes. Later episodes address both problems. Episode 04's tool will draw the same graph in milliseconds. Keep the paper so you can compare the two.

Episode 01 builds the smallest possible parser: one Python file that reads source code as data and lists every function and every call. The parser begins by reading its own source code.
