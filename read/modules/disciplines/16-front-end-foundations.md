# 16 · Front-end foundations, framework-agnostic

*Five ideas shared by user-interface frameworks, then found in a component you have never seen. About 11 minutes.*

## The state that lives on the screen

Kent C. Dodds's hard-won mistake was treating server data as if it were UI **state**. He put the response from the server in the same store as “is this list open,” then spent months synchronizing two things that do not want the same rules. UI state disappears when you refresh. Server cache is a copy of a fact that still lives somewhere else. Mixing them makes both harder.

A job posting that requires five years of Angular uses a filter from a time when learning another framework could take months. An engineer who understands components, state, rendering, **routing** (which URL loads which screen), and data fetching can now open an unfamiliar Vue file, predict how a state change affects the screen, and review an agent's Svelte version in an afternoon. The transferable skill is recognizing those five ideas under different framework names.

Frameworks still differ. Angular uses dependency injection, Svelte decides reactivity while compiling, and React renders after state changes. Once you understand the five shared ideas, you can research those differences in hours.

## The five shared ideas

A **component** is a named part of an interface with inputs and a method for displaying itself. Unclear component boundaries can leave one file performing several unrelated jobs. State is data whose change would alter the screen. Keep that state next to the component that owns it. Lift it only when a sibling needs the same fact. Unclear state can create two sources of truth or make a user's work disappear after a refresh.

Rendering turns state into pixels. A browser may build the page from JavaScript, a server may send complete HTML, or the two may connect through hydration. Hydration is the process that adds interactive JavaScript behavior to server-rendered HTML. It is part of rendering. Misunderstood rendering can cause a blank first display or a page that appears complete before its controls work.

Routing assigns each URL to a component. Routing errors break the back button or make direct links return a 404 response.

Data fetching controls when and where the screen requests server data. That fetch is the server cache Dodds wants you to keep separate. Careless fetching can create a sequence of requests that wait on one another or let the client become the authority for data it should only display.

React uses hooks for state and effects, code that runs when a component loads or relevant state changes. Vue uses composables, Angular uses services, and Svelte uses stores and signals. Learn the framework terms as needed.

## One example, worked

Suppose you have never written Vue. You open a file with a `<script setup>` block that declares `const count = ref(0)` and a template that prints `{{ count }}` beside a button with `@click="count++"`. Before running the file, predict that `count` is state because changing it alters the screen. The template defines the rendering. Clicking the button increases the count and redraws the component in place. The file contains no routing or data fetching. Run the component to check those predictions. The same component in Svelte would use `let count = 0` and `on:click={() => count++}` for the same ideas. The substantive difference is that Svelte decides reactivity at compile time through language syntax. The sentence that matters is the one that names that change.

Client-side rendering sends a basic page and a script, then builds the interface in the browser. Later interactions can be fast, but the first display remains empty until the script runs. Server-side rendering sends HTML the browser can display immediately, then a script hydrates the HTML to make it interactive. Hydration can cause visible flashes or delays. A game client supports a continuing session, while a marketing page primarily presents a document, so they may need different rendering methods. Require hydration only when you can explain why the screen needs it.

## An unfamiliar component

Here is a second Vue component. You can run it in the [Vue playground](https://play.vuejs.org/) or another host that runs a single-file Vue component.

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

`open` is UI state. `items` is a cache of a list that came from a request. Predict the screen before you run it: what happens when `open` changes from false to true, and what the list contains after the request completes. Then run it and notice every difference.

## Frameworks change; the questions remain

The syntax in this example belongs to Vue. The important decisions do not. Every interface still has to decide where a screen begins and ends, which facts belong to the browser, which facts came from a server, what causes a new render, and which URL brings the user back.

Those decisions are why framework fluency transfers. Once you can see components, state, rendering, routing, and data fetching beneath the syntax, an unfamiliar file stops looking like a foreign language. It becomes another answer to the same small set of interface questions.

The framework will keep changing. A clear ownership model for the screen will outlast it.
