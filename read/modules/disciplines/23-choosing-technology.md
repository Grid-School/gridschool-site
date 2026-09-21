# 23 · Choosing technology for the goal

*Series: disciplines. Choose between a monolith and services, decide what to build or buy, and defend a reversible technology decision. About 12 minutes.*

## The skill whose price is rising

Framework-specific implementation is easier to obtain, which increases the value of choosing technology according to a system’s goal. Write an argument that connects the goal and constraints to one choice, explains why two alternatives lost, and names the condition that would make you reconsider. Use `DECISION.md` for a general decision or `STACK-ADR.md` for a technology-stack decision. Both templates open in GridSchool, and the review accepts either as the same type of evidence.

## The questions, in the order they resolve each other

Start with the goal. A live system for outside users has different needs from a library other engineers will import. Then decide whether to create one deployable program or several services. Begin with a **monolith**, which is one deployable application. Split it into services only when a team boundary, scale limit, or failure boundary requires separate deployment. A student project with four services and one user adds operational cost before separate deployment is justified.

Build a capability when it is central to the product. Buy a commodity such as authentication, email, or payments when the system can survive a vendor failure. Choose a managed service when operating the underlying database or service would create work you cannot yet support. State what you pay for and count the running parts. Evaluate reversibility: data in a proprietary store or models owned by a framework may be difficult to move, while a container can often move to another host. Confirm that another engineer can start and operate the stack from the repository.

## What the memo contains

In the context section, state the goal, constraints, and relevant users, data, or partner. In the decision section, name the stack directly. Describe at least two alternatives and why each lost. Record what the decision makes easier, what it makes expensive, and the condition that would trigger a review. State the cost and the unit you will monitor. World provides an example: a .NET WebSocket server on one Lightsail machine with no database can support a classroom with a handful of players. Your memo should estimate the player count at which that decision stops working.

## Defend the decision

Bring the memo to the one-to-one review in Defense mode. The assistant may help you write the memo but remains silent while you explain it. Explain the choice from your own understanding. Record the hardest question and the condition under which you would choose a rejected alternative.

## The menu is the input

Readings 15 through 22 used World and supplied examples so you could practice before choosing a project. Open the project menu in GridSchool and choose one of its eight published projects. Write the technology decision for that chosen project.

## Do this now (45 minutes)

Open [the project menu](?m=projects/menu) and choose one project. In the first field, name the project and explain why it fits what you want to show. Open the stack template from the next task. Fill the stack field with the chosen technologies, monthly cost, and what can be reversed. Fill the alternatives field with two rejected choices and why they lost. Fill the final field with the condition that would change your choice. Bring the decision to the one-to-one review, explain it with the assistant silent, and record the hardest question and whether the decision survived.

## Done when

the project field names one published project and why it fits; the stack decision names the technologies, two rejected alternatives, a monthly cost you can explain, what is reversible, and the condition that would change the choice; and the one-to-one field records the hardest question and whether the decision survived while the assistant was silent.

## What's next

Next, use the project templates in GridSchool to create the system model and first specification for your chosen project.
