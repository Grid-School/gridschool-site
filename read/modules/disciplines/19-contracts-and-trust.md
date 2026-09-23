# 19 · Contracts and trust boundaries

*HTTP and WebSocket contracts, three ways to authenticate, and five common security failures. About 11 minutes.*

## The field that vanished

A mobile client asks `GET /items/1` and expects `{ "id": 1, "name": "red mug", "sku": "MUG-1" }`. An agent renames `sku` to `code` on the server. The server still compiles. Tests that talk to a matching mock still pass. Production users see a blank SKU. Martin Fowler's name for the missing check is a contract test: a test that the other side still means what you thought it meant. Ian Robinson's consumer-driven version lets the caller write the expectation and the provider run it.

An application programming interface, or API, defines how one program asks another for data or work. Its contract states the response shape and possible errors for each request. Write an **OpenAPI** document before the request handler. OpenAPI is a machine-readable description of requests, responses, and errors. Add a pipeline check that fails when the implementation differs from the document. The check must prevent an agent from silently breaking the contract.

## HTTP, WebSockets, and which facts travel on which

With HTTP, a client sends a request and the server sends one response. Representational State Transfer, or REST, organizes HTTP around resources with stable names, meaningful methods, standard status codes, and predictable response bodies. A WebSocket keeps a two-way connection open. **GridGlade**, the shared multiplayer game used as the example here, has a Unity WebGL client served through a content delivery network and a WebSocket server on a rented virtual machine. It has no database. GridGlade uses a WebSocket because multiplayer updates must arrive without waiting for a new HTTP request. A WebSocket contract must define reconnection behavior, which users may send each message type, and how the server handles invalid data.

If a system uses both HTTP and WebSockets, its contract must assign each fact to one channel and one authoritative source. A REST cache is a client-side copy of an HTTP response kept for faster reuse. If both a WebSocket message and that cached response claim authority over player position, users can observe conflicting positions.

## Compare three authentication methods

Learn what each authentication method protects and what risk or cost it introduces. Use that comparison when you review an implementation or defend a choice.

A server session stores login state on the server and identifies it with a browser cookie. A JSON Web Token, or **JWT**, stores signed claims in a token the client carries. OAuth lets another provider confirm a user's identity without giving your system the user's password.

A server session and cookie keep the truth about who is logged in on the server, so revoking is a delete. You need a shared session store or sticky routing, and careless cookie handling can allow cross-site request forgery, or CSRF, in which another site causes the browser to send an unwanted request.

A JWT lets the API stay stateless and scale sideways because the client carries a signed claim. Revoking is hard, the token is the secret once issued, and an expiry you forget to set is a permanent key.

OAuth means another party vouches for who the user is and you never see the password. You now depend on that party, and scopes you did not read carefully will surprise you later.

A choice copied from a tutorial still needs a reason tied to the API's needs. JWT and OpenAPI are two ways of writing a promise. The test is whether the other side still means it.

## The five that keep shipping

The Open Worldwide Application Security Project, or OWASP, catalogs common security failures. Focus on five: untrusted input reaching an interpreter; missing authentication or authentication enforced only by the client; an access check that confirms login without checking permission for a specific record; debug or default configuration left enabled; and a secret committed to the repository or bundled into the client. Ask where untrusted input enters and who may perform each action.

Store secrets only in the server environment. Treat committed files and every value sent to the browser as public.

## A worked items contract

The small items API that broke the mobile client needed these locks before anyone wrote a handler.

`GET /items` returns `{ "items": [Item] }` and may return 500. `POST /items` accepts `{ "name": string }`, returns an `Item`, and may return 400 or 500. `GET /items/{id}` returns one `Item` and may return 404 or 500.

`Item` is `{ "id": integer, "name": string, "sku": string }`. `sku` is assigned by the server. A 400 names the field that failed. A 404 is `{ "error": "not_found" }`.

A drift check detects a difference between a contract and an implementation. One form of the check loads the OpenAPI document and an example response, then fails if `sku` is missing or renamed. Against a matching example the check passes. If `sku` is renamed to `code` only in the example, the same check fails. That failure is the point of the check: a renamed field becomes visible before a client sees it in production.

## Trust lives at the boundary

Two programs do not share intentions. They share messages. The contract is the part of the relationship both sides can inspect: this request means this, this response has this shape, this identity may perform this action.

OpenAPI records the shape. Contract tests keep the provider and consumer from drifting apart. Sessions, JWTs, and OAuth carry different claims about identity. Server-side authorization decides whether those claims are enough for the requested record.

The boundary becomes trustworthy when neither side has to guess and neither side is believed beyond what the contract allows. A small field rename and a forged position message are versions of the same failure. In the second case, a modified client sends coordinates that the server accepts without validation. In both cases, one system accepted a meaning the other system never safely promised.
