import 'dotenv/config';
import express from 'express';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  getAllInfractionGuilds, getInfractionUserIds, getInfractions, deleteInfractions,
  getAllTickets, getTickets, updateTicket, getTodos, addTodo, editTodo, removeTodo,
  getAllLogConfigs, getAllChannelLogConfigs, getSlowmodeConfig,
  getMessageLogCount, getTicketMeta, setTicketMeta, getLogConfig,
  getChannelLogConfig, setLogConfig, setChannelLogConfig,
  enableSlowmodeChannel, disableSlowmodeChannel,
} from '../utils/db';
import {
  getPlayerRoster, getPlayerRelics, getCharacterLightCone, getCharacterRelics,
  getHsrStats,
} from '../hsr/db';

const app = express();
const PORT = parseInt(process.env.DASHBOARD_PORT || '3000', 10);

const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
const BOT_TOKEN = process.env.DISCORD_TOKEN || '';
const SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
const DASHBOARD_URL = process.env.DASHBOARD_URL || `http://localhost:${PORT}`;

const sessions = new Map<string, { userId: string; username: string; avatar: string; expires: number }>();

app.set('trust proxy', true);
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) cookies[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return cookies;
}

function setSessionCookie(res: express.Response, sessionId: string) {
  res.setHeader('Set-Cookie', `session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`);
}

function clearSessionCookie(res: express.Response) {
  res.setHeader('Set-Cookie', `session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

function getSession(req: express.Request): { userId: string; username: string; avatar: string } | null {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies['session'];
  if (!sessionId) return null;
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.now() > session.expires) {
    sessions.delete(sessionId);
    return null;
  }
  return session;
}

async function discordFetch(path: string, token: string, tokenType = 'Bearer'): Promise<any> {
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    headers: { Authorization: `${tokenType} ${token}` }
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Discord API error ${res.status}: ${text}`);
    return null;
  }
  return res.json();
}

async function exchangeCode(code: string, redirectUri: string): Promise<{ access_token: string; token_type: string } | null> {
  const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  console.log('[Dashboard] Token exchange: redirect_uri =', redirectUri, ', client_id =', CLIENT_ID);
  const res = await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Token exchange failed:', res.status, JSON.stringify(data));
    return null;
  }
  return data;
}

async function getBotGuilds(): Promise<{ id: string; name: string; icon: string | null }[]> {
  if (!BOT_TOKEN) return [];
  const guilds = await discordFetch('/users/@me/guilds', BOT_TOKEN, 'Bot');
  if (!guilds) return [];
  return guilds.map((g: any) => ({ id: g.id, name: g.name, icon: g.icon }));
}

function authRequired(req: express.Request, res: express.Response, next: express.NextFunction) {
  const session = getSession(req);
  if (!session) {
    if (req.path.startsWith('/api/')) {
      res.status(401).json({ error: 'Unauthorized' });
    } else {
      res.redirect('/login');
    }
    return;
  }
  (req as any).session = session;
  next();
}

// Login page
app.get('/login', (req, res) => {
  const session = getSession(req);
  if (session) return res.redirect('/dashboard');
  res.render('login');
});

function getRedirectUri(req: express.Request): string {
  const proto = req.headers['x-forwarded-proto'] as string || 'http';
  const host = req.headers['x-forwarded-host'] as string || req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}/auth/callback`;
}

// Discord OAuth entry
app.get('/auth/discord', (req, res) => {
  const redirectUri = getRedirectUri(req);
  console.log('[Dashboard] /auth/discord: redirect_uri =', redirectUri, ', host =', req.headers.host, ', proto =', req.headers['x-forwarded-proto']);
  const scopes = ['identify', 'guilds'].join(' ');
  const url = `https://discord.com/api/v10/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}`;
  res.redirect(url);
});

