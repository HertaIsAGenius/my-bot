import { createCanvas } from '@napi-rs/canvas';
import { Chess } from 'chess.js';

const SQ = 64;
const PAD = 30;
const BOARD = SQ * 8;
const SIZE = BOARD + PAD * 2;

const COLORS = {
  default: { light: '#F0D9B5', dark: '#B58863', bg: '#1a1a2e', coord: '#F0D9B5', last: 'rgba(255,255,0,0.3)', check: 'rgba(255,0,0,0.45)' },
  lichess: { light: '#eeeed2', dark: '#769656', bg: '#312e2b', coord: '#614c38', last: 'rgba(255,255,0,0.35)', check: 'rgba(255,0,0,0.5)' },
};

const PIECES: Record<string, string> = {
  wK: '\u2654', wQ: '\u2655', wR: '\u2656', wB: '\u2657', wN: '\u2658', wP: '\u2659',
  bK: '\u265A', bQ: '\u265B', bR: '\u265C', bB: '\u265D', bN: '\u265E', bP: '\u265F',
};

const FONT = `bold ${SQ * 0.8}px 'Segoe UI Symbol','Apple Color Emoji','Noto Sans Symbols','FreeSerif',sans-serif`;

export function renderBoard(game: Chess, lastMove?: { from: string; to: string } | null, style: keyof typeof COLORS = 'default'): Buffer {
  const C = COLORS[style];
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const board = game.board();
  const inCheck = game.isCheck();
  const turn = game.turn();

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const x = PAD + col * SQ;
      const y = PAD + row * SQ;
      const light = (row + col) % 2 === 0;

      ctx.fillStyle = light ? C.light : C.dark;
      ctx.fillRect(x, y, SQ, SQ);

      if (lastMove) {
        const fc = lastMove.from.charCodeAt(0) - 97;
        const fr = 8 - parseInt(lastMove.from[1]);
        const tc = lastMove.to.charCodeAt(0) - 97;
        const tr = 8 - parseInt(lastMove.to[1]);
        if ((row === fr && col === fc) || (row === tr && col === tc)) {
          ctx.fillStyle = C.last;
          ctx.fillRect(x, y, SQ, SQ);
        }
      }

      if (inCheck) {
        const p = board[row][col];
        if (p && p.type === 'k' && p.color !== turn) {
          ctx.fillStyle = C.check;
          ctx.fillRect(x, y, SQ, SQ);
        }
      }

      const piece = board[row][col];
      if (piece) {
        const sym = PIECES[piece.color + piece.type.toUpperCase()];
        if (sym) {
          ctx.font = FONT;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const cx = x + SQ / 2;
          const cy = y + SQ / 2 + 2;
          const isWhite = piece.color === 'w';
          ctx.lineWidth = 3;
          ctx.strokeStyle = isWhite ? '#000' : '#fff';
          ctx.strokeText(sym, cx, cy);
          ctx.fillStyle = isWhite ? '#fff' : '#000';
          ctx.fillText(sym, cx, cy);
        }
      }
    }
  }

  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.coord;
  for (let i = 0; i < 8; i++) {
    ctx.fillText(String.fromCharCode(97 + i), PAD + i * SQ + SQ / 2, PAD + BOARD + 15);
    ctx.fillText(`${8 - i}`, 14, PAD + i * SQ + SQ / 2);
  }

  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#fff';
  ctx.fillText(turn === 'w' ? "White's turn" : "Black's turn", SIZE - PAD, SIZE);

  return canvas.toBuffer('image/png');
}
