# 20 · CI/CD, environments, and where to host

*Series: disciplines. Pipeline stages as gates that can say no, PaaS against IaaS against managed services, and the decision memo that names the two hosts you turned down. ~12 minutes.*

## A pipeline is a list of things that can say no

CI/CD is not a vendor and it is not a badge. It is the sequence of checks that runs when you push, and its value is entirely in how many of those checks are capable of failing. A build step proves the thing compiles or bundles. A test step runs the suite you wrote, including the contract check from the previous reading. A lint or format step belongs in the pipeline only when it is deterministic, because a model that "styles" the tree is not a gate, it is a second author. A deploy step puts the result at a URL a stranger can open, from a branch you can name. Branch protection and pull-request gates exist so that green on your laptop and green on main stop being the same claim, and if you can push to main without any of those stages running you do not have a pipeline. You have a habit that happens to work most days.

## Environments, and the honest version of having one

Development is where you break things. Staging is where you break them against production-shaped data. Production is where a stranger is hurt when you are wrong. A student project usually has one environment, and the honest thing to do is say so in the decision memo rather than pretend, because the review is grading whether you know what staging would have caught, not whether you paid for a second server. Promoting by copying files by hand is a process you should be able to describe in full and then replace with the pipeline above. Containers make "it ran on my machine" into a file, and a Dockerfile you can explain plus an image that boots is enough; nobody on this program needs a cluster.

## Where to host, and why buying the package is allowed

The four kinds of host are worth telling apart because each one moves a different cost onto you.

| Kind | Examples | When you pick it | What it costs you |
|---|---|---|---|
| Platform as a service | Vercel, Railway, Fly, Render | You want a URL and a log without operating a machine | Vendor limits, cold starts, and the day you hear "we cannot do that here" |
| Managed data or auth | Supabase, Firebase, PlanetScale, Clerk | You want a database and auth without becoming their operator | Lock-in, billing surprises, and an abstraction that leaks at the worst moment |
| Infrastructure as a service | AWS, Azure, GCP virtual machines | You need the box, the network, or a compliance story | You are now on call for the machine |
| Your own small server | Lightsail, a six-dollar droplet | The world already does this and you understand what it costs | You patch it, back it up, and watch it |

It is fine to use a packaged service, and this program says so on purpose because the skill being taught is not raw operations. The skill is choosing a host for the goal and being able to say why, with the two alternatives you rejected and the monthly bill written as a number. Infrastructure as code, in one paragraph: the host should be recreatable from a file in the repository rather than from a night of clicking, and a Terraform module, a Pulumi program, or a compose file all count if a stranger can stand the system up from what you committed. DNS and TLS are the last mile, and a URL that is HTTP only is not shipped, any more than a URL that works only on your laptop is.

## The memo is the grade

Reading 23 will ask you for a full stack decision. This node asks for the host slice of it: the platform you chose, the two you rejected and why each lost, the monthly cost, and the condition that would make you move. A stack you cannot price is a stack you do not own, and a memo with no rejected alternative is a preference wearing a memo's clothes.

## Do this now (60 minutes)

Make your project deploy through a pipeline you can explain, then paste the configuration and name each stage with the condition that would turn it red. Write the host decision in `DECISION.md` or `STACK-ADR.md` from the project kit, with the two alternatives you rejected, the monthly cost, and what would make you switch. Confirm the live URL is HTTPS.

## Done when

A stranger can watch the pipeline run and open the URL, and the decision memo names two rejected hosts and a monthly number.

## What's next

21 · Observability and incidents: logs, metrics, traces, and the first postmortem you write on purpose.
