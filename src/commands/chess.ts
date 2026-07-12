import {
  ChatInputCommandInteraction, ButtonInteraction,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  MessageFlags, AttachmentBuilder,
} from 'discord.js';
import { Chess } from 'chess.js';
import { embed } from '../utils/embed';
import {
  createGame, findGame, getActiveGame,
  makeMove as doMove, getGameResult,
  ChessGameState,
} from '../utils/chessGame';
import { renderBoard } from '../utils/chessRenderer';
import { queryLlm } from '../utils/llm';
import { challengeAI, makeMove as lichessMove, startStream } from '../utils/lichess';

const PIECES: Record<string, string> = {
  wK: '\u2654', wQ: '\u2655', wR: '\u2656', wB: '\u2657', wN: '\u2658', wP: '\u2659',
  bK: '\u265A', bQ: '\u265B', bR: '\u265C', bB: '\u265D', bN: '\u265E', bP: '\u265F',
};

function boardStyle(game: ChessGameState): 'default' | 'lichess' {
  return game.lichessGameId ? 'lichess' : 'default';
}

async function updateBoardMessage(game: ChessGameState, client: any, content?: string, components?: any[]) {
  if (!game.messageId) return;
  const ch = await client.channels.fetch(game.channelId).catch(() => null);
  if (!ch?.isTextBased()) return;
  const msg = await ch.messages.fetch(game.messageId).catch(() => null);
  if (!msg) return;
  const buf = renderBoard(game.game, game.lastMove, boardStyle(game));
  const attach = new AttachmentBuilder(buf, { name: 'board.png' });
  const payload: any = { files: [attach] };
  if (content) payload.content = content;
  if (components) payload.components = components;
  await msg.edit(payload).catch(() => {});
}

function isPlayer(game: ChessGameState, userId: string): boolean {
  return game.whiteId === userId || game.blackId === userId;
}

function turnUser(game: ChessGameState): string {
  return game.game.turn() === 'w' ? game.whiteId : game.blackId;
}

function getBoardButtons(game: ChessGameState, userId: string): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  if (game.status !== 'active') return rows;

  const isMyTurn = turnUser(game) === userId;
  const inSel = game.selectedFrom;

  const topRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('chess_resign').setLabel('Resign').setStyle(ButtonStyle.Danger).setEmoji('\u{1F6A9}'),
    new ButtonBuilder().setCustomId('chess_draw').setLabel(game.drawOfferedBy ? 'Accept Draw' : 'Draw').setStyle(ButtonStyle.Secondary).setEmoji('\u{270D}\u{FE0F}'),
    new ButtonBuilder().setCustomId('chess_board').setLabel('Refresh').setStyle(ButtonStyle.Primary).setEmoji('\u{1F504}'),
  );
  rows.push(topRow);

  if (!isMyTurn) return rows;
  if (game.movePending) return rows;

  if (inSel) {
    const moves = game.game.moves({ square: inSel as any, verbose: true }) as any[];
    let dRow = new ActionRowBuilder<ButtonBuilder>();

    for (const m of moves) {
      if (dRow.components.length >= 5) {
        if (rows.length < 5) { rows.push(dRow); dRow = new ActionRowBuilder<ButtonBuilder>(); }
        else break;
      }
      dRow.addComponents(
        new ButtonBuilder().setCustomId(`chess_go_${inSel}_${m.to}`).setLabel(m.san).setStyle(ButtonStyle.Primary),
      );
    }
    if (dRow.components.length > 0 && rows.length < 5) rows.push(dRow);

    if (rows.length < 5) {
      const cRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('chess_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('\u274C'),
      );
      rows.push(cRow);
    }
    return rows;
  }

  const board = game.game.board();
  const turn = game.game.turn();
  const allMoves = game.game.moves({ verbose: true }) as any[];
  const seen = new Set<string>();
  let pRow = new ActionRowBuilder<ButtonBuilder>();

  for (const m of allMoves) {
    if (seen.has(m.from)) continue;
    seen.add(m.from);
    if (pRow.components.length >= 5) {
      if (rows.length < 5) { rows.push(pRow); pRow = new ActionRowBuilder<ButtonBuilder>(); }
      else break;
    }
    const p = board[8 - parseInt(m.from[1])][m.from.charCodeAt(0) - 97];
    const sym = p ? (PIECES[p.color + p.type.toUpperCase()] || p.type.toUpperCase()) : '?';
    pRow.addComponents(
      new ButtonBuilder().setCustomId(`chess_sel_${m.from}`).setLabel(`${sym} ${m.from}`).setStyle(ButtonStyle.Secondary),
    );
  }
  if (pRow.components.length > 0 && rows.length < 5) rows.push(pRow);

  return rows;
}

