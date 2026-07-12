# Bot Development Summary

## Goal
- Deploy a stable Discord moderation bot on Wispbyte with all JSON files migrated to SQLite and an auto-moderation rules engine

## Constraints & Preferences
- Wispbyte Docker container (Node 22.23.0) — cloned from GitHub, not zip upload
- User cannot run terminal commands on Wispbyte — all fixes must go through file uploads or GitHub pushes
- User prefers ephemeral replies and interactive dropdown/role-picker UI patterns
- Bot code on GitHub is outdated (pre-SQLite, pre-all-fixes) — Wispbyte clones the old version

## Progress
### Done
- **Full SQLite migration**: Created `src/utils/db.ts` — single SQLite database replacing all 14 JSON/JSONL files, with WAL mode, 16+ indexed tables, one-time auto-migration on first run that renames old files to `.migrated`
- **14 utilities rewritten** to delegate to SQLite instead of direct file I/O (`botperms.ts`, `levels.ts`, `levelRoles.ts`, `levelNotif.ts`, `logs.ts`, `slowmodeConfig.ts`, `stickers.ts`, `tags.ts`, `tickets.ts`, `ticketConfig.ts`, `todos.ts`, `trialapps.ts`) — same exported function names, zero command code changes
- **Dashboard rewritten** (`src/dashboard/server.ts`) to read from SQLite instead of `readJSON`/`writeJSON`
- **`/botperms change` subcommand** — registered in `commands.ts`, `ALL_COMMANDS` list expanded to all 24 commands
- **Auto-moderation engine built**: `src/utils/automod.ts`, `src/commands/automod.ts`, automod tables in `db.ts` — rule-based system with conditions (keyword, regex, mentions, emotes, links, caps, spoilers, attachments) and actions (delete, warn, timeout, log), template-based creation, `/automod list/create/toggle/remove/view` subcommands
- **Automod wired into bot**: command registered in `commands.ts`, command map, and `checkMessage()` called in `messageCreate` handler
- **Fixed `package.json`** — removed `postinstall` script (caused `tsc` failure on VPS by running without `--ignoreDeprecations 6.0` before `start.js`)
- **`skipLibCheck: true`** already present in local `tsconfig.json` (suppresses discord.js type noise; missing on GitHub version)
- All fixes compile locally with `npx tsc` (zero errors)

### In Progress
- (none)

### Blocked
- **GitHub repo out of sync** — Wispbyte clones from `github.com/HertaIsAGenius/my-bot` (old code), so SQLite migration, automod, and all TS6 fixes are not deployed. Need to push local changes to GitHub or switch Wispbyte to zip upload.

## Key Decisions
- SQLite (`better-sqlite@12`) chosen over JSON for atomic writes, indexed queries, single-file backup — installed locally
- Auto-mod built as rule-based engine with template presets + custom condition/action picker, integrated with existing SQLite schema and command patterns
- `postinstall` removed from `package.json` — Wispbyte's startup already runs `npm install` then `node start.js`; the `postinstall` was duplicating `tsc` without the TS6 flag
- `checkMessage()` called at start of `messageCreate` handler, before XP/logging, with internal skip checks for bot users and users with ManageMessages permission

## Next Steps
1. Push all local changes (SQLite migration, automod, `/botperms change`, all fixes) to GitHub so Wispbyte clones the working version
2. Verify VPS compiles and launches with the updated code

## Critical Context
- VPS first run (Node 19.9.0) failed with `better-sqlite3` engine warning (requires Node 20+); Wispbyte auto-restarted into Node 22.23.0, then `tsc` failed due to old GitHub code without `skipLibCheck` and with `postinstall` running without TS6 flag
- After our fixes are pushed to GitHub, the startup flow will be: `npm install` (no postinstall) → `node start.js` (detects TS 6.x → adds `--ignoreDeprecations 6.0` → compiles → copies assets → installs sharp → launches bot + dashboard)
- `better-sqlite3` is synchronous — same blocking pattern as existing `readFileSync`/`writeFileSync`, so no async refactoring needed
- `db.ts` calls `runMigrations()` automatically on startup; old JSON files get renamed to `.migrated` as backup
- Auto-mod hooks into `messageCreate` in `index.ts` via `checkMessage()` — skips bots and ManageMessages permission users

## Relevant Files
- `src/utils/db.ts`: new core SQLite database with 16+ tables, migration, and all query functions
- `src/utils/automod.ts`: auto-mod rule evaluation engine with 8 condition types and 4 action types
- `src/commands/automod.ts`: slash command interface — `/automod list|create|view|toggle|remove`
- `src/commands/botperms.ts`: updated `ALL_COMMANDS` to all 24 registered commands
- `src/commands.ts`: added `change` subcommand to `botperms`, added `automod` command
- `src/index.ts`: imports `checkMessage`, registers `automod` in command map, calls `checkMessage` in `messageCreate`
- `src/utils/botperms.ts`, `levelNotif.ts`, `levelRoles.ts`, `levels.ts`, `logs.ts`, `slowmodeConfig.ts`, `stickers.ts`, `tags.ts`, `ticketConfig.ts`, `tickets.ts`, `todos.ts`, `trialapps.ts`: all rewritten to delegate to `db.ts`
- `src/dashboard/server.ts`: rewritten to query SQLite instead of JSON files
- `package.json`: removed `postinstall` script
- `start.js`: unchanged (already handles TS version detection, compilation, sharp install, asset copy)
- `tsconfig.json`: already has `skipLibCheck: true` (locally; absent on GitHub version)
