import {
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  ThreadChannel,
  TextChannel,
  NewsChannel,
  MessageFlags
} from 'discord.js';
import { getPingRole } from './ticketConfig';
import { createTicket } from './tickets';
const ticketMessageCreateCmd = require('../commands/ticketmessagecreate');

export async function handleTicketPanelJsonModal(interaction: ModalSubmitInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const json = interaction.fields.getTextInputValue('panel_json');
    const guild = interaction.guild;
    if (!guild) throw new Error('Not in a guild');

    const payload = ticketMessageCreateCmd.parseMessageJson(json);

    const catSelect = new StringSelectMenuBuilder()
      .setCustomId('ticket_cat_sel_panel')
      .setPlaceholder('Select a category...')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Server Inquiries').setValue('inquiry')
          .setDescription('General server questions and inquiries'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Server Reports').setValue('report')
          .setDescription('Report issues or problems'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Staff Reports').setValue('staffreport')
          .setDescription('Report staff-related concerns'),
        new StringSelectMenuOptionBuilder()
          .setLabel('HSR Questions').setValue('hsr')
          .setDescription('Honkai: Star Rail related questions')
      );

    const container = new ContainerBuilder();
    for (const ed of payload.embeds.map((e: EmbedBuilder) => e.data)) {
      if (ed.title) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${ed.title}`));
      if (ed.description) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(ed.description));
      if (Array.isArray(ed.fields) && ed.fields.length) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(ed.fields.map((f: any) => `**${f.name}**\n${f.value}`).join('\n\n')));
      }
      if (ed.footer?.text) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${ed.footer.text}`));
    }
    if (payload.content) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(payload.content));
    container.setAccentColor(payload.embeds[0]?.data.color ?? 0x2B3A67);
    container.addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(catSelect));

    const channel = interaction.channel as TextChannel;
    await channel.bulkDelete(100).catch(() => {});
    await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
    await interaction.editReply({ content: 'Ticket panel sent.' });
  } catch (e: any) {
    await interaction.editReply({ content: `Failed: ${e.message}` });
  }
}

export async function handleTicketCategorySelect(interaction: StringSelectMenuInteraction) {
  const panelMsgId = interaction.message.id;
  const category = interaction.values[0];

  const reasonModal = new ModalBuilder()
    .setCustomId(`trm_${panelMsgId}_${category}`)
    .setTitle('Ticket Reason')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('ticket_reason')
          .setLabel('Describe your issue in detail')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('What brings you here today?')
          .setRequired(true)
          .setMaxLength(1500)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('ticket_proof')
          .setLabel('Proof (image URL, optional)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('https://i.imgur.com/example.png')
          .setRequired(false)
          .setMaxLength(500)
      )
    );

  await interaction.showModal(reasonModal);
}

export async function handleTicketReasonModal(interaction: ModalSubmitInteraction) {
  const parts = interaction.customId.split('_');
  const category = parts[parts.length - 1];
  const reason = interaction.fields.getTextInputValue('ticket_reason');
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: 'This must be used in a server.', flags: MessageFlags.Ephemeral });
    return;
  }

  const prefixMap: Record<string, string> = { inquiry: 'si', report: 'sr', staffreport: 'sre', hsr: 'qna' };
  const prefix = prefixMap[category] || 'tk';
  const threadName = `${prefix}-${interaction.user.username}`;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const { getTicketConfig } = require('./ticketConfig');
    const config = getTicketConfig(guild.id);
    const targetChannel = config.ticketCategoryId
      ? (guild.channels.cache.get(config.ticketCategoryId) ?? await guild.channels.fetch(config.ticketCategoryId).catch(() => null))
      : null;
    const channel = (targetChannel ?? interaction.channel) as TextChannel | NewsChannel;
    if (!channel || !('threads' in channel)) {
      await interaction.editReply({ content: 'Invalid channel.' });
      return;
    }

    const thread = await (channel.threads as any).create({ name: threadName, type: ChannelType.PrivateThread, reason: `Ticket opened by ${interaction.user.tag}` }) as ThreadChannel;
    await thread.members.add(interaction.user.id);

    const ticketTemplates: Record<string, { content: string; embeds: any[] }> = {
      inquiry: {
        content: '<@USER_ID>',
        embeds: [{
          title: '🎫 Server Inquiry Ticket',
          description: '**<@USER_ID> has opened a Server Inquiry ticket.**\n\nA staff member will assist you shortly.\n\nPlease describe your question clearly so we can help you faster.',
          color: 5793266
        }]
      },
      report: {
        content: '<@USER_ID>',
        embeds: [{
          title: '🚨 Member Report Ticket',
          description: '**<@USER_ID> has opened a Member Report ticket.**\n\nPlease include:\n◦ User involved\n◦ What happened\n◦ Any proof (screenshots/logs)\n\nStaff will review this as soon as possible.',
          color: 15158332
        }]
      },
      staffreport: {
        content: '<@USER_ID>',
        embeds: [{
          title: '⚠️ Staff Report Ticket',
          description: '**<@USER_ID> has opened a Staff Report ticket.**\n\nPlease provide detailed information and any evidence regarding the situation.\n\nThis will be handled confidentially by senior staff.',
          color: 15548997
        }]
      },
      hsr: {
        content: '<@USER_ID>',
        embeds: [{
          title: '❓ HSR Question Ticket',
          description: '**<@USER_ID> has opened a HSR Question ticket.**\n\nPlease describe your question in detail so staff can assist you.',
          color: 955438
        }]
      }
    };

    const pingRoleId = getPingRole(guild.id, category);
    const pingMention = pingRoleId ? `<@&${pingRoleId}>` : `<@${interaction.user.id}>`;

    const tmpl = ticketTemplates[category] || ticketTemplates.inquiry;
    const introContent = tmpl.content.replace(/<@USER_ID>/g, pingMention);
    const introEmbeds = JSON.parse(JSON.stringify(tmpl.embeds));
    introEmbeds.forEach((e: any) => {
      if (e.description) e.description = e.description.replace(/<@USER_ID>/g, pingMention);
    });
    const introEmbedBuilders = introEmbeds.map((d: any) => {
      const e = new EmbedBuilder();
      if (d.title) e.setTitle(d.title);
      if (d.description) e.setDescription(d.description);
      if (d.color !== undefined) e.setColor(d.color);
      if (d.footer) e.setFooter({ text: d.footer.text, iconURL: d.footer.icon_url || d.footer.iconUrl });
      if (d.author) e.setAuthor({ name: d.author.name, iconURL: d.author.icon_url || d.author.iconUrl, url: d.author.url });
      if (d.fields) e.addFields(d.fields.map((f: any) => ({ name: f.name, value: f.value, inline: f.inline ?? false })));
      return e;
    });
    await thread.send({ content: introContent, embeds: introEmbedBuilders });

    if (pingRoleId) {
      thread.send({ content: `<@&${pingRoleId}>` }).then(m => {
        setTimeout(() => m.delete().catch(() => {}), 3000);
      }).catch(() => {});
    }

    const catMap: Record<string, string> = { inquiry: 'support', report: 'bug', staffreport: 'staff', hsr: 'other' };
    const ticket = createTicket(guild.id, thread.id, interaction.user.id, interaction.user.tag, catMap[category] as any, reason);
    await interaction.editReply({ content: `Ticket #${ticket.id} created: ${thread}` });
  } catch (e: any) {
    await interaction.editReply({ content: `Failed to create ticket thread: ${e.message}` });
  }
}
