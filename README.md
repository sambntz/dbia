# dbia — Database introspection for AI agents and developers

`DBIA` is a database introspection CLI designed primarily for AI agents to
discover, navigate, and understand the structure of MySQL and PostgreSQL
databases. It is also perfectly usable by humans in a terminal or server
environment.

Unlike general-purpose SQL clients that format output for human eyes,
`DBIA` produces **machine-readable output by default** (tab-separated on
stdout, status messages on stderr). This lets an LLM — or any `awk`/`jq`
pipeline — consume the data mechanically without parsing decorations.
Switch to JSON for structured consumption, or to a pretty table for a
human terminal.

---

> ### DBIA is **not** an AI agent.
>
> **DBIA is a database exploration tool designed to be used by AI agents.**
>
> The name "Database Introspection Assistant" can be misleading. The flow
> is *not*:
>
> ```
> user → DBIA → intelligent response
> ```
>
> The actual flow is:
>
> ```
> agent → DBIA → database
> ```
>
> DBIA is the **tool**, not the agent. It does not reason, plan, or call
> an LLM. It exposes a stable, predictable CLI surface that an external
> agent (Claude Code, Cursor, OpenCode, a custom script, or a human) can
> call to discover and query databases progressively.

---

## Table of contents

- [Why DBIA?](#why-dbia)
- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [How it works](#how-it-works)
- [Commands](#commands)
  - [Connection management](#connection-management)
  - [Database navigation](#database-navigation)
  - [Schema navigation (PostgreSQL)](#schema-navigation-postgresql)
  - [Table operations](#table-operations)
  - [Schema dump](#schema-dump)
  - [Relations](#relations)
  - [Search](#search)
  - [Query](#query)
  - [Output format configuration](#output-format-configuration)
- [Command aliases](#command-aliases)
- [Configuration](#configuration)
- [Security](#security)
- [Limitations](#limitations)
- [Development](#development)

---

## Why DBIA?

Most AI agents interact with databases in one of two ways:

**Option 1 — Dump the full schema into the prompt**
Problem: enormous context, expensive, immediately stale.

**Option 2 — MCP Server**
Problem: complex setup, requires specific integrations, not every agent
supports it.

`dbia` proposes something in between:

```
dbia table list         → discover what tables exist
dbia table show users   → inspect one table's columns
dbia relations          → understand foreign keys
dbia query "..."        → fetch real data
```

An agent can discover the database **progressively**, calling only what it
needs at each step. This scales far better than dumping everything upfront.

You could use `psql` or `mysql` — those are excellent tools. But they are
designed for human eyes: decorated output, interactive pagers, colored
tables, status interleaved with data. `dbia` is designed for **both**
humans and agents, with stdout=parseable data and stderr=messages as a
first-class decision, not an afterthought.

---

## Features

- **Database introspection for agents** — discover databases, inspect
  schemas, understand table relationships, and execute queries; all
  through a stable, predictable CLI that an LLM can call repeatedly.
- **Machine-readable by default** — TSV on stdout, messages on stderr.
  Format is a single persistent preference (`plain` | `json` | `table`).
- **Multiple persistent connections** — save and switch between as many
  MySQL or PostgreSQL servers as you need.
- **Encrypted local storage** — passwords are encrypted with AES-256-GCM
  using a master key resolved from `DBIA_MASTER_KEY`, `~/.dbia/master.key`,
  or a randomly generated file.
- **Database and schema navigation** — list databases, switch the active
  database, and (for PostgreSQL) list and switch schemas without
  reconnecting.
- **Introspection** — list tables, show column details, dump full schemas,
  and enumerate foreign-key relations.
- **Search** — find tables by name across the active database.
- **Ad-hoc SQL** — execute queries on the active database, with output as
  a table, JSON, or CSV and a configurable row cap.
- **Interactive prompts** — adding a connection walks you through each
  field with sensible defaults, and passwords are always masked.
- **Short aliases** — every common command has a one-letter alias for
  fast typing.

---

## Installation

The package is shipped as a TypeScript ESM project. From the repository
root:

```bash
npm install
npm run build
npm link            # exposes the `dbia` command on your PATH
```

The `prepare` script automatically rebuilds on `npm install`, so the
`dist/cli/index.js` shim is always present after installation. Once
linked, you can call `dbia` from anywhere:

```bash
dbia --version
```

---

## Quick start

```bash
# 1. Add a MySQL connection (interactive)
dbia connection add

# 2. Add a PostgreSQL connection non-interactively
dbia connection add \
  --name pg-connection \
  --type postgres \
  --host localhost \
  --port 5432 \
  --user postgres \
  --password "$PG_PASSWORD" \
  --database postgres

# 3. Pick the active connection
dbia connection use pg-connection

# 4. Browse databases and pick one
dbia db list
dbia db use my_app

# 5. (PostgreSQL only) Browse schemas and pick one
dbia db schema list
dbia db schema use public

# 6. List tables and inspect one
dbia table list
dbia table show users

# 7. Dump the whole schema, see relations, or run a query
dbia schema
dbia relations
dbia search user
dbia query "SELECT id, email FROM users WHERE active = true"
```

---

## How it works

`dbia` keeps two things on disk in a single SQLite file (default
`~/.dbia/dbia.sqlite`, override with `DBIA_DATA_DIR`):

1. A **`connections`** table — one row per saved connection profile.
   The password is stored encrypted (AES-256-GCM, 12-byte IV, 16-byte
   authentication tag) in the format `iv:authTag:ciphertext`.
2. A **`context`** table — the current `activeConnectionId`,
   `activeDatabase`, and `activeSchema`. This is what `dbia connection
   current`, `dbia db current`, and `dbia db schema current` report.

When you run a command that needs the live database, `dbia` reads the
active connection, decrypts its password, opens a single client to MySQL
or PostgreSQL (no pool), and issues your request. Connections have a
5-second timeout. Schema changes for PostgreSQL are applied with
`SET search_path`, so switching schemas does not reconnect.

If the `context` table on an existing install does not have the
`active_schema` column yet, it is added on the fly via `ALTER TABLE`.

---

## Commands

### Connection management

`dbia connection` (alias `c`)

| Subcommand | Description |
|------------|-------------|
| `add` | Create a new connection. Prompts interactively if flags are missing. |
| `list` | List all saved connections. The active one is marked with a green dot. |
| `show <name>` | Show details of a connection. The password is always rendered as `******** (encrypted)`. |
| `rename <old> <new>` (alias `mv`) | Rename a connection. Validates that the new name is non-empty and not already in use. |
| `remove <name>` (alias `rm`) | Remove a connection. Asks for confirmation. If the connection was active, the context is cleared. |
| `use <name>` | Make a connection the active one. The active schema is reset to `null` on switch. |
| `current` | Show the active connection. |

**`add` flags:**

| Flag | Description |
|------|-------------|
| `-n, --name` | Connection name (unique). |
| `-t, --type` | `mysql` or `postgres`. |
| `-h, --host` | Database host (default `localhost`). |
| `-p, --port` | Database port (default `3306` for MySQL, `5432` for PostgreSQL). |
| `-u, --user` | Database user (default `root`). |
| `-w, --password` | Password. Avoid this in shell history; prefer the interactive prompt. |
| `-d, --database` | Default database (default `mysql` for MySQL, `postgres` for PostgreSQL). |

If a flag is missing, `dbia` prompts for it interactively. The password
prompt is always masked and never echoed to the terminal.

**MySQL example:**

```bash
dbia connection add \
  --name mysql-connection \
  --type mysql \
  --host 127.0.0.1 \
  --port 3306 \
  --user root \
  --database foo
```

**PostgreSQL example (interactive, recommended for the password):**

```bash
dbia connection add --name pg-connection --type postgres
# then answer Host / Port / User / Password / Database at the prompts
```

### Database navigation

`dbia db` (alias `d`)

| Subcommand | Description |
|------------|-------------|
| `list` | List databases visible to the active connection. The active one is marked. |
| `use <name>` | Switch the active database. The driver reconnects; the active schema is reset. |
| `current` | Show the active database. |

### Schema navigation (PostgreSQL)

`dbia db schema` (alias `sch`)

Schemas are a PostgreSQL concept — MySQL does not have them. On MySQL
these commands return a clear error.

| Subcommand | Description |
|------------|-------------|
| `list` | List schemas in the active database. System schemas (`pg_catalog`, `information_schema`, `pg_temp_*`, `pg_toast*`) are hidden. The active one is marked. |
| `use <name>` | Switch the active schema. The driver issues `SET search_path`, no reconnect. |
| `current` | Show the active schema. |

Schema names are validated against `^[a-zA-Z_][a-zA-Z0-9_]*$` before
being applied, so arbitrary SQL cannot be smuggled into the
`SET search_path` statement.

### Table operations

`dbia table` (alias `t`)

| Subcommand | Description |
|------------|-------------|
| `list` | List tables in the active schema of the active database. |
| `show <name>` | Show columns, types, nullability, keys, and defaults for a table. |

### Schema dump

`dbia schema` (alias `sch` at the top level)

Prints a compact view of every table in the active schema/database — the
kind of overview you would get from `\d` in `psql`.

### Relations

`dbia relations` (alias `rel`)

Lists every foreign key in the active schema/database, with the
referencing table, the referencing columns, the referenced table, and
the referenced columns.

### Search

`dbia search <query>` (alias `s`)

Filters the table list of the active schema/database by a substring
match on the table name.

### Query

`dbia query "<sql>"` (alias `q`)

Executes a SQL statement on the active database. The first argument is
the SQL string; quote it because most shells split on spaces.

| Flag | Description |
|------|-------------|
| `--json` | Force JSON output for this invocation (overrides the persistent `outputFormat`). |
| `--csv` | Force CSV output for this invocation (overrides the persistent `outputFormat`). |
| `--limit <n>` | Cap the number of rows shown (default `50`). A warning is printed when results are truncated. |

Examples:

```bash
dbia query "SELECT count(*) FROM users"
dbia query "SELECT * FROM users" --json --limit 100
dbia query "SELECT * FROM users" --csv > users.csv
```

### Output format configuration

`dbia config` — manage the CLI's persistent configuration.

| Subcommand | Description |
|------------|-------------|
| `format [value]` | Get or set the default output format. With no argument, prints the current format to stdout (a single line, no decorations — scriptable). With `plain`, `json`, or `table`, persists the new format and updates it for the rest of the current invocation. |
| `reset` | Reset the output format to the default (`plain`). |

Three formats are supported, each picked to match the consumer:

| Format | Best for | How data is rendered | Status messages |
|--------|----------|----------------------|-----------------|
| `plain` (default) | AI / pipes / `awk` / `cut` | Tab-separated. Header line first (`col1\tcol2`), then one row per line. Values containing tabs or newlines are flattened to spaces. No ANSI codes. | stderr, no icons |
| `json` | Machine consumers / `jq` | Pretty-printed JSON array of objects (`[{"col": "val"}, ...]`) on stdout. No ANSI codes. | stderr, no icons |
| `table` | Human terminal | `cli-table3` with Unicode borders and color. | stdout, with `✔/ℹ/⚠/✖` icons |

In `plain` and `json` modes, all status messages (info, success, warn,
error) are written to **stderr** with ANSI stripped, so stdout stays a
single, parseable, well-formed stream. In `table` mode status messages
keep the legacy behavior (stdout, with icons + colors).

Examples:

```bash
# See what's set right now (scriptable)
dbia config format
# → plain

# Switch to JSON for jq / an LLM consumer
dbia config format json
dbia connection list | jq '.[].name'

# Switch to the pretty table for a human reading the terminal
dbia config format table
dbia connection list

# Back to the default
dbia config reset
```

`query --json` and `query --csv` are preserved as per-invocation
overrides and take precedence over the persistent format. CSV is only
exposed on `query`.

---

## Command aliases

For fast typing, every command and subcommand has a short alias.

| Long | Short |
|------|-------|
| `connection` | `c` |
| `db` | `d` |
| `table` | `t` |
| `schema` | `sch` |
| `relations` | `rel` |
| `search` | `s` |
| `query` | `q` |
| `config` | `cfg` |
| `connection add` | `connection a` |
| `connection list` | `connection ls` |
| `connection show` | `connection v` |
| `connection remove` | `connection rm` |
| `connection rename` | `connection mv` |
| `connection use` | `connection u` |
| `connection current` | `connection cur` |
| `db list` | `db ls` |
| `db use` | `db u` |
| `db current` | `db cur` |
| `db schema` | `db sch` |
| `db schema list` | `db schema ls` |
| `db schema use` | `db schema u` |
| `db schema current` | `db schema cur` |
| `table list` | `table ls` |
| `table show` | `table v` |
| `config format` | `config fmt` |
| `config reset` | `config rst` |

All previous single-letter shortcuts (`q` for `query`, `rm` for `remove`)
are preserved.

---

## Configuration

| Variable / command | Description |
|--------------------|-------------|
| `DBIA_DATA_DIR` | Directory where `dbia.sqlite` and `master.key` live. Defaults to `~/.dbia/`. |
| `DBIA_MASTER_KEY` | If set, used (hashed with SHA-256) as the AES-256 master key. Overrides the file. **Changing this value invalidates every previously encrypted password.** |
| `.env` | Auto-loaded at startup from the current working directory (via `dotenv/config`). |
| `dbia config format` | Get the current persistent output format. |
| `dbia config format <plain\|json\|table>` | Set the persistent output format. |
| `dbia config reset` | Reset the output format to the default (`plain`). |

The `outputFormat` preference is stored as a JSON value in
`context.preferences.outputFormat` inside the same SQLite file that holds
the connection list. The persistent setting is loaded once per
invocation at startup.

Master key resolution order:

1. `DBIA_MASTER_KEY` environment variable.
2. File at `~/.dbia/master.key` (mode `0o600`).
3. A new random 32-byte hex key written to `~/.dbia/master.key` (mode `0o600`).

---

## Security

- Passwords are encrypted with **AES-256-GCM** before being written to
  SQLite. The on-disk format is `iv:authTag:ciphertext` (hex, `:`-separated).
- `dbia connection show` renders the password as `******** (encrypted)`.
  The CLI never logs, prints, or returns a decrypted secret.
- `dbia connection add --password <value>` puts the password into your
  shell history. Prefer the interactive `password()` prompt — it masks
  input and never stores the value in process arguments.
- The master key file and the SQLite file live in the same directory;
  protect that directory with normal filesystem permissions.

There is currently **no key-rotation support**. If you change
`DBIA_MASTER_KEY` (or wipe `master.key`), every saved password becomes
unrecoverable and connections will have to be re-added.

---

## Limitations

- The CLI opens a single long-lived client per invocation (no connection
  pool). Long-running migrations are fine, but the tool is not designed
  for sustained high-throughput queries.
- Connection timeout is fixed at **5 seconds** for both MySQL and
  PostgreSQL.
- PostgreSQL introspection filters by the **active schema only**. The
  previous hardcoded limitation to `public` is gone, but cross-schema
  introspection in a single command is not supported — switch schemas
  with `dbia db schema use <name>`.
- MySQL has **no schema concept**, so `dbia db schema` commands are
  not available there; switch between MySQL databases with `dbia db use`.
- Schema and relation metadata is queried from the live database on
  every call — there is no caching layer.
- No keychain / OS secret-store integration. The master key lives in
  `DBIA_MASTER_KEY` or `~/.dbia/master.key`.
- No integration tests against real MySQL or PostgreSQL servers. The
  CLI is the only way to exercise the drivers end-to-end.

---

## Development

Common scripts (defined in `package.json`):

```bash
npm run build         # tsc -> dist/
npm start             # run the built CLI
npm test              # vitest run (non-watch)
npm run test:watch    # vitest in watch mode
npm run lint          # eslint "src/**/*.ts"
npm run format        # prettier --write "src/**/*.ts"
npm run prepublishOnly # build + test (do not bypass before publishing)
```

Tests live in `src/tests/**/*.test.ts`. They use a real on-disk SQLite
file in a `mkdtemp` directory (one per test) and a deterministic master
key (`DBIA_MASTER_KEY=test-master-key` or a `MockSecretProvider`).
