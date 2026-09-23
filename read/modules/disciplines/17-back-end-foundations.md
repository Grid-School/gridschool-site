# 17 · Back-end foundations, framework-agnostic

*One request lifecycle, followed through .NET, Spring, Express, FastAPI, and Rails. About 11 minutes.*

## The other end of the packet

After the front end, the client program running in a browser or game, sends a request, a server program decides what the request may do. A request arrives with a method, a path, and headers. The server finds the **handler** assigned to that path, runs **middleware** that many requests share, validates the input, reads or changes data, schedules any work that should happen later, and sends a response with a status code. Mature server frameworks implement this sequence under different names. Once you can trace the sequence through an unfamiliar system, you can transfer that skill to another framework.

## One game message, walked once

**GridGlade** is the shared multiplayer game used as the example here. CloudFront, a content delivery network, serves its Unity WebGL client. Its WebSocket server runs on Lightsail, a small virtual-server service. The game has no database. The message we are tracing leaves the game client, crosses the network, and lands on the server process.

The GridGlade server uses WebSockets for gameplay, and the same request lifecycle still applies. Accepting a WebSocket routes the connection to a handler. The server decodes each incoming message by type and runs the matching handler. Middleware, if any, would run around that handler: authentication, logging, a size limit. GridGlade has no validation step for player position, so the server stores any position sent by the client. Updating in-memory state is the data-access step because GridGlade has no database. Broadcasting the new position to other clients is the response. The missing validation step is the interesting row: a client can report a false position and the server will keep it. The status of that conversation is implicit in the socket staying open. An HTTP version of the same mistake would be a 200 that stored a lie.

## One shape in five dialects

If an agent gives you a Spring controller after you have worked only with Express, you still need to find the same stages in the request lifecycle: routing, middleware, handling, validation, data access, optional background work, and the response. An object-relational mapper, or ORM, converts between database rows and program objects. Structured Query Language, or SQL, is the language used to query a relational database.

Routing: .NET uses an endpoint or controller; Spring uses `@RequestMapping`; Express uses `app.get`; FastAPI and Django use a path operation or urlconf; Rails uses routes plus a controller.

Middleware: .NET uses a filter or middleware; Spring uses a filter or interceptor; Express uses middleware; FastAPI uses a dependency or middleware; Rails uses rack or `before_action`.

Dependency injection: .NET has a dependency-injection container; Spring uses `@Autowired`; Express expects you to pass the dependency in; FastAPI uses `Depends()`; Rails connects many parts implicitly, which is its own lesson.

Validation: .NET uses data annotations or Fluent; Spring uses Bean Validation; Express often uses a schema such as zod; FastAPI uses pydantic; Rails uses strong params plus validations.

Data: .NET uses EF or Dapper; Spring uses JPA or JDBC; Express uses any client; FastAPI and Django use an ORM or SQL; Rails uses ActiveRecord.

Jobs: .NET uses a hosted service or Hangfire; Spring uses `@Scheduled` or a queue; Express uses a worker process; FastAPI often uses Celery or rq; Rails uses ActiveJob.

Rows with no direct counterpart often reveal the most. Express expects you to pass dependencies directly and provides no built-in dependency-injection system. Rails connects many parts implicitly, so a newcomer must learn where each value comes from. Treat these as framework behavior you need to locate.

## ORMs, SQL, and work that should not block the answer

An ORM can hide a database join that you need to inspect. Raw SQL exposes the query but can duplicate object mapping across several call sites. Choose based on the query in front of you, and switch approaches when the hidden cost becomes a problem. **Coupling** is how often one module must change because another module changed; the term helps you describe that cost precisely.

A background job performs work after the server sends its response. Sending email, generating a thumbnail, or notifying another service inside the request handler makes the user wait and lets those operations delay or fail the response. Record in the change specification whether slow work runs inside the request handler or in a background job.

## Every framework is answering the request

.NET, Spring, Express, FastAPI, and Rails arrange the lifecycle differently, but the server still owes the client the same account. Which code received the request? Which shared rules ran around it? Who checked the input? Where did state change? What response crossed the boundary?

Framework magic is simply part of that path you have not named yet. Once you can trace the request, implicit injection and hidden ORM calls become ordinary decisions with costs and failure modes.

Back-end understanding is less about memorising each framework's nouns than about refusing to lose the packet. Follow it from the boundary to the authoritative state and back, and the dialect becomes learnable.
