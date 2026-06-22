import {
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  ButtonInteraction,
  MessageFlags
} from 'discord.js';
import { embed } from './embed';

export interface ConfirmFlowOptions {
  embed: EmbedBuilder;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmStyle?: ButtonStyle;
  time?: number;
}

export async function withConfirmFlow(
  interaction: ChatInputCommandInteraction,
  opts: ConfirmFlowOptions,
  onConfirm: (btn: ButtonInteraction) => Promise<void>,
  onCancel?: (btn: ButtonInteraction) => Promise<void>
): Promise<void> {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('cf_confirm')
      .setLabel(opts.confirmLabel || 'Confirm')
      .setStyle(opts.confirmStyle || ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('cf_cancel')
      .setLabel(opts.cancelLabel || 'Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({ embeds: [opts.embed], components: [row] });

  const msg = await interaction.fetchReply();
  const btn = await msg.awaitMessageComponent<ComponentType.Button>({
    componentType: ComponentType.Button,
    time: opts.time || 30000
  }).catch(() => null);

  if (!btn || btn.user.id !== interaction.user.id) {
    try { await msg.edit({ components: [] }); } catch {}
    return;
  }

  if (btn.customId === 'cf_cancel') {
    if (onCancel) {
      await onCancel(btn);
    } else {
      await btn.update({ embeds: [embed('Cancelled', 'Action cancelled.')], components: [] });
    }
    return;
  }

  try {
    await onConfirm(btn);
  } catch (e) {
    console.error('Confirm flow error:', e);
    try { await msg.edit({ components: [] }); } catch {}
  }
}
