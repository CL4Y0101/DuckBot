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
      .setTitle('`🔰` Roblox Username Verification')
      .setDescription(
        `### \`📋\` Instructions\n` +
        `-# Click the button below to start verifying your Roblox username\n` +
        `-# Make sure your Roblox account is linked properly\n` +
        `-# Verification helps us maintain a secure community\n\n` +
        `### \`⚠️\` Important Notes\n-# Only verify with your own Roblox account\n-# Contact admins if you encounter any issues`
      )
      .setColor('#5865F2')
      .setTimestamp();

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