// OAuth callback
app.get('/auth/callback', async (req, res) => {
  const { code, error, error_description } = req.query;
  if (error || !code) {
    console.error('OAuth callback error:', error || 'no code');
    return res.send(`<h1>OAuth Error</h1><pre>${JSON.stringify({ error, error_description, query: req.query })}</pre><a href="/login">Back to login</a>`);
  }
  const redirectUri = getRedirectUri(req);
  console.log('[Dashboard] Callback received. redirect_uri =', redirectUri, ', host =', req.headers.host, ', proto =', req.headers['x-forwarded-proto']);
  const tokenData = await exchangeCode(code as string, redirectUri);
  if (!tokenData) {
    console.error('Token exchange failed. redirect_uri used:', redirectUri);
    return res.send(`<h1>Token Exchange Failed</h1><pre>redirect_uri: ${redirectUri}\nCheck server logs for details.</pre><a href="/login">Back to login</a>`);
  }
  const user = await discordFetch('/users/@me', tokenData.access_token, tokenData.token_type);
  if (!user) {
    console.error('Failed to fetch user from Discord API');
    return res.send(`<h1>Failed to fetch user</h1><a href="/login">Back to login</a>`);
  }
  const sessionId = generateSessionId();
  sessions.set(sessionId, {
    userId: user.id,
    username: user.username,
    avatar: user.avatar,
    expires: Date.now() + 86400000,
  });
  setSessionCookie(res, sessionId);
  console.log(`User ${user.username} (${user.id}) logged in via dashboard`);
  res.redirect('/dashboard');
});

// Logout
app.get('/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies['session'];
  if (sessionId) sessions.delete(sessionId);
  clearSessionCookie(res);
  res.redirect('/login');
});

// Landing page (public)
app.get('/', async (req, res) => {
  try {
    const { getHsrStats } = await import('../hsr/db');
    const stats = getHsrStats();
    res.render('landing', { stats });
  } catch {
    res.render('landing', { stats: { characters: 0, enemies: 0, players: 0, lightCones: 0 } });
  }
});

// Guild picker (auth required)
app.get('/dashboard', authRequired, async (req, res) => {
  const guilds = await getBotGuilds();
  const session = (req as any).session;
  res.render('guilds', { guilds, user: session });
});

// Guild-scoped: Dashboard home
app.get('/:guildId/home', authRequired, async (req, res) => {
  const guildId = req.params.guildId as string;
  const userIds = getInfractionUserIds(guildId);
  let totalInfractions = 0;
  for (const uid of userIds) {
    totalInfractions += getInfractions(guildId, uid).length;
  }

  const allTickets = (getTickets(guildId) as any[]) || [];
  const openTickets = allTickets.filter((t: any) => t.status === 'open').length;

  const todos = getTodos(guildId) as any[];
  const totalTodos = Array.isArray(todos) ? todos.length : 0;

  const logCfg = getLogConfig(guildId);
  const guildsWithLogging = logCfg.messages || logCfg.reactions ? 1 : 0;

  const slowCfg = getSlowmodeConfig();
  const slowChannels = slowCfg.enabledChannels.length;

  const m = getTicketMeta(guildId);
  const modChannels = m.moderatorChannel ? 1 : 0;

  const totalLogLines = getMessageLogCount();
  const guilds = await getBotGuilds();
  const session = (req as any).session;

  res.render('index', {
    totalInfractions, totalUsers: userIds.length, openTickets, totalTodos,
    guildsWithLogging, slowChannels, modChannels, totalLogLines,
    guildCount: 1, guildId, guilds, user: session,
  });
});

// Guild-scoped: Infractions
app.get('/:guildId/infractions', authRequired, async (req, res) => {
  const guildId = req.params.guildId as string;
  const userIds = getInfractionUserIds(guildId);
  const users = userIds.map(uid => ({ id: uid, infractions: getInfractions(guildId, uid) }));
  const guilds = await getBotGuilds();
  const session = (req as any).session;
  res.render('infractions', { guildId, users, hasData: users.length > 0, guilds, user: session });
});

app.post('/:guildId/infractions/clear', authRequired, (req, res) => {
  const guildId = req.params.guildId as string;
  const { userId } = req.body;
  deleteInfractions(guildId, userId);
  res.redirect(`/${guildId}/infractions`);
});

// Guild-scoped: Tickets
app.get('/:guildId/tickets', authRequired, async (req, res) => {
  const guildId = req.params.guildId as string;
  const tickets = (getTickets(guildId) as any[]) || [];
  const guilds = await getBotGuilds();
  const session = (req as any).session;
  res.render('tickets', { guildId, tickets, guilds, user: session });
});

