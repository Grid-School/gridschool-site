# 19 · Contracts and trust boundaries

*Series: disciplines. Define HTTP and WebSocket contracts with OpenAPI, compare three authentication methods, and review five common security failures. About 13 minutes.*

## A contract is a promise another program can fail you on

An application programming interface, or API, defines how one program asks another for data or work. Its contract states the response shape and possible errors for each request. If an agent renames a response field, the code may still compile and tests using a matching mock may still pass while the mobile client fails in production. Write an OpenAPI document before the request handler. OpenAPI is a machine-readable description of requests, responses, and errors. Add a pipeline check that fails when the implementation differs from the document. The check must prevent an agent from silently breaking the contract.

## HTTP, WebSockets, and which facts travel on which

With HTTP, a client sends a request and the server sends one response. Representational State Transfer, or REST, organizes HTTP around resources with stable names, meaningful methods, standard status codes, and predictable response bodies. A WebSocket keeps a two-way connection open. World uses one because multiplayer updates must arrive without waiting for a new HTTP request. A WebSocket contract must define reconnection behavior, which users may send each message type, and how the server handles invalid data.

If a system uses both HTTP and WebSockets, its contract must assign each fact to one channel and one authoritative source. If both a socket and a REST cache claim authority over player position, users can observe conflicting positions.

## Compare three authentication methods

This week, learn what each authentication method protects and what risk or cost it introduces. Use that information to review an agent’s implementation and defend your choice.

A server session stores login state on the server and identifies it with a browser cookie. A JSON Web Token, or JWT, stores signed claims in a token the client carries. OAuth lets another provider confirm a user’s identity without giving your system the user’s password.

| Choice | What it protects | What it leaks or costs you |
|---|---|---|
| Server session and cookie | The server holds the truth about who is logged in, so revoking is a delete | You need a shared session store or sticky routing, and careless cookie handling can allow cross-site request forgery, or CSRF, in which another site causes the browser to send an unwanted request |
| JWT | The client carries a signed claim, so the API can be stateless and scale sideways | Revoking is hard, the token is the secret once issued, and an expiry you forget to set is a permanent key |
| OAuth | Another party vouches for who the user is and you never see the password | You now depend on that party, and scopes you did not read carefully will surprise you later |

Choose one method and justify it according to the API’s needs. A tutorial’s choice alone is not sufficient evidence.

## The five that keep shipping

The Open Worldwide Application Security Project, or OWASP, catalogs common security failures. Focus on five: untrusted input reaching an interpreter; missing authentication or authentication enforced only by the client; an access check that confirms login without checking permission for a specific record; debug or default configuration left enabled; and a secret committed to the repository or bundled into the client. During review, ask where untrusted input enters and who may perform each action.

Store secrets only in the server environment. Treat committed files and every value sent to the browser as public.

## The toy contract for this reading

Write the OpenAPI document for this items API before creating a handler. Use the shop from the earlier readings. The menu-project contract comes later, after you choose and specify that project.

| Method | Path | Request | 200 body | Errors |
|---|---|---|---|---|
| GET | `/items` | none | `{ "items": [Item] }` | 500 |
| POST | `/items` | `{ "name": string }` | `Item` | 400, 500 |
| GET | `/items/{id}` | path `id` | `Item` | 404, 500 |

`Item` is `{ "id": integer, "name": string, "sku": string }`. `sku` is assigned by the server. A 400 names the field that failed. A 404 is `{ "error": "not_found" }`.

A **drift check** detects a difference between a contract and an implementation. Write a script that loads the OpenAPI file and an example response, then fails if `sku` is missing or renamed. Create a stub handler or example response that matches the contract and run the check successfully. Rename `sku` to `code` only in the stub, run the check again, and confirm that it fails.

## Do this now (50 minutes)

Write the contract before the handler. Add the drift check and prove that it fails after one field is renamed. Then write one paragraph naming the authentication method you would use for the items API, what it protects, and what risk or cost it introduces.

When you later own a system, write its contract before its implementation and include a command that can fail. Use only the items API for this assignment.

## Done when

you have pasted the items API contract, pasted the drift command and its failing output after renaming `sku`, and written one paragraph that names the authentication choice, what it protects, and one cost or exposure.

## What's next

20 · CI/CD and where to host: a pipeline already written for you, and a host decision for a starter URL.
