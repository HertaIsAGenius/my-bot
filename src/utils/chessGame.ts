import { Chess } from 'chess.js';

export interface ChessGameState {
  game: Chess;
  whiteId: string;
  blackId: string;
  channelId: string;
  guildId: string;
  messageId: string | null;
  status: 'waiting' | 'active' | 'completed';
  reason: string | null;
  aiOpponent: boolean;
  lastMove: { from: string; to: string; san: string } | null;
  drawOfferedBy: string | null;
  selectedFrom: string | null;
  lichessGameId: string | null;
  lichessColor: 'white' | 'black' | null;
  movePending: boolean;
}

const games = new Map<string, ChessGameState>();

function gameKey(channelId: string, a: string, b: string): string {
  return `${channelId}:${[a, b].sort().join(':')}`;
}

export function findGame(channelId: string, userId: string): ChessGameState | undefined {
  let found: ChessGameState | undefined;
  for (const [, g] of games) {
    if (g.channelId === channelId && (g.whiteId === userId || g.blackId === userId)) {
      if (g.status === 'active') return g;
      if (!found) found = g;
    }
  }
  return found;
}

export function getActiveGame(channelId: string, userId: string): ChessGameState | undefined {
  const g = findGame(channelId, userId);
  if (g && g.status !== 'completed') return g;
  return undefined;
}

export function createGame(
  channelId: string, guildId: string,
  whiteId: string, blackId: string,
  aiOpponent: boolean, status: 'waiting' | 'active' = 'waiting',
): ChessGameState | null {
  const existing = getActiveGame(channelId, whiteId) || getActiveGame(channelId, blackId);
  if (existing) return null;

  const state: ChessGameState = {
    game: new Chess(),
    whiteId, blackId, channelId, guildId,
    messageId: null, status, reason: null,
    aiOpponent, lastMove: null, drawOfferedBy: null, selectedFrom: null,
    lichessGameId: null, lichessColor: null, movePending: false,
  };

  games.set(gameKey(channelId, whiteId, blackId), state);
  return state;
}

export function deleteGame(channelId: string, userId: string): boolean {
  for (const [k, g] of games) {
    if (g.channelId === channelId && (g.whiteId === userId || g.blackId === userId)) {
      games.delete(k);
      return true;
    }
  }
  return false;
}

export function makeMove(game: Chess, moveStr: string): { success: boolean; error?: string; result?: any } {
  try {
    const result = game.move(moveStr);
    if (!result) {
      if (/^[a-h][1-8][a-h][1-8]([qrbn])?$/.test(moveStr)) {
        const from = moveStr.substring(0, 2);
        const to = moveStr.substring(2, 4);
        const promotion = moveStr[4] as 'q' | 'r' | 'b' | 'n' | undefined;
        const r2 = game.move({ from, to, promotion });
        if (r2) return { success: true, result: r2 };
      }
      return { success: false, error: 'Invalid move. Use algebraic notation (e.g. e4, Nf3, O-O).' };
    }
    return { success: true, result };
  } catch (e: any) {
    return { success: false, error: e.message || 'Invalid move.' };
  }
}

export function getGameResult(game: Chess): string | null {
  if (game.isCheckmate()) return 'Checkmate!';
  if (game.isStalemate()) return 'Stalemate!';
  if (game.isDraw()) return 'Draw!';
  if (game.isThreefoldRepetition()) return 'Draw by repetition.';
  if (game.isInsufficientMaterial()) return 'Draw - insufficient material.';
  return null;
}

export function cleanupGamesForChannel(channelId: string) {
  for (const [k, g] of games) {
    if (g.channelId === channelId) games.delete(k);
  }
}
