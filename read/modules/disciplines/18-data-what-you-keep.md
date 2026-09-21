# 18 · Data: what you keep and how it moves

*Series: disciplines. Compare relational, document, and key-value stores, then write and reverse a data migration. About 12 minutes.*

## The question under the database question

Choose a database by asking what must remain true after a write and who needs to read the result. A relational database fits data with relationships you will query or records that must change together in a transaction. You pay for that guarantee by defining a schema and understanding joins. A document store fits a record that you load and save as a whole document. Questions across many documents and changes to every document become more expensive. A key-value store quickly retrieves a value from a known key, but it does not support general searches. Any later search requires a separate index.

SQLite is sufficient for a first project, and the graph track already uses it. PostgreSQL is the default after a system leaves your laptop and several processes need to write. A hosted document store is suitable when each record is genuinely a document. The review will ask you to justify the database according to the project’s data and access needs.

## The write you can take back

A **migration** is a program that changes the shape of stored data. A **rollback** reverses that migration. Before running a migration, state the current schema, the new schema, how existing rows survive, and how to reverse the change after a bad deployment. Add a check that confirms an important row still exists after the migration and after the rollback.

World currently has no database. Its first persistent fact may be a player’s position or name, and the first migration would create the corresponding table. A later migration might add or rename a column after the table contains real rows. At that point, dropping and recreating the table would lose data. Write the rollback for a future migration before shipping it. Practice that sequence on the provided toy database. You will design a project schema after choosing a project.

## Idempotency begins with retries

A connection can fail after a server writes data but before the client receives the response. The client may then retry without knowing whether the first write succeeded. **Idempotency** means repeating the same operation leaves the same result as running it once. Operations such as creating a user, charging a card, or applying a migration need an explicit retry design. A write specification is incomplete until it explains what happens after a retry.

## Why "eventual" exists

Two machines need a lock, a single writer, or a shared transaction to agree on a fact immediately. That coordination has a cost. For money, the cost may be necessary. For other data, one replica may be allowed to lag another by one second. **Eventual consistency** allows readers to see older data for a defined period. State which reader may see an old value, which fact may be old, and for how long. Design the read so that the allowed delay cannot invent gold or lose an order.

## The toy file for this reading

Create a local SQLite file named `toy-shop.sqlite` and load the starting schema below. Use the toy shop from reading 15 for this exercise. You will create a separate schema for a menu project later.

```sql
CREATE TABLE items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE stock (
  item_id INTEGER NOT NULL REFERENCES items(id),
  qty INTEGER NOT NULL
);

INSERT INTO items (id, name) VALUES (1, 'red mug');
INSERT INTO stock (item_id, qty) VALUES (1, 4);
```

Write a migration that adds a `sku` column to `items`. Backfill the existing row so the record with `id = 1` keeps its name and gains a SKU. Include a down migration that restores the original table. After the up migration and again after the down migration, run a check that finds a row with `id = 1` and the name `red mug`.

## Do this now (40 minutes)

Write the up migration, down migration, and verification check for `toy-shop.sqlite`. Run the up migration and confirm the mug still exists with a SKU. Run the rollback and confirm the mug still exists in the restored two-column `items` table. Paste the migrations and check output into the task field.

Use the supplied toy database and mug row for this assignment. You will design a project schema later.

## Done when

you have pasted the up migration, down migration, and check output into the first field; the check proves the red mug row survived both directions after `sku` was added; and the retry field explains what happens when the write runs twice.

## What's next

19 · Contracts and trust: a tiny items API written before any handler, and a command that notices a rename.
