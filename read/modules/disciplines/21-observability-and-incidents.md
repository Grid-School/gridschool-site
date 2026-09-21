# 21 · Observability and incidents

*Series: disciplines. Use logs, metrics, and traces to investigate a supplied incident, then write its incident report. About 12 minutes.*

## Observability completes the live system

World’s first inherited ticket concerns a health endpoint that reports the server as dead whenever no players are connected. An automated health check restarted the process during quiet nights. **Observability** means collecting enough information to understand a running system’s behavior. Instrumentation produces that information so you can find a failure before a user reports it. This reading treats an incident report as required project evidence because observing a failure tests your understanding of the live system.

Use that ticket as the assigned incident. Base every statement in the report on the supplied signals.

## Three signals, three questions

Logs record events in order with attached context. Too many unstructured logs become difficult to read, and careless logs may expose personal data. Metrics measure amounts, frequency, and duration, but an average can hide slow requests. Traces follow one request across the machines from reading 15, but incomplete tracing may cover only successful requests. Use the three signals together: a latency metric shows that requests are slow, a trace locates the slow step, and a log at that step may explain the cause.

## Alerts, SLOs, and who is woken up

An **alert** tells a named person to respond when a condition becomes true. An alert with no owner or one that fires during every deployment becomes noise. A **service level objective**, or SLO, states a measurable availability or latency target. An **error budget** states how much failure the service may have before feature work pauses for reliability work. For a student project, write the SLO in one sentence and explain the error budget in one paragraph.

## Incidents when the team is you

During an incident, one role tracks time, one changes the system, and one records the timeline. When you fill all three roles, record timestamps before making changes, including a rollback. The postmortem records what you first believed, what the signals showed, what changed, and which check will expose the same failure in the future. A blameless report focuses on system conditions and still requires corrective action.

The `INCIDENT.md` timeline has separate columns for your belief at the time and the evidence from system signals. Use the difference between those columns to explain how the investigation changed your understanding.

## The assigned incident

`WebSocketHandler` sets `_isHealthy` from whether any sockets are connected. `/health` returns 503 whenever the world has zero players. The Docker health check curls `/health` every thirty seconds. In Development the same endpoint says OK, which is why a laptop run hides the lie. In Production an empty world looks dead, and the process is restarted all night. **Liveness** means that the server process is running and able to continue its work.

The packet below describes the staged incident. The timestamps show the restart loop and do not claim that you were on call that night.

| Time (UTC) | Signal | Value |
|---|---|---|
| 02:14:01 | docker healthcheck | `GET /health` → 503 |
| 02:14:02 | docker | restarting `world-server` |
| 02:14:18 | log | `[WebSocketHandler] Handler initialized.` |
| 02:14:19 | metric | `connected_sockets=0` |
| 02:14:20 | `/health` | 503 |
| 02:14:50 | docker healthcheck | `GET /health` → 503 |
| 02:14:51 | docker | restarting `world-server` |
| 09:02:11 | metric | `connected_sockets=1` |
| 09:02:12 | `/health` | 200 |
| 09:02:12 | metric | process uptime reset repeatedly from 02:14 until the first connection |

While players are connected, the averages appear healthy. Operations records show a nightly restart loop. The ticket first assumes the process is crashing, but the evidence shows a healthy empty server returning an unhealthy status.

## Do this now (50 minutes)

Open the incident template from the task. Complete its timeline, root-cause, and fix sections from the supplied signals. In the task fields, paste the timestamped timeline, the root cause stated as the condition that allowed the failure, and a regression check that fails if the defect returns. The check may use `curl` against an empty server and require a 200 response in Production mode.

Base the report on the supplied signals from World’s incorrect health endpoint. Leave your own running processes unchanged.

## Done when

the incident template names the fix, the timeline field uses timestamps from the supplied signals, the root-cause field explains that the server confused liveness with a connected player, and the regression-check field proves that an empty World in Production returns 200.

## What's next

22 · Engineering principles as a suspicion vocabulary: a provided agent pull request, reviewed by name.
