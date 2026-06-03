# `samples/` — `service_marketplace` demo kit

A small, self-contained demo you can run end-to-end to see what
`dbia` actually produces. The `service_marketplace` MySQL database
modeled here is a tiny marketplace of services: users (providers)
publish services in categories, customers place orders, and each
order has line items, a payment, and reviews.

## What's in here

| File | Purpose |
|------|---------|
| `schema.sql` | DDL for the `service_marketplace` database (8 tables, foreign keys included). |
| `seed.sql` | Sample rows so the introspection commands have something to show. |
| `table-list.txt` | Expected output of `dbia table list` against this database. |
| `table-show-services.txt` | Expected output of `dbia table show services`. |
| `relations.txt` | Expected output of `dbia relations`. |
| `query-example.sql` | The SQL used to produce `query-example.json`. |
| `query-example.json` | Expected output of `dbia query <query-example.sql> --json`. |

## Reproducing the demo

```bash
# 1. Load the schema and seed data
mysql -u root -p < samples/schema.sql
mysql -u root -p < samples/seed.sql

# 2. Add the connection in dbia
dbia connection add \
  --name service-marketplace \
  --type mysql \
  --host 127.0.0.1 \
  --port 3306 \
  --user root \
  --database service_marketplace

dbia connection use service-marketplace

# 3. Reproduce the captured outputs
dbia table list                       # → table-list.txt
dbia table show services              # → table-show-services.txt
dbia relations                        # → relations.txt
dbia query "$(cat samples/query-example.sql)" --json
                                      # → query-example.json
```

## Why this folder exists

The README's "What it looks like" section shows shortened previews so
readers can scan them. The files in `samples/` are the full,
unmodified outputs — useful for:

- **Tests** — golden-file style checks against the live driver.
- **Documentation drift** — diffing the captured output against the
  current `dbia` behavior catches accidental regressions in column
  names, types, or relations.
- **Onboarding** — new contributors can reproduce the exact demo
  the README is built around in under a minute.
