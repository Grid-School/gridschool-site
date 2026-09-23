# 23 · Choosing technology for the goal

*How to choose between a monolith and services, and what to build, buy, or leave managed. About 10 minutes.*

## Prefer the failure you already know

Dan McKinley's essay is called Choose Boring Technology. Boring here means well understood. MySQL, Postgres, Python, memcached, and cron are boring. You can list the main ways they will let you down. A new tool may be a better local fit and still be the worse global set, because every extra piece has operational cost that never appears in the “best tool for the job” slide. McKinley calls the scarce budget innovation tokens. Spend them on the one novelty the product actually needs.

Framework-specific implementation is easier to obtain, which increases the value of choosing technology according to a system's goal. A useful argument connects the goal and constraints to one choice, explains why two alternatives lost, and names the condition that would make you reconsider.

## The questions, in the order they resolve each other

Start with the goal. A live system for outside users has different needs from a library other engineers will import. Then decide whether to create one deployable program or several services. Begin with a **monolith**, which is one deployable application. Split it into services only when a team boundary, scale limit, or failure boundary requires separate deployment. Four services for one user add operational cost before separate deployment is justified.

Build a capability when it is central to the product. Buy a commodity such as authentication, email, or payments when the system can survive a vendor failure. Choose a managed service when operating the underlying database or service would create work you cannot yet support. State what you pay for and count the running parts.

Evaluate **reversibility**: data in a proprietary store or models owned by a framework may be difficult to move, while a container can often move to another host. Then check **operability**: can another engineer start and run the stack from the repository? If nobody else can start the stack, you will be the person who is on call for it.

## A way to think the decision through

Write the goal, constraints, and relevant users, data, or partner. Name the stack directly. Describe at least two alternatives and why each lost. Record what the decision makes easier, what it makes expensive, and the condition that would trigger a review. State the cost and the unit you will monitor. The writing is a thinking tool. The reasoning is finished when you can explain the choice without rereading the note.

**GridGlade**, the shared multiplayer game used as the example here, shows one finished architecture: a Unity WebGL client served through a content delivery network, and a .NET WebSocket server on one rented virtual machine with no database. That is a monolith on a well-understood host. The interesting part of that choice is what would force a change: a need for durable player state, a host you can no longer operate, or a cost unit that grows faster than the goal can bear.

Technology choices compound. Every database, framework, queue, and service becomes something the team must understand, secure, upgrade, observe, and eventually replace. The cost arrives long after the excitement of choosing it.

“Boring” is therefore a form of freedom. Known tools leave more attention for the part of the product that is genuinely new. Reversible choices keep today's uncertainty from becoming tomorrow's trap.

The best stack is rarely the collection of individually clever choices. It is the smallest set of understood tools that can carry the goal, fail in ways the team can handle, and change when the reasons for choosing it are no longer true.
