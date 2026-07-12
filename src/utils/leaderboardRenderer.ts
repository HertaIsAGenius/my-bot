import { createCanvas, loadImage } from '@napi-rs/canvas';

const FONT_FAMILY = 'Arial';

const C = {
  bg: '#FFF5F8',
  rowAlt: '#F3E8FF',
  text: '#581C87',
  label: '#581C87',
  trackBg: '#F3E8FF',
  innerBox: '#FFF5F8',
  outline: '#F472B6',
  accent: '#EC4899',
};
const OUTLINE_WIDTH = 1.5;

const WIDTH = 900;
const HEADER_HEIGHT = 64;
const ROW_HEIGHT = 92;
const ROW_GAP = 10;
const PADDING_X = 28;
const RADIUS = 16;
const ROW_RADIUS = 14;

export interface LeaderboardEntry {
  title: string;
  username: string;
  avatarBuffer: Buffer | null;
  rank: number;
  level: number;
  exp: number;
  weeklyExp: number;
  expMax: number;
}

interface RenderOptions {
  title: string;
  entries: LeaderboardEntry[];
  mode: 'overall' | 'weekly';
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function drawAvatar(ctx: any, buf: Buffer | null, x: number, y: number, size: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  if (buf) {
    try {
      const img = await loadImage(buf);
      ctx.drawImage(img, x, y, size, size);
    } catch {
      ctx.fillStyle = C.text;
      ctx.fillRect(x, y, size, size);
    }
  } else {
    ctx.fillStyle = C.text;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
}

export async function renderLeaderboard(opts: RenderOptions): Promise<Buffer> {
  const { title, entries, mode } = opts;
  const totalH = HEADER_HEIGHT + entries.length * (ROW_HEIGHT + ROW_GAP) - ROW_GAP + 16;

  const canvas = createCanvas(WIDTH, totalH);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, WIDTH, totalH);

  // Full-canvas background panel
  roundRect(ctx, 0, 0, WIDTH, totalH, RADIUS);
  ctx.fillStyle = C.bg;
  ctx.fill();
  ctx.strokeStyle = C.outline;
  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.stroke();

  // Header
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = C.text;
  ctx.font = `bold 24px ${FONT_FAMILY}`;
  ctx.fillText(title, PADDING_X, 22);

  // Rows
  let y = HEADER_HEIGHT;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const rowW = WIDTH - PADDING_X * 2;
    const rowX = PADDING_X;

    ctx.save();
    roundRect(ctx, rowX, y, rowW, ROW_HEIGHT, ROW_RADIUS);
    ctx.clip();
    ctx.fillStyle = i % 2 === 0 ? C.bg : C.rowAlt;
    ctx.fillRect(rowX, y, rowW, ROW_HEIGHT);

    const padY = 16;
    const avatarSize = ROW_HEIGHT - padY * 2;
    const avatarY = y + padY;

    // Rank number box
    const rankBoxW = 44;
    const rankBoxH = 32;
    const rankBoxX = rowX + 20;
    const rankBoxY = y + ROW_HEIGHT / 2 - rankBoxH / 2;

    roundRect(ctx, rankBoxX, rankBoxY, rankBoxW, rankBoxH, 8);
    ctx.fillStyle = C.innerBox;
    ctx.fill();
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = OUTLINE_WIDTH;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.text;
    ctx.font = `bold 18px ${FONT_FAMILY}`;
    ctx.fillText(`#${entry.rank}`, rankBoxX + rankBoxW / 2, rankBoxY + rankBoxH / 2);

    const avatarX = rankBoxX + rankBoxW + 16;
    await drawAvatar(ctx, entry.avatarBuffer, avatarX, avatarY, avatarSize);

    // Username
    const textX = avatarX + avatarSize + 24;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    ctx.font = `bold 20px ${FONT_FAMILY}`;
    ctx.fillText(entry.title, textX, y + 14);

    // Right box label/value
    const isWeekly = mode === 'weekly';
    const boxLabel = isWeekly ? 'WEEKLY XP' : 'LEVEL';
    const boxValue = isWeekly ? entry.weeklyExp.toLocaleString() : String(entry.level);

    ctx.font = `bold 16px ${FONT_FAMILY}`;
    const minBoxWidth = 96;
    const rightBoxWidth = Math.max(minBoxWidth, ctx.measureText(boxValue).width + 32);

    // Progress bar
    const barY = y + 44;
    const barHeight = 8;
    const barW = rowX + rowW - 20 - rightBoxWidth - 16 - textX;

    roundRect(ctx, textX, barY, barW, barHeight, barHeight / 2);
    ctx.fillStyle = C.trackBg;
    ctx.fill();

    const pct = Math.min(1, entry.exp / Math.max(entry.expMax, 1));
    const fillW = Math.max(barHeight, barW * pct);
    roundRect(ctx, textX, barY, fillW, barHeight, barHeight / 2);
    ctx.fillStyle = C.accent;
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.label;
    ctx.font = `13px ${FONT_FAMILY}`;
    ctx.fillText(`${entry.username} · ${entry.exp.toLocaleString()} / ${entry.expMax.toLocaleString()} XP`, textX, barY + 16);

    ctx.restore(); // end row clip

    // Row outline
    ctx.save();
    roundRect(ctx, rowX + 0.75, y + 0.75, rowW - 1.5, ROW_HEIGHT - 1.5, ROW_RADIUS);
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = OUTLINE_WIDTH;
    ctx.stroke();
    ctx.restore();

    // Right box (LEVEL or WEEKLY XP)
    const boxW = rightBoxWidth;
    const boxH = 40;
    const boxX = rowX + rowW - 20 - boxW;
    const boxY2 = y + ROW_HEIGHT / 2 - boxH / 2;

    ctx.save();
    roundRect(ctx, boxX, boxY2, boxW, boxH, 10);
    ctx.fillStyle = C.innerBox;
    ctx.fill();
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = OUTLINE_WIDTH;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.label;
    ctx.font = `11px ${FONT_FAMILY}`;
    ctx.fillText(boxLabel, boxX + boxW / 2, boxY2 + 12);

    ctx.fillStyle = C.text;
    ctx.font = `bold 16px ${FONT_FAMILY}`;
    ctx.fillText(boxValue, boxX + boxW / 2, boxY2 + 27);
    ctx.restore();

    y += ROW_HEIGHT + ROW_GAP;
  }

  return canvas.toBuffer('image/png');
}
