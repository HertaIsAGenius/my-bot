# Discord Moderation Bot

A minimal Discord moderation bot with commands for kick, ban, mute, warn, and infractions.

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in `DISCORD_TOKEN`, `GUILD_ID`, and `MOD_LOG_CHANNEL_ID` if needed.
3. Run `npm install`.
4. Start development mode with `npm run dev`.

## Commands

- `/kick user: @member reason: optional`
- `/ban user: @member reason: optional`
- `/mute user: @member duration: minutes reason: optional`
- `/warn user: @member reason: optional`
- `/infractions user: @member`

## Notes

- This bot uses Discord slash commands, which are registered per guild.
- Infractions are stored locally in `data/<guildId>.json`.
