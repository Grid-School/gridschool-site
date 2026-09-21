# 22 · Engineering principles as a suspicion vocabulary

*Series: disciplines. Learn common design principles and use them to review a supplied change. About 13 minutes.*

## Why the old words still earn their keep

AI reduced the cost of implementation while review still requires careful work. A request to “use SOLID better in the billing module” is useful only when you can name the relevant principle and verify the result. A comment that a pull request “couples the domain to the payment vendor” should identify a specific design problem. This reading gives you vocabulary for finding missing work in a diff and requesting a refactor precisely. The review grades how you apply the principles to the supplied code.

## The words, as suspicions

SOLID names five design principles. **Single responsibility** asks whether a file changes for more than one reason. **Open/closed** asks whether adding a new case requires editing every existing case. **Liskov substitution** asks whether a subtype surprises code written for its parent type. **Interface segregation** asks whether a caller must depend on methods it never uses. **Dependency inversion** asks whether high-level policy imports a low-level detail, such as a domain model that imports a database driver or payment software development kit.

DRY means “do not repeat yourself.” Apply it when the same rule has multiple copies that can drift apart. Similar lines may represent different rules, so do not combine them until you confirm that they have the same meaning.

**Cohesion** measures whether related code stays together. **Coupling** measures how often one part must change because another part changed. The graph-track tool can measure one form of coupling by finding cycles in the call graph. **Clean architecture** keeps policy in inner layers and details such as HTTP, databases, and vendor software development kits in outer layers, with dependencies pointing inward. Three design patterns are enough to begin: use a factory when object creation requires a decision, a strategy when the algorithm may vary, and an adapter when your code must communicate with an interface you do not control.

The testing pyramid calls for many fast unit checks, fewer checks that several units work together, and the fewest full checks that a stranger can perform through the interface. An inverted pyramid is slow and unreliable. A pyramid without any full-interface checks leaves the user-facing contract untested.

## How the vocabulary is used on a review

During review, name the violated principle and request a specific refactor. Then verify that the new code matches the principle’s meaning. For example, moving a payment SDK import one layer lower while leaving it inside the domain does not achieve dependency inversion.

Also review for missing work: “This pull request does not test the retry path. It copies the price rule into a second file. It adds an interface and still imports the concrete class.” Specific comments about absent tests or boundaries show that you examined the diff.

## The agent pull request for this reading

An agent received the request, “add charging to the toy shop so a paid item can be marked sold.” The agent opened the pull request below. The code comes from the supplied toy shop.

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

// cart.js  (already in the repo, unchanged)
  export function cartTotal(items) {
    const TAX = 1.08
    return items.reduce((n, item) => n + item.price * TAX, 0)
  }
```

The domain module imports the payment vendor, stores the vendor’s identifier on the order, and duplicates the tax rule from `cart.js`. The change has no retry test and no test for a charge that succeeds after the caller times out.

## Do this now (40 minutes)

Review the provided pull request. Name the principle it violates, write the refactor request using that principle, and describe the observable code change that would satisfy the request. If you identify several principles, choose the first one you would address and explain the order.

Save agent diffs from your own work for a later review. For this assignment, submit a review note about the supplied toy-shop charging patch.

## Done when

the review note names a principle, makes a specific request, and describes a before-and-after change a stranger can verify against the supplied diff.

## What's next

23 · Choosing technology for the goal: pick one project from the published menu and write the stack decision you will defend.
