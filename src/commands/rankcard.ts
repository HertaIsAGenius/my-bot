import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { embed, COLORS } from '../utils/embed';
import { getCardConfig, setCardConfig, resetCardConfig, RankCardConfig } from '../utils/rankCards';

const VALID_HEX = /^#[0-9a-fA-F]{6}$/;

function isValidHex(color: string): boolean {
  return VALID_HEX.test(color);
}

function configSummary(config: RankCardConfig): string {
  return [
    `**Background:** \`${config.backgroundColor}\``,
    `**Accent:** \`${config.accentColor}\``,
    `**XP Bar:** \`${config.barColor}\``,
    `**Avatar Style:** \`${config.avatarStyle}\``,
    `**Font:** \`${config.fontFamily}\``,
    config.backgroundImage ? `**BG Image:** ${config.backgroundImage}` : '**BG Image:** None',
  ].join('\n');
}

async function rankcardCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ embeds: [embed('Guild Only', 'This command must be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'view') {
    const config = getCardConfig(interaction.guild.id, interaction.user.id);
    await interaction.reply({
      embeds: [embed('Your Rank Card Customization', configSummary(config)).setColor(COLORS.info)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === 'reset') {
    resetCardConfig(interaction.guild.id, interaction.user.id);
    await interaction.reply({
      embeds: [embed('Rank Card Reset', 'Your rank card has been reset to defaults.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === 'set') {
    const field = interaction.options.getSubcommandGroup(false);
    const option = interaction.options.getString('value', true);

    switch (field) {
      case 'background': {
        if (!isValidHex(option)) {
          await interaction.reply({ embeds: [embed('Invalid Color', 'Provide a hex color like `#ff8844`.')], flags: MessageFlags.Ephemeral });
          return;
        }
        setCardConfig(interaction.guild.id, interaction.user.id, { backgroundColor: option });
        await interaction.reply({ embeds: [embed('Background Color Set', `Background changed to \`${option}\`.`)], flags: MessageFlags.Ephemeral });
        return;
      }
      case 'accent': {
        if (!isValidHex(option)) {
          await interaction.reply({ embeds: [embed('Invalid Color', 'Provide a hex color like `#ff8844`.')], flags: MessageFlags.Ephemeral });
          return;
        }
        setCardConfig(interaction.guild.id, interaction.user.id, { accentColor: option });
        await interaction.reply({ embeds: [embed('Accent Color Set', `Accent changed to \`${option}\`.`)], flags: MessageFlags.Ephemeral });
        return;
      }
      case 'bar': {
        if (!isValidHex(option)) {
          await interaction.reply({ embeds: [embed('Invalid Color', 'Provide a hex color like `#ff8844`.')], flags: MessageFlags.Ephemeral });
          return;
        }
        setCardConfig(interaction.guild.id, interaction.user.id, { barColor: option });
        await interaction.reply({ embeds: [embed('XP Bar Color Set', `XP bar color changed to \`${option}\`.`)], flags: MessageFlags.Ephemeral });
        return;
      }
      case 'avatar': {
        const styles = ['hexagon', 'circle', 'square'] as const;
        if (!styles.includes(option as any)) {
          await interaction.reply({ embeds: [embed('Invalid Style', 'Choose `hexagon`, `circle`, or `square`.')], flags: MessageFlags.Ephemeral });
          return;
        }
        setCardConfig(interaction.guild.id, interaction.user.id, { avatarStyle: option as RankCardConfig['avatarStyle'] });
        await interaction.reply({ embeds: [embed('Avatar Style Set', `Avatar style changed to \`${option}\`.`)], flags: MessageFlags.Ephemeral });
        return;
      }
      case 'font': {
        setCardConfig(interaction.guild.id, interaction.user.id, { fontFamily: option });
        await interaction.reply({ embeds: [embed('Font Set', `Font changed to \`${option}\`.`)], flags: MessageFlags.Ephemeral });
        return;
      }
      case 'bgimage': {
        if (option === 'none' || option === 'clear') {
          setCardConfig(interaction.guild.id, interaction.user.id, { backgroundImage: null });
          await interaction.reply({ embeds: [embed('Background Image Cleared', 'Rank card background image removed.')], flags: MessageFlags.Ephemeral });
        } else {
          setCardConfig(interaction.guild.id, interaction.user.id, { backgroundImage: option });
          await interaction.reply({ embeds: [embed('Background Image Set', `Background image URL set.`)], flags: MessageFlags.Ephemeral });
        }
        return;
      }
      default: {
        await interaction.reply({ embeds: [embed('Unknown Setting', 'Use one of: background, accent, bar, avatar, font, bgimage.')], flags: MessageFlags.Ephemeral });
      }
    }
  }
}

module.exports = { default: rankcardCommand };
