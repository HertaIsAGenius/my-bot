import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS = join(process.cwd(), 'assets', 'hsr');
const JADES_ICON = join(ASSETS, 'jades.png');

const NATIVE_W = 200;
const NATIVE_H = 250;
const SCALE = 5;
const W = NATIVE_W * SCALE;
const H = NATIVE_H * SCALE;

const FONT: Record<string, string[]> = {
  A: ["01110","10001","10001","11111","10001","10001","10001"],
  B: ["11110","10001","10001","11110","10001","10001","11110"],
  C: ["01110","10001","10000","10000","10000","10001","01110"],
  D: ["11110","10001","10001","10001","10001","10001","11110"],
  E: ["11111","10000","10000","11110","10000","10000","11111"],
  F: ["11111","10000","10000","11110","10000","10000","10000"],
  G: ["01110","10001","10000","10111","10001","10001","01110"],
  H: ["10001","10001","10001","11111","10001","10001","10001"],
  I: ["01110","00100","00100","00100","00100","00100","01110"],
  J: ["00111","00010","00010","00010","10010","10010","01100"],
  K: ["10001","10010","10100","11000","10100","10010","10001"],
  L: ["10000","10000","10000","10000","10000","10000","11111"],
  M: ["10001","11011","10101","10101","10001","10001","10001"],
  N: ["10001","11001","10101","10101","10011","10001","10001"],
  O: ["01110","10001","10001","10001","10001","10001","01110"],
  P: ["11110","10001","10001","11110","10000","10000","10000"],
  Q: ["01110","10001","10001","10001","10101","10010","01101"],
  R: ["11110","10001","10001","11110","10100","10010","10001"],
  S: ["01111","10000","10000","01110","00001","00001","11110"],
  T: ["11111","00100","00100","00100","00100","00100","00100"],
  U: ["10001","10001","10001","10001","10001","10001","01110"],
  V: ["10001","10001","10001","10001","01010","01010","00100"],
  W: ["10001","10001","10001","10101","10101","11011","10001"],
  X: ["10001","01010","00100","00100","00100","01010","10001"],
  Y: ["10001","10001","01010","00100","00100","00100","00100"],
  Z: ["11111","00001","00010","00100","01000","10000","11111"],
  0: ["01110","10001","10011","10101","11001","10001","01110"],
  1: ["00100","01100","00100","00100","00100","00100","01110"],
  2: ["01110","10001","00001","00010","00100","01000","11111"],
  3: ["11111","00001","00010","00100","00010","00001","11111"],
  4: ["00010","00110","01010","10010","11111","00010","00010"],
  5: ["11111","10000","11110","00001","00001","10001","01110"],
  6: ["01110","10001","10000","11110","10001","10001","01110"],
  7: ["11111","00001","00010","00100","01000","01000","01000"],
  8: ["01110","10001","10001","01110","10001","10001","01110"],
  9: ["01110","10001","10001","01111","00001","10001","01110"],
  ' ': ["00000","00000","00000","00000","00000","00000","00000"],
  '.': ["00000","00000","00000","00000","00000","00000","00100"],
  ':': ["00000","00100","00000","00000","00000","00100","00000"],
  '/': ["00001","00010","00010","00100","00100","01000","01000"],
  '(': ["00110","01000","01000","01000","01000","01000","00110"],
  ')': ["11000","00010","00010","00010","00010","00010","11000"],
  '-': ["00000","00000","00000","11111","00000","00000","00000"],
  '+': ["00000","00000","00100","01110","00100","00000","00000"],
};

