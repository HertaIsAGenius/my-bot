import { Message, GuildMember, TextChannel, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { getAutoModRules, logAutoModAction, AutoModRule, AutoModCondition, AutoModAction } from './db';

const INVITE_RE = /discord\.(gg|com\/invite|me)\/\S+/i;
const URL_RE = /https?:\/\/[^\s]+/gi;
const EVERYONE_RE = /(@everyone|@here)/g;

function matchCondition(msg: Message, condition: AutoModCondition): boolean {
  const content = msg.content || '';

  switch (condition.type) {
    case 'keyword': {
      if (!condition.value) return false;
      return content.toLowerCase().includes(condition.value.toLowerCase());
    }
    case 'regex': {
      if (!condition.value) return false;
      try {
        return new RegExp(condition.value, 'i').test(content);
      } catch { return false; }
    }
    case 'mentions': {
      const count = msg.mentions.users.size + msg.mentions.roles.size;
      if (condition.min && count < condition.min) return false;
      if (condition.max && count > condition.max) return false;
      if ((condition.min || condition.max) && condition.min === undefined) return count >= (condition.min ?? 1);
      return condition.min ? count >= condition.min : true;
    }
    case 'links': {
      const matches = content.match(URL_RE);
      const count = matches?.length || 0;
      if (condition.min && count < condition.min) return false;
      if (condition.max && count > condition.max) return false;
      return condition.min ? count >= condition.min : count > 0;
    }
    case 'emotes': {
      const customEmote = content.match(/<a?:\w+:\d+>/g);
      const unicodeEmote = content.match(/[\u{1F000}-\u{1FFFF}]/gu);
      const count = (customEmote?.length || 0) + (unicodeEmote?.length || 0);
      if (condition.min && count < condition.min) return false;
      if (condition.max && count > condition.max) return false;
      return condition.min ? count >= condition.min : count > 0;
    }
    case 'caps': {
      const letters = content.replace(/[^a-zA-Z]/g, '');
      if (letters.length < (condition.min || 5)) return false;
      const upper = letters.replace(/[^A-Z]/g, '');
      const ratio = upper.length / letters.length;
      return ratio > 0.7;
    }
    case 'spoilers': {
      const spoilers = content.match(/\|\|.+\|\|/g);
      const count = spoilers?.length || 0;
      if (condition.min && count < condition.min) return false;
      if (condition.max && count > condition.max) return false;
      return condition.min ? count >= condition.min : count > 0;
    }
    case 'attachments': {
      const count = msg.attachments.size;
      if (condition.min && count < condition.min) return false;
      if (condition.max && count > condition.max) return false;
      return condition.min ? count >= condition.min : count > 0;
    }
    default:
      return false;
  }
}

function allConditionsMatch(msg: Message, conditions: AutoModCondition[]): boolean {
  return conditions.every(c => matchCondition(msg, c));
}

async function executeActions(msg: Message, rule: AutoModRule) {
  for (const action of rule.actions) {
    try {
      switch (action.type) {
        case 'delete': {
          if (msg.deletable) await msg.delete();
          break;
        }
        case 'warn': {
          const dm = await msg.author.createDM().catch(() => null);
          if (dm) {
            await dm.send({
              content: `**Warning** in ${msg.guild?.name}\nReason: ${action.reason || 'Auto-mod rule triggered'}\n\n> ${(msg.content || '(no text)').slice(0, 1000)}`
            }).catch(() => {});
          }
          break;
        }
        case 'timeout': {
          const member = msg.member;
          if (member && member.moderatable) {
            await member.timeout(action.duration || 600000, action.reason || 'Auto-mod action');
          }
          break;
        }
        case 'log': {
          const logChan = action.channel_id
            ? await msg.guild?.channels.fetch(action.channel_id).catch(() => null)
            : null;
          if (logChan && logChan.isTextBased()) {
            await logChan.send({
              content: `**Auto-mod** — Rule: \`${rule.name}\`\nUser: ${msg.author.tag} (<@${msg.author.id}>)\nChannel: <#${msg.channel.id}>\nAction: ${action.type}${action.reason ? ` (${action.reason})` : ''}\nContent: ${(msg.content || '*no text*').slice(0, 1500)}`
            }).catch(() => {});
          }
          break;
        }
      }
    } catch {}
  }
}

export async function checkMessage(msg: Message) {
  if (!msg.guild || msg.author.bot) return;
  if (msg.member?.permissions.has(PermissionFlagsBits.ManageMessages)) return;

  const rules = getAutoModRules(msg.guild.id);
  if (rules.length === 0) return;

  for (const rule of rules) {
    if (!rule.enabled) continue;

    if (rule.whitelist.length > 0 && rule.whitelist.includes(msg.channel.id)) continue;
    if (rule.blacklist.length > 0 && rule.blacklist.includes(msg.channel.id)) continue;

    if (allConditionsMatch(msg, rule.conditions)) {
      await executeActions(msg, rule);
      for (const action of rule.actions) {
        logAutoModAction(msg.guild.id, rule.name, msg.author.id, action.type);
      }
      return;
    }
  }
}

export interface RuleTemplate {
  name: string;
  description: string;
  conditions: AutoModCondition[];
  actions: AutoModAction[];
}

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    name: 'invites',
    description: 'Block Discord invite links',
    conditions: [{ type: 'regex', value: 'discord\\.(gg|com/invite|me)/\\S+' }],
    actions: [{ type: 'delete', reason: 'No invite links' }, { type: 'log' }],
  },
  {
    name: 'mass-mention',
    description: 'Block messages with 5+ mentions',
    conditions: [{ type: 'mentions', min: 5 }],
    actions: [{ type: 'delete', reason: 'Mass mention' }, { type: 'timeout', duration: 300000, reason: 'Mass mention' }, { type: 'log' }],
  },
  {
    name: 'excessive-caps',
    description: 'Block messages with >70% caps and 5+ letters',
    conditions: [{ type: 'caps', min: 5 }],
    actions: [{ type: 'delete', reason: 'Excessive caps' }, { type: 'log' }],
  },
  {
    name: 'link-spam',
    description: 'Block messages with 3+ links',
    conditions: [{ type: 'links', min: 3 }],
    actions: [{ type: 'delete', reason: 'Link spam' }, { type: 'log' }],
  },
];
