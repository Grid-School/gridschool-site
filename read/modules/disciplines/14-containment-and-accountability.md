# 14 · Containment and accountability

*What holds when nobody is watching: reach, credentials, budget, stop conditions, the gate, the rollback, and the record you sign afterward. About 12 minutes.*

## The overnight run

You start a frontier agent against a well-specified refactor at eleven. The model is one of the most capable ones currently available. It waits on tests, resumes, retries, and keeps going after you sleep. At seven you have a large, coherent pull request. Somewhere in hour three the agent accepted a failing premise and built an hour of fluent work on top of it. Surface metrics look healthy. The log is full of successes.

A supervised agent workflow can rely on a person who is watching and ready to stop the run. Containment asks what safeguards remain active when nobody is watching. Direct supervision cannot cover several agents or continue while you sleep. Before the run, you therefore build constraints that remain active without you. Afterward, a **run record** preserves the instructions, actions, changes, costs, stops, and checks another person needs to reconstruct what happened.

Anthropic's trustworthy-agent writing names the same tension. Agents are useful because they act without you. Humans still keep control of reach and of high-stakes approval. Identity has to travel with the tool call. If the tool server runs as a different account from the person who started the job, the agent can retrieve data that person could not access.

## What METR actually measured

METR, a research organization that measures AI capabilities, calls the length of software and research tasks a capable model can complete at a fifty-percent success rate a **time horizon**. METR also warns that this measure is imprecise and does not describe how long an agent can work independently. A fifty-percent success rate means that half of comparable runs fail. Reliability-critical tasks may require success rates above ninety-eight percent, and those horizon estimates need more data.

Access control can fail even when the agent follows its instructions. If a tool server runs under a more powerful identity than the person who started the task, the agent may retrieve data that person could not access directly. A safer design carries the person's identity through the full tool chain and enforces authorization outside the model.

Building controls for capable agents is paid engineering work. An organisation needs limits on access, spending, execution, and release before it can let an agent work against sensitive systems. A **harness** is the runtime around the model that provides its tools, permissions, budget, memory, and stop conditions. The people who build that runtime may be called harness engineers or agent platform engineers. The title is still unsettled, while the underlying capability transfers between roles.

A crash is easier to diagnose because it shows where execution stopped. The overnight run hides the error inside a finished artifact. Containment limits the cost of that failure. It restricts what the run can touch and spend, stops execution when a check fails, and preserves enough evidence to reconstruct the run.

## The containment contract

Write the contract before the run begins and enforce each clause through the harness, permissions, or another control that remains active without you.

**Reach.** Name every file, directory, service, and network destination the run may touch. Use permissions or isolation to block everything outside the list. For example, restrict the run to a branch, a working directory, and an approved set of network destinations.

**Identity.** Determine which account runs the agent, which credentials exist in the shell environment, which tokens exist in the browser profile, and what each credential permits. Create a revocable identity with only the permissions the task needs. Every credential left on the machine expands the agent's reach. A dedicated identity enforces the limit without relying on a checklist of credentials to remove before you step away.

**Budget.** Set limits for money and elapsed time, and enforce both through the harness. The agent's estimate of its own spending is insufficient. If the limit is forty dollars, the harness must stop the run at forty dollars. Record the actual cost because cost per outcome is a non-functional requirement that employers evaluate.

**Stop conditions.** Define the events that halt or pause the run. Include a failing check, the same error twice in a row, an edit outside the reach list, a diff above a chosen size, and a period with no measurable progress. A stop ends the run. A pause preserves the current state until you return, which modern agents can usually handle.

**The gate.** A check outside the agent's write access decides whether the work can land. Define the criterion before the run and execute the check in a location the agent cannot edit. Allowing the agent to modify the gate would remove the independent control.

**Rollback.** Before the run, write one sentence that explains how to undo every change. A longer rollback procedure indicates that the run may have too much reach.

Keep enforcement outside the agent's write access. A controlling script can enforce four parts of the contract: reach, budget, stop conditions, and the gate. It can track money and elapsed time from the trace, check `git diff --name-only` against the reach list after each phase, run the gate as a protected subprocess, and create the branch used for rollback. Identity still needs a separate control because credentials already exist in the environment when the script starts. Controls you wrote are easier to explain during a technical review, and a structured trace lets you reconstruct the run from recorded data.

## The failure with no error message

A difficult unattended failure occurs when the run keeps completing tasks while quietly skipping validation or reasoning from an unchecked premise. Use three controls that rely on direct evidence from the run.

Check the invariant independently. Assert the required system property continuously through a check outside the agent. A skipped validation then appears as an invariant violation.

Measure progress directly. Use passing-test counts, open-finding counts, or benchmark values. If those measures remain unchanged for an hour, treat the run as stalled.

Verify the summary. Treat the end-of-run report as a set of hypotheses because the agent being audited wrote it. Check each claim against independent evidence. In the run record, mark which claims you verified and which claims still depend on the agent's account. The unverified claims form your risk register.

Because you could not watch the run, the run record must let a stranger reconstruct what the agent did. It includes the contract as written before the run, the full log of actions with timestamps, every diff, the cost and elapsed time, each stop condition that fired and why, the gate result, and your afterward note separating what you verified from what you accepted. A team without this spends weeks after any incident trying to work out whether the fault was the prompt, the model, the tool integration, or the orchestration. That archaeology destroys trust faster than the original fault.

## What you are actually signing

A model cannot be sued, fired, licensed, indemnified, or subpoenaed. A person remains answerable when work reaches production. As the volume of machine-produced work rises, a well-supported human sign-off becomes more valuable.

Signing means you can explain why you believed the result was correct and support the explanation with artifacts. When the run record leaves an important claim unverified, decline to sign that part and state the missing evidence.

Unattended work separates accountability from direct observation. Containment reconnects them. Reach limits what one bad decision can touch. Identity says whose authority the tools carry. Stop conditions prevent persistence from becoming damage. Rollback preserves a way home. The run record lets a person reconstruct work they did not watch.

Greater autonomy does not remove responsibility. It increases the distance across which responsibility has to hold. The overnight run becomes trustworthy only when its boundaries remain awake after you go to sleep.
