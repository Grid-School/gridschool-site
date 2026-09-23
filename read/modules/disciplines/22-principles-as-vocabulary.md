# 22 · Engineering principles as a suspicion vocabulary

*Common design principles, used as named suspicions when you review a change. About 11 minutes.*

## The wrong shared function

Sandi Metz's warning is that the wrong abstraction is worse than duplication. You extract a shared function because two callers look alike. The next requirement adds a parameter. The one after that adds a conditional. Soon the shared function is a condition-laden procedure that interleaves two ideas, and everyone is afraid to touch it. Her remedy is to put the code back into each caller, let the real duplication show, and extract again only from what you can now see.

DRY means “do not repeat yourself.” Apply it when the same rule has multiple copies that can drift apart. Similar lines may represent different rules, so do not combine them until you confirm that they have the same meaning. **Coupling** measures how often one part must change because another part changed. These words are vocabulary you use in a review. They name tradeoffs you can argue about in a review.

AI reduced the cost of implementation while review still requires careful work. A request to “use SOLID better in the billing module” is useful only when you can name the relevant principle and verify the result. A comment that a pull request “couples the domain to the payment vendor” should identify a specific design problem. These words help you find missing work in a diff and request a refactor precisely.

## The words, as suspicions

SOLID names five design principles. Single responsibility asks whether a file changes for more than one reason. Open/closed asks whether adding a new case requires editing every existing case. Metz's reading of open/closed is to wait: write the simplest code today, then rearrange when the next requirement arrives. Liskov substitution asks whether a subtype surprises code written for its parent type. Interface segregation asks whether a caller must depend on methods it never uses. Dependency inversion asks whether high-level policy imports a low-level detail, such as a domain model that imports a database driver or payment software development kit.

Cohesion measures whether related code stays together. A call graph, a map of which functions call which other functions, can reveal cycles, which is one form of coupling you can measure. Robert Martin's clean architecture places business rules at the center and details such as HTTP, databases, and vendor software development kits at the edge, with dependencies pointing inward. Three design patterns are enough to begin: use a factory when object creation requires a decision, a strategy when the algorithm may vary, and an adapter when your code must communicate with an interface you do not control.

The testing pyramid calls for many fast unit checks, fewer checks that several units work together, and the fewest full checks that a stranger can perform through the interface. An inverted pyramid is slow and unreliable. A pyramid without any full-interface checks leaves the user-facing contract untested.

## How the vocabulary is used on a review

Name the violated principle and request a specific refactor. Then verify that the new code matches the principle's meaning. For example, moving a payment SDK import one layer lower while leaving it inside the domain does not achieve dependency inversion.

Also review for missing work: “This pull request does not test the retry path. It copies the price rule into a second file. It adds an interface and still imports the concrete class.” Specific comments about absent tests or boundaries show that you examined the diff.

## A deliberately flawed charging change

The pull request below is a worked example from a small inventory application. It is deliberately flawed. An agent received the request, “add charging so a paid item can be marked sold.” The code uses Stripe's older Charges API (`stripe.charges.create`), which many current integrations have replaced. Read it as a review target.

```diff
// domain/order.js  (new)
+ import Stripe from 'stripe'
+
+ const TAX = 1.08
+
+ export async function markSold(order) {
+   const stripe = new Stripe(process.env.STRIPE_SECRET)
+   const amount = order.items.reduce((n, item) => n + item.price * TAX, 0)
+   const charge = await stripe.charges.create({
+     amount,
+     currency: 'usd',
+     source: order.token
+   })
+   order.paid = true
+   order.stripeChargeId = charge.id
+   return order
+ }

// cart.js  (existing file in the example project)
  export function cartTotal(items) {
    const TAX = 1.08
    return items.reduce((n, item) => n + item.price * TAX, 0)
  }
```

The domain module imports the payment vendor, stores the vendor's identifier on the order, and duplicates the tax rule from `cart.js`. The tax constant looks like a DRY violation. Before you extract it, ask Metz's question: is it the same rule, or two rules that happen to share a number today? The change has no retry test and no test for a charge that succeeds after the caller times out. The coupling to Stripe is the clearer finding. The duplicated 1.08 is a suspicion until the next requirement tells you whether the two callers should stay in step.

## Principles help you ask a better question

The vocabulary did not produce a mechanical verdict on the diff. It made several concerns precise enough to investigate. The Stripe import creates measurable coupling. The missing retry test leaves a known failure unexamined. The repeated tax number might be duplication or might represent two rules that merely agree today.

That uncertainty is healthy. Design principles become harmful when they replace observation with obedience. Used well, they give reviewers shared names for pressure in the code and a way to explain why a change may become expensive.

The principle is the beginning of the conversation. The behaviour of the system decides how the conversation ends.
