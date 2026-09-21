# 16 · Front-end foundations, framework-agnostic

*Series: disciplines. Learn five ideas shared by user-interface frameworks, then find them in a component you have never seen. About 12 minutes.*

## The claim, stated so it can be wrong

A job posting that requires five years of Angular uses a filter from a time when learning another framework could take months. An engineer who understands components, state, rendering, routing, and data fetching can now open an unfamiliar Vue file, predict how a state change affects the screen, and review an agent’s Svelte version in an afternoon. The transferable skill is recognizing those five ideas under different framework names.

Frameworks still differ. Angular uses dependency injection, Svelte decides reactivity while compiling, and React renders after state changes. Once you understand the five shared ideas, you can research those differences in hours. This reading introduces the shared ideas.

## The five shared ideas

A **component** is a named part of an interface with inputs and a method for displaying itself. Unclear component boundaries can leave one file performing several unrelated jobs. **State** is data whose change would alter the screen. Unclear state can create two sources of truth or make a user’s work disappear after a refresh. **Rendering** turns state into pixels. A browser may build the page from JavaScript, a server may send complete HTML, or the two may connect through hydration. **Hydration** is the process that adds interactive JavaScript behavior to server-rendered HTML. Misunderstood rendering can cause a blank first display or a page that appears complete before its controls work. **Routing** assigns each URL to a component. Routing errors break the back button or make direct links return a 404 response. **Data fetching** controls when and where the screen requests server data. Careless fetching can create a sequence of requests that wait on one another or let the client become the authority for data it should only display.

React uses hooks for state and effects. Vue uses composables, Angular uses services, and Svelte uses stores and signals. Learn the framework terms as needed. In the exercise below, identify the five shared ideas in an unfamiliar framework.

## One example, worked

Suppose you have never written Vue. You open a file with a `<script setup>` block that declares `const count = ref(0)` and a template that prints `{{ count }}` beside a button with `@click="count++"`. Before running the file, predict that `count` is state because changing it alters the screen. The template defines the rendering. Clicking the button increases the count and redraws the component in place. The file contains no routing or data fetching. Run the component to check those predictions. Then ask an agent to write the same component in Svelte. In the diff, `let count = 0` and `on:click={() => count++}` express the same ideas with different syntax. The substantive difference is that Svelte decides reactivity at compile time through language syntax. Your artifact for this reading is one sentence that identifies the substantive change.

## Client-side and server-side rendering

Client-side rendering sends a basic page and a script, then builds the interface in the browser. Later interactions can be fast, but the first display remains empty until the script runs. Server-side rendering sends HTML the browser can display immediately, then a script hydrates the HTML to make it interactive. Hydration can cause visible flashes or delays. A game client supports a continuing session, while a marketing page primarily presents a document, so they may need different rendering methods. Require hydration only when you can explain why the screen needs it.

## The foreign component for this reading

Use the provided component for this exercise. Paste it into the [Vue playground](https://play.vuejs.org/) or another host that runs a single-file Vue component.

```vue
<script setup>
import { ref, onMounted } from 'vue'

const open = ref(false)
const items = ref([])
const error = ref('')

onMounted(async () => {
  try {
    const res = await fetch('data:application/json,["red mug","blue bowl"]')
    items.value = await res.json()
  } catch (e) {
    error.value = 'list failed'
  }
})
</script>

<template>
  <button @click="open = !open">{{ open ? 'hide' : 'show' }} list</button>
  <p v-if="error">{{ error }}</p>
  <ul v-if="open">
    <li v-for="item in items" :key="item">{{ item }}</li>
  </ul>
</template>
```

Before running the component, write what you expect when `open` changes from false to true and what you expect the list to contain after the request completes. Then run it and record every difference between your prediction and the screen.

## Do this now (50 minutes)

Predict the behavior of the unfamiliar component above, then run it. Record what you expected after one piece of state changed, what the screen displayed, and where your prediction differed. Identify which of the five ideas is absent. Ask an agent to write the component in a second framework you have never shipped. Review the diff for the five ideas and write one sentence explaining which idea changed and which differences only renamed an idea.

Fill the prediction and error fields after running the provided component. Then fill the second-framework field with the idea that changed and the differences that only renamed an idea.

## Done when

the prediction field records what you expected, the error field records what happened and which idea is absent, and the second-framework field explains which idea changed and which differences were only renames.

## What's next

Next, reading 17 follows the same server request lifecycle through World and an unfamiliar starter application.
