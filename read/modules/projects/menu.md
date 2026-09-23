# Project menu

Choose **one** project to start. You may begin another after the first project has a live URL, an incident report, and a demo video. Every project must eventually produce work you can release into the live world or explain during a live defense.

Choose from the eight projects below.

## Constraints (locked)

1. A stranger can understand the project’s display within five seconds. Use moving three-dimensional graphics when they suit the subject.
2. Every project uses a real user, real data, or a real partner. Tutorial copies and copies of another student’s work are prohibited.
3. At least one project must include revenue or a cost model. You will ship one of those projects before the intensive ends or during the next phase.
4. Use the project templates throughout the work. A project is incomplete until it has a live URL and an incident report.
5. Choose a project you will be glad to send to another person. Every menu project should be worth posting.

Use three-dimensional graphics when they suit the subject. The world already runs Unity WebGL, and the GridSchool site already includes three.js. Reviewers grade the specification, verification, incident report, and measured result.

## The eight

OpenTelemetry is a standard for recording traces, which follow a request through a system. Each timed operation in a trace is a **span**. **p95 latency** is the response time that 95 percent of measured requests meet or beat. The transit project can use three kinds of public live-location feed: General Transit Feed Specification Realtime, or GTFS-realtime, for public transit; Automatic Dependent Surveillance-Broadcast, or ADS-B, for aircraft; and Automatic Identification System, or AIS, for ships.

### 1. Trace city

**Five-second visual:** Your own system’s services appear as buildings in a 3D city. Each real request is a light travelling between them; slow spans stretch the road, and errors make a building flash.

**Real data, user, or partner:** Real OpenTelemetry traces from the world server or from your other menu project. You may also use a partner’s staging traces if they will provide them.

**Measurement you own:** The p95 latency of one request path, watched live.

**First expected incident:** Trace ingestion falls behind, and the city shows past activity as if it were current.

**Cost model:** Ingest and storage per million spans.

**Later use:** Instruments the world and supplies two minutes for the defense section about your tools.

**Evidence:** Comprehension and verification.

### 2. Match replay theater

**Five-second visual:** A shareable link replays a real multiplayer session in 3D with a timeline scrubber, a heatmap of where players walked, and the moment someone got stuck.

**Real data, user, or partner:** Real players in the world. Every session is data.

**Measurement you own:** First-session drop-off inside three minutes, measured before and after a change you shipped.

**First expected incident:** The replay falls out of sync with the server record, and you have to prove which one is wrong.

**Cost model:** Storage per session hour and the retention policy.

**Later use:** Turns evidence into GridGlade tickets and supports a later outcome claim.

**Evidence:** Deciding what to build and owning the number.

### 3. Internet weather globe

**Five-second visual:** A 3D globe shows public services and application programming interfaces, or APIs, as points. Latency controls their colour, and an outage ripples outward as probes detect it.

**Real data, user, or partner:** Public status feeds, your own probes from two or more regions, and users who subscribe to a service.

**Measurement you own:** Time from a real outage to your alert, measured against the vendor’s own status page.

**First expected incident:** A probe region goes dark, and the globe reports that the whole internet is down.

**Cost model:** Probe compute per region per month and alert delivery.

**Later use:** Builds observability habits and provides one incident story a month for content.

**Evidence:** Verification and owning the outcome.

### 4. Living city (fault injection)

**Five-second visual:** A simulated company appears as a city. Kill a database replica, duplicate a payment message, or partition a service, then watch orders vanish in the streets.

**Real data, user, or partner:** Scenarios seeded from real incidents, including yours, the world’s, and public postmortems. Visitors can share “diagnose this incident before the agent does” links.

**Measurement you own:** How often a visitor diagnoses the incident correctly and how often the built-in agent investigator does.

**First expected incident:** The simulation falls out of sync under load, and the city reports false state.

**Cost model:** Simulation compute per concurrent session.

**Later use:** Supports later team contracts and gives every specification a vocabulary for failure modes.

**Evidence:** Comprehension and specification.

### 5. Codebase city

**Five-second visual:** Your graph tool renders any public repository as a walkable 3D city. Files become buildings, height represents load-bearing rank, and a blast radius ripples outward when you click a function.

**Real data, user, or partner:** Your graph tool runs on repositories submitted by strangers, with the world server as the demonstration repository.

**Measurement you own:** The time a newcomer needs to answer “what breaks if I change this” with the city and again using the repository alone.

**First expected incident:** Parsing fails on a language you did not plan for, and the city shows an empty lot where a module should be.

**Cost model:** Parse compute per repository and cache costs.

**Later use:** Creates the graph track’s fork and supplies two minutes for the defense section about your tools.

**Evidence:** Comprehension and verification.

### 6. Shared 3D sandbox with offline sync

**Five-second visual:** Many people move objects in one live 3D scene. Pull the network cable, continue editing, reconnect, and watch the edits merge.

**Real data, user, or partner:** Real collaborators, beginning with the cohort and later including strangers who open the shared link.

**Measurement you own:** Merge conflicts per hundred edits and reconnect time.

**First expected incident:** Two clients disagree about one object’s position, and the server has to choose the authoritative value.

**Cost model:** Bandwidth per active user and state storage.

**Later use:** Directly addresses the world’s synchronization and authority problems.

**Evidence:** Specification and verification.

### 7. Live transit or flight board in 3D

**Five-second visual:** Vehicles from a public real-time feed move over a 3D map. Delay predictions appear as trails, and users can subscribe to a route.

**Real data, user, or partner:** Public GTFS-realtime, ADS-B, or AIS feeds and users who subscribe to a route.

**Measurement you own:** Prediction error in minutes, tracked weekly.

**First expected incident:** The feed changes shape or goes silent, and the board continues showing yesterday’s vehicles.

**Cost model:** Ingest per feed and notification delivery.

**Later use:** Builds streaming and time-series habits for a later project.

**Evidence:** Owning the number and verification.

### 8. Agent arena with visible cost

**Five-second visual:** Agents solve one bounded task while touched files light up on a 3D graph, tests turn green or red, and a cost meter runs. Humans can challenge a reported success.

**Real data, user, or partner:** Begin with your own past tickets as tasks. Later, open-source maintainers submit bounded issues.

**Measurement you own:** Cost per accepted phase and the rate at which a human rejects solutions whose checks pass.

**First expected incident:** The harness marks a wrong solution as correct, and someone proves the error on the site.

**Cost model:** Tokens per task and sandbox compute.

**Later use:** Supports delegation and injected checks at scale and puts the verification thesis on camera.

**Evidence:** Verification and deciding what to build.

## Which constraints each one meets

| Constraint | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Five-second visual, 3D | yes | yes | yes | yes | yes | yes | yes | yes |
| Another party's data or users | partner traces | real players | public feeds, subscribers | public postmortems | submitted repos | collaborators | public feeds, subscribers | maintainers |
| Money or a cost model | ingest cost | storage cost | probe cost | compute cost | parse cost | bandwidth cost | ingest cost | tokens, the whole point |
| Feeds the world directly | yes | yes | no | yes | yes | yes | no | no |

## A first pick that already has live data

If you want real data on the first day, start with **Match replay theater** or **Trace city**. Both use the world, so each finding can become a ticket. If you finish early, **Agent arena** is a suitable second project because one artifact records both its cost model and its verification result. Living city, Codebase city, and the shared sandbox are better suited to a team or a later phase, when you have a subsystem to own and a version of the graph tool to render.

After you choose, write the stack decision described in reading 23.