app.post('/:guildId/tickets/close', authRequired, (req, res) => {
  const guildId = req.params.guildId as string;
  const { ticketId } = req.body;
  updateTicket(guildId, parseInt(ticketId), { status: 'closed', closed_at: Date.now(), closed_by: 'dashboard' });
  res.redirect(`/${guildId}/tickets`);
});

// Guild-scoped: Todos
app.get('/:guildId/todos', authRequired, async (req, res) => {
  const guildId = req.params.guildId as string;
  const items = (getTodos(guildId) as any[]) || [];
  const guilds = await getBotGuilds();
  const session = (req as any).session;
  res.render('todos', { guildId, items, guilds, user: session });
});

app.post('/:guildId/todos/add', authRequired, (req, res) => {
  const guildId = req.params.guildId as string;
  const { text } = req.body;
  if (text?.trim()) {
    addTodo(guildId, text.trim(), 'dashboard', 'Dashboard');
  }
  res.redirect(`/${guildId}/todos`);
});

app.post('/:guildId/todos/edit', authRequired, (req, res) => {
  const guildId = req.params.guildId as string;
  const { id, text } = req.body;
  editTodo(guildId, parseInt(id), text);
  res.redirect(`/${guildId}/todos`);
});

app.post('/:guildId/todos/remove', authRequired, (req, res) => {
  const guildId = req.params.guildId as string;
  const { id } = req.body;
  removeTodo(guildId, parseInt(id));
  res.redirect(`/${guildId}/todos`);
});

// Guild-scoped: Logging
app.get('/:guildId/logging', authRequired, async (req, res) => {
  const guildId = req.params.guildId as string;
  const logCfg: Record<string, any> = {};
  const rows = getAllLogConfigs() as any[];
  for (const r of rows) {
    logCfg[r.guild_id] = { messages: r.messages === 1, reactions: r.reactions === 1 };
  }
  const channelLogCfg: Record<string, any> = {};
  const chRows = getAllChannelLogConfigs() as any[];
  for (const r of chRows) {
    channelLogCfg[r.channel_id] = { messages: r.messages === 1, reactions: r.reactions === 1 };
  }
  const guilds = await getBotGuilds();
  const session = (req as any).session;
  res.render('logging', { guildId, logCfg, channelLogCfg, guilds, user: session });
});

app.post('/:guildId/logging', authRequired, (req, res) => {
  const guildId = req.params.guildId as string;
  const { type, enabled, channelId } = req.body;
  const isChannel = channelId && channelId !== '';
  const val = enabled === 'true';

  if (isChannel) {
    const existing = getChannelLogConfig(channelId);
    if (type === 'messages') setChannelLogConfig(channelId, val, existing.reactions);
    else setChannelLogConfig(channelId, existing.messages, val);
  } else {
    const existing = getLogConfig(guildId);
    if (type === 'messages') setLogConfig(guildId, val, existing.reactions);
    else setLogConfig(guildId, existing.messages, val);
  }
  res.redirect(`/${guildId}/logging`);
});

// Guild-scoped: Slowmode
app.get('/:guildId/slowmode', authRequired, async (req, res) => {
  const guildId = req.params.guildId as string;
  const slowCfg = getSlowmodeConfig();
  const guilds = await getBotGuilds();
  const session = (req as any).session;
  res.render('slowmode', { guildId, enabledChannels: slowCfg.enabledChannels || [], guilds, user: session });
});

app.post('/:guildId/slowmode/toggle', authRequired, (req, res) => {
  const guildId = req.params.guildId as string;
  const { channelId, enabled } = req.body;
  if (enabled === 'true') {
    enableSlowmodeChannel(guildId, channelId);
  } else {
    disableSlowmodeChannel(guildId, channelId);
  }
  res.redirect(`/${guildId}/slowmode`);
});

// Guild-scoped: Mod Channel
app.get('/:guildId/modchannel', authRequired, async (req, res) => {
  const guildId = req.params.guildId as string;
  const meta: Record<string, any> = {};
  const m = getTicketMeta(guildId);
  if (m.moderatorChannel) {
    meta[guildId] = { moderatorChannel: m.moderatorChannel };
  }
  const guilds = await getBotGuilds();
  const session = (req as any).session;
  res.render('modchannel', { guildId, meta, guilds, user: session });
});

