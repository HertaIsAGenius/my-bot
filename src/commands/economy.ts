import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { embed, COLORS } from '../utils/embed';
import { getBalance, addMoney, removeMoney, transferMoney, depositToBank, withdrawFromBank, buyItem, getRichLeaderboard, COOLDOWNS, DAILY_AMOUNT, WORK_MIN, WORK_MAX, BEG_MIN, BEG_MAX, formatDuration } from '../utils/economy';
import { getEconomy, setEconomy, getShopItems, addShopItem, deleteShopItem } from '../utils/db';

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default async function (interaction: ChatInputCommandInteraction) {
  const sub = interaction.commandName;
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  if (sub === 'balance') {
    const target = interaction.options.getUser('user') || interaction.user;
    const eco = getBalance(guildId, target.id);
    const e = embed('Balance', `${target.username}'s Wallet`)
      .setColor(COLORS.info)
      .addFields(
        { name: 'Cash', value: `$${eco.wallet.toLocaleString()}`, inline: true },
        { name: 'Bank', value: `$${(eco.bank || 0).toLocaleString()}`, inline: true },
        { name: 'Total', value: `$${(eco.wallet + (eco.bank || 0)).toLocaleString()}`, inline: true },
      );
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'daily') {
    const eco = getEconomy(guildId, userId);
    const now = Date.now();
    const remaining = eco.last_daily + COOLDOWNS.daily - now;
    if (remaining > 0) {
      await interaction.reply({ embeds: [embed('Cooldown', `You already claimed your daily. Come back in ${formatDuration(remaining)}.`)], flags: MessageFlags.Ephemeral });
      return;
    }
    const bonus = 0;
    const amount = DAILY_AMOUNT + bonus;
    eco.wallet += amount;
    eco.last_daily = now;
    setEconomy(guildId, userId, eco);
    await interaction.reply({ embeds: [embed('Daily Reward', `You received **$${amount.toLocaleString()}**!`).setColor(COLORS.success)], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'work') {
    const eco = getEconomy(guildId, userId);
    const now = Date.now();
    const remaining = eco.last_work + COOLDOWNS.work - now;
    if (remaining > 0) {
      await interaction.reply({ embeds: [embed('Cooldown', `You're still on the clock. Wait ${formatDuration(remaining)}.`)], flags: MessageFlags.Ephemeral });
      return;
    }
    const amount = randomInt(WORK_MIN, WORK_MAX);
    const jobs = ['flipping burgers', 'coding', 'consulting', 'delivering packages', 'walking dogs', 'washing cars'];
    const job = jobs[Math.floor(Math.random() * jobs.length)];
    eco.wallet += amount;
    eco.last_work = now;
    setEconomy(guildId, userId, eco);
    const e = embed('Work', `You worked ${job} and earned **$${amount.toLocaleString()}**!`).setColor(COLORS.success);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'beg') {
    const eco = getEconomy(guildId, userId);
    const now = Date.now();
    const remaining = eco.last_beg + COOLDOWNS.beg - now;
    if (remaining > 0) {
      await interaction.reply({ embeds: [embed('Cooldown', `You already begged recently. Wait ${formatDuration(remaining)}.`)], flags: MessageFlags.Ephemeral });
      return;
    }
    const amount = randomInt(BEG_MIN, BEG_MAX);
    eco.wallet += amount;
    eco.last_beg = now;
    setEconomy(guildId, userId, eco);
    const e = embed('Begging', `Someone gave you **$${amount.toLocaleString()}**.`).setColor(COLORS.info);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'gamble') {
    const amount = interaction.options.getInteger('amount', true);
    if (amount <= 0) {
      await interaction.reply({ embeds: [embed('Invalid Amount', 'Amount must be positive.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const eco = getEconomy(guildId, userId);
    const now = Date.now();
    const remaining = eco.last_gamble + COOLDOWNS.gamble - now;
    if (remaining > 0) {
      await interaction.reply({ embeds: [embed('Cooldown', `Gamble cooldown active. Wait ${formatDuration(remaining)}.`)], flags: MessageFlags.Ephemeral });
      return;
    }
    if (eco.wallet < amount) {
      await interaction.reply({ embeds: [embed('Insufficient Funds', `You only have $${eco.wallet.toLocaleString()}.`)], flags: MessageFlags.Ephemeral });
      return;
    }
    const win = Math.random() < 0.4;
    const payout = win ? Math.floor(amount * 2.0) : -amount;
    eco.wallet += payout;
    eco.last_gamble = now;
    setEconomy(guildId, userId, eco);
    const e = win
      ? embed('Gamble', `You won **$${payout.toLocaleString()}**! New balance: $${eco.wallet.toLocaleString()}.`).setColor(COLORS.success)
      : embed('Gamble', `You lost **$${amount.toLocaleString()}**. New balance: $${eco.wallet.toLocaleString()}.`).setColor(COLORS.danger);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'pay') {
    const target = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);
    if (target.id === userId) {
      await interaction.reply({ embeds: [embed('Invalid Target', 'You cannot pay yourself.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (amount <= 0) {
      await interaction.reply({ embeds: [embed('Invalid Amount', 'Amount must be positive.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const result = transferMoney(guildId, userId, target.id, amount);
    if (!result) {
      await interaction.reply({ embeds: [embed('Insufficient Funds', 'You don\'t have enough money.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const e = embed('Payment', `You paid **${target.username}** $${amount.toLocaleString()}.`).setColor(COLORS.success);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'rob') {
    const target = interaction.options.getUser('user', true);
    if (target.id === userId) {
      await interaction.reply({ embeds: [embed('Invalid Target', 'You cannot rob yourself.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (target.bot) {
      await interaction.reply({ embeds: [embed('Invalid Target', 'You cannot rob a bot.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const eco = getEconomy(guildId, userId);
    const now = Date.now();
    const remaining = eco.last_rob + COOLDOWNS.rob - now;
    if (remaining > 0) {
      await interaction.reply({ embeds: [embed('Cooldown', `You need to lay low. Wait ${formatDuration(remaining)}.`)], flags: MessageFlags.Ephemeral });
      return;
    }
    const victim = getEconomy(guildId, target.id);
    if (victim.wallet < 100) {
      await interaction.reply({ embeds: [embed('Too Poor', `${target.username} is too poor to rob.`)], flags: MessageFlags.Ephemeral });
      return;
    }
    const success = Math.random() < 0.25;
    if (success) {
      const stolen = Math.floor(victim.wallet * 0.15);
      victim.wallet -= stolen;
      eco.wallet += stolen;
      eco.last_rob = now;
      setEconomy(guildId, userId, eco);
      setEconomy(guildId, target.id, victim);
      const e = embed('Robbery', `You stole **$${stolen.toLocaleString()}** from ${target.username}!`).setColor(COLORS.success);
      await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    } else {
      const fine = Math.floor(eco.wallet * 0.1);
      eco.wallet = Math.max(0, eco.wallet - fine);
      eco.last_rob = now;
      setEconomy(guildId, userId, eco);
      const e = embed('Robbery Failed', `You got caught and fined **$${fine.toLocaleString()}**.`).setColor(COLORS.danger);
      await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    }
    return;
  }

  if (sub === 'deposit') {
    const amount = interaction.options.getInteger('amount', true);
    const result = depositToBank(guildId, userId, amount);
    if (result === null) {
      await interaction.reply({ embeds: [embed('Insufficient Cash', 'You don\'t have enough cash.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (result === 'exceeds_capacity') {
      await interaction.reply({ embeds: [embed('Bank Full', 'Bank capacity exceeded (max $50,000).')], flags: MessageFlags.Ephemeral });
      return;
    }
    const e = embed('Deposit', `Deposited **$${amount.toLocaleString()}**.`).setColor(COLORS.success);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'withdraw') {
    const amount = interaction.options.getInteger('amount', true);
    const result = withdrawFromBank(guildId, userId, amount);
    if (result === null) {
      await interaction.reply({ embeds: [embed('Insufficient Bank Balance', 'You don\'t have enough in your bank.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const e = embed('Withdraw', `Withdrew **$${amount.toLocaleString()}**.`).setColor(COLORS.success);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'shop') {
    const items = getShopItems(guildId);
    if (items.length === 0) {
      await interaction.reply({ embeds: [embed('Shop', 'The shop is empty.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const desc = items.map((i: any) => `**#${i.item_id}** ${i.name} — $${i.price.toLocaleString()}${i.description ? `\n> ${i.description}` : ''}`).join('\n');
    const e = embed('Shop', desc).setColor(COLORS.info);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'buy') {
    const itemId = interaction.options.getInteger('item', true);
    const result = buyItem(guildId, userId, itemId);
    if (result === 'not_found') {
      await interaction.reply({ embeds: [embed('Not Found', 'Item not found.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (result === 'insufficient_funds') {
      await interaction.reply({ embeds: [embed('Insufficient Funds', 'You don\'t have enough money.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const { data, item } = result;
    if (item.role_id) {
      try {
        const member = interaction.member as any;
        if (member?.roles) await member.roles.add(item.role_id);
      } catch {}
    }
    const e = embed('Purchase', `You bought **${item.name}** for $${item.price.toLocaleString()}.`).setColor(COLORS.success);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'inventory') {
    const target = interaction.options.getUser('user') || interaction.user;
    const eco = getBalance(guildId, target.id);
    const inv = eco.inventory || {};
    const entries = Object.entries(inv).filter(([, v]) => (v as number) > 0);
    if (entries.length === 0) {
      await interaction.reply({ embeds: [embed('Inventory', `${target.username}'s inventory is empty.`)], flags: MessageFlags.Ephemeral });
      return;
    }
    const desc = entries.map(([name, count]) => `**${name}** x${count}`).join('\n');
    const e = embed(`${target.username}'s Inventory`, desc).setColor(COLORS.info);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'ecoleaderboard') {
    const lb = getRichLeaderboard(guildId, 10);
    if (lb.length === 0) {
      await interaction.reply({ embeds: [embed('Leaderboard', 'No economy data yet.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const desc = lb.map((u, i) => `**#${i + 1}** <@${u.user_id}> — $${u.total.toLocaleString()}`).join('\n');
    const e = embed('Richest Users', desc).setColor(COLORS.warning);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'shopadmin') {
    const shopSub = interaction.options.getSubcommand(true);
    const name = interaction.options.getString('name', true);
    if (shopSub === 'add') {
      const price = interaction.options.getInteger('price', true);
      const description = interaction.options.getString('description') || '';
      const role = interaction.options.getRole('role');
      addShopItem(guildId, name, price, { description, roleId: role?.id || undefined, type: role ? 'role' : 'item' });
      await interaction.reply({ embeds: [embed('Shop Item Added', `Added **${name}** to shop for $${price}.`)], flags: MessageFlags.Ephemeral });
    } else if (shopSub === 'remove') {
      const items = getShopItems(guildId);
      const item = items.find((i: any) => i.name.toLowerCase() === name.toLowerCase());
      if (!item) {
        await interaction.reply({ embeds: [embed('Not Found', `Item "${name}" not found.`)], flags: MessageFlags.Ephemeral });
        return;
      }
      deleteShopItem(guildId, item.item_id);
      await interaction.reply({ embeds: [embed('Shop Item Removed', `Removed **${item.name}** from shop.`)], flags: MessageFlags.Ephemeral });
    }
    return;
  }

  await interaction.reply({ embeds: [embed('Error', 'Unknown subcommand.')], flags: MessageFlags.Ephemeral });
}
