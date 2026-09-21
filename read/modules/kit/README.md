# Project templates

These templates open inside GridSchool. Leave them empty during the foundation readings. After you choose from the project menu, use the templates to model and ship the system you own.

A complete project includes a live system, an incident report, and a real user, real data, or a real partner. Build original work; tutorial copies and copies of another student’s project are prohibited.

Use the provided templates for every project.

| File | What it is for | When you fill it |
|---|---|---|
| `SPEC.md` | Intent, acceptance rows, failure modes, and the honest limit a demo would hide | When you model the system |
| `VERIFY.md` | Properties, contract checks, evals, and how a stranger re-runs the suite | When you ship |
| `AGENT-LOG.md` | What you kept, what the model decided, branches, review-lead time, reverts | Every run that used an agent |
| `LIVE.md` | The deployed URL, the uptime source, and who the outside party is | When you ship |
| `INCIDENT.md` | Timeline, root cause, fix, regression check, what you still cannot see | When users exist, and for the outcome you will defend |
| `DECISION.md` | Context, the choice, rejected alternatives, consequences, the unit you watch | When you model the system |
| `DEMO.md` | A three-to-six minute video: spec, verification, the number that moved | When you show the work |
| `STACK-ADR.md` | The same decision, shaped as language, framework, store, and host | When you choose the stack |
| `README-shape.md` | What a stranger sees first on the repo: what it is, how to run, how to verify, what it cannot do | The repo root |

Complete the required “What this cannot do” section in `SPEC.md`. A valid check must be able to fail. A complete specification must state the system’s limit.
