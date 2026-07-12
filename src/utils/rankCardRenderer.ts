import { createCanvas, loadImage } from '@napi-rs/canvas';
import { loadAvatarBuffer, FONT, renderFadeInGif } from './canvas';
import { getLevelData, progressToNext, getRank, getWeeklyRank } from './levels';
import { getCardConfig, RankCardConfig } from './rankCards';

const WIDTH = 1000;
const HEIGHT = 300;
const PADDING = 20;
const GAP = 14;
const RADIUS = 18;
const BAR_AREA_HEIGHT = 40;

const CONTENT_H = HEIGHT - PADDING * 2 - BAR_AREA_HEIGHT - GAP;
const PANEL1_W = 190;
const RIGHT_W = WIDTH - PADDING * 2 - PANEL1_W - GAP;
const STACK_H = (CONTENT_H - GAP) / 2;

const C = {
  bgFallback: '#15151a',
  panel: 'rgba(20, 20, 26, 0.55)',
  panelSolid: '#1a1a1f',
  innerBox: '#0f0f12',
  white: '#ffffff',
  label: '#c9c9ce',
  accent: '#f2c866',
  outline: 'rgba(255, 255, 255, 0.12)',
  trackBg: 'rgba(255, 255, 255, 0.15)',
};
const OUTLINE_WIDTH = 1.5;

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function formatCompact(n: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getRoleInfo(member: any): { name: string; color: string } {
  if (!member?.roles?.cache) return { name: 'Member', color: C.accent };
  const roles = [...member.roles.cache.values()].filter((r: any) => r.name !== '@everyone');
  if (roles.length === 0) return { name: 'Member', color: C.accent };
  const sorted = roles.sort((a: any, b: any) => b.position - a.position);
  const colored = sorted.find((r: any) => r.color);
  return {
    name: colored?.name ?? sorted[0].name,
    color: colored?.hexColor ?? C.accent,
  };
}

function drawOutlinedText(
  ctx: any,
  text: string,
  x: number,
  y: number,
  font: string,
  fillColor: string,
  strokeColor = 'rgba(0,0,0,0.55)',
  strokeWidth = 3,
) {
  ctx.font = font;
  ctx.lineJoin = 'round';
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = strokeColor;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
}

async function drawCardFrame(ctx: any, target: any, guild: any, phase: number): Promise<void> {
  const data = getLevelData(target.id, guild.id);
  if (!data) return;
  const config: RankCardConfig = getCardConfig(guild.id, target.id);
  const font = config.fontFamily || FONT;
  const fontAccent = 'Georgia';

  const serverRank = getRank(target.id, guild.id);
  const weeklyRank = getWeeklyRank(target.id, guild.id);
  const prog = progressToNext(data);
  const { current: currentXp, needed: requiredXp } = prog;
  const progressPct = Math.min(prog.percent, 1);
  const level = data.level;

  const member = guild.members?.cache?.get(target.id);
  const nickname = member?.displayName ?? target.username;
  const joinedDate = member?.joinedAt ? formatDate(new Date(member.joinedAt)) : 'Unknown';
  const roleInfo = getRoleInfo(member);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Background
  ctx.fillStyle = C.bgFallback;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── Panel 1: full-height left panel ──
  const panel1X = PADDING;
  const rightX = panel1X + PANEL1_W + GAP;
  const panelY = PADDING;

  ctx.save();
  roundRect(ctx, panel1X, panelY, PANEL1_W, CONTENT_H, RADIUS);
  ctx.clip();
  ctx.fillStyle = C.panelSolid;
  ctx.fillRect(panel1X, panelY, PANEL1_W, CONTENT_H);

  const captionH = 44;
  const imgAreaH = CONTENT_H - captionH;

  const avatarBuf = await loadAvatarBuffer(target.displayAvatarURL({ extension: 'png', size: 256 }));
  if (avatarBuf) {
    try {
      const img = await loadImage(avatarBuf);
      const scale = Math.max(PANEL1_W / img.width, imgAreaH / img.height);
      const iw = img.width * scale;
      const ih = img.height * scale;
      ctx.drawImage(img, panel1X + (PANEL1_W - iw) / 2, panelY + (imgAreaH - ih) / 2, iw, ih);
    } catch {
      ctx.fillStyle = '#3a3a42';
      ctx.fillRect(panel1X, panelY, PANEL1_W, imgAreaH);
    }
  } else {
    ctx.fillStyle = '#3a3a42';
    ctx.fillRect(panel1X, panelY, PANEL1_W, imgAreaH);
  }

  ctx.strokeStyle = C.white;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(panel1X + PANEL1_W / 2 - 24, panelY + imgAreaH + 14);
  ctx.lineTo(panel1X + PANEL1_W / 2 + 24, panelY + imgAreaH + 14);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.globalAlpha = phase;
  ctx.fillStyle = C.white;
  ctx.font = `bold 18px ${font}`;
  ctx.fillText(target.username, panel1X + PANEL1_W / 2, panelY + imgAreaH + 20);
  ctx.globalAlpha = 1;

  ctx.restore();

  ctx.save();
  roundRect(ctx, panel1X + 0.75, panelY + 0.75, PANEL1_W - 1.5, CONTENT_H - 1.5, RADIUS);
  ctx.strokeStyle = C.outline;
  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.stroke();
  ctx.restore();

  // ── Panel 2: top-right ──
  {
    const x = rightX;
    const y = panelY;
    const w = RIGHT_W;
    const h = STACK_H;

    ctx.save();
    roundRect(ctx, x, y, w, h, RADIUS);
    ctx.clip();
    ctx.fillStyle = C.panelSolid;
    ctx.fillRect(x, y, w, h);

    const decorSize = Math.min(64, h - 28);
    const decorX = x + 24;
    const decorY = y + (h - decorSize) / 2;
    const ringWidth = 4;

    ctx.beginPath();
    ctx.arc(decorX + decorSize / 2, decorY + decorSize / 2, decorSize / 2 + ringWidth / 2, 0, Math.PI * 2);
    ctx.strokeStyle = roleInfo.color;
    ctx.lineWidth = ringWidth;
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(decorX + decorSize / 2, decorY + decorSize / 2, decorSize / 2, 0, Math.PI * 2);
    ctx.clip();
    const decorBuf = await loadAvatarBuffer(target.displayAvatarURL({ extension: 'png', size: 64 }));
    if (decorBuf) {
      try {
        const decorImg = await loadImage(decorBuf);
        ctx.drawImage(decorImg, decorX, decorY, decorSize, decorSize);
      } catch {
        ctx.fillStyle = '#e8a0a8';
        ctx.fillRect(decorX, decorY, decorSize, decorSize);
      }
    } else {
      ctx.fillStyle = '#e8a0a8';
      ctx.fillRect(decorX, decorY, decorSize, decorSize);
    }
    ctx.restore();

    const textX = decorX + decorSize + 20;
    let textY = y + h / 2 - 30;

    ctx.globalAlpha = phase;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.white;
    ctx.font = `bold 19px ${font}`;
    ctx.fillText(nickname, textX, textY);

    textY += 26;
    ctx.fillStyle = roleInfo.color;
    ctx.font = `italic bold 13px ${fontAccent}`;
    ctx.fillText(roleInfo.name, textX, textY);

    textY += 18;
    ctx.fillStyle = C.label;
    ctx.font = `italic 12px ${fontAccent}`;
    ctx.fillText(`Member since ${joinedDate}`, textX, textY);
    ctx.globalAlpha = 1;

    ctx.restore();

    ctx.save();
    roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, RADIUS);
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = OUTLINE_WIDTH;
    ctx.stroke();
    ctx.restore();
  }

  // ── Panel 3: bottom-right — stats boxes ──
  {
    const x = rightX;
    const y = panelY + STACK_H + GAP;
    const w = RIGHT_W;
    const h = STACK_H;

    ctx.save();
    roundRect(ctx, x, y, w, h, RADIUS);
    ctx.clip();
    ctx.fillStyle = C.panelSolid;
    ctx.fillRect(x, y, w, h);

    const stats = [
      { value: `#${serverRank}`, label: 'All time' },
      { value: formatCompact(data.xp), label: 'Messages' },
      { value: `#${weeklyRank}`, label: 'Weekly' },
    ];

    const colW = w / stats.length;
    const boxH = 30;
    const groupH = boxH + 6 + 14;
    const groupTop = y + (h - groupH) / 2;

    stats.forEach((stat, i) => {
      const cx = x + colW * i + colW / 2;

      ctx.font = `bold 17px ${font}`;
      const textW = ctx.measureText(stat.value).width;
      const boxW = textW + 24;
      const boxX = cx - boxW / 2;
      const boxY = groupTop;

      roundRect(ctx, boxX, boxY, boxW, boxH, 8);
      ctx.fillStyle = C.innerBox;
      ctx.fill();
      ctx.strokeStyle = C.outline;
      ctx.lineWidth = OUTLINE_WIDTH;
      ctx.stroke();

      ctx.globalAlpha = phase;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = C.accent;
      ctx.fillText(stat.value, cx, boxY + boxH / 2);

      ctx.textBaseline = 'top';
      ctx.fillStyle = C.label;
      ctx.font = `12px ${font}`;
      ctx.fillText(stat.label, cx, boxY + boxH + 6);
      ctx.globalAlpha = 1;
    });

    ctx.restore();

    ctx.save();
    roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, RADIUS);
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = OUTLINE_WIDTH;
    ctx.stroke();
    ctx.restore();
  }

  // ── Bottom XP bar ──
  {
    const x = PADDING;
    const y = panelY + CONTENT_H + GAP;
    const w = WIDTH - PADDING * 2;
    const h = BAR_AREA_HEIGHT;
    const barHeight = Math.min(30, h);
    const barY = y + (h - barHeight) / 2;

    roundRect(ctx, x, barY, w, barHeight, barHeight / 2);
    ctx.fillStyle = C.trackBg;
    ctx.fill();

    const filledW = Math.max(barHeight, w * progressPct * phase);
    roundRect(ctx, x, barY, filledW, barHeight, barHeight / 2);
    ctx.fillStyle = C.accent;
    ctx.fill();

    ctx.globalAlpha = phase;
    const textY = barY + barHeight / 2;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    drawOutlinedText(ctx, `LVL ${level}`, x + 16, textY, `bold 14px ${font}`, C.white);
    ctx.textAlign = 'right';
    drawOutlinedText(ctx, `${currentXp}/${requiredXp} XP`, x + w - 16, textY, `bold 13px ${font}`, C.white);
    ctx.globalAlpha = 1;
  }
}

// ── Public API ──

export async function renderRankCard(target: any, guild: any): Promise<Buffer> {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  await drawCardFrame(ctx, target, guild, 1);
  return canvas.toBuffer('image/png');
}

export async function renderAnimatedRankCard(target: any, guild: any): Promise<Buffer> {
  return renderFadeInGif(WIDTH, HEIGHT, async (ctx, phase) => {
    await drawCardFrame(ctx, target, guild, phase);
  });
}