function drawPixelText(
  nctx: any, text: string, x: number, y: number, px: number,
  fill: string, shadow?: string, outline?: string,
) {
  text = text.toUpperCase();
  let cx = x;
  for (const ch of text) {
    const glyph = FONT[ch];
    if (!glyph) { cx += 6 * px; continue; }
    const off = Math.max(1, Math.floor(px / 2));
    if (outline) {
      for (const [dx, dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]] as [number,number][]) {
        const ox = dx * off, oy = dy * off;
        for (let gy = 0; gy < 7; gy++)
          for (let gx = 0; gx < 5; gx++)
            if (glyph[gy][gx] === '1')
              nctx.fillRect(cx + gx * px + ox, y + gy * px + oy, px, px);
      }
    }
    if (shadow) {
      for (let gy = 0; gy < 7; gy++)
        for (let gx = 0; gx < 5; gx++)
          if (glyph[gy][gx] === '1')
            nctx.fillRect(cx + gx * px + 1, y + gy * px + 1, px, px);
    }
    for (let gy = 0; gy < 7; gy++)
      for (let gx = 0; gx < 5; gx++)
        if (glyph[gy][gx] === '1')
          nctx.fillRect(cx + gx * px, y + gy * px, px, px);
    cx += 6 * px;
  }
}

function drawTextAuto(nctx: any, label: string, value: string, x: number, y: number, px: number, labelColor: string, valueColor: string) {
  drawPixelText(nctx, label, x, y, px, labelColor);
  drawPixelText(nctx, ': ', x + label.length * 6 * px, y, px, labelColor);
  drawPixelText(nctx, value, x + (label.length + 2) * 6 * px, y, px, valueColor);
}

function lerpColor(a: [number,number,number], b: [number,number,number], t: number): string {
  return `rgb(${Math.round(a[0]+(b[0]-a[0])*t)},${Math.round(a[1]+(b[1]-a[1])*t)},${Math.round(a[2]+(b[2]-a[2])*t)})`;
}

function roundR(nctx: any, x: number, y: number, w: number, h: number, r: number) {
  nctx.beginPath();
  nctx.moveTo(x + r, y);
  nctx.lineTo(x + w - r, y);
  nctx.arcTo(x + w, y, x + w, y + r, r);
  nctx.lineTo(x + w, y + h - r);
  nctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  nctx.lineTo(x + r, y + h);
  nctx.arcTo(x, y + h, x, y + h - r, r);
  nctx.lineTo(x, y + r);
  nctx.arcTo(x, y, x + r, y, r);
  nctx.closePath();
}

function slot(nctx: any, x0: number, y0: number, x1: number, y1: number, r = 6) {
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  nctx.fillStyle = 'rgb(240,232,205)';
  roundR(nctx, x0, y0, w, h, r);
  nctx.fill();
  nctx.strokeStyle = 'rgb(196,178,130)';
  nctx.lineWidth = 1;
  roundR(nctx, x0, y0, w, h, r);
  nctx.stroke();
  nctx.fillStyle = 'rgb(250,244,222)';
  roundR(nctx, x0 + 2, y0 + 2, w - 4, 4, r > 2 ? r - 2 : 1);
  nctx.fill();
}

function cornerOrnament(nctx: any, cx: number, cy: number, flipX = 1, flipY = 1) {
  const GOLD = 'rgb(240,210,120)';
  const GOLD_DK = 'rgb(180,150,70)';

  function rect(x0: number, y0: number, x1: number, y1: number, color: string) {
    const rx0 = cx + (flipX === 1 ? x0 : 15 - x0);
    const rx1 = cx + (flipX === 1 ? x1 : 15 - x1);
    const ry0 = cy + (flipY === 1 ? y0 : 15 - y0);
    const ry1 = cy + (flipY === 1 ? y1 : 15 - y1);
    const left = Math.min(rx0, rx1);
    const top = Math.min(ry0, ry1);
    const rw = Math.max(rx0, rx1) - left + 1;
    const rh = Math.max(ry0, ry1) - top + 1;
    nctx.fillStyle = color;
    nctx.fillRect(left, top, rw, rh);
  }

  const brackets = [
    { length: 15, thick: 2, inset: 0, color: GOLD },
    { length: 10, thick: 2, inset: 4, color: GOLD_DK },
    { length: 5,  thick: 2, inset: 8, color: GOLD },
  ];

  for (const b of brackets) {
    const i = b.inset, L = b.length, t = b.thick;
    rect(i, i, i + L, i + t - 1, b.color);
    rect(i, i, i + t - 1, i + L, b.color);
  }

  const dx = cx + (flipX === 1 ? 12 : 3);
  const dy = cy + (flipY === 1 ? 12 : 3);
  const d = 2;
  nctx.fillStyle = GOLD;
  nctx.beginPath();
  nctx.moveTo(dx, dy - d);
  nctx.lineTo(dx + d, dy);
  nctx.lineTo(dx, dy + d);
  nctx.lineTo(dx - d, dy);
  nctx.closePath();
  nctx.fill();
}