app.post('/:guildId/modchannel', authRequired, (req, res) => {
  const guildId = req.params.guildId as string;
  const { channelId } = req.body;
  if (channelId?.trim()) {
    setTicketMeta(guildId, { moderatorChannel: channelId.trim() });
  } else {
    setTicketMeta(guildId, { moderatorChannel: null });
  }
  res.redirect(`/${guildId}/modchannel`);
});

// ── HSR Tracker ──

app.get('/tracker', authRequired, async (req, res) => {
  const session = (req as any).session;
  res.render('tracker', { user: session });
});

app.get('/api/hsr/tracker', authRequired, async (req, res) => {
  const userId = (req as any).session.userId;
  const slot = parseInt(req.query.slot as string) || 1;
  try {
    const { default: Database } = await import('better-sqlite3');
    const dbPath = join(process.cwd(), 'data', 'hsr.db');
    const db = new Database(dbPath, { readonly: true });

    const player = db.prepare('SELECT * FROM hsr_players WHERE user_id = ? AND slot_number = ?').get(userId, slot) as any;
    const saveSlot = db.prepare('SELECT * FROM hsr_save_slots WHERE user_id = ? AND slot_number = ?').get(userId, slot) as any;
    const roster = getPlayerRoster(userId, slot);

    const rosterWithGear = roster.map((char: any) => {
      const lc = getCharacterLightCone(userId, slot, char.character_id);
      const relics = getCharacterRelics(userId, slot, char.character_id);
      return { ...char, light_cone: lc || null, relics };
    });

    const allRelics = getPlayerRelics(userId, slot);

    const inventory = db.prepare(`
      SELECT i.*, m.name, m.type, m.rarity, m.description, m.source
      FROM hsr_inventory i
      LEFT JOIN hsr_materials m ON i.item_id = m.item_id
      WHERE i.user_id = ? AND i.slot_number = ?
      ORDER BY m.rarity DESC, m.name ASC
    `).all(userId, slot) as any[];

    const express = db.prepare(`
      SELECT pe.*, er.name, er.description, er.max_level, er.base_production
      FROM hsr_player_express pe
      LEFT JOIN hsr_express_rooms er ON pe.room_id = er.room_id
      WHERE pe.user_id = ? AND pe.slot_number = ?
    `).all(userId, slot) as any[];

    const quests = db.prepare(`
      SELECT pq.*, q.title, q.description, q.quest_type, q.objectives
      FROM hsr_player_quests pq
      LEFT JOIN hsr_quests q ON pq.quest_id = q.id
      WHERE pq.user_id = ? AND pq.slot_number = ?
      ORDER BY pq.status ASC, q.display_order ASC
    `).all(userId, slot) as any[];

    const dailies = db.prepare(`
      SELECT pd.*, dc.description, dc.commission_type, dc.rewards
      FROM hsr_player_dailies pd
      LEFT JOIN hsr_daily_commissions dc ON pd.commission_id = dc.id
      WHERE pd.user_id = ? AND pd.slot_number = ? AND pd.date = date('now')
    `).all(userId, slot) as any[];

    const slots = db.prepare('SELECT * FROM hsr_save_slots WHERE user_id = ? ORDER BY slot_number').all(userId) as any[];

    const achievements = db.prepare(`
      SELECT pa.*, a.name, a.description, a.category
      FROM hsr_player_achievements pa
      LEFT JOIN hsr_achievements a ON pa.achievement_id = a.id
      WHERE pa.user_id = ? AND pa.slot_number = ?
    `).all(userId, slot) as any[];

    const unlockedCount = achievements.filter((a: any) => a.unlocked).length;

    db.close();

    res.json({
      success: true,
      player: player || null,
      saveSlot: saveSlot || null,
      slots,
      roster: rosterWithGear,
      allRelics,
      inventory,
      express,
      quests,
      dailies,
      achievements: { total: achievements.length, unlocked: unlockedCount },
    });
  } catch (err: any) {
    console.error('[Tracker API Error]', err.message);
    res.json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
