# 18 · Data: what you keep and how it moves

*Series: disciplines. Relational, document, and key-value stores as answers to one question, migrations as writes you can undo, and why "eventual" is a sentence and not a mood. ~12 minutes.*

## The question under the database question

People argue about which database to use as though it were a matter of taste, and it becomes much simpler when you notice that every store is an answer to the same two questions: what must still be true after a write, and who else needs to read it. A relational database is the right answer when rows have relationships you will actually query and when several of them have to change together or not at all, which is what a transaction buys you and what you pay for in schema work and joins you must understand. A document store is right when the record really is a blob you load and save whole, and it charges you the moment you need to ask a question across many blobs or change the shape of all of them. A key-value store is right when you have a key and want the value quickly, and it charges you by removing the ability to search, so that any query you later need has to be built as a second index somewhere else.

SQLite is enough for a first project and this program already uses it in the graph track. Postgres is the default once the system leaves your laptop and more than one process wants to write. A hosted document store is fine when the record is genuinely a document. "We used NoSQL because it is modern" is not a reason, and the review will ask for one.

## The write you can take back

A migration is a program that changes the shape of stored data, and the most important line in it is the one that puts the shape back. Without a rollback a migration is a one-way door, and one-way doors get walked through at eleven at night by someone who has just discovered that the deploy was wrong. The minimum you owe a migration is a statement of what the schema is now, what it becomes, how the rows that already exist survive the change, how you would reverse it if the deploy is bad, and a check that a row you care about is still there after both directions have run. The check is the part people skip, and it is the part that turns a hopeful migration into a verified one.

Take the world, which today has no database at all. The first persistent fact anyone adds will probably be a player's position or name, and the first migration is the one that creates that table. The second migration, the one that adds a column or renames one, is where the rollback plan earns its keep, because by then there are real rows in the table and "drop and recreate" is no longer free. Writing the second migration's rollback before the first one ships is the habit this reading is asking for.

## Idempotency, discovered rather than defined

A server can send a write without learning whether it landed, because sending the request and receiving the response are separate events and the connection can fail between them. Once you see that, a retry stops being a harmless reflex, because repeating the write is only safe when the write is safe to repeat, and "create a user" or "charge this card" or "apply this migration" are not. That is where idempotency comes from: not a vocabulary word but the property that running the same write twice leaves one truth rather than two, and the practical rule that if you cannot say what happens on a retry you have not finished specifying the write.

## Why "eventual" exists

Two machines cannot agree on a fact instantly without paying for it, either with a lock, a single writer, or a transaction that both must complete. Sometimes you pay that price because the fact is money. Sometimes you decide that replica B may lag replica A by a second, and you design the read so that a second of staleness cannot invent gold or lose an order. Eventual consistency is therefore not a vibe about modern systems. It is a specific sentence about which reader is allowed to be wrong, about which fact, for how long, and a system that cannot state that sentence has not chosen eventual consistency; it has stumbled into it.

## Do this now (40 minutes)

Write one migration for the project you will ship, with the up, the down, and a check that a row you care about survived both directions. If the project is still a drawing, do it against a toy SQLite file with two related tables. The artifact the review reads is the rollback plan and the check, not the table definitions.

## Done when

The migration file exists at a public URL, you ran the rollback and not only the forward step, and the check passed in both directions or you wrote down why it cannot.

## What's next

19 · Contracts and trust: HTTP, WebSockets, OpenAPI, and what each auth choice leaks.
