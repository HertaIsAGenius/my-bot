import { Chess } from 'chess.js';

const BASE = 'https://lichess.org';

export interface LichessState {
  gameId: string;
  chess: Chess;
  myColor: 'white' | 'black';
  status: string;
  winner: string | null;
  lastUci: string | null;
}

function applyUci(game: Chess, uci: string): boolean {
  try {
    const r = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] as any });
    return !!r;
  } catch { return false; }
}

function movesToChess(moves: string[], initialFen?: string): Chess {
  const c = initialFen ? new Chess(initialFen) : new Chess();
  for (const u of moves) applyUci(c, u);
  return c;
}

export async function challengeAI(
  token: string, level = 3, color: 'random' | 'white' | 'black' = 'random',
): Promise<LichessState> {
  const body = new URLSearchParams({ level: String(level), color });
  const res = await fetch(`${BASE}/api/challenge/ai`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Lichess challenge failed (${res.status}): ${t}`);
  }

  const data = await res.json();
  const myColor: 'white' | 'black' = data.player?.color ?? 'white';
  const initial = data.initialFen || undefined;
  const moves = data.state?.moves ? data.state.moves.split(' ') : [];

  return {
    gameId: data.id,
    chess: movesToChess(moves, initial),
    myColor,
    status: data.status || 'created',
    winner: data.winner || null,
    lastUci: moves.length > 0 ? moves[moves.length - 1] : null,
  };
}

export async function makeMove(token: string, gameId: string, uci: string): Promise<boolean> {
  const res = await fetch(`${BASE}/api/board/game/${gameId}/move/${uci}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.ok;
}

export async function startStream(
  token: string,
  gameId: string,
  chess: Chess,
  onState: (chess: Chess, lastUci: string | null, status: string, winner: string | null) => void,
  onError: (err: Error) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BASE}/api/board/game/stream/${gameId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
    signal,
  });

  if (!res.ok) {
    onError(new Error(`Stream status ${res.status}`));
    return;
  }

  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const ev = JSON.parse(line.slice(6));
        if (ev.type === 'gameFull') {
          const moves = ev.state?.moves ? ev.state.moves.split(' ') : [];
          const initial = ev.initialFen || undefined;
          const c = movesToChess(moves, initial);
          chess.load(c.fen());
          const last = moves.length > 0 ? moves[moves.length - 1] : null;
          onState(chess, last, ev.state.status, ev.state.winner || null);
        } else if (ev.type === 'gameState') {
          const moves = ev.moves ? ev.moves.split(' ') : [];
          const c = movesToChess(moves);
          chess.load(c.fen());
          const last = moves.length > 0 ? moves[moves.length - 1] : null;
          onState(chess, last, ev.status, ev.winner || null);
        }
      } catch { /* skip malformed events */ }
    }
  }
}
