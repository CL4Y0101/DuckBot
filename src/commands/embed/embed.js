const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
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

        const description = interaction.fields.getTextInputValue('Description Input');
        const link = interaction.fields.getTextInputValue('Link Input');

        const embed = new EmbedBuilder()
            .setTitle('`🔐` Private Server Link')
            .setDescription(description)
            .setColor(0x0099FF);
        const button = new ButtonBuilder()
            .setLabel('Click Me')
            .setStyle(ButtonStyle.Link)
            .setURL(link);
        const row = new ActionRowBuilder().addComponents(button);
        await interaction.reply({
            embeds: [embed],
            components: [row]
        });

    }
};