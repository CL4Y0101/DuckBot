const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  AttachmentBuilder
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

    const attachment = new AttachmentBuilder('src/img/profile.png', {
      name: 'profile.png'
    });

    const embed = new EmbedBuilder()
      .setTitle('`🔰` Roblox Username Verification')
      .setDescription(
        `### \`📋\` Verification Guide\n` +
        `> Follow the steps below carefully to verify your Roblox account:\n\n` +
        `• Click the **Verify** button below to start the verification process.\n` +
        `• Ensure your Roblox account is correctly linked to your Discord profile.\n` +
        `• Verification keeps our community safe and authentic.\n` +
        `• To receive the role and join **Duck Void**, your **Roblox Display Name** must follow one of these formats:\n` +
        `\`DV_DisplayName\`, \`DVxDisplayName\`, \`DVDisplayName\`, \`DisplayNameDV\`, \`DisplayNamexDV\`, or \`DisplayNameDV\`.\n` +
        `> *(Replace \`DisplayName\` with your actual Roblox display name)*\n\n` +
        `### \`⚠️\` Important Notes\n` +
        `• Only verify using your **own Roblox account**.\n` +
        `• If you experience any issues, please contact an **Admin** for assistance.`
      )
      .setImage('attachment://profile.png')
      .setColor('#5865F2')
      .setTimestamp();


    const button = new ButtonBuilder()
      .setCustomId('verify_button_setup')
      .setLabel('Verify your username')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(button);

    const messages = await channel.messages.fetch({
      limit: 50
    });
    const botMessage = messages.find(msg =>
      msg.author.id === interaction.client.user.id &&
      (
        (msg.embeds.length > 0 && msg.embeds[0].title?.includes('Roblox Username Verification')) ||
        (msg.content.includes('kadaluarsa') && msg.components.length > 0)
      )
    );

    if (botMessage) {
      await botMessage.edit({
        content: '',
        embeds: [embed],
        components: [row],
        files: [attachment]
      });
      await interaction.reply({
        content: `✅ Pesan verifikasi diperbarui di ${channel}`,
        ephemeral: true
      });
    } else {
      await channel.send({
        embeds: [embed],
        components: [row],
        files: [attachment]
      });
      await interaction.reply({
        content: `✅ Embed verifikasi dikirim ke ${channel}`,
        ephemeral: true
      });
    }
  },
};