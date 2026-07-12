import { GlobalFonts, createCanvas } from '@napi-rs/canvas';
import * as path from 'path';
import GIFEncoder from 'gif-encoder';

// Register local DIN fonts
const FONT_DIR = path.resolve(__dirname, '../../din-font/DIN');
GlobalFonts.registerFromPath(path.join(FONT_DIR, 'DIN Regular/DIN Regular.ttf'));
GlobalFonts.registerFromPath(path.join(FONT_DIR, 'DIN Bold/DIN Bold.otf'));
GlobalFonts.registerFromPath(path.join(FONT_DIR, 'DIN Medium/DIN Medium.otf'));

export const HSR_BG = '#0c0f17';
export const HSR_GOLD = '#f2c866';
export const HSR_TEAL = '#4ef2d2';
export const HSR_CRIMSON = '#dc143c';
export const HSR_MUTE = '#8e99a8';
export const HSR_DARK = '#141a26';
export const HSR_BAR_BG = '#1c2436';

export const FONT = '\'DIN\', \'Segoe UI\', \'Helvetica Neue\', Arial, sans-serif';

export function hexPath(ctx: any, cx: number, cy: number, r: number, offset = 0) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = cx + (r + offset) * Math.cos(angle);
    const y = cy + (r + offset) * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export async function loadAvatarBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export function backdropSlice(ctx: any, edgeX: number, edgeY: number) {
  ctx.fillStyle = HSR_DARK;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(edgeX, 0);
  ctx.lineTo(edgeY, ctx.canvas.height);
  ctx.lineTo(0, ctx.canvas.height);
  ctx.closePath();
  ctx.fill();
}

export function goldAccent(ctx: any, x1: number, y1: number, x2: number, y2: number, width = 4) {
  ctx.strokeStyle = HSR_GOLD;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// ── GIF fade-in animation ──

function encoderToBuffer(encoder: GIFEncoder): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    encoder.on('data', (chunk: Buffer) => chunks.push(chunk));
    encoder.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * Render a fade-in GIF.
 * `drawFrame(ctx, phase)` is called for each frame where `phase` goes from 0→1.
 */
export async function renderFadeInGif(
  width: number,
  height: number,
  drawFrame: (ctx: any, phase: number) => void,
  options?: { totalFrames?: number; fadeFrames?: number; delay?: number; quality?: number },
): Promise<Buffer> {
  const { totalFrames = 40, fadeFrames = 30, delay = 33, quality = 10 } = options ?? {};
  const holdFrames = totalFrames - fadeFrames;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const encoder = new GIFEncoder(width, height);
  encoder.setRepeat(0);
  encoder.setDelay(delay);
  encoder.setQuality(quality);
  encoder.writeHeader();

  for (let i = 0; i < totalFrames; i++) {
    const phase = i < holdFrames ? 0 : Math.min((i - holdFrames) / fadeFrames, 1);
    drawFrame(ctx, phase);
    const imageData = ctx.getImageData(0, 0, width, height);
    encoder.addFrame(imageData.data);
    encoder.flushData();
  }

  encoder.finish();
  return encoderToBuffer(encoder);
}
