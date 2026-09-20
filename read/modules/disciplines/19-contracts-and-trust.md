# 19 · Contracts and trust boundaries

*Series: disciplines. HTTP and WebSockets, contract-first with OpenAPI, sessions against JWTs against OAuth at the level of what each leaks, and the five OWASP mistakes that keep shipping. ~13 minutes.*

## A contract is a promise another program can fail you on

An API is not a list of URLs. It is a promise that, given this request, the caller gets this shape or this error and nothing else, and the reason that promise matters more now than it did five years ago is that agents break it constantly without anyone noticing. Rename a response field and the code still compiles, the tests that mock the response still pass, and the mobile client that reads the old name finds out in production. The only honest defense is a contract the pipeline can fail, which means writing the OpenAPI document before the handler exists and adding a check that goes red when the implementation drifts from it. The verification conversation this series grew out of put the rule bluntly: the agent must not be able to break the contract. On this node that sentence is the grade.

## HTTP, WebSockets, and which facts travel on which

HTTP is request and response. The client asks, the server answers, and the conversation is over, which is why REST as a style works: resources with stable names, verbs that mean what they say, status codes a stranger can interpret, and payloads that do not surprise the next caller. A WebSocket is a pipe that stays open, and the world uses one because a multiplayer tick cannot wait for the next request to arrive. A pipe that stays open is also a pipe that dies in the middle of a sentence, so a socket contract has to say what happens on reconnect, who is allowed to send which message types, and what the server does when the payload is garbage.

If your project exposes both, the contract has to say which facts travel on which channel. A system where "the socket is the source of truth for position" and "the REST cache is the source of truth for position" are both true has two worlds, and players will find the seam between them before you do.

## Sessions, JWTs, and OAuth, at the level that matters

You do not need a tutorial on any of these this week. You need to be able to say what each one protects and what each one leaks, because that is the level at which you will review an agent's implementation and defend your choice.

| Choice | What it protects | What it leaks or costs you |
|---|---|---|
| Server session and cookie | The server holds the truth about who is logged in, so revoking is a delete | You need a shared session store or sticky routing, and you inherit CSRF if you are careless with the cookie |
| JWT | The client carries a signed claim, so the API can be stateless and scale sideways | Revoking is hard, the token is the secret once issued, and an expiry you forget to set is a permanent key |
| OAuth | Another party vouches for who the user is and you never see the password | You now depend on that party, and scopes you did not read carefully will surprise you later |

Pick one and write down why. "We used JWT because the tutorial did" is the sentence the review is listening for, and it fails.

## The five that keep shipping

The OWASP list is long and you do not need all of it this week. Five items account for most of what an agent will hand you: untrusted input reaching an interpreter, which is injection in all its forms; an authentication check that is missing or lives on the client; an access check that confirms the user is logged in and never asks whether they may read this particular record; a configuration left in its debug or default state; and a secret committed to the repository or bundled into the client where anyone can read it. When you review a pull request the two questions that catch most of these are where untrusted input enters and who is allowed to do this, and once those are habits the rest of the list is a reference rather than a curriculum.

Secrets live in the environment, not in files you commit. If the browser can see it, it is not a secret, whatever the variable is called.

## Do this now (50 minutes)

Write the OpenAPI contract for your menu project before any handler exists, with paths, methods, request and response shapes, and the error codes each path can return. Add a command to the project's pipeline, or a script you will put in the pipeline, that fails when the implementation does not match the contract, and prove it by renaming one field and watching it go red. Then write one paragraph naming the auth choice, what it protects, and what it leaks.

## Done when

The contract file exists, the drift command has been seen to fail on a renamed field, and the auth paragraph names a leak rather than a feature.

## What's next

20 · CI/CD and where to host: a pipeline you can explain, and a host you can defend.
