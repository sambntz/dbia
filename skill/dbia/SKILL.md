---
name: dbia
description: Inspect and query MySQL and PostgreSQL databases using the dbia CLI. Use when you need to explore database schemas, manage connections, discover tables and columns, trace foreign-key relationships, search for tables, execute SQL queries, and retrieve machine-readable output in plain, JSON, or CSV formats for agent analysis.
license: MIT
compatibility: Requires Node.js 20.0.0 or later and MySQL or PostgreSQL database access
metadata:
  repository: https://github.com/maxi/dbia
  version: "1.0"
---

# DBIA

`dbia` is a database introspection CLI for agents and developers. It supports
MySQL and PostgreSQL, stores saved connections locally, and defaults to
machine-readable output.

Use this skill when the user asks to understand a database, inspect schema,
find tables/columns, trace foreign keys, or run SQL through `dbia`.

## First Checks

Start by verifying the CLI and the current context:

```bash
command -v dbia
dbia --version
dbia connection current
dbia db current
```

For PostgreSQL, also check the active schema:

```bash
dbia db schema current
```

If there is no active connection, inspect saved connections before asking the
user for credentials:

```bash
dbia connection list
dbia connection use <name>
```

Avoid putting passwords in shell history. Prefer interactive connection setup:

```bash
dbia connection add
```

Only use `--password` when the user explicitly provides a safe non-interactive
credential flow.

## Progressive Discovery Workflow

Prefer small, targeted calls over dumping everything at once.

1. Confirm the active connection: `dbia connection current`.
2. List/select the database: `dbia db list`, then `dbia db use <database>`.
3. For PostgreSQL, list/select schema: `dbia db schema list`, then `dbia db schema use <schema>`.
4. Discover tables: `dbia table list` or `dbia search <query>`.
5. Inspect relevant tables: `dbia table show <table>`.
6. Check relationships: `dbia relations`.
7. Query small samples or aggregates with an explicit limit.

Useful commands:

```bash
dbia table list
dbia table show users
dbia schema
dbia relations
dbia search user
dbia query "SELECT id, email FROM users LIMIT 20" --json
```

## Output Handling

Default output is `plain`: TSV on stdout with status messages on stderr. This
is good for `awk`, `cut`, and simple parsing.

Set or inspect the persistent format:

```bash
dbia config format
dbia config format plain
dbia config format json
dbia config format table
dbia config reset
```

For agent consumption, prefer `plain` or per-query JSON:

```bash
dbia query "SELECT count(*) AS total FROM users" --json
```

For exports, CSV is available on `query` only:

```bash
dbia query "SELECT * FROM users" --csv --limit 1000 > users.csv
```

`dbia query` defaults to `--limit 50`. Use explicit limits for exploratory
queries and raise them only when needed.

## Safety Rules

- Treat `dbia query` as capable of executing arbitrary SQL. Use read-only
  queries unless the user explicitly asks for writes, migrations, deletes, or
  other mutations.
- Do not run destructive SQL (`DROP`, `TRUNCATE`, broad `DELETE`/`UPDATE`,
  schema changes) without explicit user confirmation in the current task.
- Do not expose secrets. `dbia connection show` masks passwords; preserve that.
- Remember PostgreSQL introspection is scoped to the active schema. Switch
  schemas with `dbia db schema use <name>` when tables appear missing.
- MySQL has no `dbia db schema` support; switch MySQL databases with
  `dbia db use <name>`.

## Command Reference

### Connection Management (`dbia connection` / `dbia c`)

```bash
dbia connection add              # Create new connection (interactive or with flags)
dbia connection list             # List all saved connections
dbia connection show <name>      # Show details (password masked as ********)
dbia connection rename <old> <new>  # Rename connection
dbia connection remove <name>    # Remove connection
dbia connection use <name>       # Set as active connection
dbia connection current          # Show active connection
```

Flags for `add`: `-n/--name`, `-t/--type` (mysql|postgres), `-h/--host`, `-p/--port`, 
`-u/--user`, `-w/--password`, `-d/--database`.

### Database & Schema Navigation

```bash
dbia db list                     # List databases in active connection
dbia db use <name>               # Switch active database
dbia db current                  # Show active database

# PostgreSQL only:
dbia db schema list              # List schemas in active database
dbia db schema use <name>        # Switch active schema
dbia db schema current           # Show active schema
```

### Schema Introspection

```bash
dbia table list                  # List tables in active database/schema
dbia table show <name>           # Show columns, types, keys, and defaults for a table
dbia schema                      # Dump full schema for all tables
dbia relations                   # List all foreign-key relationships
dbia search <query>              # Find tables by name (substring match)
```

### Query Execution

```bash
dbia query "<sql>"               # Execute SQL query
dbia query "<sql>" --json        # Force JSON output
dbia query "<sql>" --csv         # Force CSV output
dbia query "<sql>" --limit <n>   # Cap result rows (default 50)
```

### Output Format Configuration

```bash
dbia config format               # Show current output format
dbia config format <plain|json|table>  # Set output format persistently
dbia config reset                # Reset to default format (plain)
```

Three formats: `plain` (TSV, default for agents), `json` (for jq/scripts), 
`table` (human terminal with colors/borders).

## Quick Aliases

All commands have short aliases for fast typing:

```bash
dbia c add                       # connection add
dbia c ls                        # connection list
dbia c v <name>                  # connection show
dbia c rm <name>                 # connection remove
dbia c u <name>                  # connection use
dbia d ls                        # db list
dbia d u <name>                  # db use
dbia t ls                        # table list
dbia t v <name>                  # table show
dbia sch                         # schema
dbia rel                         # relations
dbia s <query>                   # search
dbia q "<sql>"                   # query
dbia cfg fmt <format>            # config format
```

## Full Reference

For detailed examples, environment variables, security info, and complete alias 
list, consult the project README. It covers:

- Installation and setup
- How `dbia` works (connections storage, encryption, schema caching)
- Security practices and encrypted password storage
- Limitations and known constraints
- Development (build, test, lint scripts)
