import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TextChannel, Message } from 'discord.js';
import { dataPath } from './dataPath';

export interface TranscriptResult {
  htmlPath: string;
  jsonPath: string;
  messageCount: number;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function generateHtml(messages: Message[], ticketId: number, closeReason?: string): string {
  const lines = messages.map(m => {
    const author = `${escapeHtml(m.author.tag)}`;
    const time = m.createdAt.toLocaleString();
    const content = m.content ? escapeHtml(m.content) : '(no text content)';
    const attachStr = m.attachments.size > 0
      ? `<div class="attachments">${Array.from(m.attachments.values()).map(a => `<a href="${a.url}">${escapeHtml(a.name)}</a>`).join(', ')}</div>`
      : '';
    return `    <div class="msg">
      <div class="head"><span class="author">${author}</span><span class="time">${time}</span></div>
      <div class="body">${content}</div>
      ${attachStr}
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Ticket #${ticketId} Transcript</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:0 auto;padding:20px;background:#0f0f1a;color:#ddd}
h1{color:#fff;border-bottom:1px solid #333;padding-bottom:10px;margin-bottom:15px}
.info{color:#888;font-size:0.9em;margin-bottom:15px}
.close-reason{background:#2d1b1b;padding:10px;border-radius:5px;margin-bottom:15px;border-left:3px solid #f44336}
.msg{padding:10px;margin:6px 0;background:#1a1a2e;border-radius:5px}
.head{display:flex;justify-content:space-between;margin-bottom:4px}
.author{color:#4fc3f7;font-weight:bold}
.time{color:#666;font-size:0.85em}
.body{white-space:pre-wrap;word-break:break-word}
.attachments{margin-top:4px}
.attachments a{color:#4fc3f7;font-size:0.9em}
</style></head>
<body>
<h1>Ticket #${ticketId} Transcript</h1>
<div class="info">${messages.length} message(s) | Closed: ${closeReason ? escapeHtml(closeReason) : 'N/A'}</div>
${closeReason ? `<div class="close-reason"><strong>Reason:</strong> ${escapeHtml(closeReason)}</div>` : ''}
${lines}
</body>
</html>`;
}

export async function generateTranscript(
  channel: TextChannel,
  ticketId: number,
  guildId: string,
  closeReason?: string
): Promise<TranscriptResult> {
  const allMessages: Message[] = [];
  let lastId: string | undefined;

  while (true) {
    const fetched = await channel.messages.fetch({ limit: 100, ...(lastId ? { before: lastId } : {}) });
    if (fetched.size === 0) break;
    allMessages.push(...fetched.values());
    lastId = fetched.last()!.id;
    if (fetched.size < 100) break;
  }

  allMessages.reverse();

  const dir = dataPath('transcripts', guildId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const htmlPath = join(dir, `ticket-${ticketId}.html`);
  const html = generateHtml(allMessages, ticketId, closeReason);
  writeFileSync(htmlPath, html);

  const jsonPath = join(dir, `ticket-${ticketId}.json`);
  const json = allMessages.map(m => ({
    authorId: m.author.id,
    authorTag: m.author.tag,
    content: m.content,
    timestamp: m.createdAt.toISOString(),
    attachments: m.attachments.map(a => ({ url: a.url, name: a.name }))
  }));
  writeFileSync(jsonPath, JSON.stringify(json, null, 2));

  return { htmlPath, jsonPath, messageCount: allMessages.length };
}
