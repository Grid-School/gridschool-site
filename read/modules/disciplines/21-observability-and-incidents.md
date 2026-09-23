# 21 · Observability and incidents

*Logs, metrics, and traces, used to understand a failure and write it down. About 11 minutes.*

## The night the empty world looked dead

**GridGlade** is the shared multiplayer game used as the example here. A content delivery network serves its Unity WebGL client, and a small rented virtual machine runs its WebSocket server. The game has no database. At 02:14 UTC a Docker health check called `GET /health` and received 503. The process restarted. Eighteen seconds later the server's `WebSocketHandler` initialized, `connected_sockets` was still zero, and `/health` said 503 again. The loop ran until 09:02, when the first player connected and `/health` returned 200. The deployment logs show a nightly restart loop. The first guess is often that the process is crashing. The evidence shows a healthy empty server returning an unhealthy status.

Charity Majors's definition of **observability** is the power to ask a new question of a running system without shipping new code to gather new data. Monitoring is the known alarm: `/health` should be 200. Observability is being able to ask why an empty world looked dead. Instrumentation produces that information so you can find a failure before a user reports it. The night-restart loop is a case study in that gap: the process looked dead while it was only empty.

`WebSocketHandler` sets `_isHealthy` from whether any sockets are connected. `/health` returns 503 whenever the game has zero players. The Docker health check requests `/health` every thirty seconds. In the Development configuration, used on a developer's machine, the same endpoint says OK. In the Production configuration, used on the live server, an empty game looks dead and the process restarts all night. Liveness means that the server process is running and able to continue its work. A game with zero players can still be live.

## Three signals with different jobs

Logs record events in order with attached context. Too many unstructured logs become difficult to read, and careless logs may expose personal data. Metrics measure amounts, frequency, and duration, but an average can hide slow requests. Traces follow one request across the machines that handled it, but incomplete tracing may cover only successful requests. Use the three signals together: a latency metric shows that requests are slow, a trace locates the slow step, and a log at that step may explain the cause.

While players are connected, the averages appear healthy. The nightly loop lives in the timestamps: 02:14:01 health check 503, 02:14:02 restart, 02:14:18 handler initialized, 02:14:19 `connected_sockets=0`, 02:14:20 `/health` 503, and the same pair again at 02:14:50. At 09:02:11 a socket connects. At 09:02:12 `/health` is 200 and process uptime has been reset repeatedly since 02:14. These timestamps form a constructed incident example based on the health-check defect; they do not claim that you were on call that night.

## Alerts, SLOs, and who is woken up

An alert tells a named person to respond when a condition becomes true. An alert with no owner or one that fires during every deployment becomes noise. A **service level objective**, or **SLO**, states a measurable availability or latency target. An **error budget** is the amount of failure the target permits before feature work pauses for reliability work. The SLO is useful when it names a number another person could check. The error budget is useful when it says what work stops once that number is spent.

A health check that restarts an empty world spends the budget on a lie.

## Incidents when the team is you

Google's SRE postmortem culture assumes that everyone involved had good intentions and did the right thing with the information they had. The write-up names contributing causes. It does not name a person to blame. During an incident, one role tracks time, one changes the system, and one records the timeline. When you fill all three roles, record timestamps before making changes, including a rollback. The postmortem records what you first believed, what the signals showed, what changed, and which check will expose the same failure in the future. A blameless report focuses on system conditions and still requires corrective action.

A useful incident timeline keeps what you believed at the time in one column and the evidence from system signals in another. The difference between those columns is how the investigation changed your understanding. For the empty-world night, the first belief was a crash. The signals showed a 503 on zero sockets. The fix is a `/health` that reports liveness, and an SLO that does not treat an empty world as downtime.

The incident began because the system answered the question it was given: “Are any players connected?” Operations thought it had asked, “Can the server continue working?” Observability exposed the difference.

That is the deeper purpose of logs, metrics, traces, and postmortems. They let a team replace the first story with a better one while the evidence is still available. The system becomes easier to operate when it can explain its behaviour in terms a person can question, and the team becomes more reliable when it preserves what the surprise taught.
