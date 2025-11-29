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
            .setDescription('Set channel untuk verifikasi (roblox or minecraft)')
            .addChannelOption(option =>
              option.setName('channel')
                .setDescription('Channel tempat verifikasi')
                .setRequired(true)
            )
            .addStringOption(opt =>
              opt.setName('type')
                .setDescription('Tipe verifikasi: roblox atau minecraft')
                .setRequired(true)
                .addChoices(
                  { name: 'roblox', value: 'roblox' },
                  { name: 'minecraft', value: 'minecraft' }
                )
            )
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const type = interaction.options.getString('type') || 'roblox';

    const attachment = new AttachmentBuilder('src/assets/img/profile.png', {
      name: 'profile.png'
    });

    let embed;
    let button;
    if (type === 'minecraft') {
      embed = new EmbedBuilder()
        .setTitle('`🔰` Minecraft (Venity) Guild Verification')
        .setDescription(
          `### \`📋\` Venity Verification Guide\n` +
          `> Click the button below labeled **Venity Verification Guild** to start the verification process.\n\n` +
          `• You will be asked to enter your Minecraft in-game name.\n` +
          `• The bot will search across the known Venity guilds for your membership and link your account.\n` +
          `• If found, the bot will fetch your Venity profile and store your **xuid** for future verification checks.`
        )
        .setImage('attachment://profile.png')
        .setColor('#4CAF50');

      button = new ButtonBuilder()
        .setCustomId('venity_verify_button')
        .setLabel('Venity Verification Guild')
        .setStyle(ButtonStyle.Success);
    } else {
      embed = new EmbedBuilder()
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
        .setColor('#5865F2');

      button = new ButtonBuilder()
        .setCustomId('verify_button_setup')
        .setLabel('Verify your username')
        .setStyle(ButtonStyle.Success);
    }

    const row = new ActionRowBuilder().addComponents(button);

    const messages = await channel.messages.fetch({
      limit: 50
    });
    const botMessage = messages.find(msg =>
      msg.author.id === interaction.client.user.id &&
      (
        (msg.embeds.length > 0 && (
          msg.embeds[0].title?.includes('Roblox Username Verification') ||
          msg.embeds[0].title?.includes('Minecraft (Venity) Guild Verification')
        )) ||
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
    try {
      const fs = require('fs');
      const path = require('path');
      const guildDbPath = path.join(__dirname, '../../database/guild.json');
      let raw = '[]';
      try { raw = fs.existsSync(guildDbPath) ? fs.readFileSync(guildDbPath, 'utf8') : '[]'; } catch { }
      let parsed = [];
      try { parsed = raw.trim() ? JSON.parse(raw) : []; } catch (e) { parsed = []; }

      const gid = interaction.guild.id;
      let modified = false;

      if (Array.isArray(parsed)) {
        let foundIdx = -1;
        for (let i = 0; i < parsed.length; i++) {
          const item = parsed[i];
          if (item && typeof item === 'object' && item[gid]) { foundIdx = i; break; }
        }
        if (foundIdx === -1) {
          const newCfg = {};
          newCfg[gid] = { Verification: {} };
          newCfg[gid].Verification[type] = channel.id;
          parsed.push(newCfg);
          modified = true;
        } else {
          const cfg = parsed[foundIdx][gid] = parsed[foundIdx][gid] || {};
          cfg.Verification = cfg.Verification || {};
          cfg.Verification[type] = channel.id;
          modified = true;
        }
      } else if (parsed && typeof parsed === 'object') {
        parsed[gid] = parsed[gid] || {};
        parsed[gid].Verification = parsed[gid].Verification || {};
        parsed[gid].Verification[type] = channel.id;
        modified = true;
      }

      if (modified) {
        try { fs.writeFileSync(guildDbPath, JSON.stringify(parsed, null, 2)); console.log(`💾 Updated guild.json verification channel for ${gid} (${type} -> ${channel.id})`); } catch (e) { console.error('❌ Failed to write guild.json', e); }
      }
    } catch (err) {
      console.error('❌ Error persisting verification channel:', err);
    }
  },
};