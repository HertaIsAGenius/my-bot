import Database from 'better-sqlite3';
import { existsSync, readFileSync, renameSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { dataPath } from './dataPath';

const DB_PATH = dataPath('bot.db');

let initialized = false;

function ensureDir() {
  const dir = dataPath();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function openDb(): Database.Database {
  ensureDir();
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

const db = openDb();

export function initSchema() {
  if (initialized) return;
  initialized = true;

  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY (guild_id, key)
    );

    CREATE TABLE IF NOT EXISTS bot_perms (
      guild_id TEXT NOT NULL,
      command_name TEXT NOT NULL,
      role_ids TEXT NOT NULL DEFAULT '[]',
      PRIMARY KEY (guild_id, command_name)
    );

    CREATE TABLE IF NOT EXISTS levels (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      xp INTEGER NOT NULL DEFAULT 0,
      weekly_xp INTEGER NOT NULL DEFAULT 0,
      weekly_reset_at INTEGER NOT NULL DEFAULT 0,
      last_message_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS level_roles (
      guild_id TEXT NOT NULL,
      level INTEGER NOT NULL,
      role_id TEXT NOT NULL,
      PRIMARY KEY (guild_id, level)
    );

    CREATE TABLE IF NOT EXISTS log_config (
      guild_id TEXT NOT NULL,
      messages INTEGER NOT NULL DEFAULT 0,
      reactions INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id)
    );

    CREATE TABLE IF NOT EXISTS channel_log_config (
      channel_id TEXT NOT NULL,
      messages INTEGER NOT NULL DEFAULT 0,
      reactions INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (channel_id)
    );

    CREATE TABLE IF NOT EXISTS slowmode_channels (
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      PRIMARY KEY (guild_id, channel_id)
    );

    CREATE TABLE IF NOT EXISTS sticker_config (
      guild_id TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (guild_id)
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER NOT NULL,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      aliases TEXT NOT NULL DEFAULT '[]',
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      footer TEXT,
      image_url TEXT,
      created_by TEXT NOT NULL,
      updated_by TEXT,
      uses INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_tags_guild ON tags(guild_id, name);

    CREATE TABLE IF NOT EXISTS ticket_config (
      guild_id TEXT NOT NULL,
      category_id TEXT,
      log_channel_id TEXT,
      panel_channel_id TEXT,
      panel_message_id TEXT,
      support_role_ids TEXT NOT NULL DEFAULT '[]',
      ping_roles TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY (guild_id)
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER NOT NULL,
      guild_id TEXT NOT NULL,
      channel_id TEXT,
      creator_id TEXT NOT NULL,
      creator_tag TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'other',
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'medium',
      subject TEXT NOT NULL DEFAULT '',
      claimed_by TEXT,
      claimed_at INTEGER,
      notes TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      closed_at INTEGER,
      closed_by TEXT,
      close_reason TEXT,
      transcript_path TEXT,
      PRIMARY KEY (guild_id, id)
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER NOT NULL,
      guild_id TEXT NOT NULL,
      text TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_tag TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      edited_at INTEGER,
      PRIMARY KEY (guild_id, id)
    );

    CREATE TABLE IF NOT EXISTS trial_apps (
      guild_id TEXT NOT NULL,
      channel_id TEXT,
      forms TEXT NOT NULL DEFAULT '[]',
      PRIMARY KEY (guild_id)
    );

    CREATE TABLE IF NOT EXISTS message_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT,
      author_id TEXT NOT NULL,
      content TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_msg_logs_guild ON message_logs(guild_id, created_at);

    CREATE TABLE IF NOT EXISTS reaction_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT,
      message_id TEXT,
      emoji TEXT NOT NULL,
      author_id TEXT NOT NULL,
      added INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rxn_logs_guild ON reaction_logs(guild_id, created_at);

    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      migrated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS infractions (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      infractions TEXT NOT NULL DEFAULT '[]',
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS automod_rules (
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      conditions TEXT NOT NULL DEFAULT '[]',
      actions TEXT NOT NULL DEFAULT '[]',
      whitelist TEXT NOT NULL DEFAULT '[]',
      blacklist TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER,
      PRIMARY KEY (guild_id, name)
    );

    CREATE TABLE IF NOT EXISTS automod_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_automod_logs ON automod_logs(guild_id, created_at);

    -- Economy
    CREATE TABLE IF NOT EXISTS economy (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      wallet INTEGER NOT NULL DEFAULT 0,
      bank INTEGER NOT NULL DEFAULT 0,
      inventory TEXT NOT NULL DEFAULT '{}',
      last_daily INTEGER NOT NULL DEFAULT 0,
      last_work INTEGER NOT NULL DEFAULT 0,
      last_beg INTEGER NOT NULL DEFAULT 0,
      last_crime INTEGER NOT NULL DEFAULT 0,
      last_rob INTEGER NOT NULL DEFAULT 0,
      last_gamble INTEGER NOT NULL DEFAULT 0,
      last_fish INTEGER NOT NULL DEFAULT 0,
      last_mine INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS shop_items (
      guild_id TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price INTEGER NOT NULL DEFAULT 0,
      role_id TEXT,
      type TEXT NOT NULL DEFAULT 'item',
      created_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS economy_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL
    );

    -- Welcome / Goodbye / Auto-role
    CREATE TABLE IF NOT EXISTS welcome_config (
      guild_id TEXT NOT NULL PRIMARY KEY,
      channel_id TEXT,
      message TEXT NOT NULL DEFAULT 'Welcome {user} to {server}!',
      embed_json TEXT,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS goodbye_config (
      guild_id TEXT NOT NULL PRIMARY KEY,
      channel_id TEXT,
      message TEXT NOT NULL DEFAULT '{user} has left {server}.',
      embed_json TEXT,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS auto_roles (
      guild_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      PRIMARY KEY (guild_id, role_id)
    );

    -- Reaction Roles
    CREATE TABLE IF NOT EXISTS reaction_roles (
      guild_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      role_id TEXT NOT NULL,
      label TEXT,
      description TEXT,
      PRIMARY KEY (guild_id, message_id, emoji)
    );

    -- Giveaways
    CREATE TABLE IF NOT EXISTS giveaways (
      guild_id TEXT NOT NULL,
      message_id TEXT NOT NULL PRIMARY KEY,
      channel_id TEXT NOT NULL,
      prize TEXT NOT NULL,
      description TEXT,
      winners INTEGER NOT NULL DEFAULT 1,
      end_time INTEGER NOT NULL,
      host_id TEXT NOT NULL,
      ended INTEGER NOT NULL DEFAULT 0,
      winner_ids TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL
    );

    -- Server Stats
    CREATE TABLE IF NOT EXISTS server_stats (
      guild_id TEXT NOT NULL PRIMARY KEY,
      member_channel_id TEXT,
      bot_channel_id TEXT,
      voice_channel_id TEXT,
      channel_category TEXT
    );

    -- Join-to-Create
    CREATE TABLE IF NOT EXISTS join_to_create (
      guild_id TEXT NOT NULL PRIMARY KEY,
      channel_id TEXT,
      category_id TEXT,
      voice_format TEXT NOT NULL DEFAULT '{user}''s Channel'
    );

    -- Birthdays
    CREATE TABLE IF NOT EXISTS birthdays (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      month INTEGER NOT NULL,
      day INTEGER NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      year INTEGER,
      PRIMARY KEY (guild_id, user_id)
    );

    -- Moderation Cases (replaces JSON infractions with proper schema)
    CREATE TABLE IF NOT EXISTS mod_cases (
      guild_id TEXT NOT NULL,
      case_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      action TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      duration INTEGER,
      duration_unit TEXT,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id, case_id)
    );

    CREATE INDEX IF NOT EXISTS idx_mod_cases_user ON mod_cases(guild_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_mod_cases_created ON mod_cases(guild_id, created_at);

    -- Slumber Guard presets
    CREATE TABLE IF NOT EXISTS slumberguard_presets (
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      threshold_users INTEGER NOT NULL DEFAULT 5,
      threshold_time INTEGER NOT NULL DEFAULT 10,
      slowmode_time INTEGER NOT NULL DEFAULT 10,
      slowmode_length INTEGER NOT NULL DEFAULT 60,
      min_messages INTEGER NOT NULL DEFAULT 2,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id, name)
    );

    -- Slumber Guard channel config
    CREATE TABLE IF NOT EXISTS slumberguard_channels (
      channel_id TEXT NOT NULL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      preset_name TEXT NOT NULL DEFAULT 'default',
      enabled INTEGER NOT NULL DEFAULT 1
    );

    -- LLM chat memory
    CREATE TABLE IF NOT EXISTS chat_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_memory_channel ON chat_memory(guild_id, channel_id, created_at);
  `);
}

export function runMigrations() {
  initSchema();

  const row = db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get() as { version: number } | undefined;
  if (row) return;

  migrateFromJson();
  db.prepare('INSERT INTO schema_version (version) VALUES (1)').run();
}

function migrateFromJson() {
  const dir = dataPath();
  if (!existsSync(dir)) return;
  ensureDir();

  const migrateFile = <T>(name: string, fn: (data: T) => void) => {
    const path = join(dir, name);
    if (!existsSync(path)) return;
    try {
      const data = JSON.parse(readFileSync(path, 'utf-8')) as T;
      fn(data);
      renameSync(path, path + '.migrated');
      console.log(`  Migrated ${name}`);
    } catch (e) {
      console.warn(`  Skipped ${name}: ${e}`);
    }
  };

  const tx = db.transaction(() => {
    migrateFile<Record<string, string[]>>('botperms.json', (data) => {
      const stmt = db.prepare('INSERT OR REPLACE INTO bot_perms (guild_id, command_name, role_ids) VALUES (?, ?, ?)');
      for (const [key, roleIds] of Object.entries(data)) {
        const [guildId, ...rest] = key.split('_');
        const cmd = rest.join('_');
        if (guildId && cmd) stmt.run(guildId, cmd, JSON.stringify(roleIds));
      }
    });

    migrateFile<Record<string, string | null>>('levelNotifConfig.json', (data) => {
      const stmt = db.prepare('INSERT OR REPLACE INTO guild_config (guild_id, key, value) VALUES (?, ?, ?)');
      for (const [guildId, channelId] of Object.entries(data)) {
        stmt.run(guildId, 'level_up_channel', channelId);
      }
    });

    migrateFile<Record<string, Record<string, string>>>('levelRoles.json', (data) => {
      const stmt = db.prepare('INSERT OR REPLACE INTO level_roles (guild_id, level, role_id) VALUES (?, ?, ?)');
      for (const [guildId, levels] of Object.entries(data)) {
        for (const [level, roleId] of Object.entries(levels)) {
          stmt.run(guildId, parseInt(level), roleId);
        }
      }
    });

    migrateFile('levels.json', (data: any) => {
      const stmt = db.prepare('INSERT OR REPLACE INTO levels (guild_id, user_id, xp, weekly_xp, weekly_reset_at, last_message_at) VALUES (?, ?, ?, ?, ?, ?)');
      for (const [key, entry] of Object.entries(data)) {
        const parts = key.split('_');
        const guildId = parts.slice(0, -1).join('_');
        const userId = parts[parts.length - 1];
        if (!guildId || !userId) continue;
        const e = entry as any;
        stmt.run(guildId, userId, e.xp || 0, e.weeklyXp || 0, e.weeklyResetTimestamp || 0, e.lastMessageTimestamp || 0);
      }
    });

    migrateFile<Record<string, { messages?: boolean; reactions?: boolean }>>('logConfig.json', (data) => {
      const stmt = db.prepare('INSERT OR REPLACE INTO log_config (guild_id, messages, reactions) VALUES (?, ?, ?)');
      for (const [guildId, cfg] of Object.entries(data)) {
        stmt.run(guildId, cfg.messages ? 1 : 0, cfg.reactions ? 1 : 0);
      }
    });

    migrateFile<Record<string, { messages?: boolean; reactions?: boolean }>>('channelLogConfig.json', (data) => {
      const stmt = db.prepare('INSERT OR REPLACE INTO channel_log_config (channel_id, messages, reactions) VALUES (?, ?, ?)');
      for (const [channelId, cfg] of Object.entries(data)) {
        stmt.run(channelId, cfg.messages ? 1 : 0, cfg.reactions ? 1 : 0);
      }
    });

    migrateFile('slowmodeConfig.json', (data: any) => {
      const stmt = db.prepare('INSERT OR IGNORE INTO slowmode_channels (guild_id, channel_id) VALUES (?, ?)');
      for (const ch of data.enabledChannels || []) {
        stmt.run('0', ch);
      }
    });

    migrateFile<Record<string, { enabled: boolean }>>('stickerConfig.json', (data) => {
      const stmt = db.prepare('INSERT OR REPLACE INTO sticker_config (guild_id, enabled) VALUES (?, ?)');
      for (const [guildId, cfg] of Object.entries(data)) {
        stmt.run(guildId, cfg.enabled ? 1 : 0);
      }
    });

    migrateFile('tags.json', (data: any) => {
      const stmt = db.prepare('INSERT OR REPLACE INTO tags (id, guild_id, name, aliases, title, content, footer, image_url, created_by, updated_by, uses, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const [guildId, tags] of Object.entries(data)) {
        for (const t of tags as any[]) {
          stmt.run(t.id, guildId, t.name, JSON.stringify(t.aliases || []), t.title || '', t.content, t.footer || null, t.imageUrl || null, t.createdBy, t.updatedBy || null, t.uses || 0, t.createdAt, t.updatedAt || null);
        }
      }
    });

    migrateFile<Record<string, any>>('ticketConfig.json', (data) => {
      const stmt = db.prepare('INSERT OR REPLACE INTO ticket_config (guild_id, category_id, log_channel_id, panel_channel_id, panel_message_id, support_role_ids, ping_roles) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const [guildId, cfg] of Object.entries(data)) {
        stmt.run(guildId, cfg.ticketCategoryId || null, cfg.loggingChannelId || null, cfg.panelChannelId || null, cfg.panelMessageId || null, JSON.stringify(cfg.supportRoleIds || []), JSON.stringify(cfg.pingRoles || {}));
      }
    });

    migrateFile('tickets.json', (data: any) => {
      const stmt = db.prepare('INSERT OR REPLACE INTO tickets (id, guild_id, channel_id, creator_id, creator_tag, category, status, priority, subject, claimed_by, claimed_at, notes, created_at, closed_at, closed_by, close_reason, transcript_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const [guildId, tickets] of Object.entries(data)) {
        for (const t of tickets as any[]) {
          stmt.run(t.id, guildId, t.channelId || null, t.creatorId, t.creatorTag || '', t.category || 'other', t.status || 'open', t.priority || 'medium', t.subject || '', t.claimedBy || null, t.claimedAt || null, JSON.stringify(t.notes || []), t.createdAt, t.closedAt || null, t.closedBy || null, t.closeReason || null, t.transcriptPath || null);
        }
      }
    });

    migrateFile('todos.json', (data: any) => {
      const stmt = db.prepare('INSERT OR REPLACE INTO todos (id, guild_id, text, author_id, author_tag, created_at, edited_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const [guildId, items] of Object.entries(data)) {
        for (const item of items as any[]) {
          stmt.run(item.id, guildId, item.text, item.authorId || '', item.authorTag || '', item.createdAt, item.editedAt || null);
        }
      }
    });

    migrateFile('trialapps.json', (data: any) => {
      const stmt = db.prepare('INSERT OR REPLACE INTO trial_apps (guild_id, channel_id, forms) VALUES (?, ?, ?)');
      for (const [guildId, store] of Object.entries(data)) {
        const s = store as any;
        stmt.run(guildId, s.channelId || null, JSON.stringify(s.forms || []));
      }
    });

    migrateFile('ticketMeta.json', (data: any) => {
      const stmt = db.prepare('INSERT OR REPLACE INTO guild_config (guild_id, key, value) VALUES (?, ?, ?)');
      for (const [guildId, meta] of Object.entries(data)) {
        const m = meta as any;
        if (m?.moderatorChannel) {
          stmt.run(guildId, 'moderator_channel', m.moderatorChannel);
        }
      }
    });

    const guildDirs = readdirSync(dir).filter(f => /^\d+$/.test(f));
    for (const guildId of guildDirs) {
      const msgFile = join(dir, guildId, 'messages.jsonl');
      if (existsSync(msgFile)) {
        try {
          const insert = db.prepare('INSERT INTO message_logs (guild_id, channel_id, message_id, author_id, content, created_at) VALUES (?, ?, ?, ?, ?, ?)');
          const lines = readFileSync(msgFile, 'utf-8').split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              insert.run(guildId, entry.channelId || '', entry.messageId || null, entry.authorId, entry.content || null, Date.now());
            } catch {}
          }
          renameSync(msgFile, msgFile + '.migrated');
        } catch {}
      }

      const rxnFile = join(dir, guildId, 'reactions.jsonl');
      if (existsSync(rxnFile)) {
        try {
          const insert = db.prepare('INSERT INTO reaction_logs (guild_id, channel_id, message_id, emoji, author_id, added, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
          const lines = readFileSync(rxnFile, 'utf-8').split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              insert.run(guildId, entry.channelId || null, entry.messageId || null, entry.emoji, entry.authorId, entry.added !== false ? 1 : 0, Date.now());
            } catch {}
          }
          renameSync(rxnFile, rxnFile + '.migrated');
        } catch {}
      }
    }

    const guildFiles = readdirSync(dir).filter(f => /^\d+\.json$/.test(f) &&
      !['tickets.json', 'todos.json', 'logConfig.json', 'channelLogConfig.json', 'slowmodeConfig.json', 'ticketMeta.json', 'botperms.json', 'levels.json', 'levelRoles.json', 'levelNotifConfig.json', 'stickerConfig.json', 'tags.json', 'ticketConfig.json', 'trialapps.json'].includes(f));

    for (const f of guildFiles) {
      try {
        const guildId = f.replace('.json', '');
        const data = JSON.parse(readFileSync(join(dir, f), 'utf-8')) as Record<string, any[]>;
        const stmt = db.prepare('INSERT OR REPLACE INTO infractions (guild_id, user_id, infractions) VALUES (?, ?, ?)');
        for (const [userId, infs] of Object.entries(data)) {
          stmt.run(guildId, userId, JSON.stringify(infs));
        }
        renameSync(join(dir, f), join(dir, f) + '.migrated');
        console.log(`  Migrated ${f}`);
      } catch {}
    }
  });

  console.log('Migrating JSON data to SQLite...');
  tx();
  console.log('Migration complete.');
}

initSchema();

const INS_GUILD_CONFIG = db.prepare('INSERT OR REPLACE INTO guild_config (guild_id, key, value) VALUES (?, ?, ?)');
const GET_GUILD_CONFIG = db.prepare('SELECT value FROM guild_config WHERE guild_id = ? AND key = ?');
const DEL_GUILD_CONFIG = db.prepare('DELETE FROM guild_config WHERE guild_id = ? AND key = ?');

export function getGuildConfig(guildId: string, key: string): string | null {
  const row = GET_GUILD_CONFIG.get(guildId, key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setGuildConfig(guildId: string, key: string, value: string | null) {
  if (value === null) {
    DEL_GUILD_CONFIG.run(guildId, key);
  } else {
    INS_GUILD_CONFIG.run(guildId, key, value);
  }
}

const INS_BOT_PERMS = db.prepare('INSERT OR REPLACE INTO bot_perms (guild_id, command_name, role_ids) VALUES (?, ?, ?)');
const GET_BOT_PERMS = db.prepare('SELECT role_ids FROM bot_perms WHERE guild_id = ? AND command_name = ?');
const GET_ALL_BOT_PERMS = db.prepare('SELECT command_name, role_ids FROM bot_perms WHERE guild_id = ?');

export function getCommandRoles(guildId: string, commandName: string): string[] {
  const row = GET_BOT_PERMS.get(guildId, commandName) as { role_ids: string } | undefined;
  return row ? JSON.parse(row.role_ids) : [];
}

export function setCommandRoles(guildId: string, commandName: string, roleIds: string[]) {
  INS_BOT_PERMS.run(guildId, commandName, JSON.stringify(roleIds));
}

export function getAllPerms(guildId: string): Array<{ command: string; roles: string[] }> {
  const rows = GET_ALL_BOT_PERMS.all(guildId) as Array<{ command_name: string; role_ids: string }>;
  return rows.map(r => ({ command: r.command_name, roles: JSON.parse(r.role_ids) }));
}

const GET_LEVEL = db.prepare('SELECT * FROM levels WHERE guild_id = ? AND user_id = ?');
const UPSERT_LEVEL = db.prepare('INSERT OR REPLACE INTO levels (guild_id, user_id, xp, weekly_xp, weekly_reset_at, last_message_at) VALUES (?, ?, ?, ?, ?, ?)');
const GET_ALL_LEVELS_GUILD = db.prepare('SELECT * FROM levels WHERE guild_id = ?');
const DEL_LEVEL = db.prepare('DELETE FROM levels WHERE guild_id = ? AND user_id = ?');
const DEL_ALL_GUILD_LEVELS = db.prepare('DELETE FROM levels WHERE guild_id = ?');
const RESET_WEEKLY = db.prepare('UPDATE levels SET weekly_xp = 0, weekly_reset_at = ? WHERE guild_id = ?');

export interface LevelRow {
  guild_id: string;
  user_id: string;
  xp: number;
  weekly_xp: number;
  weekly_reset_at: number;
  last_message_at: number;
}

export function getLevelRow(guildId: string, userId: string): LevelRow | null {
  return (GET_LEVEL.get(guildId, userId) as LevelRow | undefined) ?? null;
}

export function upsertLevelRow(guildId: string, userId: string, data: Partial<LevelRow>) {
  const existing = getLevelRow(guildId, userId);
  const merged: LevelRow = {
    guild_id: guildId,
    user_id: userId,
    xp: 0,
    weekly_xp: 0,
    weekly_reset_at: 0,
    last_message_at: 0,
    ...existing,
    ...data,
  };
  UPSERT_LEVEL.run(merged.guild_id, merged.user_id, merged.xp, merged.weekly_xp, merged.weekly_reset_at, merged.last_message_at);
}

export function getAllLevels(guildId: string): LevelRow[] {
  return GET_ALL_LEVELS_GUILD.all(guildId) as LevelRow[];
}

export function deleteLevel(guildId: string, userId: string) {
  DEL_LEVEL.run(guildId, userId);
}

export function deleteAllGuildLevels(guildId: string) {
  DEL_ALL_GUILD_LEVELS.run(guildId);
}

export function resetWeeklyXp(guildId: string): number {
  const result = RESET_WEEKLY.run(Date.now(), guildId);
  return result.changes;
}

const INS_LEVEL_ROLE = db.prepare('INSERT OR REPLACE INTO level_roles (guild_id, level, role_id) VALUES (?, ?, ?)');
const GET_LEVEL_ROLE = db.prepare('SELECT role_id FROM level_roles WHERE guild_id = ? AND level = ?');
const DEL_LEVEL_ROLE = db.prepare('DELETE FROM level_roles WHERE guild_id = ? AND level = ?');
const LIST_LEVEL_ROLES = db.prepare('SELECT level, role_id FROM level_roles WHERE guild_id = ? ORDER BY level ASC');

export function getLevelRole(guildId: string, level: number): string | null {
  const row = GET_LEVEL_ROLE.get(guildId, level) as { role_id: string } | undefined;
  return row?.role_id ?? null;
}

export function setLevelRole(guildId: string, level: number, roleId: string) {
  INS_LEVEL_ROLE.run(guildId, level, roleId);
}

export function removeLevelRole(guildId: string, level: number): boolean {
  const result = DEL_LEVEL_ROLE.run(guildId, level);
  return result.changes > 0;
}

export function listLevelRoles(guildId: string): { level: number; roleId: string }[] {
  return LIST_LEVEL_ROLES.all(guildId) as { level: number; roleId: string }[];
}

const INS_LOG_CONFIG = db.prepare('INSERT OR REPLACE INTO log_config (guild_id, messages, reactions) VALUES (?, ?, ?)');
const GET_LOG_CONFIG = db.prepare('SELECT messages, reactions FROM log_config WHERE guild_id = ?');

export function getLogConfig(guildId: string): { messages: boolean; reactions: boolean } {
  const row = GET_LOG_CONFIG.get(guildId) as { messages: number; reactions: number } | undefined;
  return { messages: row?.messages === 1, reactions: row?.reactions === 1 };
}

export function setLogConfig(guildId: string, messages?: boolean, reactions?: boolean) {
  const existing = getLogConfig(guildId);
  INS_LOG_CONFIG.run(guildId,
    messages !== undefined ? (messages ? 1 : 0) : (existing.messages ? 1 : 0),
    reactions !== undefined ? (reactions ? 1 : 0) : (existing.reactions ? 1 : 0)
  );
}

const INS_CHANNEL_LOG_CONFIG = db.prepare('INSERT OR REPLACE INTO channel_log_config (channel_id, messages, reactions) VALUES (?, ?, ?)');
const GET_CHANNEL_LOG_CONFIG = db.prepare('SELECT messages, reactions FROM channel_log_config WHERE channel_id = ?');

export function getChannelLogConfig(channelId: string): { messages: boolean; reactions: boolean } {
  const row = GET_CHANNEL_LOG_CONFIG.get(channelId) as { messages: number; reactions: number } | undefined;
  return { messages: row?.messages === 1, reactions: row?.reactions === 1 };
}

export function setChannelLogConfig(channelId: string, messages?: boolean, reactions?: boolean) {
  const existing = getChannelLogConfig(channelId);
  INS_CHANNEL_LOG_CONFIG.run(channelId,
    messages !== undefined ? (messages ? 1 : 0) : (existing.messages ? 1 : 0),
    reactions !== undefined ? (reactions ? 1 : 0) : (existing.reactions ? 1 : 0)
  );
}

const INS_SLOWMODE = db.prepare('INSERT OR IGNORE INTO slowmode_channels (guild_id, channel_id) VALUES (?, ?)');
const DEL_SLOWMODE = db.prepare('DELETE FROM slowmode_channels WHERE guild_id = ? AND channel_id = ?');
const GET_SLOWMODE_CHANNELS = db.prepare('SELECT channel_id FROM slowmode_channels WHERE guild_id = ?');
const GET_SLOWMODE_ALL = db.prepare('SELECT channel_id FROM slowmode_channels');

export function enableSlowmodeChannel(guildId: string, channelId: string) {
  INS_SLOWMODE.run(guildId, channelId);
}

export function disableSlowmodeChannel(guildId: string, channelId: string) {
  DEL_SLOWMODE.run(guildId, channelId);
}

export function isSlowmodeEnabled(channelId: string): boolean {
  const rows = GET_SLOWMODE_ALL.all() as { channel_id: string }[];
  return rows.some(r => r.channel_id === channelId);
}

export function getEnabledSlowmodeChannels(guildId?: string): Set<string> {
  const rows = guildId
    ? (GET_SLOWMODE_CHANNELS.all(guildId) as { channel_id: string }[])
    : (GET_SLOWMODE_ALL.all() as { channel_id: string }[]);
  return new Set(rows.map(r => r.channel_id));
}

const INS_STICKER = db.prepare('INSERT OR REPLACE INTO sticker_config (guild_id, enabled) VALUES (?, ?)');
const GET_STICKER = db.prepare('SELECT enabled FROM sticker_config WHERE guild_id = ?');

export function isStickerDetectionEnabled(guildId: string): boolean {
  const row = GET_STICKER.get(guildId) as { enabled: number } | undefined;
  return row === undefined ? true : row.enabled === 1;
}

export function setStickerDetectionEnabled(guildId: string, enabled: boolean) {
  INS_STICKER.run(guildId, enabled ? 1 : 0);
}

const GET_TAGS = db.prepare('SELECT * FROM tags WHERE guild_id = ? ORDER BY id ASC');
const GET_TAG_BY_NAME = db.prepare('SELECT * FROM tags WHERE guild_id = ? AND name = ?');
const INS_TAG = db.prepare('INSERT OR REPLACE INTO tags (id, guild_id, name, aliases, title, content, footer, image_url, created_by, updated_by, uses, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
const DEL_TAG = db.prepare('DELETE FROM tags WHERE guild_id = ? AND name = ?');
const MAX_TAG_ID = db.prepare('SELECT COALESCE(MAX(id), 0) as max_id FROM tags WHERE guild_id = ?');

export function getTags(guildId: string) {
  return GET_TAGS.all(guildId);
}

export function getTag(guildId: string, name: string) {
  return GET_TAG_BY_NAME.get(guildId, name) || null;
}

export function createTag(guildId: string, name: string, content: string, authorId: string, opts?: { aliases?: string[]; title?: string; footer?: string; imageUrl?: string }) {
  const existing = getTag(guildId, name);
  if (existing) throw new Error(`Tag "${name}" already exists.`);
  const maxRow = MAX_TAG_ID.get(guildId) as { max_id: number };
  const id = maxRow.max_id + 1;
  const tag: any = {
    id, guild_id: guildId, name, aliases: JSON.stringify(opts?.aliases || []),
    title: opts?.title || '', content, footer: opts?.footer || null,
    image_url: opts?.imageUrl || null, created_by: authorId, updated_by: null,
    uses: 0, created_at: Date.now(), updated_at: null
  };
  INS_TAG.run(tag.id, tag.guild_id, tag.name, tag.aliases, tag.title, tag.content, tag.footer, tag.image_url, tag.created_by, tag.updated_by, tag.uses, tag.created_at, tag.updated_at);
  return tag;
}

export function editTag(guildId: string, currentName: string, updates: { name?: string; content?: string; aliases?: string[]; title?: string; footer?: string; imageUrl?: string }, editorId: string) {
  const existing = getTag(guildId, currentName) as any;
  if (!existing) return null;
  if (updates.name !== undefined && updates.name !== currentName) {
    const dup = getTag(guildId, updates.name);
    if (dup) throw new Error(`Tag "${updates.name}" already exists.`);
    existing.name = updates.name;
  }
  if (updates.content !== undefined) existing.content = updates.content;
  if (updates.aliases !== undefined) existing.aliases = JSON.stringify(updates.aliases);
  if (updates.title !== undefined) existing.title = updates.title;
  if (updates.footer !== undefined) existing.footer = updates.footer || null;
  if (updates.imageUrl !== undefined) existing.image_url = updates.imageUrl || null;
  existing.updated_by = editorId;
  existing.updated_at = Date.now();
  INS_TAG.run(existing.id, existing.guild_id, existing.name, existing.aliases, existing.title, existing.content, existing.footer, existing.image_url, existing.created_by, existing.updated_by, existing.uses, existing.created_at, existing.updated_at);
  return existing;
}

export function deleteTag(guildId: string, name: string) {
  const existing = getTag(guildId, name);
  if (!existing) return null;
  DEL_TAG.run(guildId, name);
  return existing;
}

export function incrementTagUses(guildId: string, name: string) {
  const existing = getTag(guildId, name) as any;
  if (!existing) return;
  existing.uses++;
  INS_TAG.run(existing.id, existing.guild_id, existing.name, existing.aliases, existing.title, existing.content, existing.footer, existing.image_url, existing.created_by, existing.updated_by, existing.uses, existing.created_at, existing.updated_at);
}

export function getTicketConfig(guildId: string) {
  const row = db.prepare('SELECT * FROM ticket_config WHERE guild_id = ?').get(guildId) as any;
  if (!row) return { ticketCategoryId: null, loggingChannelId: null, panelChannelId: null, panelMessageId: null, supportRoleIds: [], pingRoles: {} };
  return {
    ticketCategoryId: row.category_id,
    loggingChannelId: row.log_channel_id,
    panelChannelId: row.panel_channel_id,
    panelMessageId: row.panel_message_id,
    supportRoleIds: JSON.parse(row.support_role_ids || '[]'),
    pingRoles: JSON.parse(row.ping_roles || '{}'),
  };
}

export function setTicketConfig(guildId: string, config: Partial<ReturnType<typeof getTicketConfig>>) {
  const existing = getTicketConfig(guildId);
  const merged = { ...existing, ...config };
  db.prepare('INSERT OR REPLACE INTO ticket_config (guild_id, category_id, log_channel_id, panel_channel_id, panel_message_id, support_role_ids, ping_roles) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    guildId, merged.ticketCategoryId, merged.loggingChannelId, merged.panelChannelId, merged.panelMessageId,
    JSON.stringify(merged.supportRoleIds), JSON.stringify(merged.pingRoles)
  );
}

export function setPingRole(guildId: string, category: string, roleId: string | null) {
  const cfg = getTicketConfig(guildId);
  const pingRoles = { ...cfg.pingRoles };
  if (roleId) {
    pingRoles[category] = roleId;
  } else {
    delete pingRoles[category];
  }
  setTicketConfig(guildId, { pingRoles });
}

export function getPingRole(guildId: string, category: string): string | null {
  return getTicketConfig(guildId).pingRoles[category] || null;
}

const TICKET_BY_ID = db.prepare('SELECT * FROM tickets WHERE guild_id = ? AND id = ?');
const TICKETS_BY_GUILD = db.prepare('SELECT * FROM tickets WHERE guild_id = ? ORDER BY id ASC');
const TICKET_BY_CHANNEL = db.prepare('SELECT * FROM tickets WHERE channel_id = ?');
const ALL_TICKETS = db.prepare('SELECT * FROM tickets');
const INS_TICKET = db.prepare('INSERT OR REPLACE INTO tickets (id, guild_id, channel_id, creator_id, creator_tag, category, status, priority, subject, claimed_by, claimed_at, notes, created_at, closed_at, closed_by, close_reason, transcript_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
const MAX_TICKET_ID = db.prepare('SELECT COALESCE(MAX(id), 0) as max_id FROM tickets WHERE guild_id = ?');

export function createTicket(guildId: string, channelId: string, creatorId: string, creatorTag: string, category: string, subject?: string) {
  const maxRow = MAX_TICKET_ID.get(guildId) as { max_id: number };
  const id = maxRow.max_id + 1;
  const ticket: any = {
    id, guild_id: guildId, channel_id: channelId, creator_id: creatorId, creator_tag: creatorTag,
    category, status: 'open', priority: 'medium', subject: subject || '',
    claimed_by: null, claimed_at: null, notes: '[]',
    created_at: Date.now(), closed_at: null, closed_by: null, close_reason: null, transcript_path: null
  };
  INS_TICKET.run(ticket.id, ticket.guild_id, ticket.channel_id, ticket.creator_id, ticket.creator_tag, ticket.category, ticket.status, ticket.priority, ticket.subject, ticket.claimed_by, ticket.claimed_at, ticket.notes, ticket.created_at, ticket.closed_at, ticket.closed_by, ticket.close_reason, ticket.transcript_path);
  return ticket;
}

export function getTickets(guildId: string) {
  return TICKETS_BY_GUILD.all(guildId);
}

export function getTicket(guildId: string, ticketId: number) {
  return TICKET_BY_ID.get(guildId, ticketId) || null;
}

export function getTicketByChannel(channelId: string) {
  return TICKET_BY_CHANNEL.get(channelId) || null;
}

export function updateTicket(guildId: string, ticketId: number, updates: any) {
  const t = getTicket(guildId, ticketId) as any;
  if (!t) return null;
  for (const [k, v] of Object.entries(updates)) {
    if (k === 'notes' && typeof v !== 'string') {
      t.notes = JSON.stringify(v);
    } else {
      t[k] = v;
    }
  }
  INS_TICKET.run(t.id, t.guild_id, t.channel_id, t.creator_id, t.creator_tag, t.category, t.status, t.priority, t.subject, t.claimed_by, t.claimed_at, t.notes, t.created_at, t.closed_at, t.closed_by, t.close_reason, t.transcript_path);
  return t;
}

export function searchTickets(guildId: string, query: { userId?: string; status?: string; category?: string }) {
  const conditions: string[] = ['guild_id = ?'];
  const params: any[] = [guildId];
  if (query.userId) { conditions.push('creator_id = ?'); params.push(query.userId); }
  if (query.status) { conditions.push('status = ?'); params.push(query.status); }
  if (query.category) { conditions.push('category = ?'); params.push(query.category); }
  const sql = `SELECT * FROM tickets WHERE ${conditions.join(' AND ')} ORDER BY id ASC`;
  return db.prepare(sql).all(...params);
}

export function getTicketStats(guildId: string) {
  const tickets = getTickets(guildId) as any[];
  const open = tickets.filter(t => t.status === 'open');
  const claimed = tickets.filter(t => t.status === 'claimed');
  const closed = tickets.filter(t => t.status === 'closed');
  const byCategory: Record<string, number> = {};
  const byStaff: Record<string, { closed: number; claimed: number }> = {};
  for (const t of tickets) {
    byCategory[t.category] = (byCategory[t.category] || 0) + 1;
    if (t.claimed_by) {
      byStaff[t.claimed_by] = byStaff[t.claimed_by] || { closed: 0, claimed: 0 };
      byStaff[t.claimed_by].claimed++;
      if (t.status === 'closed') byStaff[t.claimed_by].closed++;
    }
  }
  const avgClosureMs = closed.reduce((sum, t) => {
    if (t.closed_at && t.created_at) return sum + (t.closed_at - t.created_at);
    return sum;
  }, 0) / (closed.length || 1);
  return { total: tickets.length, open: open.length, claimed: claimed.length, closed: closed.length, byCategory, byStaff, avgClosureHours: Math.round(avgClosureMs / 3600000 * 10) / 10 };
}

const TODOS_BY_GUILD = db.prepare('SELECT * FROM todos WHERE guild_id = ? ORDER BY id ASC');
const INS_TODO = db.prepare('INSERT OR REPLACE INTO todos (id, guild_id, text, author_id, author_tag, created_at, edited_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
const DEL_TODO = db.prepare('DELETE FROM todos WHERE guild_id = ? AND id = ?');
const MAX_TODO_ID = db.prepare('SELECT COALESCE(MAX(id), 0) as max_id FROM todos WHERE guild_id = ?');

export function getTodos(guildId: string) {
  return TODOS_BY_GUILD.all(guildId);
}

export function addTodo(guildId: string, text: string, authorId: string, authorTag: string) {
  const maxRow = MAX_TODO_ID.get(guildId) as { max_id: number };
  const id = maxRow.max_id + 1;
  const item = { id, guild_id: guildId, text, author_id: authorId, author_tag: authorTag, created_at: Date.now(), edited_at: null };
  INS_TODO.run(item.id, item.guild_id, item.text, item.author_id, item.author_tag, item.created_at, item.edited_at);
  return item;
}

export function removeTodo(guildId: string, id: number) {
  const existing = db.prepare('SELECT * FROM todos WHERE guild_id = ? AND id = ?').get(guildId, id);
  if (!existing) return null;
  DEL_TODO.run(guildId, id);
  return existing;
}

export function editTodo(guildId: string, id: number, newText: string) {
  const existing = db.prepare('SELECT * FROM todos WHERE guild_id = ? AND id = ?').get(guildId, id) as any;
  if (!existing) return null;
  existing.text = newText;
  existing.edited_at = Date.now();
  INS_TODO.run(existing.id, existing.guild_id, existing.text, existing.author_id, existing.author_tag, existing.created_at, existing.edited_at);
  return existing;
}

export function clearTodos(guildId: string) {
  const rows = getTodos(guildId);
  db.prepare('DELETE FROM todos WHERE guild_id = ?').run(guildId);
  return rows;
}

const GET_TRIAL_APP = db.prepare('SELECT * FROM trial_apps WHERE guild_id = ?');
const INS_TRIAL_APP = db.prepare('INSERT OR REPLACE INTO trial_apps (guild_id, channel_id, forms) VALUES (?, ?, ?)');

export function getTrialAppChannel(guildId: string): string | null {
  const row = GET_TRIAL_APP.get(guildId) as { channel_id: string } | undefined;
  return row?.channel_id ?? null;
}

export function setTrialAppChannel(guildId: string, channelId: string | null) {
  const existing = GET_TRIAL_APP.get(guildId) as { forms: string } | undefined;
  const forms = existing ? JSON.parse(existing.forms) : [];
  INS_TRIAL_APP.run(guildId, channelId, JSON.stringify(forms));
}

export function getForms(guildId: string): Array<{ name: string; questions: string[] }> {
  const row = GET_TRIAL_APP.get(guildId) as { forms: string } | undefined;
  return row ? JSON.parse(row.forms) : [];
}

export function getForm(guildId: string, name: string): { name: string; questions: string[] } | undefined {
  return getForms(guildId).find(f => f.name === name);
}

export function addForm(guildId: string, form: { name: string; questions: string[] }) {
  const existing = GET_TRIAL_APP.get(guildId) as { channel_id: string; forms: string } | undefined;
  const channelId = existing?.channel_id ?? null;
  const forms = existing ? JSON.parse(existing.forms) : [];
  forms.push(form);
  INS_TRIAL_APP.run(guildId, channelId, JSON.stringify(forms));
}

export function removeForm(guildId: string, formName: string): boolean {
  const existing = GET_TRIAL_APP.get(guildId) as { channel_id: string; forms: string } | undefined;
  if (!existing) return false;
  const forms: Array<{ name: string; questions: string[] }> = JSON.parse(existing.forms);
  const idx = forms.findIndex(f => f.name === formName);
  if (idx === -1) return false;
  forms.splice(idx, 1);
  INS_TRIAL_APP.run(guildId, existing.channel_id, JSON.stringify(forms));
  return true;
}

const INS_MESSAGE_LOG = db.prepare('INSERT INTO message_logs (guild_id, channel_id, message_id, author_id, content, created_at) VALUES (?, ?, ?, ?, ?, ?)');

export function logMessage(guildId: string, entry: { messageId: string; authorId: string; content: string; channelId: string }) {
  INS_MESSAGE_LOG.run(guildId, entry.channelId, entry.messageId, entry.authorId, entry.content, Date.now());
}

const INS_REACTION_LOG = db.prepare('INSERT INTO reaction_logs (guild_id, channel_id, message_id, emoji, author_id, added, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');

export function logReaction(guildId: string, entry: { messageId: string; authorId: string; emoji: string; channelId: string; added: boolean }) {
  INS_REACTION_LOG.run(guildId, entry.channelId, entry.messageId, entry.emoji, entry.authorId, entry.added ? 1 : 0, Date.now());
}

export function getInfractions(guildId: string, userId: string): any[] {
  const row = db.prepare('SELECT infractions FROM infractions WHERE guild_id = ? AND user_id = ?').get(guildId, userId) as { infractions: string } | undefined;
  return row ? JSON.parse(row.infractions) : [];
}

export function setInfractions(guildId: string, userId: string, infractions: any[]) {
  db.prepare('INSERT OR REPLACE INTO infractions (guild_id, user_id, infractions) VALUES (?, ?, ?)').run(guildId, userId, JSON.stringify(infractions));
}

export function deleteInfractions(guildId: string, userId: string) {
  db.prepare('DELETE FROM infractions WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
}

export function getAllInfractionGuilds(): string[] {
  const rows = db.prepare('SELECT DISTINCT guild_id FROM infractions').all() as { guild_id: string }[];
  return rows.map(r => r.guild_id);
}

export function getInfractionUserIds(guildId: string): string[] {
  const rows = db.prepare('SELECT user_id FROM infractions WHERE guild_id = ?').all(guildId) as { user_id: string }[];
  return rows.map(r => r.user_id);
}

export function getAllTickets(): any[] {
  return ALL_TICKETS.all();
}

export function getTicketMeta(guildId: string): { moderatorChannel: string | null } {
  return { moderatorChannel: getGuildConfig(guildId, 'moderator_channel') };
}

export function setTicketMeta(guildId: string, meta: { moderatorChannel: string | null }) {
  setGuildConfig(guildId, 'moderator_channel', meta.moderatorChannel);
}

export function getAllLogConfigs(): any[] {
  return db.prepare('SELECT * FROM log_config').all();
}

export function getAllChannelLogConfigs(): any[] {
  return db.prepare('SELECT * FROM channel_log_config').all();
}

export function getSlowmodeConfig(): { enabledChannels: string[] } {
  const rows = GET_SLOWMODE_ALL.all() as { channel_id: string }[];
  return { enabledChannels: rows.map(r => r.channel_id) };
}

export function getMessageLogCount(): number {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM message_logs').get() as { cnt: number };
  return row.cnt;
}

export function closeTicket(guildId: string, ticketId: number, closedBy: string, reason?: string, transcriptPath?: string) {
  return updateTicket(guildId, ticketId, {
    status: 'closed',
    closed_by: closedBy,
    closed_at: Date.now(),
    close_reason: reason || null,
    transcript_path: transcriptPath || null
  });
}

export function claimTicket(guildId: string, ticketId: number, userId: string) {
  return updateTicket(guildId, ticketId, { status: 'claimed', claimed_by: userId, claimed_at: Date.now() });
}

export function reopenTicket(guildId: string, ticketId: number) {
  return updateTicket(guildId, ticketId, { status: 'open', closed_by: null, closed_at: null, close_reason: null });
}

export function addNote(guildId: string, ticketId: number, authorId: string, content: string) {
  const t = getTicket(guildId, ticketId) as any;
  if (!t) return null;
  const notes = JSON.parse(t.notes || '[]');
  notes.push({ authorId, content, createdAt: Date.now() });
  t.notes = JSON.stringify(notes);
  INS_TICKET.run(t.id, t.guild_id, t.channel_id, t.creator_id, t.creator_tag, t.category, t.status, t.priority, t.subject, t.claimed_by, t.claimed_at, t.notes, t.created_at, t.closed_at, t.closed_by, t.close_reason, t.transcript_path);
  return t;
}

export function setModeratorChannel(guildId: string, channelId: string) {
  setTicketConfig(guildId, { loggingChannelId: channelId });
}

export function getModeratorChannel(guildId: string): string | null {
  return getTicketConfig(guildId).loggingChannelId;
}

const INS_AUTOMOD_RULE = db.prepare('INSERT OR REPLACE INTO automod_rules (guild_id, name, enabled, conditions, actions, whitelist, blacklist, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
const GET_AUTOMOD_RULE = db.prepare('SELECT * FROM automod_rules WHERE guild_id = ? AND name = ?');
const GET_ALL_AUTOMOD_RULES = db.prepare('SELECT * FROM automod_rules WHERE guild_id = ? ORDER BY created_at ASC');
const DEL_AUTOMOD_RULE = db.prepare('DELETE FROM automod_rules WHERE guild_id = ? AND name = ?');
const INS_AUTOMOD_LOG = db.prepare('INSERT INTO automod_logs (guild_id, rule_name, user_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)');

export interface AutoModCondition {
  type: 'keyword' | 'regex' | 'mentions' | 'emotes' | 'links' | 'caps' | 'spoilers' | 'attachments';
  value?: string;
  min?: number;
  max?: number;
}

export interface AutoModAction {
  type: 'delete' | 'warn' | 'timeout' | 'log';
  reason?: string;
  duration?: number;
  channel_id?: string;
}

export interface AutoModRule {
  guild_id: string;
  name: string;
  enabled: boolean;
  conditions: AutoModCondition[];
  actions: AutoModAction[];
  whitelist: string[];
  blacklist: string[];
  created_at: number;
  updated_at: number | null;
}

export function createAutoModRule(guildId: string, name: string, conditions: AutoModCondition[], actions: AutoModAction[]) {
  const now = Date.now();
  INS_AUTOMOD_RULE.run(guildId, name, 1, JSON.stringify(conditions), JSON.stringify(actions), '[]', '[]', now, null);
}

export function getAutoModRule(guildId: string, name: string): AutoModRule | null {
  const row = GET_AUTOMOD_RULE.get(guildId, name) as any;
  if (!row) return null;
  return {
    guild_id: row.guild_id, name: row.name, enabled: row.enabled === 1,
    conditions: JSON.parse(row.conditions), actions: JSON.parse(row.actions),
    whitelist: JSON.parse(row.whitelist), blacklist: JSON.parse(row.blacklist),
    created_at: row.created_at, updated_at: row.updated_at,
  };
}

export function getAutoModRules(guildId: string): AutoModRule[] {
  return (GET_ALL_AUTOMOD_RULES.all(guildId) as any[]).map(row => ({
    guild_id: row.guild_id, name: row.name, enabled: row.enabled === 1,
    conditions: JSON.parse(row.conditions), actions: JSON.parse(row.actions),
    whitelist: JSON.parse(row.whitelist), blacklist: JSON.parse(row.blacklist),
    created_at: row.created_at, updated_at: row.updated_at,
  }));
}

export function updateAutoModRule(guildId: string, name: string, updates: Partial<{ enabled: boolean; conditions: AutoModCondition[]; actions: AutoModAction[]; whitelist: string[]; blacklist: string[] }>) {
  const existing = getAutoModRule(guildId, name);
  if (!existing) return null;
  const merged = { ...existing, ...updates };
  INS_AUTOMOD_RULE.run(guildId, name, merged.enabled ? 1 : 0, JSON.stringify(merged.conditions), JSON.stringify(merged.actions), JSON.stringify(merged.whitelist), JSON.stringify(merged.blacklist), merged.created_at, Date.now());
  return getAutoModRule(guildId, name);
}

export function deleteAutoModRule(guildId: string, name: string): boolean {
  const result = DEL_AUTOMOD_RULE.run(guildId, name);
  return result.changes > 0;
}

export function logAutoModAction(guildId: string, ruleName: string, userId: string, action: string, detail?: string) {
  INS_AUTOMOD_LOG.run(guildId, ruleName, userId, action, detail || null, Date.now());
}

// ======== ECONOMY ========

const GET_ECONOMY = db.prepare('SELECT * FROM economy WHERE guild_id = ? AND user_id = ?');
const UPSERT_ECONOMY = db.prepare('INSERT OR REPLACE INTO economy (guild_id, user_id, wallet, bank, inventory, last_daily, last_work, last_beg, last_crime, last_rob, last_gamble, last_fish, last_mine) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

export interface EconomyData {
  guild_id: string;
  user_id: string;
  wallet: number;
  bank: number;
  inventory: Record<string, number>;
  last_daily: number;
  last_work: number;
  last_beg: number;
  last_crime: number;
  last_rob: number;
  last_gamble: number;
  last_fish: number;
  last_mine: number;
}

export function getEconomy(guildId: string, userId: string): EconomyData {
  const row = GET_ECONOMY.get(guildId, userId) as any;
  if (row) {
    return {
      guild_id: row.guild_id, user_id: row.user_id, wallet: row.wallet, bank: row.bank,
      inventory: JSON.parse(row.inventory || '{}'),
      last_daily: row.last_daily, last_work: row.last_work, last_beg: row.last_beg,
      last_crime: row.last_crime, last_rob: row.last_rob, last_gamble: row.last_gamble,
      last_fish: row.last_fish, last_mine: row.last_mine,
    };
  }
  return { guild_id: guildId, user_id: userId, wallet: 0, bank: 0, inventory: {}, last_daily: 0, last_work: 0, last_beg: 0, last_crime: 0, last_rob: 0, last_gamble: 0, last_fish: 0, last_mine: 0 };
}

export function setEconomy(guildId: string, userId: string, data: Partial<EconomyData>) {
  const existing = getEconomy(guildId, userId);
  const merged = { ...existing, ...data };
  if (merged.inventory && typeof merged.inventory !== 'string') {
    (merged as any)._inventory = JSON.stringify(merged.inventory);
  }
  UPSERT_ECONOMY.run(merged.guild_id, merged.user_id, merged.wallet, merged.bank,
    JSON.stringify(merged.inventory), merged.last_daily, merged.last_work, merged.last_beg,
    merged.last_crime, merged.last_rob, merged.last_gamble, merged.last_fish, merged.last_mine);
}

const GET_ECONOMY_LEADERBOARD = db.prepare('SELECT user_id, wallet, bank FROM economy WHERE guild_id = ? ORDER BY (wallet + bank) DESC');

export function getEconomyLeaderboard(guildId: string, limit = 10): { user_id: string; wallet: number; bank: number; total: number }[] {
  const rows = GET_ECONOMY_LEADERBOARD.all(guildId) as { user_id: string; wallet: number; bank: number }[];
  return rows.slice(0, limit).map(r => ({ user_id: r.user_id, wallet: r.wallet, bank: r.bank, total: r.wallet + r.bank }));
}

// ======== SHOP ========

const GET_SHOP_ITEMS = db.prepare('SELECT * FROM shop_items WHERE guild_id = ? ORDER BY item_id ASC');
const GET_SHOP_ITEM = db.prepare('SELECT * FROM shop_items WHERE guild_id = ? AND item_id = ?');
const INS_SHOP_ITEM = db.prepare('INSERT OR REPLACE INTO shop_items (guild_id, item_id, name, description, price, role_id, type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
const DEL_SHOP_ITEM = db.prepare('DELETE FROM shop_items WHERE guild_id = ? AND item_id = ?');
const MAX_SHOP_ITEM_ID = db.prepare('SELECT COALESCE(MAX(item_id), 0) as max_id FROM shop_items WHERE guild_id = ?');

export function getShopItems(guildId: string): any[] {
  return GET_SHOP_ITEMS.all(guildId);
}

export function getShopItem(guildId: string, itemId: number): any {
  return GET_SHOP_ITEM.get(guildId, itemId) || null;
}

export function addShopItem(guildId: string, name: string, price: number, opts?: { description?: string; roleId?: string; type?: string }) {
  const maxRow = MAX_SHOP_ITEM_ID.get(guildId) as { max_id: number };
  const itemId = maxRow.max_id + 1;
  INS_SHOP_ITEM.run(guildId, itemId, name, opts?.description || '', price, opts?.roleId || null, opts?.type || 'item', Date.now());
  return { item_id: itemId, guild_id: guildId, name, price };
}

export function deleteShopItem(guildId: string, itemId: number): boolean {
  const result = DEL_SHOP_ITEM.run(guildId, itemId);
  return result.changes > 0;
}

// ======== ECONOMY TRANSACTIONS ========

const INS_ECON_TRANSACTION = db.prepare('INSERT INTO economy_transactions (guild_id, user_id, type, amount, balance_after, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');

export function logEconTransaction(guildId: string, userId: string, type: string, amount: number, balanceAfter: number, description?: string) {
  INS_ECON_TRANSACTION.run(guildId, userId, type, amount, balanceAfter, description || null, Date.now());
}

// ======== WELCOME / GOODBYE ========

const GET_WELCOME = db.prepare('SELECT * FROM welcome_config WHERE guild_id = ?');
const SET_WELCOME = db.prepare('INSERT OR REPLACE INTO welcome_config (guild_id, channel_id, message, embed_json, enabled) VALUES (?, ?, ?, ?, ?)');

export function getWelcomeConfig(guildId: string): { channel_id: string | null; message: string; embed_json: string | null; enabled: boolean } {
  const row = GET_WELCOME.get(guildId) as any;
  if (!row) return { channel_id: null, message: 'Welcome {user} to {server}!', embed_json: null, enabled: false };
  return { channel_id: row.channel_id, message: row.message, embed_json: row.embed_json, enabled: row.enabled === 1 };
}

export function setWelcomeConfig(guildId: string, config: { channel_id?: string | null; message?: string; embed_json?: string | null; enabled?: boolean }) {
  const existing = getWelcomeConfig(guildId);
  const merged = { ...existing, ...config };
  SET_WELCOME.run(guildId, merged.channel_id, merged.message, merged.embed_json, merged.enabled ? 1 : 0);
}

const GET_GOODBYE = db.prepare('SELECT * FROM goodbye_config WHERE guild_id = ?');
const SET_GOODBYE = db.prepare('INSERT OR REPLACE INTO goodbye_config (guild_id, channel_id, message, embed_json, enabled) VALUES (?, ?, ?, ?, ?)');

export function getGoodbyeConfig(guildId: string): { channel_id: string | null; message: string; embed_json: string | null; enabled: boolean } {
  const row = GET_GOODBYE.get(guildId) as any;
  if (!row) return { channel_id: null, message: '{user} has left {server}.', embed_json: null, enabled: false };
  return { channel_id: row.channel_id, message: row.message, embed_json: row.embed_json, enabled: row.enabled === 1 };
}

export function setGoodbyeConfig(guildId: string, config: { channel_id?: string | null; message?: string; embed_json?: string | null; enabled?: boolean }) {
  const existing = getGoodbyeConfig(guildId);
  const merged = { ...existing, ...config };
  SET_GOODBYE.run(guildId, merged.channel_id, merged.message, merged.embed_json, merged.enabled ? 1 : 0);
}

// ======== AUTO ROLES ========

const GET_AUTO_ROLES = db.prepare('SELECT role_id FROM auto_roles WHERE guild_id = ?');
const INS_AUTO_ROLE = db.prepare('INSERT OR IGNORE INTO auto_roles (guild_id, role_id) VALUES (?, ?)');
const DEL_AUTO_ROLE = db.prepare('DELETE FROM auto_roles WHERE guild_id = ? AND role_id = ?');

export function getAutoRoles(guildId: string): string[] {
  const rows = GET_AUTO_ROLES.all(guildId) as { role_id: string }[];
  return rows.map(r => r.role_id);
}

export function addAutoRole(guildId: string, roleId: string) {
  INS_AUTO_ROLE.run(guildId, roleId);
}

export function removeAutoRole(guildId: string, roleId: string): boolean {
  const result = DEL_AUTO_ROLE.run(guildId, roleId);
  return result.changes > 0;
}

// ======== REACTION ROLES ========

const GET_REACTION_ROLES_MSG = db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ? AND message_id = ?');
const GET_ALL_REACTION_ROLES = db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ?');
const INS_REACTION_ROLE = db.prepare('INSERT OR REPLACE INTO reaction_roles (guild_id, message_id, channel_id, emoji, role_id, label, description) VALUES (?, ?, ?, ?, ?, ?, ?)');
const DEL_REACTION_ROLE = db.prepare('DELETE FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?');
const DEL_REACTION_ROLES_MSG = db.prepare('DELETE FROM reaction_roles WHERE guild_id = ? AND message_id = ?');

export function getReactionRoles(guildId: string): any[] {
  return GET_ALL_REACTION_ROLES.all(guildId);
}

export function getMessageReactionRoles(guildId: string, messageId: string): any[] {
  return GET_REACTION_ROLES_MSG.all(guildId, messageId);
}

export function setReactionRole(guildId: string, messageId: string, channelId: string, emoji: string, roleId: string, opts?: { label?: string; description?: string }) {
  INS_REACTION_ROLE.run(guildId, messageId, channelId, emoji, roleId, opts?.label || null, opts?.description || null);
}

export function removeReactionRole(guildId: string, messageId: string, emoji: string): boolean {
  const result = DEL_REACTION_ROLE.run(guildId, messageId, emoji);
  return result.changes > 0;
}

export function removeMessageReactionRoles(guildId: string, messageId: string) {
  DEL_REACTION_ROLES_MSG.run(guildId, messageId);
}

// ======== GIVEAWAYS ========

const GET_GIVEAWAY = db.prepare('SELECT * FROM giveaways WHERE message_id = ?');
const GET_ACTIVE_GIVEAWAYS = db.prepare('SELECT * FROM giveaways WHERE ended = 0');
const GET_GUILD_GIVEAWAYS = db.prepare('SELECT * FROM giveaways WHERE guild_id = ? ORDER BY created_at DESC');
const INS_GIVEAWAY = db.prepare('INSERT OR REPLACE INTO giveaways (guild_id, message_id, channel_id, prize, description, winners, end_time, host_id, ended, winner_ids, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
const DEL_GIVEAWAY = db.prepare('DELETE FROM giveaways WHERE message_id = ?');

export function getGiveaway(messageId: string): any {
  return GET_GIVEAWAY.get(messageId) || null;
}

export function getActiveGiveaways(): any[] {
  return GET_ACTIVE_GIVEAWAYS.all();
}

export function getGuildGiveaways(guildId: string): any[] {
  return GET_GUILD_GIVEAWAYS.all(guildId);
}

export function createGiveaway(guildId: string, messageId: string, channelId: string, prize: string, winners: number, endTime: number, hostId: string, description?: string) {
  INS_GIVEAWAY.run(guildId, messageId, channelId, prize, description || null, winners, endTime, hostId, 0, '[]', Date.now());
}

export function endGiveaway(messageId: string, winnerIds: string[]) {
  db.prepare('UPDATE giveaways SET ended = 1, winner_ids = ? WHERE message_id = ?').run(JSON.stringify(winnerIds), messageId);
}

export function deleteGiveaway(messageId: string): boolean {
  const result = DEL_GIVEAWAY.run(messageId);
  return result.changes > 0;
}

// ======== SERVER STATS ========

const GET_SERVER_STATS = db.prepare('SELECT * FROM server_stats WHERE guild_id = ?');
const SET_SERVER_STATS = db.prepare('INSERT OR REPLACE INTO server_stats (guild_id, member_channel_id, bot_channel_id, voice_channel_id, channel_category) VALUES (?, ?, ?, ?, ?)');

export function getServerStatsConfig(guildId: string): { member_channel_id: string | null; bot_channel_id: string | null; voice_channel_id: string | null; channel_category: string | null } {
  const row = GET_SERVER_STATS.get(guildId) as any;
  if (!row) return { member_channel_id: null, bot_channel_id: null, voice_channel_id: null, channel_category: null };
  return { member_channel_id: row.member_channel_id, bot_channel_id: row.bot_channel_id, voice_channel_id: row.voice_channel_id, channel_category: row.channel_category };
}

export function setServerStatsConfig(guildId: string, config: { member_channel_id?: string | null; bot_channel_id?: string | null; voice_channel_id?: string | null; channel_category?: string | null }) {
  const existing = getServerStatsConfig(guildId);
  const merged = { ...existing, ...config };
  SET_SERVER_STATS.run(guildId, merged.member_channel_id, merged.bot_channel_id, merged.voice_channel_id, merged.channel_category);
}

// ======== JOIN-TO-CREATE ========

const GET_JTC = db.prepare('SELECT * FROM join_to_create WHERE guild_id = ?');
const SET_JTC = db.prepare('INSERT OR REPLACE INTO join_to_create (guild_id, channel_id, category_id, voice_format) VALUES (?, ?, ?, ?)');
const DEL_JTC = db.prepare('DELETE FROM join_to_create WHERE guild_id = ?');

export function getJtcConfig(guildId: string): { channel_id: string | null; category_id: string | null; voice_format: string } {
  const row = GET_JTC.get(guildId) as any;
  if (!row) return { channel_id: null, category_id: null, voice_format: "{user}'s Channel" };
  return { channel_id: row.channel_id, category_id: row.category_id, voice_format: row.voice_format };
}

export function setJtcConfig(guildId: string, config: { channel_id?: string | null; category_id?: string | null; voice_format?: string }) {
  const existing = getJtcConfig(guildId);
  const merged = { ...existing, ...config };
  SET_JTC.run(guildId, merged.channel_id, merged.category_id, merged.voice_format);
}

export function deleteJtcConfig(guildId: string) {
  DEL_JTC.run(guildId);
}

// ======== BIRTHDAYS ========

const GET_BIRTHDAYS_GUILD = db.prepare('SELECT * FROM birthdays WHERE guild_id = ?');
const GET_BIRTHDAY = db.prepare('SELECT * FROM birthdays WHERE guild_id = ? AND user_id = ?');
const INS_BIRTHDAY = db.prepare('INSERT OR REPLACE INTO birthdays (guild_id, user_id, month, day, timezone, year) VALUES (?, ?, ?, ?, ?, ?)');
const DEL_BIRTHDAY = db.prepare('DELETE FROM birthdays WHERE guild_id = ? AND user_id = ?');
const GET_BIRTHDAYS_DATE = db.prepare('SELECT * FROM birthdays WHERE month = ? AND day = ?');

export function getGuildBirthdays(guildId: string): any[] {
  return GET_BIRTHDAYS_GUILD.all(guildId);
}

export function getBirthday(guildId: string, userId: string): any {
  return GET_BIRTHDAY.get(guildId, userId) || null;
}

export function setBirthday(guildId: string, userId: string, month: number, day: number, timezone?: string, year?: number) {
  INS_BIRTHDAY.run(guildId, userId, month, day, timezone || 'UTC', year || null);
}

export function removeBirthday(guildId: string, userId: string): boolean {
  const result = DEL_BIRTHDAY.run(guildId, userId);
  return result.changes > 0;
}

export function getBirthdaysByDate(month: number, day: number): { guild_id: string; user_id: string }[] {
  return GET_BIRTHDAYS_DATE.all(month, day) as { guild_id: string; user_id: string }[];
}

// ======== MODERATION CASES ========

const GET_MOD_CASES = db.prepare('SELECT * FROM mod_cases WHERE guild_id = ? AND user_id = ? ORDER BY case_id DESC');
const GET_ALL_MOD_CASES = db.prepare('SELECT * FROM mod_cases WHERE guild_id = ? ORDER BY case_id DESC');
const GET_MOD_CASE = db.prepare('SELECT * FROM mod_cases WHERE guild_id = ? AND case_id = ?');
const INS_MOD_CASE = db.prepare('INSERT OR REPLACE INTO mod_cases (guild_id, case_id, user_id, moderator_id, action, reason, duration, duration_unit, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
const MAX_MOD_CASE_ID = db.prepare('SELECT COALESCE(MAX(case_id), 0) as max_id FROM mod_cases WHERE guild_id = ?');

export interface ModCase {
  guild_id: string;
  case_id: number;
  user_id: string;
  moderator_id: string;
  action: string;
  reason: string;
  duration: number | null;
  duration_unit: string | null;
  created_at: number;
}

export function createModCase(guildId: string, userId: string, moderatorId: string, action: string, reason?: string, duration?: { value: number; unit: string }): ModCase {
  const maxRow = MAX_MOD_CASE_ID.get(guildId) as { max_id: number };
  const caseId = maxRow.max_id + 1;
  const c: ModCase = {
    guild_id: guildId, case_id: caseId, user_id: userId, moderator_id: moderatorId,
    action, reason: reason || '', duration: duration?.value ?? null,
    duration_unit: duration?.unit ?? null, created_at: Date.now(),
  };
  INS_MOD_CASE.run(c.guild_id, c.case_id, c.user_id, c.moderator_id, c.action, c.reason, c.duration, c.duration_unit, c.created_at);
  return c;
}

export function getModCases(guildId: string, userId?: string): ModCase[] {
  if (userId) return GET_MOD_CASES.all(guildId, userId) as ModCase[];
  return GET_ALL_MOD_CASES.all(guildId) as ModCase[];
}

export function getModCase(guildId: string, caseId: number): ModCase | null {
  return (GET_MOD_CASE.get(guildId, caseId) as ModCase | undefined) ?? null;
}

// ======== SLUMBER GUARD ========

const INS_SG_PRESET = db.prepare('INSERT OR REPLACE INTO slumberguard_presets (guild_id, name, threshold_users, threshold_time, slowmode_time, slowmode_length, min_messages, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
const GET_SG_PRESET = db.prepare('SELECT * FROM slumberguard_presets WHERE guild_id = ? AND name = ?');
const GET_SG_PRESETS = db.prepare('SELECT * FROM slumberguard_presets WHERE guild_id = ? ORDER BY name ASC');
const DEL_SG_PRESET = db.prepare('DELETE FROM slumberguard_presets WHERE guild_id = ? AND name = ?');

const GET_SG_CHANNEL = db.prepare('SELECT * FROM slumberguard_channels WHERE channel_id = ?');
const GET_SG_GUILD_CHANNELS = db.prepare('SELECT * FROM slumberguard_channels WHERE guild_id = ?');
const INS_SG_CHANNEL = db.prepare('INSERT OR REPLACE INTO slumberguard_channels (channel_id, guild_id, preset_name, enabled) VALUES (?, ?, ?, ?)');
const DEL_SG_CHANNEL = db.prepare('DELETE FROM slumberguard_channels WHERE channel_id = ?');

export interface SlumberGuardPreset {
  guild_id: string;
  name: string;
  threshold_users: number;
  threshold_time: number;
  slowmode_time: number;
  slowmode_length: number;
  min_messages: number;
  created_at: number;
}

export interface SlumberGuardChannel {
  channel_id: string;
  guild_id: string;
  preset_name: string;
  enabled: boolean;
}

export function getSlumberGuardPresets(guildId: string): SlumberGuardPreset[] {
  return (GET_SG_PRESETS.all(guildId) as any[]).map(r => ({
    guild_id: r.guild_id, name: r.name, threshold_users: r.threshold_users,
    threshold_time: r.threshold_time, slowmode_time: r.slowmode_time,
    slowmode_length: r.slowmode_length, min_messages: r.min_messages,
    created_at: r.created_at,
  }));
}

export function getSlumberGuardPreset(guildId: string, name: string): SlumberGuardPreset | null {
  const r = GET_SG_PRESET.get(guildId, name) as any;
  if (!r) return null;
  return {
    guild_id: r.guild_id, name: r.name, threshold_users: r.threshold_users,
    threshold_time: r.threshold_time, slowmode_time: r.slowmode_time,
    slowmode_length: r.slowmode_length, min_messages: r.min_messages,
    created_at: r.created_at,
  };
}

export function setSlumberGuardPreset(guildId: string, name: string, config: { threshold_users?: number; threshold_time?: number; slowmode_time?: number; slowmode_length?: number; min_messages?: number }) {
  const existing = getSlumberGuardPreset(guildId, name);
  const now = existing?.created_at ?? Date.now();
  INS_SG_PRESET.run(guildId, name,
    config.threshold_users ?? existing?.threshold_users ?? 5,
    config.threshold_time ?? existing?.threshold_time ?? 10,
    config.slowmode_time ?? existing?.slowmode_time ?? 10,
    config.slowmode_length ?? existing?.slowmode_length ?? 60,
    config.min_messages ?? existing?.min_messages ?? 2,
    now,
  );
}

export function deleteSlumberGuardPreset(guildId: string, name: string): boolean {
  const result = DEL_SG_PRESET.run(guildId, name);
  return result.changes > 0;
}

export function getSlumberGuardChannel(channelId: string): SlumberGuardChannel | null {
  const r = GET_SG_CHANNEL.get(channelId) as any;
  if (!r) return null;
  return { channel_id: r.channel_id, guild_id: r.guild_id, preset_name: r.preset_name, enabled: r.enabled === 1 };
}

export function getSlumberGuardGuildChannels(guildId: string): SlumberGuardChannel[] {
  return (GET_SG_GUILD_CHANNELS.all(guildId) as any[]).map(r => ({
    channel_id: r.channel_id, guild_id: r.guild_id, preset_name: r.preset_name, enabled: r.enabled === 1,
  }));
}

export function setSlumberGuardChannel(channelId: string, guildId: string, presetName: string, enabled: boolean) {
  INS_SG_CHANNEL.run(channelId, guildId, presetName, enabled ? 1 : 0);
}

export function deleteSlumberGuardChannel(channelId: string) {
  DEL_SG_CHANNEL.run(channelId);
}

export function ensureDefaultPresets(guildId: string) {
  const existing = getSlumberGuardPresets(guildId);
  if (existing.length > 0) return;
  const defaults: Array<{ name: string; threshold_users: number; threshold_time: number; slowmode_time: number; slowmode_length: number; min_messages: number }> = [
    { name: 'relaxed', threshold_users: 10, threshold_time: 15, slowmode_time: 5, slowmode_length: 30, min_messages: 3 },
    { name: 'default', threshold_users: 5, threshold_time: 10, slowmode_time: 10, slowmode_length: 60, min_messages: 2 },
    { name: 'strict', threshold_users: 3, threshold_time: 8, slowmode_time: 15, slowmode_length: 120, min_messages: 1 },
    { name: 'locked', threshold_users: 2, threshold_time: 5, slowmode_time: 30, slowmode_length: 300, min_messages: 1 },
  ];
  const now = Date.now();
  const stmt = db.prepare('INSERT OR IGNORE INTO slumberguard_presets (guild_id, name, threshold_users, threshold_time, slowmode_time, slowmode_length, min_messages, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  for (const p of defaults) {
    stmt.run(guildId, p.name, p.threshold_users, p.threshold_time, p.slowmode_time, p.slowmode_length, p.min_messages, now);
  }
}

// ======== CHAT MEMORY (LLM) ========

const INS_CHAT_MEMORY = db.prepare('INSERT INTO chat_memory (guild_id, channel_id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)');
const GET_CHAT_MEMORY = db.prepare('SELECT * FROM chat_memory WHERE guild_id = ? AND channel_id = ? ORDER BY created_at ASC');
const DEL_CHAT_MEMORY = db.prepare('DELETE FROM chat_memory WHERE guild_id = ? AND channel_id = ?');
const DEL_OLD_CHAT_MEMORY = db.prepare('DELETE FROM chat_memory WHERE guild_id = ? AND channel_id = ? AND id NOT IN (SELECT id FROM chat_memory WHERE guild_id = ? AND channel_id = ? ORDER BY created_at DESC LIMIT ?)');

export interface ChatMessage {
  id: number;
  guild_id: string;
  channel_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: number;
}

export function addChatMessage(guildId: string, channelId: string, userId: string, role: 'user' | 'assistant', content: string) {
  INS_CHAT_MEMORY.run(guildId, channelId, userId, role, content, Date.now());
  // Keep only last 50 messages per channel
  DEL_OLD_CHAT_MEMORY.run(guildId, channelId, guildId, channelId, 50);
}

export function getChatMemory(guildId: string, channelId: string, limit = 30): ChatMessage[] {
  const all = GET_CHAT_MEMORY.all(guildId, channelId) as ChatMessage[];
  return all.slice(-limit);
}

export function clearChatMemory(guildId: string, channelId: string) {
  DEL_CHAT_MEMORY.run(guildId, channelId);
}

export function getModMailChannel(guildId: string): string | null {
  return getGuildConfig(guildId, 'modmail_channel');
}

export function setModMailChannel(guildId: string, channelId: string | null) {
  setGuildConfig(guildId, 'modmail_channel', channelId);
}

export default db;
