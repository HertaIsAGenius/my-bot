import { ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { embed, COLORS } from '../utils/embed';
import { addForm } from '../utils/trialapps';

const makeAppStates = new Map<string, { formName: string; questions: string[] }>();

export default async function makeappCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ embeds: [embed('Guild Only', 'This command must be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.memberPermissions?.has('ManageGuild')) {
    await interaction.reply({ embeds: [embed('Permission Denied', 'You need Manage Server permission.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId('makeapp_name_modal')
    .setTitle('Create Application Form')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('form_name')
          .setLabel('Form name')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. Trial-Moderator')
          .setRequired(true)
          .setMaxLength(100)
      )
    );

  await interaction.showModal(modal);
}

export async function handleMakeAppNameSubmit(interaction: any) {
  const formName = interaction.fields.getTextInputValue('form_name');
  if (!interaction.guild) {
    await interaction.reply({ embeds: [embed('Guild Only', 'Must be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }

  makeAppStates.set(interaction.user.id, { formName, questions: [] });

  const e = new EmbedBuilder()
    .setColor(COLORS.accent)
    .setTitle(`Creating Form: ${formName}`)
    .setDescription('Type **question 1** in this channel, or type `!stopapplication` to finish.');

  await interaction.reply({ embeds: [e] });
}

export async function handleMakeAppMessage(message: any): Promise<boolean> {
  if (!message.guild || message.author.bot) return false;

  const state = makeAppStates.get(message.author.id);
  if (!state) return false;

  const text = message.content.trim();

  if (text.toLowerCase() === '!stopapplication') {
    if (state.questions.length === 0) {
      try { await message.reply({ embeds: [embed('No Questions', 'You need at least one question. Type a question or use `!stopapplication` after adding some.')] }); } catch {}
      return true;
    }
    addForm(message.guild.id, { name: state.formName, questions: state.questions });
    makeAppStates.delete(message.author.id);

    const qs = state.questions.map((q, i) => `**Q${i + 1}:** ${q}`).join('\n');
    const e = new EmbedBuilder()
      .setColor(COLORS.accent)
      .setTitle(`Form Saved: ${state.formName}`)
      .setDescription(`**${state.questions.length} question(s)**\n\n${qs}`);
    try { await message.channel.send({ embeds: [e] }); } catch {}
    return true;
  }

  state.questions.push(text);
  const nextNum = state.questions.length + 1;
  try { await message.reply({ embeds: [embed('Question Added', `**Question ${nextNum}:** Type the next question, or type \`!stopapplication\` to finish.`)] }); } catch {}
  return true;
}

module.exports = { default: makeappCommand, handleMakeAppNameSubmit, handleMakeAppMessage, makeAppStates };