function dashedH(nctx: any, y: number, x0: number, x1: number, color: string, dash = 2, gap = 2) {
  nctx.fillStyle = color;
  for (let x = x0; x < x1; x += dash + gap)
    nctx.fillRect(x, y, Math.min(dash, x1 - x), 1);
}

function dashedV(nctx: any, x: number, y0: number, y1: number, color: string, dash = 2, gap = 3) {
  nctx.fillStyle = color;
  for (let y = y0; y < y1; y += dash + gap)
    nctx.fillRect(x, y, 1, Math.min(dash, y1 - y));
}

function drawLoadbar(nctx: any, y: number, x0: number, x1: number) {
  const barW = x1 - x0;
  const segW = Math.floor(barW / 6);
  const caps = 2;
  const body = segW;
  const gap = 1;

  nctx.fillStyle = 'rgb(200,180,230)';
  let cx = x0;
  nctx.fillRect(cx, y, body, 1); cx += body + gap;
  for (let i = 0; i < 4; i++) {
    nctx.fillRect(cx, y, body, 1); cx += body + gap;
  }
  nctx.fillRect(cx, y, body, 1);
}

export interface ProfileData {
  name: string;
  level: number;
  pronouns: string;
  path: string;
  party: { name: string; level: number }[];
  credits: number;
  stellarJade: number;
  tbPower: number;
  tbPowerMax: number;
  avatarUrl: string;
}

