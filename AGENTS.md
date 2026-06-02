# AGENTS.md

> Context for OpenCode agents working in `dbia/`. DBIA is a TypeScript ESM CLI for managing multiple database connections and introspecting their schemas (MySQL, PostgreSQL). Layered architecture: `cli` → `application` → `domain` (interfaces) ← `infrastructure` (drivers, SQLite repos, secret provider). The CLI is designed to be friendly to AI/LLM consumers as well as humans, so all data output flows through a single `Renderer` that can emit `plain` (TSV, default), `json`, or `table` formats.

## Commands

All scripts live in `package.json`. Use them; don't reinvent.

- `npm run build` — `tsc` → `dist/`. The `bin` shim is `dist/cli/index.js` (CommonJS-style shebang `#!/usr/bin/env node` at the top of the .ts file).
- `npm start` — runs the built CLI: `node dist/cli/index.js`.
- `npm test` — `vitest run` (non-watch). Picks up only `src/tests/**/*.test.ts` (see `vitest.config.ts`).
- `npm run test:watch` — `vitest` watch mode.
- `npm run lint` — `eslint "src/**/*.ts"` (note: lints `src/**` only, not tests by default glob — though `src/tests/*.test.ts` IS under `src/**` and will be linted; `tsconfig.json` only excludes tests from build).
- `npm run format` — `prettier --write "src/**/*.ts"`.
- `npm run prepare` — runs build on `npm install` (so the dist always exists for `npm link`).
- `npm run prepublishOnly` — build + test; do not bypass before publishing.

Run a single test file: `npx vitest run src/tests/encryption.test.ts`. Filter by name with `-t "<substring>"`.

## ESM / TypeScript quirks (real footguns)

- `package.json` has `"type": "module"`. `tsconfig` uses `"module": "NodeNext"` and `"moduleResolution": "NodeNext"`. **All intra-project imports MUST end in `.js`** even when the source is `.ts` (e.g. `import { Foo } from './Foo.js'`). Forgetting `.js` is the #1 build error here.
- Tests are excluded from the build (`tsconfig.json` `exclude`: `**/*.spec.ts`, `**/*.test.ts`). Don't put non-test code under `src/tests/`.
- `vitest` is configured with `globals: true` — `describe`/`it`/`expect` work without import, but the existing tests still `import { describe, it, expect } from 'vitest'`. Stay consistent with the file you're editing.
- `tsconfig` is `strict: true` plus `noUnusedLocals`/`noUnusedParameters` are NOT set, but ESLint's `@typescript-eslint/no-unused-vars` is `error` with `argsIgnorePattern: "^_"`. Prefix intentionally-unused args with `_`.

## Storage, secrets, and runtime env

- Local SQLite DB defaults to `~/.dbia/dbia.sqlite`. Override with `DBIA_DATA_DIR` (used by `SqliteDatabase`). Schema is auto-created on first open (`connections` + `context` tables).
- Master key resolution order (`DefaultSecretProvider.getMasterKey`):
  1. `DBIA_MASTER_KEY` env var (hashed with SHA-256 → 32-byte key).
  2. File at `~/.dbia/master.key` (mode `0o600`).
  3. Generated random 32-byte hex written to `~/.dbia/master.key` (mode `0o600`).
  **Changing `DBIA_MASTER_KEY` invalidates every previously-encrypted password** — no key-rotation logic exists yet.
- `dotenv/config` is imported at the top of `src/cli/index.ts`, so a `.env` in the cwd is auto-loaded at startup.
- Passwords are encrypted with AES-256-GCM. Stored format: `iv:authTag:ciphertext` (all hex, `:` separator, 12-byte IV, 16-byte tag). See `EncryptionService.ts` and the format assertion in `src/tests/encryption.test.ts`.
- **Never** log/print decrypted secrets. `connection show` intentionally renders password as `******** (cifrada)`. Don't change this.
- `cli/commands/connectionCommands.ts` exposes `--password` but the comment flags it as "no recomendado"; the interactive `@clack/prompts` `password()` prompt is the safe default and the only one that keeps the secret out of shell history. Keep it that way.

## CLI surface (already wired in `src/cli/`)

Hierarchical commands, registered in `src/cli/index.ts`:

