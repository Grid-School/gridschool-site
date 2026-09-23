# 18 · Data: what you keep and how it moves

*How to choose a store, change its shape, and reverse the change. About 11 minutes.*

## The write you can take back

Pramod Sadalage and Martin Fowler's name for this work is evolutionary database design. You change the schema in small steps, you keep those steps in version control, and you migrate the rows you already stored. A database is part of the deploy. If the application ships and the schema does not, you have two systems that no longer mean the same thing.

A **migration** is a program that changes the shape of stored data. A rollback reverses that migration. Before running a migration, state the current schema, the new schema, how existing rows survive, and how to reverse the change after a bad deployment. Add a check that confirms an important row still exists after the migration and after the rollback.

**GridGlade** is the shared multiplayer game used as the example here. A content delivery network serves its Unity WebGL client, and a small rented virtual machine runs its WebSocket server. GridGlade currently has no database. Restart the process and every player disappears. The first persistent fact may be a player's position or name, and the first migration would create the corresponding table. A later migration might add or rename a column after the table contains real rows. At that point, dropping and recreating the table would lose data. Write the rollback for a future migration before shipping it. The absence of a store is why migration and rollback still matter. The day GridGlade keeps a fact across a restart, the first migration is the deploy.

## The question under the database question

Choose a database by asking what must remain true after a write and who needs to read the result. A relational database fits data with relationships you will query or records that must change together in a transaction. You pay for that guarantee by defining a schema and understanding joins. A document store fits a record that you load and save as a whole document. Questions across many documents and changes to every document become more expensive. A key-value store quickly retrieves a value from a known key, but it does not support general searches. Any later search requires a separate index.

SQLite is sufficient while one process on a laptop owns the file. PostgreSQL is the default after a system leaves that laptop and several processes need to write. A hosted document store is suitable when each record is genuinely a document. Justify the store from the data and the access pattern.

## Idempotency begins with retries

A connection can fail after a server writes data but before the client receives the response. The client may then retry without knowing whether the first write succeeded. **Idempotency** means repeating the same operation leaves the same result as running it once. Operations such as creating a user, charging a card, or applying a migration need an explicit retry design. A write specification is incomplete until it explains what happens after a retry. Without idempotency, one uncertain response can create two users, two charges, or two attempts to reshape the same data.

## Why "eventual" exists

Two machines need a lock, a single writer, or a shared transaction to agree on a fact immediately. That coordination has a cost. For money, the cost may be necessary. For other data, one replica may be allowed to lag another by a short period, for example one second (hypothetical). Eventual consistency allows readers to see older data for a defined period. State which reader may see an old value, which fact may be old, and for how long. Design the read so that the allowed delay cannot invent gold or lose an order.

## An example shop schema

The schema below is an example. It describes a tiny shop with items and stock. One row already exists: a red mug with four units on the shelf.

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

Suppose the shop later needs a stock-keeping unit, or SKU, on each item. A migration would add a `sku` column to `items` and fill the existing row so `id = 1` keeps the name `red mug` and gains a SKU. A rollback would restore the original two-column `items` table. After the up migration, and again after the rollback, a check would look for a row with `id = 1` and the name `red mug`. That surviving row is how you know the data lived through both directions.

## Persistence turns history into a design constraint

Before a database exists, changing a model can be as easy as restarting the process. After people have entrusted facts to the system, the old shape of those facts becomes part of every future release. The application can change in an afternoon. Its history has to arrive safely on the other side.

Migrations make that history explicit. Idempotency protects it from uncertain retries. Consistency rules say which readers may briefly disagree without creating a false balance or losing an order.

Choosing what to keep is therefore also choosing what future versions must carry. Persistent data gives a system memory, and memory creates obligations.
