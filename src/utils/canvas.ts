export const HSR_BG = '#0c0f17';
export const HSR_GOLD = '#f2c866';
export const HSR_TEAL = '#4ef2d2';
export const HSR_CRIMSON = '#dc143c';
export const HSR_MUTE = '#8e99a8';
export const HSR_DARK = '#141a26';
export const HSR_BAR_BG = '#1c2436';

export const FONT = '\'DIN Next\', \'Segoe UI\', \'Helvetica Neue\', Arial, sans-serif';

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
