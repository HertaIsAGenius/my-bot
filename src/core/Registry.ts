import {
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import {
  ButtonHandler,
  ModalHandler,
  SelectMenuHandler,
  AutocompleteHandler,
  CommandHandler,
  ButtonEntry,
  ModalEntry,
  SelectMenuEntry,
  AutocompleteEntry,
  RegisteredCommand,
} from './types';
import { embed } from '../utils/embed';

function matchPattern(pattern: string | RegExp, value: string): boolean {
  if (typeof pattern === 'string') return pattern === value;
  return pattern.test(value);
}

async function safeHandle<T>(handler: (i: T) => Promise<void> | void, interaction: T, label: string): Promise<void> {
  try {
    await handler(interaction);
  } catch (error) {
    console.error(`[Registry] ${label} handler error (${(interaction as any).customId ?? (interaction as any).commandName ?? ''}):`, error);
  }
}

export class Registry {
  private buttons: ButtonEntry[] = [];
  private modals: ModalEntry[] = [];
  private selectMenus: SelectMenuEntry[] = [];
  private autocompletes: Map<string, AutocompleteHandler> = new Map();
  private commands: Map<string, RegisteredCommand> = new Map();

  // -- Button --

  registerButton(pattern: string | RegExp, handler: ButtonHandler): void {
    this.buttons.push({ pattern, handler });
  }

  handleButton(interaction: ButtonInteraction): boolean {
    for (const entry of this.buttons) {
      if (matchPattern(entry.pattern, interaction.customId)) {
        safeHandle(entry.handler, interaction, 'button');
        return true;
      }
    }
    return false;
  }

  // -- Modal --

  registerModal(pattern: string | RegExp, handler: ModalHandler): void {
    this.modals.push({ pattern, handler });
  }

  handleModal(interaction: ModalSubmitInteraction): boolean {
    for (const entry of this.modals) {
      if (matchPattern(entry.pattern, interaction.customId)) {
        safeHandle(entry.handler, interaction, 'modal');
        return true;
      }
    }
    return false;
  }

  // -- Select Menu --

  registerSelectMenu(pattern: string | RegExp, handler: SelectMenuHandler): void {
    this.selectMenus.push({ pattern, handler });
  }

  handleSelectMenu(interaction: StringSelectMenuInteraction): boolean {
    for (const entry of this.selectMenus) {
      if (matchPattern(entry.pattern, interaction.customId)) {
        safeHandle(entry.handler, interaction, 'selectMenu');
        return true;
      }
    }
    return false;
  }

  // -- Autocomplete --

  registerAutocomplete(commandName: string, handler: AutocompleteHandler): void {
    this.autocompletes.set(commandName, handler);
  }

  handleAutocomplete(interaction: AutocompleteInteraction): boolean {
    const handler = this.autocompletes.get(interaction.commandName);
    if (handler) {
      safeHandle(handler, interaction, 'autocomplete');
      return true;
    }
    return false;
  }

  // -- Slash Command --

  registerCommand(name: string, handler: CommandHandler, permissionRoles?: string[]): void {
    this.commands.set(name, { handler, permissionRoles });
  }

  async handleCommand(interaction: ChatInputCommandInteraction, memberRoles?: string[]): Promise<boolean> {
    const entry = this.commands.get(interaction.commandName);
    if (!entry) return false;

    if (entry.permissionRoles && entry.permissionRoles.length > 0 && memberRoles) {
      const hasRole = memberRoles.some(r => entry.permissionRoles!.includes(r));
      if (!hasRole) {
        await interaction.reply({ embeds: [embed('Permission Denied', 'You do not have permission to use this command.')], flags: MessageFlags.Ephemeral });
        return true;
      }
    }

    safeHandle(entry.handler, interaction, 'command');
    return true;
  }
}