export async function renderProfile(data: ProfileData): Promise<Buffer> {
  const native = createCanvas(NATIVE_W, NATIVE_H);
  const nctx = native.getContext('2d');
  nctx.fillStyle = 'rgb(14,10,26)';
  nctx.fillRect(0, 0, NATIVE_W, NATIVE_H);

  const PURPLE: [number,number,number] = [98, 46, 172];
  const BLUE: [number,number,number] = [40, 96, 210];
  const BORDER = 4;

  for (let y = BORDER; y < NATIVE_H - BORDER; y++) {
    const t = (y - BORDER) / (NATIVE_H - 2 * BORDER);
    nctx.fillStyle = lerpColor(PURPLE, BLUE, t);
    nctx.fillRect(BORDER, y, NATIVE_W - 2 * BORDER, 1);
  }

  nctx.fillStyle = 'rgb(20,14,40)';
  nctx.fillRect(BORDER - 1, BORDER - 1, NATIVE_W - 2 * BORDER + 2, 1);
  nctx.fillRect(BORDER - 1, NATIVE_H - BORDER, NATIVE_W - 2 * BORDER + 2, 1);
  nctx.fillRect(BORDER - 1, BORDER - 1, 1, NATIVE_H - 2 * BORDER + 2);
  nctx.fillRect(NATIVE_W - BORDER, BORDER - 1, 1, NATIVE_H - 2 * BORDER + 2);

  cornerOrnament(nctx, 4, 4, 1, 1);
  cornerOrnament(nctx, NATIVE_W - 20, 4, -1, 1);
  cornerOrnament(nctx, 4, NATIVE_H - 20, 1, -1);
  cornerOrnament(nctx, NATIVE_W - 20, NATIVE_H - 20, -1, -1);

  dashedH(nctx, 34, 22, NATIVE_W - 22, 'rgb(230,220,245)');
  dashedV(nctx, 9, 38, NATIVE_H - 38, 'rgb(200,190,230)');
  dashedV(nctx, NATIVE_W - 10, 38, NATIVE_H - 38, 'rgb(200,190,230)');

  const title = 'STARBLAZE';
  const tw = title.length * 6 * 2 - 4;
  const tx = Math.floor((NATIVE_W - tw) / 2);
  drawPixelText(nctx, title, tx, 8, 2, 'rgb(255,235,150)', 'rgb(60,30,10)', 'rgb(255,255,255)');

  slot(nctx, 12, 40, NATIVE_W - 12, 80);

  const ps = 1;
  const px = 12;
  const py = 46;
  const nameStr = `${data.name}  LV.${data.level} TRAILBLAZER`;
  drawPixelText(nctx, nameStr, px, py, ps, 'rgb(0,0,0)');

  const pathStr = `${data.pronouns}  PATH OF ${data.path.toUpperCase()}`;
  drawPixelText(nctx, pathStr, px, py + 10, ps, 'rgb(50,30,80)');

  const partyStr = `PARTY: ${data.party.map(p => `${p.name}(LV.${p.level})`).join(' ')}`;
  drawPixelText(nctx, partyStr, px, py + 20, ps, 'rgb(80,60,120)');

  // Loadbar-style separator
  drawLoadbar(nctx, py + 30, px, NATIVE_W - px);

  // Stats section
  slot(nctx, 12, 86, NATIVE_W - 12, 128);

  const sy = 92;
  const credStr = `CREDITS: ${data.credits.toLocaleString()}`;
  drawPixelText(nctx, credStr, px, sy, ps, 'rgb(0,0,0)');

  const jadeStr = `STELLAR JADE: ${data.stellarJade.toLocaleString()}`;
  drawPixelText(nctx, jadeStr, px, sy + 10, ps, 'rgb(0,0,0)');

  const tbStr = `TB POWER: ${data.tbPower}/${data.tbPowerMax}`;
  drawPixelText(nctx, tbStr, px, sy + 20, ps, 'rgb(0,0,0)');

  drawLoadbar(nctx, sy + 30, px, NATIVE_W - px);

  // Avatar + jade row
  slot(nctx, 12, 134, 84, NATIVE_H - 8);
  slot(nctx, 90, 134, NATIVE_W - 12, 158);

  // Jade icon + amount in right slot
  const jadeAmt = data.stellarJade.toLocaleString();
  drawPixelText(nctx, jadeAmt, 112, 142, 1, 'rgb(0,0,0)');

  // Bottom right slot (empty for now / placeholder)
  slot(nctx, 90, 164, NATIVE_W - 12, NATIVE_H - 8);

  const final = createCanvas(W, H);
  const ctx = final.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(native, 0, 0, W, H);

  // Composite hi-res avatar into picture frame
  try {
    const avatarImg = await loadImage(data.avatarUrl);
    const afx = 17, afy = 139;
    const afw = 62, afh = 44;
    roundR(ctx, afx * SCALE, afy * SCALE, afw * SCALE, afh * SCALE, 3 * SCALE);
    ctx.save();
    ctx.clip();
    ctx.drawImage(avatarImg, afx * SCALE, afy * SCALE, afw * SCALE, afh * SCALE);
    ctx.restore();

    ctx.strokeStyle = '#D4A843';
    ctx.lineWidth = 2 * SCALE;
    roundR(ctx, afx * SCALE, afy * SCALE, afw * SCALE, afh * SCALE, 3 * SCALE);
    ctx.stroke();
  } catch (e) {
    console.error('[HSR] Avatar render error:', e);
  }

  // Composite jades icon
  try {
    if (existsSync(JADES_ICON)) {
      const jadeImg = await loadImage(readFileSync(JADES_ICON));
      const gx = 96, gy = 137;
      const gs = 14;
      ctx.drawImage(jadeImg, gx * SCALE, gy * SCALE, gs * SCALE, gs * SCALE);
    }
  } catch (e) {
    console.error('[HSR] Jades render error:', e);
  }

  return final.toBuffer('image/png');
}
