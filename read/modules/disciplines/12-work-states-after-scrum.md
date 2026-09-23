# 12 · Work states after Scrum

*Why a simple board has three columns, what those columns hide, and the measure that replaces story points. About 10 minutes.*

## Processes manage bottlenecks

Waterfall solved a problem: large projects with many hands needed a plan before anyone poured concrete. Agile solved the problem waterfall created. Plans made once were wrong by the time they shipped, so teams shortened the loop and checked with reality often. Scrum gave agile teams a repeatable mechanism for doing that: a backlog, a sprint, a standup, a review, a retrospective, repeat. Each of those was a good answer to the bottleneck of its time, and the bottleneck each one addressed was the same. Implementation was expensive, and human implementers were the constraint.

Will Larson's rule for process is that good process is evolved. You try something, measure whether it moved the constraint, and cancel it when it no longer does. Donald Reinertsen's warning is that software queues are invisible. Walk into a crowded shop and you can see the line. Walk into a busy engineering team and twenty tickets in **To do** look the same as two. Those tickets are work in process. If you do not measure the queue, you will manage the ritual instead.

Here is the rule that outlives waterfall, agile, and Scrum: processes exist to manage bottlenecks, and when the bottleneck moves, the process must move with it. If you keep running a process designed for a constraint that no longer binds, you are performing a ritual. Rituals keep teams busy while the useful output stays flat.

## Where the bottleneck went

When a model can write the implementation, the sprint's central question, how many story points fit, stops being the interesting one. The interesting questions become: which work is actually understood well enough to specify? Which specifications deserve execution at all? Which agent output is sitting there waiting for a human to judge it? Which experiment needs evidence before anyone decides? Which dependency is blocking autonomous execution? Where are the agents repeatedly failing, and is that the specification's fault?

A simple board answers none of those. The board most teams actually use has three columns named To do, Doing, and Done. A ticket can sit in Doing for a week while the team is still defining it, an agent has produced three incorrect versions, and a human review remains pending. Those three words hide the states underneath.

Keep the board simple. A small team shipping weekly does not need nine columns, and the mental model matters more than the furniture. When you say a ticket is in progress, say which hidden state you mean.

Unknown: someone wants something; nobody has framed it. Investigating: hypotheses exist; evidence is being gathered. Specified: a contract exists that someone else could execute. Ready for delegation: the work is decomposed; context and boundaries are written. Agent executing: machines are working; the human is watching checkpoints. Evaluating: output exists; checks are being run against it. Needs human judgment: the checks raised something only a person can decide. Experiment: it shipped to some reality; a number is being watched. Proven or rejected: the evidence is in.

A useful status is specific: “In progress: agent executing, two interventions so far, evaluating by Thursday.” The words “in progress” alone leave the state and the next action unclear.

Do not invent a new religion of nine columns. Learn the states so you can see the queue Reinertsen says you are otherwise blind to.

## Why work moves backward

Needs human judgment often sends work back to Specified, because the human judgment exposed a gap in the specification. Evaluating sends work back to Agent executing when the output was rejected and the specification was fine. Investigating can end with a rejected outcome when the evidence shows the problem is not worth solving. A board that has no backward arrows is hiding how work happens. A team that treats backward movement as failure will hide it, which is worse.

## The metric that replaces velocity

Story points measured how much implementation a team could produce, which was the right thing to measure when implementation was the constraint. The measure that matches the new bottleneck is proven outcomes per unit of human attention.

Proven means the work reached a proven or rejected outcome with evidence attached. Human attention is the scarce input: the hours of framing, specifying, judging, and evaluating that still require a person. A team that ships forty changes and proves that three mattered has a lower rate than a team that ships six and proves that five mattered. That is why every serious change needs an outcome record: the starting point, the change, and the measured result or explicit rejection. A merge by itself does not establish that the outcome occurred.

## Follow the queue

Scrum did not become foolish when code generation became cheap. The constraint moved. A process built around feeding work to human implementers will reveal less when the growing queue sits in framing the problem, writing the specification, evaluating the output, and exercising human judgment.

The three-column board can stay. What matters is whether the team can see what “Doing” conceals and whether unfinished work is waiting for a machine, a check, or a person. Once the queue is visible, the process can evolve around the real delay.

Process is useful when it helps work move and easy to discard when it does not. The ritual is never the product. The outcome is.
