# 21 · Observability and incidents

*Series: disciplines. Logs, metrics, and traces as three different questions, alerting and SLOs as promises with a budget, and the postmortem as an artifact every project is required to carry. ~12 minutes.*

## A live system you cannot see has not finished shipping

The world's first inherited ticket is a health endpoint that reports the server dead whenever nobody is playing, which meant that for months the process was restarted every quiet night by a health check that believed it. Nobody noticed because nobody was looking, and that is the whole argument for observability in one incident: a system that is live and silent is a system you will learn about from a user or from a restart loop in a log nobody reads. Instrumentation is how you learn about it first, and the reason this reading treats an incident as a required artifact rather than a misfortune is that an engineer who has never watched their own system fail has not yet verified it.

## Three signals, three questions

Logs answer what happened and in what order, with whatever context you thought to attach, and when they are the only signal you have you end up with a wall of text that nobody reads and, often, personal data you should never have written down. Metrics answer how much, how often, and how slow, and when they are the only signal a green average will hide a red tail until a user finds it. Traces answer what happened to this one request as it crossed the boxes from reading 15, and when they are your only signal you discover that you traced the happy path and nothing else. The three are not redundant. A latency metric tells you something is slow, a trace tells you which hop, and a log line at that hop tells you why, and a project that has one of the three is answering one question out of three.

## Alerts, SLOs, and who is woken up

An alert is the sentence "wake a human when this is true," and its two failure modes are an alert with no owner, which is noise, and an alert that fires on every deploy, which is noise that has trained everyone to ignore it. A service level objective is the number you have promised, availability or latency at a percentile, together with the error budget you are allowed to burn before you stop shipping features and spend the time on reliability instead. For a student project the SLO can be one sentence and the budget can be a paragraph, but writing them down is what turns "it is usually up" into a claim that can be checked.

## Incidents when the team is you

When it breaks, one person owns the clock, one person changes things, and one person writes the timeline, and when the team is a single student the discipline is to write the timeline first anyway, because reverting is a change and a change made without a timestamp is how an incident becomes folklore instead of evidence. The postmortem that follows is not an apology. It records what you believed was happening, what the signals show was actually happening, what you changed, and the check you added so that this class of failure cannot hide again. Blameless means you describe the system and not the person. It does not mean nothing changes.

The kit's `INCIDENT.md` has a table for the timeline with a column for what you thought and a column for what the signals showed, and the gap between those two columns is the most instructive thing you will write this month.

## The first incident is assigned

Every project on this program carries an incident report, and if the system has not failed on its own yet you break it on purpose: kill the process, let a certificate expire in a test environment, send a malformed payload, unplug a dependency the code assumes is there. Then write the report from the logs and metrics rather than from memory, because the exercise is not the breaking, it is discovering whether your instrumentation could have told you what happened if you had not already known.

## Do this now (50 minutes)

Instrument the project with at least one log line on the request path, one metric you would actually look at tomorrow, and one way to see that the process is alive. Break it on purpose and watch the signals. Then write `INCIDENT.md` from the kit: timeline with timestamps drawn from the signals, root cause stated as a condition rather than a last change, the fix, and a regression check that would fail if the break came back.

## Done when

The incident file has a timestamped timeline that came from logs or metrics, and the regression check has been seen to fail with the break reintroduced and pass with it fixed.

## What's next

22 · Engineering principles as a suspicion vocabulary: the words you need to review an agent's pull request by name.
