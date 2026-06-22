import {
  ChatInputCommandInteraction,
  ActionRowBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';

export default async function ticketMessageCreate(interaction: ChatInputCommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId('ticket_json_modal')
    .setTitle('Ticket Panel JSON');

  const jsonInput = new TextInputBuilder()
    .setCustomId('panel_json')
    .setLabel('Paste embed JSON')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('[{"title":"Title","description":"Desc","color":28232}]')
    .setRequired(true)
    .setMaxLength(4000);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(jsonInput));
  await interaction.showModal(modal);
}

export interface MessagePayload {
  content?: string;
  embeds: EmbedBuilder[];
}

export function parseMessageJson(json: string): MessagePayload {
  const parsed = JSON.parse(json);
  const arr = Array.isArray(parsed.embeds) ? parsed.embeds : [];
  const embeds = arr.map((d: any) => {
    const e = new EmbedBuilder();
    if (d.title) e.setTitle(d.title);
    if (d.description) e.setDescription(d.description);
    if (d.url) e.setURL(d.url);
    if (d.color !== undefined) e.setColor(d.color);
    if (d.timestamp) e.setTimestamp(new Date(d.timestamp));
    if (d.thumbnail?.url) e.setThumbnail(d.thumbnail.url);
    if (d.image?.url) e.setImage(d.image.url);
    if (d.footer) e.setFooter({ text: d.footer.text, iconURL: d.footer.icon_url || d.footer.iconUrl });
    if (d.author) e.setAuthor({ name: d.author.name, iconURL: d.author.icon_url || d.author.iconUrl, url: d.author.url });
    if (d.fields) e.addFields(d.fields.map((f: any) => ({ name: f.name, value: f.value, inline: f.inline ?? false })));
    return e;
  });
  return { content: parsed.content, embeds };
}