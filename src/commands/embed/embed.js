const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const channel = '1421698609086464021';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Sends an embed with a link button.'),

    async execute(interaction) {
        if (!interaction.channel || interaction.channel.id !== channel) {
            return await interaction.reply({
                content: `❌ Command ini hanya dapat digunakan di <#${channel}>.`,
                ephemeral: true
            });
        }

        const modal = new ModalBuilder()
            .setCustomId('embed_modal')
            .setTitle('Create Embed');

        const descriptionInput = new TextInputBuilder()
            .setCustomId('description_input')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Enter the description for the embed')
            .setRequired(true);

        const linkInput = new TextInputBuilder()
            .setCustomId('link_input')
            .setLabel('Link')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter the link URL')
            .setRequired(true);

        const firstRow = new ActionRowBuilder().addComponents(descriptionInput);
        const secondRow = new ActionRowBuilder().addComponents(linkInput);

        modal.addComponents(firstRow, secondRow);

        await interaction.showModal(modal);
    }
};