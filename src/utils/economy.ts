import { getEconomy, setEconomy, getEconomyLeaderboard, getShopItems, getShopItem, addShopItem, deleteShopItem, logEconTransaction } from './db';

export const COOLDOWNS = {
  daily: 24 * 60 * 60 * 1000,
  work: 30 * 60 * 1000,
  beg: 30 * 60 * 1000,
  crime: 60 * 60 * 1000,
  rob: 4 * 60 * 60 * 1000,
  gamble: 5 * 60 * 1000,
  fish: 45 * 60 * 1000,
  mine: 60 * 60 * 1000,
};

export const DAILY_AMOUNT = 1000;
export const WORK_MIN = 50;
export const WORK_MAX = 150;
export const BEG_MIN = 1;
export const BEG_MAX = 20;

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function getBalance(guildId: string, userId: string) {
  return getEconomy(guildId, userId);
}

export function addMoney(guildId: string, userId: string, amount: number, source: string) {
  const data = getEconomy(guildId, userId);
  data.wallet += amount;
  setEconomy(guildId, userId, data);
  logEconTransaction(guildId, userId, source, amount, data.wallet);
  return data;
}

export function removeMoney(guildId: string, userId: string, amount: number, source: string) {
  const data = getEconomy(guildId, userId);
  if (data.wallet < amount) return null;
  data.wallet -= amount;
  setEconomy(guildId, userId, data);
  logEconTransaction(guildId, userId, source, -amount, data.wallet);
  return data;
}

export function transferMoney(guildId: string, senderId: string, receiverId: string, amount: number) {
  const sender = getEconomy(guildId, senderId);
  if (sender.wallet < amount) return null;
  const receiver = getEconomy(guildId, receiverId);
  sender.wallet -= amount;
  receiver.wallet += amount;
  setEconomy(guildId, senderId, sender);
  setEconomy(guildId, receiverId, receiver);
  logEconTransaction(guildId, senderId, 'transfer_sent', -amount, sender.wallet);
  logEconTransaction(guildId, receiverId, 'transfer_received', amount, receiver.wallet);
  return { sender, receiver };
}

export function depositToBank(guildId: string, userId: string, amount: number) {
  const data = getEconomy(guildId, userId);
  if (data.wallet < amount) return null;
  const maxBank = 50000;
  if ((data.bank || 0) + amount > maxBank) return 'exceeds_capacity';
  data.wallet -= amount;
  data.bank = (data.bank || 0) + amount;
  setEconomy(guildId, userId, data);
  logEconTransaction(guildId, userId, 'deposit', amount, data.wallet);
  return data;
}

export function withdrawFromBank(guildId: string, userId: string, amount: number) {
  const data = getEconomy(guildId, userId);
  const bank = data.bank || 0;
  if (bank < amount) return null;
  data.bank = bank - amount;
  data.wallet += amount;
  setEconomy(guildId, userId, data);
  logEconTransaction(guildId, userId, 'withdraw', -amount, data.wallet);
  return data;
}

export function buyItem(guildId: string, userId: string, itemId: number) {
  const item = getShopItem(guildId, itemId);
  if (!item) return 'not_found';
  const data = getEconomy(guildId, userId);
  if (data.wallet < item.price) return 'insufficient_funds';
  data.wallet -= item.price;
  const inv = data.inventory || {};
  inv[item.name] = (inv[item.name] || 0) + 1;
  data.inventory = inv;
  setEconomy(guildId, userId, data);
  logEconTransaction(guildId, userId, 'purchase', -item.price, data.wallet, item.name);
  return { data, item };
}

export function getRichLeaderboard(guildId: string, limit = 10) {
  return getEconomyLeaderboard(guildId, limit);
}