async function handleGameOver(game: ChessGameState, interaction: ChatInputCommandInteraction | ButtonInteraction) {
  const result = getGameResult(game.game);
  let winner = '';
  if (game.game.isCheckmate()) {
    const loser = game.game.turn() === 'w' ? 'White' : 'Black';
    winner = loser === 'White' ? 'Black' : 'White';
  }

  let content = '';
  if (winner) {
    const wid = winner === 'White' ? game.whiteId : game.blackId;
    content = `\u{1F3C6} **Game Over** \u2014 ${winner} wins! (<@${wid}>)\n${result}`;
  } else if (result) {
    content = `\u{1F3C1} **Game Over** \u2014 ${result}`;
  } else if (game.reason) {
    content = `\u{1F3C1} **Game Over** \u2014 ${game.reason}`;
  }

  const ch = await interaction.client.channels.fetch(game.channelId).catch(() => null);
    if (ch?.isTextBased() && game.messageId) {
      const msg = await ch.messages.fetch(game.messageId).catch(() => null);
      if (msg) {
        const buf = renderBoard(game.game, game.lastMove, boardStyle(game));
        const attach = new AttachmentBuilder(buf, { name: 'board.png' });
      const done = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('chess_delete').setLabel('Dismiss').setStyle(ButtonStyle.Secondary).setEmoji('\u{1F5D1}\u{FE0F}'),
      );
      await msg.edit({ content, files: [attach], components: [done] }).catch(() => {});
    }
  }
  return content;
}

async function processMove(
  game: ChessGameState,
  moveStr: string,
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  isButton = false,
) {
  const result = doMove(game.game, moveStr);
  if (!result.success) {
    if (isButton) await (interaction as ButtonInteraction).deferUpdate();
    return { success: false, error: result.error };
  }

  game.lastMove = { from: result.result.from, to: result.result.to, san: result.result.san };
  game.drawOfferedBy = null;
  game.selectedFrom = null;

  const gameOver = game.game.isGameOver();
  if (gameOver) {
    game.status = 'completed';
    await handleGameOver(game, interaction);
    if (isButton) {
      const btnInt = interaction as ButtonInteraction;
      await btnInt.message.edit({ components: [] }).catch(() => {});
      await btnInt.update({ content: `\u2705 Move: **${result.result.san}**` }).catch(() => {});
    }
    return { success: true, gameOver: true, san: result.result.san };
  }

  let buttons = getBoardButtons(game, turnUser(game));
  let nextPlayer = turnUser(game);
  let statusText = `${nextPlayer === game.whiteId ? '**White**' : '**Black**'} \u2014 <@${nextPlayer}>`;

  if (game.aiOpponent) {
    await updateBoardMessage(game, interaction.client,
      `\u{1F916} **AI is thinking...**\nLast move: **${result.result.san}**`, []);
    if (isButton) {
      await (interaction as ButtonInteraction).deferUpdate();
    } else {
      await (interaction as ChatInputCommandInteraction).editReply({ content: `\u2705 Your move: **${result.result.san}**. AI is thinking...` });
    }

    const aiMove = await getAiMove(game.game);
    const aiResult = doMove(game.game, aiMove);
    if (aiResult.success) {
      game.lastMove = { from: aiResult.result.from, to: aiResult.result.to, san: aiResult.result.san };
      game.drawOfferedBy = null;
      if (game.game.isGameOver()) {
        game.status = 'completed';
        await handleGameOver(game, interaction);
        return { success: true, gameOver: true, san: result.result.san, aiSan: aiResult.result.san };
      }
    }

    nextPlayer = turnUser(game);
    buttons = getBoardButtons(game, nextPlayer);
    statusText = `${nextPlayer === game.whiteId ? '**White**' : '**Black**'} \u2014 <@${nextPlayer}>`;
  }

  const boardContent = `\u2654 **Chess** \u265A\n<@${game.whiteId}> (White) vs <@${game.blackId}> (Black)\nLast move: **${result.result.san}**\n\n${statusText}'s turn`;
  if (game.aiOpponent && !isButton) {
    await updateBoardMessage(game, interaction.client, boardContent, buttons);
    await (interaction as ChatInputCommandInteraction).editReply({ content: `\u2705 Move: **${result.result.san}**` });
  } else if (game.aiOpponent && isButton) {
    await updateBoardMessage(game, interaction.client, boardContent, buttons);
  } else if (!isButton) {
    await updateBoardMessage(game, interaction.client, boardContent, buttons);
    await (interaction as ChatInputCommandInteraction).editReply({ content: `\u2705 Move: **${result.result.san}**` });
  }

  return { success: true, san: result.result.san, aiSan: game.aiOpponent ? game.lastMove?.san : undefined };
}

