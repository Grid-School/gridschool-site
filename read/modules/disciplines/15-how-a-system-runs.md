# 15 · How a system runs, end to end

*Where code runs, what a request costs, and how to map the machines in an existing system. About 10 minutes.*

## Follow the tap

A player taps Move. Julia Evans's HTTP writing is the right way to watch what happens next. The browser, or the game client, sends a request: a method, a path, some headers, and maybe a body. Something answers with a status code, more headers, and a body. Caching, cookies, and a lot of security are those headers. If you can read the request and the response, the path stops being magic.

In **GridGlade**, the shared multiplayer game used as the example here, the first hop is a file. **CloudFront**, a content delivery network, or CDN, serves the Unity WebGL client, a Unity game built to run in a browser, from a machine near the player. A CDN stores a previous answer so the next player does not wait on the origin. The client then opens a WebSocket. That is still HTTP at the start, upgraded to a long-lived connection. A movement intent leaves the device as a frame.

The frame crosses a network and reaches a rented machine. **Lightsail** runs the GridGlade server. The server may ask another machine for data before answering. GridGlade has no database, so this hop stops at process memory. Restart the server and every player disappears. Include the missing database in the map, because a useful system map records missing parts as well as existing machines.

The player experiences one tap. You must account for each hop. Each hop adds waiting time, cost, and a possible failure. You need to name the machines before you can specify or verify a change and choose the technology that runs them.

An application programming interface, or API, is the same conversation with names attached: how one program asks another for data or work, and which status codes mean success, absence, or a forbidden action.

## Four places where code runs

Code on the client runs on the user's machine, so the user supplies the computing power and can inspect or change the data. Put rendering and responsive interaction on the client. Keep authoritative rules, such as whether money changed hands, on the server. The line between a component that proposes a fact and the component allowed to decide that fact is an **authority boundary**. GridGlade currently crosses that boundary incorrectly by accepting every position reported by a client.

Code at the edge runs on a CDN or on a worker near the user. Edge code is fast and inexpensive, but it sees only the current request and cached data. A cache stores a previous answer for reuse. Use edge code to serve a file or check a token. Keep authoritative facts, such as who owns an item, on the server.

Code on the server costs money by the hour or by the request. Server code can access the database, secrets, and other services, so every authoritative decision must reach the server. Batch code runs server work later through a scheduled job or a program that consumes queued tasks. Because batch work finishes after the original request, you must check that it actually completed.

The live GridGlade game at `play.gridschool.org` is small enough to show the full path. CloudFront serves the Unity WebGL client. A WebSocket server runs on an Amazon Lightsail machine. The system has no database, so restarting the server process removes every player from memory.

## Cost, latency, and the question of what breaks first

The user supplies client computing power, while you pay for server computing power. Latency is the time a user waits while data crosses the arrows. A cache returns a stored answer faster than the system can produce a current answer, so using a cache requires deciding how old each fact may be. A player's display name may tolerate old data, while a gold balance may not. Load describes the work created as the number of users grows. When ten players become one hundred, likely bottlenecks include the connection table in one process, a shared file, a slow database query, or a host sized only for a demonstration. The programming language is rarely the first bottleneck.

Your map is incomplete until it predicts which part will fail first with ten times as many users. A request-path drawing alone describes only normal operation.

## One tap contains the whole system

The path began with a player pressing a button. Following that tap exposed the client, the edge, the connection, the server, the missing database, the authority boundary, the latency, and the bill. Architecture becomes much less abstract when every box has to explain one moment a user can feel.

That habit scales. Follow a request until you can name where code runs, where truth lives, which hop can fail, and what each machine costs. Then ask the same questions while the server sends its response or state update back to the client.

A system is not the repository alone. It is the repository in motion across devices, networks, processes, and time. Understanding how it runs means being able to follow that motion without losing the user who started it.
