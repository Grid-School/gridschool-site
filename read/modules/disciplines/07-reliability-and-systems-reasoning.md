# 07 · Reliability and systems reasoning

*Concurrency, latency, trust boundaries, and blast radius, taught when a failure makes each one necessary. About 11 minutes.*

## Reliable enough

Google's SRE book opens reliability with a claim that surprises people. Past a certain point, making a service more reliable is worse for users. Extreme reliability costs features, speed, and money. A person on a phone that is up ninety-nine percent of the time cannot tell the difference between 99.99 and 99.999 on your server. The job is to choose a risk the business can bear. An **error budget** is the amount of unreliability that choice permits before feature work pauses and reliability work takes priority.

Richard Cook's note on how complex systems fail adds the other half. Serious failures are almost never one broken part. They are combinations: a race plus a retry plus a client the server trusted. You meet the principles when a live system makes each one necessary.

**GridGlade**, the shared multiplayer game used as the example here, gives us one current failure and three hypothetical extensions that make the principles concrete. GridGlade already exposes slow movement and client-reported positions. A richer game might allow two players to claim one plot or might duplicate an item. Any software project can also be damaged by an agent reaching production systems it should not touch.

## Two players, one plot

Imagine a game where two players click the same empty plot in the same tick and both are told they own it. This is a race, and the cluster it opens is concurrency.

**Atomicity** means an operation either fully happens or does not happen at all. “Check the plot is free, then assign it” is two operations, and the gap between them is where the second player lives.

Locks make the second player wait until the first is finished. Correct, and a bottleneck when a thousand players are clicking.

Optimistic concurrency lets both proceed, and makes the write fail if the row changed since it was read. Cheaper when conflicts are rare.

**Idempotency** means an operation you can safely run twice. Claiming a plot you already own should leave the state unchanged. It should neither throw nor charge you again. Every message that might be retried needs this property.

When you meet this failure, the question to answer in writing is: which of these does the current code use, and where is the gap?

## The world feels slow

Players say movement is laggy. Problem framing, the practice of separating an observed symptom from its possible causes, requires several hypotheses before a fix. The cluster is performance.

Latency is the time one thing takes. Throughput is how many things happen per second. Fixing one can worsen the other.

Caching trades freshness for speed. The question is always what happens when the cache is wrong.

Queueing: when arrivals exceed service, delay grows without bound. A server at ninety percent utilisation is one burst from collapse, whatever the dashboard calls it.

Consistency: how long until every observer agrees on the world state, and what they see in the meantime.

Indexes: the query that scanned forty rows in development scans four million in production. Look at the query plan before you blame the network.

The discipline is measuring before believing. A trace that shows where the milliseconds went is worth more than any hypothesis, including the correct one.

## An item duplicated itself

Imagine a game with collectible items. Someone has two copies of an item that should exist once. The cluster is trust boundaries, and it begins with a single question: who is the authority?

For each piece of state, exactly one component decides its truth. If the client tells the server “I picked up the sword” and the server believes it, the client is the authority, and the client is in the hands of the user. GridGlade currently accepts every position reported by a client. That known trust-boundary defect follows the same pattern.

Validate on the client for responsiveness. Validate on the server for truth. Skipping the second because the first exists is the classic duplication bug.

Replay is a valid message captured and sent twice. Idempotency from the plot race is the defence; an idempotency key on every state-changing message is the mechanism.

A trust boundary is any place data crosses from something you control to something you do not. Draw it on your system model. Every arrow that crosses it needs validation on the trusted side.

## An agent broke production

An assistant, given a task, did something outside the task, and the world is down. The cluster is blast radius, and it is the one this generation of engineers will meet most.

Least privilege: the agent had the permissions to do it. Should it have? Grant the minimum a task needs, per task, and revoke it after.

Sandboxes: run machine work somewhere its mistakes cannot reach users. Then promote deliberately.

Rollback: the ability to return to the last known good state, rehearsed before you need it. Rehearse the rollback before deployment so you know the recovery procedure works.

Blast radius: before any change, machine or human, ask what else it can reach. A paper map and a call graph both help. Apply the same question to permissions.

The error budget keeps work on concurrency, performance, trust boundaries, and blast radius tied to the reliability users were promised. If the service has already spent that budget, you stop shipping features and address the race, the slow path, the trust boundary, or the missing rollback. If the service is far more reliable than anyone asked for, you have been spending user-visible work on nines nobody can feel.

## Reliability lives between the parts

None of the four failures came from a mysterious force inside one bad function. The race lived between two requests. The delay lived between arrivals and capacity. The duplicate lived between trust and retry. The production break lived between an agent's reach and the absence of a boundary.

That is why reliability work feels different from ordinary debugging. Fixing the visible defect matters, but the deeper task is to find the relationship that allowed the defect to become damage. Atomicity closes one gap. Idempotency makes a retry safe. Validation restores an authority boundary. A sandbox limits what the next mistake can reach.

Perfect reliability would consume the whole product. Careless speed would spend the whole error budget. Systems reasoning is the continuing choice between them: understand how the parts can combine, decide which failures users can bear, and make the dangerous combinations harder to assemble.
