const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set')
    .setDescription('Set channel untuk verifikasi username Roblox')
    .addSubcommandGroup(group =>
      group
      .setName('verify')
      .setDescription('Set channel untuk verifikasi username Roblox')
      .addSubcommand(subcommand =>
        subcommand
        .setName('channel')
        .setDescription('Set channel untuk verifikasi username Roblox')
        .addChannelOption(option =>
          option.setName('channel')
          .setDescription('Channel tempat verifikasi')
          .setRequired(true)
        )
      )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');

    const embed = new EmbedBuilder()
      .setTitle('🔰 Roblox Username Verification')
      .setDescription('Klik tombol di bawah untuk memverifikasi username Roblox kamu.')
      .setColor('#393a41');

    const button = new ButtonBuilder()
      .setCustomId('verify_button')
      .setLabel('Verify your username')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(button);

    await channel.send({
      embeds: [embed],
      components: [row]
    });
    await interaction.reply({
      content: `✅ Embed verifikasi dikirim ke ${channel}`,
      ephemeral: true
    });
  },
};