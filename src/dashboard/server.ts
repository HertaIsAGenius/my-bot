import express from 'express';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { dataPath } from '../utils/dataPath';

const app = express();
const PORT = parseInt(process.env.DASHBOARD_PORT || '3000', 10);
const dataDir = dataPath();

app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

function ensureDataDir() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
}

function readJSON(path: string): any {
  ensureDataDir();
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf-8')); }
  catch { return null; }
}

function writeJSON(path: string, data: any) {
  ensureDataDir();
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

function readJSONL(path: string): any[] {
  if (!existsSync(path)) return [];
  try {
    return readFileSync(path, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line));
  } catch { return []; }
}

// ---------- Dashboard Home ----------
app.get('/', (req, res) => {
  const guildFiles = readdirSync(dataDir).filter(f => /^\d+\.json$/.test(f) && f !== 'tickets.json' && f !== 'todos.json' && f !== 'logConfig.json' && f !== 'channelLogConfig.json' && f !== 'slowmodeConfig.json' && f !== 'ticketMeta.json');

  let totalInfractions = 0;
  let totalUsers = 0;
  for (const f of guildFiles) {
    const data = readJSON(join(dataDir, f));
    if (data) {
      const users = Object.keys(data);
      totalUsers += users.length;
      totalInfractions += users.reduce((sum: number, u: string) => sum + data[u].length, 0);
    }
  }

  const tickets = readJSON(join(dataDir, 'tickets.json')) || {};
  const allTickets = Object.values(tickets).flat() as any[];
  const openTickets = allTickets.filter((t: any) => t.status === 'open').length;

  const todos = readJSON(join(dataDir, 'todos.json')) || {};
  const totalTodos = Object.values(todos).flat().length;

  const logCfg = readJSON(join(dataDir, 'logConfig.json')) || {};
  const guildsWithLogging = Object.keys(logCfg).length;

  const slowCfg = readJSON(join(dataDir, 'slowmodeConfig.json')) || {};
  const slowChannels = slowCfg.enabledChannels?.length || 0;

  const meta = readJSON(join(dataDir, 'ticketMeta.json')) || {};
  const modChannels = Object.values(meta).filter((m: any) => m?.moderatorChannel).length;

  const logFiles = readdirSync(dataDir).filter(f => f.startsWith('logs-') && f.endsWith('.jsonl'));
  let totalLogLines = 0;
  for (const f of logFiles) {
    totalLogLines += readJSONL(join(dataDir, f)).length;
  }

  res.render('index', {
    totalInfractions, totalUsers, openTickets, totalTodos,
    guildsWithLogging, slowChannels, modChannels, totalLogLines,
    guildCount: guildFiles.length
  });
});

// ---------- Infractions ----------
app.get('/infractions', (req, res) => {
  const guildFiles = readdirSync(dataDir).filter(f => /^\d+\.json$/.test(f) && f !== 'tickets.json' && f !== 'todos.json' && f !== 'logConfig.json' && f !== 'channelLogConfig.json' && f !== 'slowmodeConfig.json' && f !== 'ticketMeta.json');
  const guilds: { id: string; users: { id: string; infractions: any[] }[] }[] = [];

  for (const f of guildFiles) {
    const guildId = f.replace('.json', '');
    const data = readJSON(join(dataDir, f));
    if (data) {
      const users = Object.entries(data).map(([userId, infs]) => ({
        id: userId, infractions: infs as any[]
      }));
      guilds.push({ id: guildId, users });
    }
  }

  res.render('infractions', { guilds });
});

app.post('/infractions/clear', (req, res) => {
  const { guildId, userId } = req.body;
  const path = join(dataDir, `${guildId}.json`);
  const data = readJSON(path) || {};
  delete data[userId];
  writeJSON(path, data);
  res.redirect('/infractions');
});

// ---------- Tickets ----------
app.get('/tickets', (req, res) => {
  const tickets = readJSON(join(dataDir, 'tickets.json')) || {};
  res.render('tickets', { tickets: Object.entries(tickets).flatMap(([guildId, ts]) =>
    (ts as any[]).map(t => ({ ...t, guildId }))
  ) });
});

