# 01 · System comprehension

*How to enter software you did not write and come out with a model that predicts its behaviour. About 11 minutes.*

## You cannot read it like a book

When an engineer joins a system, the instinct is to open the editor and start changing things, because changing things feels like progress and reading feels like delay. A large codebase will not yield to that instinct. Nobody holds the whole thing in their head, including the people who wrote it. They have a map: the shape of the system, where things live, and how the important paths flow.

Researchers who watched professionals work on unfamiliar code found the same habit. People spent their time seeking, learning, and checking facts such as “this function has side effects.” Experts did not read more methods than beginners. They collected the facts that constrained the next change and skipped the rest. Academic writing called the skill program comprehension. The job is the same: **system comprehension**, a model of what exists that can predict what the system will do.

Your first artifact in an unfamiliar system is that model: a description of what exists, where authority lives, how **state** moves, and what must stay true. Code comes after the model, because a change made without one is a guess with a commit message.

An assistant can fake this skill more convincingly than most. Ask a model to explain a codebase and it will produce a fluent, confident, structured explanation in a few seconds. The explanation will mix accurate claims with unsupported ones. Until you verify those claims, neither you nor the person reading your pull request can tell which parts are reliable.

## Run it, then follow one tap

The faster path is the one the running system already knows. Clone the repository, get it running, and use the product. Open the app, connect, and watch one action happen. You cannot understand code you have never seen do anything. The running app gives you real behaviour to attach the code to later.

Then pick one action and follow it all the way through. **GridGlade**, the shared multiplayer game used as the example here, gives us a player moving. CloudFront, a content delivery network, serves its Unity WebGL client. A movement intent leaves the browser as a WebSocket frame. A process on Lightsail, a small virtual-server service, receives it. GridGlade has no database, so the server holds position in memory. Restart the process and every player disappears. The server currently accepts the position the client reports, which means the client is the authority for that piece of state. That is a known trust-boundary defect because a user controls the client.

Following that one path teaches the layers in the order they actually connect: the screen, the message, the handler, the state, the broadcast back to other clients. Reading fifty files across the repository teaches fifty disconnected facts. Tracing one feature teaches the project's conventions.

Along the path, write down what you can confirm. Which processes exist. Which process may change each piece of state. What survives a restart. What happens, in order, when the player taps. What crosses the wire, and in which format. What must stay true. Where the path breaks if the client lies or the server dies mid-message. Who may do what. How code reaches the host. How you would know what happened. You will not have every answer on day one. Say which ones you do not have.

A generic multiplayer game with persistence and plots would add more boxes: a gateway that authenticates, a game session that owns the tick, and a store that keeps inventory across restarts. GridGlade is smaller than that picture. Include the missing database in the map, because a useful model records missing parts as well as existing machines.

## The test that separates a model from a summary

Once you have a model, check it against reality with **counterfactuals**: questions the system's behaviour will answer whether or not your model does.

Start with questions GridGlade can answer now. Where is the authority over a player's position, and what happens if the client lies? What disappears when the server process restarts? Then label richer examples as hypothetical: if a future game added plots and inventory, what would happen if two players claimed the same plot in one tick, or if the server died halfway through an inventory transaction?

Write your answer before you look. Then look. Where you were wrong, your model was wrong, and you have found the exact place to read more carefully. Where you were right, you have earned the confidence you now have. A summary describes what you already saw. A model predicts what will happen next, which is why it can be checked.

## When the documentation thins out

Some teams give a new engineer a documented system map. Others provide only the code, logs, a bug report, and commit history. Comprehension matters most when the system in front of you does not explain itself.

When documentation is thin, three habits help. Read the entry points first: where a request enters, where the tick starts, then one path end to end before anything else. For each piece of state you meet, write down which process may change it; most real bugs are two processes that both think they own something. Record confidence with every claim. “The server stores position in memory: confirmed in the handler.” “The server validates reported coordinates: uncertain, have not found the check.” A model with honest confidence is worth more than a longer one without.

## Where the assistant belongs

Draw the paper map before you ask an assistant to explain the system. A fluent summary of code you have not read can create confidence without understanding, and you may act on that confidence. Once the map exists, ask the assistant to list the files that touch a symbol, to summarise a module you have already skimmed, or to propose invariants for you to check. Treat its explanation as a hypothesis you still need to test. “The assistant said so” is a weak answer to “how do you know?” because nobody was in control.

The assistant can help you cross the ground faster. It cannot decide which ground is solid. That distinction matters because a useful system model is allowed to be incomplete and required to be honest. It marks the claims you checked, the guesses you still carry, and the questions that would prove it wrong.

Comprehension is finished for a change when your model can survive a prediction. You know where the behaviour enters, where the important state lives, what must remain true, and where the next surprise is likely to come from. You still do not know the whole codebase. You know enough of the right facts to change it without pretending.
