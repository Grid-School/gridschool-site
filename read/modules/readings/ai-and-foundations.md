# Using AI while learning to own the result

You can use AI throughout GridSchool. Before you accept a consequential change, you need to explain what the change does, how you checked it, and how you would recover if it failed. Your explanation may be incomplete. Naming the uncertainty gives you and your reviewer something useful to investigate.

During the intensive, you will diagnose Northline Desk, ship reviewed changes to your own project, and improve one person's workflow. Afterward, you can propose a problem of your own using the same project review. Each stage gives you more responsibility for choosing the work.

## Decide what you need to know

| Level | What you should be able to do | Examples |
|---|---|---|
| Explain without AI | Predict behavior, draw the path, and identify a dangerous assumption | Which user may read a record; what a retry can duplicate; where state persists; what your test actually checks |
| Find and verify | Use documentation, then demonstrate the behavior locally | A library option, command syntax, deployment setting, or database query plan |
| Delegate and inspect | Give AI a bounded task, review its changes, and run an independent check | Repetitive code, test fixtures, draft documentation, or a first implementation |

The level depends on the consequence. You can look up a header's spelling. You need to understand who receives the secret inside that header before you send it. You do not need to implement TLS encryption to diagnose an expired certificate; you do need to distinguish a certificate error from an application rejecting a request.

## A short practice loop

Choose one important uncertainty in the change. Spend up to ten minutes writing what you think happens, what you predict will change, and what observation would show that your prediction was wrong. Use AI and documentation to investigate. Run the smallest useful check, then explain what changed in your understanding.

If you cannot begin, ask for a hint or a worked example. After the example, close the answer and try a similar case with one condition changed. Repeating an explanation from memory is only part of learning; your explanation must also predict the new case. You can skip repeated practice once you demonstrate that transfer to your reviewer.

Keep one entry in your failure log when evidence changes your mind: assumption, observation, test or source, correction, and remaining uncertainty. Record an actual disagreement when one occurs. Inventing an AI mistake to satisfy a quota makes the record useless.

## The foundations check

In weeks 1, 3, 5, and 7, part of your 45-minute meeting is a short check with AI closed. You may read the code and use ordinary documentation. Aden asks you to trace a request, explain a failure, or write a small piece of pseudocode. You are assessed on the explanation and the check you propose. Remembering an obscure API is unnecessary.

A missing concept leads to one focused exercise and a changed example at the next meeting. Start with a hint, work through an example together if needed, then try independently. If the gap affects permissions, data loss, or external actions, keep that work in a sandbox with review until the gap is resolved. You can continue other course work.

Your final defense includes an explanation with AI closed and a separate change exercise with AI available. An employer can inspect both kinds of evidence. Neither exercise certifies that you can safely run every production system alone.

## Why preserve some unaided practice?

In his March 2026 discussion at UCLA, Terence Tao distinguishes reaching a result quickly from learning through the work of reaching it. He also describes AI opening larger collections of problems to investigation. GridSchool's application is to preserve short exercises that develop judgment while using AI for implementation and exploration. This is a course design choice drawn from that discussion; Tao has not endorsed this program. [Watch the discussion](https://forum.openai.com/public/videos/event-replay-terence-tao-and-mark-chen-on-ai-and-mathematical-discovery-2026-03-11).

**Done when** you can explain which parts of your current task you will delegate, which decisions you must understand, and how you will check the result.