app.post('/tickets/close', (req, res) => {
  const { guildId, ticketId } = req.body;
  const path = join(dataDir, 'tickets.json');
  const data = readJSON(path) || {};
  const list = data[guildId] || [];
  const ticket = list.find((t: any) => t.id === parseInt(ticketId));
  if (ticket) {
    ticket.status = 'closed';
    ticket.closedAt = Date.now();
    ticket.closedBy = 'dashboard';
    writeJSON(path, data);
  }
  res.redirect('/tickets');
});

// ---------- Todo List ----------
app.get('/todos', (req, res) => {
  const todos = readJSON(join(dataDir, 'todos.json')) || {};
  const guildIds = Object.keys(todos);
  res.render('todos', { guildIds, todos });
});

app.post('/todos/add', (req, res) => {
  const { guildId, text } = req.body;
  if (!guildId || !text?.trim()) return res.redirect('/todos');
  const path = join(dataDir, 'todos.json');
  const data = readJSON(path) || {};
  const list = data[guildId] || [];
  const id = list.length > 0 ? list[list.length - 1].id + 1 : 1;
  list.push({ id, text: text.trim(), authorId: 'dashboard', authorTag: 'Dashboard', createdAt: Date.now() });
  data[guildId] = list;
  writeJSON(path, data);
  res.redirect('/todos');
});

app.post('/todos/edit', (req, res) => {
  const { guildId, id, text } = req.body;
  const path = join(dataDir, 'todos.json');
  const data = readJSON(path) || {};
  const list = data[guildId] || [];
  const item = list.find((t: any) => t.id === parseInt(id));
  if (item) {
    item.text = text;
    item.editedAt = Date.now();
    writeJSON(path, data);
  }
  res.redirect('/todos');
});

app.post('/todos/remove', (req, res) => {
  const { guildId, id } = req.body;
  const path = join(dataDir, 'todos.json');
  const data = readJSON(path) || {};
  const list = data[guildId] || [];
  data[guildId] = list.filter((t: any) => t.id !== parseInt(id));
  writeJSON(path, data);
  res.redirect('/todos');
});

// ---------- Logging ----------
app.get('/logging', (req, res) => {
  const logCfg = readJSON(join(dataDir, 'logConfig.json')) || {};
  const channelLogCfg = readJSON(join(dataDir, 'channelLogConfig.json')) || {};
  res.render('logging', { logCfg, channelLogCfg });
});

app.post('/logging', (req, res) => {
  const { guildId, type, enabled, channelId } = req.body;
  const isChannel = channelId && channelId !== '';

  if (isChannel) {
    const path = join(dataDir, 'channelLogConfig.json');
    const data = readJSON(path) || {};
    data[channelId] = data[channelId] || {};
    data[channelId][type] = enabled === 'true';
    writeJSON(path, data);
  } else {
    const path = join(dataDir, 'logConfig.json');
    const data = readJSON(path) || {};
    data[guildId] = data[guildId] || {};
    data[guildId][type] = enabled === 'true';
    writeJSON(path, data);
  }
  res.redirect('/logging');
});

// ---------- Slowmode ----------
app.get('/slowmode', (req, res) => {
  const slowCfg = readJSON(join(dataDir, 'slowmodeConfig.json')) || { enabledChannels: [] };
  res.render('slowmode', { enabledChannels: slowCfg.enabledChannels || [] });
});

app.post('/slowmode/toggle', (req, res) => {
  const { channelId, enabled } = req.body;
  const path = join(dataDir, 'slowmodeConfig.json');
  const data = readJSON(path) || { enabledChannels: [] };
  if (enabled === 'true') {
    if (!data.enabledChannels.includes(channelId)) data.enabledChannels.push(channelId);
  } else {
    data.enabledChannels = data.enabledChannels.filter((c: string) => c !== channelId);
  }
  writeJSON(path, data);
  res.redirect('/slowmode');
});

// ---------- Mod Channel ----------
app.get('/modchannel', (req, res) => {
  const meta = readJSON(join(dataDir, 'ticketMeta.json')) || {};
  res.render('modchannel', { meta });
});

app.post('/modchannel', (req, res) => {
  const { guildId, channelId } = req.body;
  const path = join(dataDir, 'ticketMeta.json');
  const data = readJSON(path) || {};
  data[guildId] = data[guildId] || {};
  if (channelId?.trim()) {
    data[guildId].moderatorChannel = channelId.trim();
  } else {
    delete data[guildId].moderatorChannel;
  }
  writeJSON(path, data);
  res.redirect('/modchannel');
});

app.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