export async function handleChessButton(interaction: ButtonInteraction) {
  const cid = interaction.customId;

  if (cid === 'chess_delete') {
    await interaction.message.delete().catch(() => {});
    return;
  }

  if (cid === 'chess_board') {
    const game = findGame(interaction.channelId, interaction.user.id);
    if (!game || game.status === 'completed') {
      await interaction.reply({ content: 'No active chess game found.', flags: MessageFlags.Ephemeral });
      return;
    }
    const buf = renderBoard(game.game, game.lastMove, boardStyle(game));
    const attach = new AttachmentBuilder(buf, { name: 'board.png' });
    await interaction.reply({ files: [attach], flags: MessageFlags.Ephemeral });
    return;
  }

  if (cid === 'chess_resign') {
    const game = findGame(interaction.channelId, interaction.user.id);
    if (!game || game.status !== 'active') {
      await interaction.reply({ content: 'No active game to resign from.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (!isPlayer(game, interaction.user.id)) {
      await interaction.reply({ content: 'You are not a player in this game.', flags: MessageFlags.Ephemeral });
      return;
    }

    game.status = 'completed';
    const isW = interaction.user.id === game.whiteId;
    game.reason = `${isW ? 'White' : 'Black'} resigned`;
    await interaction.deferUpdate();
    await handleGameOver(game, interaction);
    await interaction.editReply({ content: '\u2705 Resignation accepted.' });
    return;
  }

  if (cid === 'chess_draw') {
    const game = findGame(interaction.channelId, interaction.user.id);
    if (!game || game.status !== 'active') {
      await interaction.reply({ content: 'No active game.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (!isPlayer(game, interaction.user.id)) {
      await interaction.reply({ content: 'You are not a player in this game.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (game.drawOfferedBy === interaction.user.id) {
      await interaction.reply({ content: 'You already offered a draw.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (game.drawOfferedBy) {
      game.status = 'completed';
      game.reason = 'Draw by agreement';
      await interaction.deferUpdate();
      await handleGameOver(game, interaction);
      await interaction.editReply({ content: '\u2705 Draw accepted.' });
      return;
    }
    game.drawOfferedBy = interaction.user.id;
    const other = game.whiteId === interaction.user.id ? game.blackId : game.whiteId;
    const content = `<@${other}> \u2014 <@${interaction.user.id}> offers a draw. Click **Draw** on the board message to accept.`;
    await updateBoardMessage(game, interaction.client, content, getBoardButtons(game, interaction.user.id));
    await interaction.reply({ content: '\u270D\uFE0F Draw offered.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (cid === 'chess_cancel') {
    const game = findGame(interaction.channelId, interaction.user.id);
    if (!game || game.status !== 'active') {
      await interaction.reply({ content: 'No active game.', flags: MessageFlags.Ephemeral });
      return;
    }
    game.selectedFrom = null;
    const buttons = getBoardButtons(game, interaction.user.id);
    const next = turnUser(game);
    const st = `${next === game.whiteId ? '**White**' : '**Black**'} \u2014 <@${next}>`;
    await updateBoardMessage(game, interaction.client,
      `\u2654 **Chess** \u265A\n<@${game.whiteId}> (White) vs <@${game.blackId}> (Black)\n\n${st}'s turn`, buttons);
    await interaction.deferUpdate();
    return;
  }

  if (cid.startsWith('chess_sel_')) {
    const square = cid.slice('chess_sel_'.length);
    const game = findGame(interaction.channelId, interaction.user.id);
    if (!game || game.status !== 'active' || turnUser(game) !== interaction.user.id) {
      await interaction.reply({ content: 'It is not your turn or no active game.', flags: MessageFlags.Ephemeral });
      return;
    }
    const moves = game.game.moves({ square: square as any, verbose: false }) as string[];
    if (moves.length === 0) {
      await interaction.reply({ content: 'That piece has no legal moves.', flags: MessageFlags.Ephemeral });
      return;
    }
    game.selectedFrom = square;
    const buttons = getBoardButtons(game, interaction.user.id);
    const boardContent = `\u2654 **Chess** \u265A\n<@${game.whiteId}> (White) vs <@${game.blackId}> (Black)\n\nSelected: **${square}** \u2014 choose a destination`;
    await updateBoardMessage(game, interaction.client, boardContent, buttons);
    await interaction.deferUpdate();
    return;
  }

  if (cid.startsWith('chess_go_')) {
    const parts = cid.split('_');
    if (parts.length < 4) return;
    const fromSq = parts[2];
    const toSq = parts.slice(3).join('_');

    const game = findGame(interaction.channelId, interaction.user.id);
    if (!game || game.status !== 'active' || turnUser(game) !== interaction.user.id) {
      await interaction.reply({ content: 'It is not your turn or no active game.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (game.selectedFrom !== fromSq) {
      game.selectedFrom = null;
    }

    if (game.lichessGameId) {
      if (game.movePending) {
        await interaction.reply({ content: 'Move already in progress, please wait...', flags: MessageFlags.Ephemeral });
        return;
      }

      const uci = fromSq + toSq;
      const token = process.env.LICHESS_API_TOKEN;
      if (!token) {
        await interaction.reply({ content: 'LICHESS_API_TOKEN not configured.', flags: MessageFlags.Ephemeral });
        return;
      }

      game.movePending = true;
      await interaction.deferUpdate();

      try {
        await lichessMove(token, game.lichessGameId, uci);
      } catch (e: any) {
        game.movePending = false;
        await interaction.editReply({ content: `Move failed: ${e.message}`, components: [], files: [] });
        return;
      }
      return;
    }

    await processMove(game, `${fromSq}${toSq}`, interaction, true);
    return;
  }

  if (cid.startsWith('chess_accept_') || cid.startsWith('chess_decline_')) {
    const parts = cid.split('_');
    const action = parts[1];
    const challengerId = parts.slice(2).join('_');

    const game = findGame(interaction.channelId, challengerId);
    if (!game || game.status !== 'waiting') {
      await interaction.reply({ content: 'This challenge is no longer available.', flags: MessageFlags.Ephemeral });
      return;
    }
    const isTarget = game.whiteId === interaction.user.id || game.blackId === interaction.user.id;
    if (!isTarget) {
      await interaction.reply({ content: 'This challenge is not for you.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (action === 'decline') {
      game.status = 'completed';
      game.reason = 'Challenge declined';
      await interaction.update({ content: '\u274C Challenge declined.', components: [], files: [] });
      return;
    }

    game.status = 'active';
    game.messageId = interaction.message.id;
    const buf = renderBoard(game.game, null, boardStyle(game));
    const attach = new AttachmentBuilder(buf, { name: 'board.png' });
    const buttons = getBoardButtons(game, game.whiteId);
    const content = `\u2654 **Chess** \u265A\n<@${game.whiteId}> (White) vs <@${game.blackId}> (Black)\n\n**White's turn** \u2014 <@${game.whiteId}>`;
    await interaction.update({ content, files: [attach], components: buttons });
    return;
  }
}

export default async function chessCommand(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'ai') {
    const existing = getActiveGame(interaction.channelId, interaction.user.id);
    if (existing) {
      await interaction.reply({
        embeds: [embed('Game Already Exists', 'You already have an active game in this channel. Use `/chess resign` or `/chess board`.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const game = createGame(interaction.channelId, interaction.guildId!, interaction.user.id, interaction.client.user!.id, true, 'active');
    if (!game) {
      await interaction.editReply({ content: 'Could not create game.' });
      return;
    }

    const buf = renderBoard(game.game, null, boardStyle(game));
    const attach = new AttachmentBuilder(buf, { name: 'board.png' });
    const buttons = getBoardButtons(game, interaction.user.id);
    const ch = interaction.channel as any;
    const msg = await ch.send({
      content: `\u2654 **Chess vs AI** \u265A\n<@${interaction.user.id}> (White) vs **AI** (Black)\n\n**White's turn** \u2014 <@${interaction.user.id}>`,
      files: [attach],
      components: buttons,
    });

    game.messageId = msg.id;
    await interaction.editReply({ content: '\u2705 Game started! Choose a piece on the board message or use `/chess move <notation>`.' });
    return;
  }

  if (sub === 'challenge') {
    const opponent = interaction.options.getUser('opponent', true);
    if (opponent.id === interaction.user.id) {
      await interaction.reply({ content: 'You cannot challenge yourself.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (opponent.bot) {
      await interaction.reply({ content: 'You cannot challenge a bot. Use `/chess ai` instead.', flags: MessageFlags.Ephemeral });
      return;
    }

    const existing = getActiveGame(interaction.channelId, interaction.user.id) || getActiveGame(interaction.channelId, opponent.id);
    if (existing) {
      await interaction.reply({ embeds: [embed('Game Already Exists', 'You or your opponent already has an active game in this channel.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const game = createGame(interaction.channelId, interaction.guildId!, interaction.user.id, opponent.id, false, 'waiting');
    if (!game) {
      await interaction.reply({ content: 'Could not create challenge.', flags: MessageFlags.Ephemeral });
      return;
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`chess_accept_${interaction.user.id}`).setLabel('Accept').setStyle(ButtonStyle.Success).setEmoji('\u2705'),
      new ButtonBuilder().setCustomId(`chess_decline_${interaction.user.id}`).setLabel('Decline').setStyle(ButtonStyle.Danger).setEmoji('\u274C'),
    );

    const msg = await interaction.reply({
      content: `\u{1F3B2} **Chess Challenge!**\n<@${interaction.user.id}> challenges <@${opponent.id}> to a chess game!\n\n<@${opponent.id}> \u2014 do you accept?`,
      components: [row],
      fetchReply: true,
    });

    game.messageId = msg.id;
    return;
  }

  if (sub === 'accept') {
    const game = findGame(interaction.channelId, interaction.user.id);
    if (!game || game.status !== 'waiting') {
      await interaction.reply({ content: 'No pending challenge for you in this channel.', flags: MessageFlags.Ephemeral });
      return;
    }
    game.status = 'active';
    const buf = renderBoard(game.game, null, boardStyle(game));
    const attach = new AttachmentBuilder(buf, { name: 'board.png' });

    const ch = await interaction.client.channels.fetch(game.channelId).catch(() => null);
    if (ch?.isTextBased() && game.messageId) {
      const msg = await ch.messages.fetch(game.messageId).catch(() => null);
      if (msg) {
        const buttons = getBoardButtons(game, game.whiteId);
        const content = `\u2654 **Chess** \u265A\n<@${game.whiteId}> (White) vs <@${game.blackId}> (Black)\n\n**White's turn** \u2014 <@${game.whiteId}>`;
        await msg.edit({ content, files: [attach], components: buttons }).catch(() => {});
      }
    }
    await interaction.reply({ content: '\u2705 Challenge accepted! Game started.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'decline') {
    const game = findGame(interaction.channelId, interaction.user.id);
    if (!game || game.status !== 'waiting') {
      await interaction.reply({ content: 'No pending challenge for you in this channel.', flags: MessageFlags.Ephemeral });
      return;
    }
    game.status = 'completed';
    game.reason = 'Challenge declined';
    const ch = await interaction.client.channels.fetch(game.channelId).catch(() => null);
    if (ch?.isTextBased() && game.messageId) {
      const msg = await ch.messages.fetch(game.messageId).catch(() => null);
      if (msg) await msg.edit({ content: '\u274C Challenge declined.', components: [] }).catch(() => {});
    }
    await interaction.reply({ content: '\u274C Challenge declined.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'move') {
    const moveStr = interaction.options.getString('move', true);
    const game = findGame(interaction.channelId, interaction.user.id);
    if (!game || game.status !== 'active') {
      await interaction.reply({ content: 'No active game found in this channel.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (turnUser(game) !== interaction.user.id) {
      await interaction.reply({ content: 'It is not your turn.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const r = await processMove(game, moveStr, interaction, false);
    if (r && !r.success) {
      await interaction.editReply({ content: r.error });
    }
    return;
  }

  if (sub === 'resign') {
    const game = findGame(interaction.channelId, interaction.user.id);
    if (!game || game.status !== 'active') {
      await interaction.reply({ content: 'No active game to resign from.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (!isPlayer(game, interaction.user.id)) {
      await interaction.reply({ content: 'You are not a player in this game.', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    game.status = 'completed';
    const isW = interaction.user.id === game.whiteId;
    game.reason = `${isW ? 'White' : 'Black'} resigned`;
    await handleGameOver(game, interaction);
    await interaction.editReply({ content: `\u2705 You resigned. ${isW ? 'Black' : 'White'} wins!` });
    return;
  }

  if (sub === 'board') {
    const game = findGame(interaction.channelId, interaction.user.id);
    if (!game) {
      await interaction.reply({ content: 'No chess game found in this channel.', flags: MessageFlags.Ephemeral });
      return;
    }
    const buf = renderBoard(game.game, game.lastMove, boardStyle(game));
    const attach = new AttachmentBuilder(buf, { name: 'board.png' });
    const turn = game.game.turn() === 'w' ? 'White' : 'Black';
    const status = game.status === 'completed' ? `\n**Game Over** \u2014 ${game.reason || ''}` : `\n**${turn}'s turn**`;
    await interaction.reply({ content: `<@${game.whiteId}> (White) vs <@${game.blackId}> (Black)${status}`, files: [attach], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'draw') {
    const game = findGame(interaction.channelId, interaction.user.id);
    if (!game || game.status !== 'active') {
      await interaction.reply({ content: 'No active game found.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (!isPlayer(game, interaction.user.id)) {
      await interaction.reply({ content: 'You are not a player in this game.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (game.drawOfferedBy === interaction.user.id) {
      await interaction.reply({ content: 'You already offered a draw. Wait for your opponent.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (game.drawOfferedBy) {
      game.status = 'completed';
      game.reason = 'Draw by agreement';
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await handleGameOver(game, interaction);
      await interaction.editReply({ content: '\u2705 Draw accepted!' });
      return;
    }
    game.drawOfferedBy = interaction.user.id;
    const other = game.whiteId === interaction.user.id ? game.blackId : game.whiteId;
    const con = `<@${other}> \u2014 I offer a draw! Click **Draw** to accept.`;
    await updateBoardMessage(game, interaction.client, con, getBoardButtons(game, interaction.user.id));
    await interaction.reply({ content: '\u270D\uFE0F Draw offered!', flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'lichess') {
    const token = process.env.LICHESS_API_TOKEN;
    if (!token) {
      await interaction.reply({ content: '`LICHESS_API_TOKEN` is not set in `.env`. Get one at https://lichess.org/account/oauth/token (scope: Board play)', flags: MessageFlags.Ephemeral });
      return;
    }

    const level = interaction.options.getInteger('level') ?? 3;
    const color = interaction.options.getString('color') as 'random' | 'white' | 'black' ?? 'random';

    const existing = getActiveGame(interaction.channelId, interaction.user.id);
    if (existing) {
      await interaction.reply({ embeds: [embed('Game Already Exists', 'You already have an active game.')], flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const ls = await challengeAI(token, level, color);

      const myIsWhite = ls.myColor === 'white';
      const game = createGame(
        interaction.channelId, interaction.guildId!,
        myIsWhite ? interaction.user.id : interaction.client.user!.id,
        myIsWhite ? interaction.client.user!.id : interaction.user.id,
        true, 'active',
      );
      if (!game) {
        await interaction.editReply({ content: 'Could not create game.' });
        return;
      }

      game.game.load(ls.chess.fen());
      game.lichessGameId = ls.gameId;
      game.lichessColor = ls.myColor;
      game.lastMove = ls.lastUci ? { from: ls.lastUci.slice(0, 2), to: ls.lastUci.slice(2, 4), san: ls.lastUci } : null;

      const style = 'lichess';
      const buf = renderBoard(game.game, game.lastMove, style);
      const attach = new AttachmentBuilder(buf, { name: 'board.png' });
      const buttons = getBoardButtons(game, interaction.user.id);
      const ch = interaction.channel as any;
      const msg = await ch.send({
        content: `\u2654 **Chess vs Lichess AI** \u265A\n<@${interaction.user.id}> (${game.lichessColor === 'white' ? 'White' : 'Black'}) vs **Stockfish lv${level}**\n\n**Your turn** \u2014 <@${interaction.user.id}>`,
        files: [attach],
        components: buttons,
      });

      game.messageId = msg.id;
      startLichessStream(token, game, interaction.client);

      await interaction.editReply({ content: `\u2705 Lichess game started vs Stockfish level ${level}! Make your move using the buttons on the board message.` });
    } catch (e: any) {
      await interaction.editReply({ content: `\u274C Lichess error: ${e.message}` });
    }
    return;
  }
}

async function updateLichessBoard(game: ChessGameState, client: any) {
  if (!game.messageId) return;
  const ch = await client.channels.fetch(game.channelId).catch(() => null);
  if (!ch?.isTextBased()) return;
  const msg = await ch.messages.fetch(game.messageId).catch(() => null);
  if (!msg) return;

  const userId = game.lichessColor === 'white' ? game.whiteId : game.blackId;
  const style = 'lichess';
  const buf = renderBoard(game.game, game.lastMove, style);
  const attach = new AttachmentBuilder(buf, { name: 'board.png' });

  const status = game.status === 'completed'
    ? `\n**Game Over** \u2014 ${game.reason || ''}`
    : `\n${game.game.turn() === 'w' ? '**White**' : '**Black**'}'s turn`;

  const content = `\u2654 **Chess vs Lichess AI** \u265A\n<@${game.whiteId}> (White) vs <@${game.blackId}> (Black)${status}`;
  const buttons = game.status === 'active' ? getBoardButtons(game, userId) : [];
  await msg.edit({ content, files: [attach], components: buttons }).catch(() => {});
}

async function handleLichessGameOver(game: ChessGameState, winner: string | null) {
  if (winner === 'white') {
    game.reason = game.whiteId === game.lichessColor ? 'You won!' : 'Stockfish won!';
  } else if (winner === 'black') {
    game.reason = game.blackId === game.lichessColor ? 'You won!' : 'Stockfish won!';
  } else {
    game.reason = 'Game ended.';
  }
  game.status = 'completed';
}

async function startLichessStream(token: string, game: ChessGameState, client: any) {
  try {
    await startStream(
      token,
      game.lichessGameId!,
      game.game,
      (chess, lastUci, status, winner) => {
        game.movePending = false;
        game.lastMove = lastUci ? { from: lastUci.slice(0, 2), to: lastUci.slice(2, 4), san: lastUci } : null;

        if (status !== 'started' && status !== 'created' && status !== 'playing') {
          handleLichessGameOver(game, winner);
          updateLichessBoard(game, client);
        } else {
          // Verify it's not our own move by checking the board
          updateLichessBoard(game, client);
        }
      },
      (err) => { console.error('Lichess stream error:', err); },
    );
  } catch (e) {
    console.error('Lichess stream error:', e);
  }
}

async function getAiMove(game: Chess): Promise<string> {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  const moves = game.moves();
  const random = () => moves[Math.floor(Math.random() * moves.length)];
  if (!apiKey || moves.length === 0) return random();

  try {
    const reply = await queryLlm(
      [{ role: 'user', content: `You are a chess engine. FEN: ${game.fen()}
You play as ${game.turn() === 'w' ? 'white' : 'black'}. Legal moves: ${moves.join(', ')}
Reply with ONLY your move in standard algebraic notation (e.g. e4, Nf3, O-O, exd5). No extra text.` }],
      { apiKey, baseUrl, model, temperature: 0.3, maxTokens: 20 },
    );

    const words = reply.trim().toLowerCase().split(/[^a-z0-9+#=\-]+/).filter(Boolean);
    for (const w of words) {
      const e = moves.find(m => m.toLowerCase() === w);
      if (e) return e;
    }
    for (const w of words) {
      const p = moves.find(m => m.toLowerCase().startsWith(w));
      if (p) return p;
    }
    console.log(`LLM returned invalid move: "${reply}", using random fallback`);
    return random();
  } catch (e) {
    console.error('LLM error in getAiMove:', e);
    return random();
  }
}