- `dbia connection {add|list|show <name>|remove <name>|use <name>|current}` — `remove` alias: `rm`.
- `dbia db {list|use <name>|current}`.
- `dbia table {list|show <name>}`.
- `dbia {schema|relations|search <query>}`.
- `dbia query "<sql>"` (alias `q`) — supports `--json`, `--csv`, `--limit <n>`. Default row cap is **50**; a warning is printed when truncated.
- `dbia config {format [value]|reset}` — get/set the persistent output format (see "Output format" below).

Commands are thin: no business logic in the Commander handlers — all real work goes through the `Container` (DI) into `ConnectionService` / `IntrospectionService` / `EncryptionService` / `PreferencesService` / `DriverFactory`.

## Output format

All data output goes through `src/shared/formatters/Renderer.ts`, which picks one of three formatters based on the persisted `outputFormat` preference (stored in `context.preferences.outputFormat`):

| Format | When | How it renders tabular data | Status messages |
|--------|------|------------------------------|-----------------|
| `plain` (default) | AI / pipes | TSV: header line then one row per line, columns separated by `\t`. Values containing tabs/newlines are flattened to spaces. ANSI stripped. | stderr, no icons |
| `json` | machine consumers | Pretty-printed `Array<Record<string, any>>` on stdout. ANSI stripped. | stderr, no icons |
| `table` | human terminal | cli-table3 with Unicode borders + colors. | stdout, with `✔/ℹ/⚠/✖` icons |

The user controls the format persistently with:

```bash
dbia config format              # print current format (scriptable: `dbia config format`)
dbia config format plain        # set
dbia config format json
dbia config format table
dbia config reset               # back to plain
```

In `plain` and `json` modes, `Logger.info/success/warn/error` are routed to **stderr** (without ANSI) so that stdout stays a single parseable blob. In `table` mode, status messages stay on stdout with the legacy icons. Empty result sets print `[]` on stdout in JSON mode so the data stream is always valid JSON; `[]` is never produced in `plain` mode (callers may emit a `Logger.info` instead).

`query --json` and `query --csv` are preserved as legacy per-command overrides and take precedence over the persistent config. They are the only place CSV is exposed.

## Driver gotchas

- `DriverFactory` only knows `mysql` and `postgres`. Throwing a new type means a new `DatabaseDriver` impl + a switch case in the factory.
- **Postgres driver hardcodes the `public` schema** for `listTables`, `getTableInfo`, and `getRelations` (see `PostgresDriver.ts`). Tables in other schemas are invisible. If you need multi-schema support, that's the place.
- `IntrospectionService.ensureDriver` caches a single driver per active connection; switching connection or `db use <name>` reconnects. Be careful when adding new state — the cache key is `currentConnectionId` only, not the database name.
- `pg` and `mysql2` clients are created without a pool; long-lived single connection per CLI invocation. Connection timeouts are 5s on both.

## Testing notes

- Tests run against a real on-disk SQLite file in a temp dir, not in-memory. Each test sets `process.env.DBIA_DATA_DIR` to a fresh `fs.mkdtemp(...)` in `beforeEach` and `delete`s it in `afterEach`.
- Tests also set `DBIA_MASTER_KEY = 'test-master-key'` (or use a `MockSecretProvider` with SHA-256 of that string). Do not rely on `~/.dbia/master.key` existing in tests.
- `src/tests/` is the only place tests live. `vitest.config.ts` `include` is `src/tests/**/*.test.ts`.
- No integration tests against real MySQL/Postgres — drivers are exercised only manually via the CLI.

## Style and lint

- Prettier: single quotes, 2-space, trailing comma `all`, 100 cols, LF (`/.prettierrc`).
- ESLint: `@typescript-eslint/recommended` + `eslint:recommended`. `@typescript-eslint/no-explicit-any` is `warn`, not `error` — but prefer fixing it.
- `Logger` in `src/shared/utils/logger.ts` is the only place `console.*` is called. Add new output methods there, not inline.
- Output is rendered with `TableFormatter` (cli-table3) and `OutputFormatter` (JSON/CSV). Don't `console.log` tabular data directly from commands.

## What is NOT here

- No CI workflows (no `.github/`, no `.gitlab-ci.yml`). Don't try to find them.
- No pre-commit hooks.
- No `AGENTS.md` / `CLAUDE.md` / `.cursor/rules/` / `opencode.json` existed before this file.
- Keychain / OS secret-store providers from the PRD are **not implemented** — only env var + file. Don't wire them up unless explicitly asked.
- Schema/relations metadata is NOT cached in SQLite (per PRD). Drivers query the live DB every time.
