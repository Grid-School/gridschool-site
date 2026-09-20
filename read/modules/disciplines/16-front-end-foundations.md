# 16 · Front-end foundations, framework-agnostic

*Series: disciplines. Five ideas every UI framework implements under different names, and why reading a component you have never seen matters more than years inside one library. ~12 minutes.*

## The claim, stated so it can be wrong

A posting that asks for five years of Angular is describing a hiring filter from a period when learning a second framework took months and a team could not afford the gap. That period ended when an engineer who understands what a component, a piece of state, a render, a route, and a fetch are for could open a Vue file for the first time, predict what a state change would do to the screen, and be right, then ask an agent for the Svelte equivalent and review the result in an afternoon. The barrier moved from knowing the framework to being able to see the five ideas when they are spelled differently, and a review that docks you for not being "a React person" is grading a skill the market stopped paying for.

That is not a claim that frameworks are identical. Angular's dependency injection, Svelte's compile-time reactivity, and React's render-on-state-change are genuinely different machines. The claim is narrower and testable: the differences are researchable in hours once the five ideas are in your head, and this reading exists to put them there.

## The five ideas and what goes wrong when one is missing

A **component** is a named unit of interface with inputs and a render, and when a codebase has lost the idea you find files that do six things and state that nobody can locate. **State** is the data that, if it changed, the screen would change, and when state is unclear you find two sources of truth for the same fact and a user who refreshes and watches their work vanish. **Rendering** is how state becomes pixels, whether the browser builds the page from a script, the server sends HTML that already looks right, or the two hand off through hydration, and when rendering is misunderstood you get a blank first paint or a page that looks finished and does nothing for a second. **Routing** is which component owns which URL, and when it is wrong the back button breaks and deep links land on a 404. **Data fetching** is when and where the screen asks the server, and when it is careless you get waterfalls of dependent requests and a client that has quietly become the authority on data it should only display.

React calls its state and effects hooks, Vue calls them composables, Angular puts them in services, Svelte in stores and signals. Those are dictionary entries. The five ideas are the skill, and the exercise below asks you to find them in a language you do not speak.

## One example, worked

Suppose you have never written Vue and you open a file that begins with a `<script setup>` block declaring `const count = ref(0)`, a template that prints `{{ count }}` next to a button with `@click="count++"`, and nothing else. Before running it you can predict, from the five ideas alone, that `count` is state because the screen would change if it changed, that the template is the render, that clicking will increment and repaint without a page load because this is client-side rendering, and that there is no routing or fetching in the file at all. Run it and the prediction holds. Now ask an agent for the same component in Svelte and read the diff: `let count = 0` and `on:click={() => count++}` say the same five things in a different dialect, and the only real change is that Svelte's reactivity is decided at compile time rather than through a wrapper object. That one sentence about what actually moved is the artifact this node grades. A paragraph about which syntax you prefer is not.

## Client-side versus server-side rendering, in one paragraph

Client-side rendering ships a shell and a script and builds the page in the browser, which is fast after the first load and empty until then. Server-side rendering sends HTML that already looks like the page so the browser can paint immediately, and then a script hydrates it so that it becomes interactive, which is the expensive handshake between the two approaches and the source of most of the flashes and stalls you have seen on modern sites. A game client is a session and a marketing page is a document, and they want different answers for that reason, so when you cannot say whether your project needs hydration the honest default is that it does not.

## Do this now (50 minutes)

Open a component in a framework you have not shipped in, write down what you expect to happen when one piece of its state changes, run it, and record exactly where you were wrong. Then ask an agent to write the same component in a second framework and review the diff only for the five ideas, writing one sentence on which idea actually changed and which was a rename. Finish with a paragraph on which of the five you would specify first for your menu project and why that one.

## Done when

You can point at a component you did not write and name the five ideas in it, including the one that is absent, and your prediction record shows a check against reality rather than a summary of documentation.

## What's next

17 · Back-end foundations: the same request lifecycle in every server framework.
