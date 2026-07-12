import {
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
} from 'discord.js';

export type InteractionHandler<T> = (interaction: T) => Promise<void> | void;

export type ButtonHandler = InteractionHandler<ButtonInteraction>;
export type ModalHandler = InteractionHandler<ModalSubmitInteraction>;
export type SelectMenuHandler = InteractionHandler<StringSelectMenuInteraction>;
export type AutocompleteHandler = InteractionHandler<AutocompleteInteraction>;
export type CommandHandler = InteractionHandler<ChatInputCommandInteraction>;

export interface RegisteredCommand {
  handler: CommandHandler;
  permissionRoles?: string[];
}

export interface ButtonEntry {
  pattern: string | RegExp;
  handler: ButtonHandler;
}

export interface ModalEntry {
  pattern: string | RegExp;
  handler: ModalHandler;
}

export interface SelectMenuEntry {
  pattern: string | RegExp;
  handler: SelectMenuHandler;
}

export interface AutocompleteEntry {
  commandName: string;
  handler: AutocompleteHandler;
}
